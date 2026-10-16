"""Count literal word-head occurrences from pinned, auditable past-paper text."""
import pathlib,json,re,hashlib,collections,unicodedata
ROOT=pathlib.Path(__file__).parent.parent/'corpora'
DIST=pathlib.Path(__file__).parent/'dist'
TOKEN=re.compile(r"[a-z]+(?:[-'][a-z]+)*")

def normalize(text,latex=False):
    text=unicodedata.normalize('NFKC',text).replace('\u2019',"'").replace('\u2018',"'")
    text=text.replace('\u2013','-').replace('\u2014','-')
    if latex:
        text=re.sub(r'(?<!\\)%[^\n]*',' ',text)
        text=re.sub(r'\\(?:begin|end)\{[^}]+\}',' ',text)
        text=re.sub(r'\\[a-zA-Z]+\*?(?:\[[^\]]*\])?',' ',text)
        text=re.sub(r'\\[^a-zA-Z]',' ',text)
    return text.lower()

def tokenize(text,latex=False):
    return TOKEN.findall(normalize(text,latex))

def enrich_exam_counts(words,meta,basic_levels=None):
    manifests={k:json.loads((ROOT/(k+'-manifest.json')).read_text(encoding='utf-8')) for k in ['cet6','ky']}
    papers=[];excluded=[];seen=set()
    for f in sorted(manifests['cet6']['files'],key=lambda f:f['path']):
        text=(ROOT/'cet6'/f['path']).read_text(encoding='utf-8-sig')
        tokens=tokenize(text)
        # Titles differ in duplicates. Ignore leading title text before Part I.
        body=re.split(r'part\s+i\b',normalize(text),maxsplit=1)
        signature=hashlib.sha256(' '.join(TOKEN.findall(body[-1])).encode()).hexdigest()
        if signature in seen:
            excluded.append({'path':f['path'],'reason':'卷面英文与已收录试卷重复，按词序列去重'})
            continue
        seen.add(signature)
        name=pathlib.PurePosixPath(f['path']).stem
        year=int(name[:4]);month=name[5:7];number=name[-2:]
        papers.append({'id':f'cet6-{year}-{month}-{number}','exam':'cet6','year':year,'label':f'{year}年{int(month)}月 六级第{int(number)}套','sourceUrl':f['url'],'files':[f], 'counts':collections.Counter(tokens)})
    grouped=collections.defaultdict(list)
    for f in manifests['ky']['files']:
        course,year,*_=f['path'].split('/')
        grouped[(course,year)].append(f)
    for (course,year),files in sorted(grouped.items()):
        counts=collections.Counter()
        for f in files:counts.update(tokenize((ROOT/'ky'/f['path']).read_text(encoding='utf-8-sig'),latex=True))
        exam='ky1' if course=='201' else 'ky2'
        manifest=manifests['ky']
        papers.append({'id':f'{exam}-{year}','exam':exam,'year':int(year),'label':f'{year}年 英语{"一" if exam=="ky1" else "二"} · 完形与阅读','sourceUrl':f'https://github.com/{manifest["repo"]}/tree/{manifest["commit"]}/{course}/{year}','files':sorted(files,key=lambda f:f['path']),'counts':counts})
    definitions={
        'cet6':{'name':'大学英语六级','scope':'卷面英文，含题干、选项、写作提示及说明；不含未收录的听力原文，不含答案解析。'},
        'ky1':{'name':'考研英语一','scope':'完形填空与阅读理解的文章、题干和选项；不含新题型、翻译、写作及答案解析。'},
        'ky2':{'name':'考研英语二','scope':'完形填空与阅读理解的文章、题干和选项；不含新题型、翻译、写作及答案解析。'}
    }
    for exam,definition in definitions.items():
        subset=[p for p in papers if p['exam']==exam]
        definition.update(papers=len(subset),start=min(p['year'] for p in subset),end=max(p['year'] for p in subset),source='https://github.com/'+manifests['cet6' if exam=='cet6' else 'ky']['repo'])
    for w in words:
        w['exams']={}
        for exam in definitions:
            hits=[[p['id'],p['counts'][w['word']]] for p in papers if p['exam']==exam and p['counts'][w['word']]]
            w['exams'][exam]={'count':sum(n for _,n in hits),'papers':len(hits),'hits':hits}
            track='cet6' if exam=='cet6' else 'ky'
            if hits and track not in w['tracks']:w['tracks'].append(track)
        tags=w.get('tags',[])
        w['difficulty']='junior' if 'zk' in tags else 'high' if 'gk' in tags else 'cet4' if 'cet4' in tags else 'advanced'
        # Inflected forms inherit their basic lemma's school level as well.
        lemma=next((part[2:] for part in w.get('exchange','').split('/') if part.startswith('0:')),w['word'])
        inherited=(basic_levels or {}).get(lemma)
        if inherited=='junior' or inherited=='high' and w['difficulty']!='junior':w['difficulty']=inherited
        # General corpus ranks are deliberately not exposed as exam counts.
        w.pop('frq',None);w.pop('bnc',None)
    words.sort(key=lambda w:(-sum(e['count'] for e in w['exams'].values()),w['word']))
    for i,w in enumerate(words,1):w['rank']=i
    meta.update(version=2,collected='2026-10-16',exams=definitions,
        method='按当前所选考试的真题文本中，词头原拼写的累计出现次数降序排列；同次按单词字母排序。大小写合并，连字符和撇号词作为一个词；不合并复数、过去式等词形，不使用通用语料名次。',
        scope='统计仅覆盖下列已收录真题文本；0次表示当前样本未检出，不代表历年从未考过。各考试分别计数。考研样本仅含完形和阅读；六级不含缺失的听力原文。文本由第三方整理，存在拼写、排版或漏录误差，未经逐字人工校对。',
        levelMethod='初中/高中基础词依据ECDICT的zk/gk标签划分；不永久删除，默认在新词推荐中排除，可在词库查看并手动加入。考试分数只用于选择初始过滤设置。')
    counts={track:sum(track in w['tracks'] for w in words) for track in ['ky','cet6']}
    counts.update(total=len(words),both=sum(len(w['tracks'])==2 for w in words),junior=sum(w['difficulty']=='junior' for w in words),high=sum(w['difficulty']=='high' for w in words))
    meta['counts']=counts
    meta['examSources']=[{'name':'六级逐卷文本','url':'https://github.com/'+manifests['cet6']['repo'],'commit':manifests['cet6']['commit']},{'name':'考研英语一/二：完形与阅读','url':'https://github.com/'+manifests['ky']['repo'],'commit':manifests['ky']['commit']}]
    # Publish aggregate counts and links/hashes. Do not redistribute full papers.
    report={'version':1,'method':meta['method'],'scope':meta['scope'],'exams':definitions,'excluded':excluded,'papers':[{k:v for k,v in p.items() if k!='counts'} for p in papers]}
    (DIST/'exam-papers.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (pathlib.Path(__file__).parent/'corpus-manifest.json').write_text(json.dumps(manifests,ensure_ascii=False,indent=2),encoding='utf-8')
    print('EXAMS',json.dumps(definitions,ensure_ascii=True))
    print('EXCLUDED',json.dumps(excluded,ensure_ascii=True))
    return words,meta
