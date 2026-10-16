import csv, json, pathlib, re, shutil, hashlib

BASE = pathlib.Path(__file__).parent
DATA = BASE.parent / 'data'
DIST = BASE / 'dist'
entries = {}
basic_levels = {}
def valid(word):
    return bool(re.fullmatch(r"[a-z]+(?:[-'][a-z]+)*", word))
for filename, track in [('kaoyan.json','ky'),('cet6.json','cet6')]:
    for row in json.loads((DATA / filename).read_text(encoding='utf-8')):
        word = row['name'].strip().lower()
        if not valid(word): continue
        item = entries.setdefault(word, {'word':word,'tracks':[], 'sources':[]})
        if track not in item['tracks']: item['tracks'].append(track)
        item['sources'].append('qwerty-'+track)
        item.setdefault('translation','\n'.join(row.get('trans',[])))
        item.setdefault('phonetic',row.get('ukphone') or row.get('usphone') or '')
        if row.get('usphone'): item['usphone'] = row['usphone']
with (DATA / 'ecdict.csv').open(encoding='utf-8-sig',newline='') as f:
    for row in csv.DictReader(f):
        word = row['word'].strip().lower()
        tags = row['tag'].split()
        if 'zk' in tags: basic_levels[word] = 'junior'
        elif 'gk' in tags: basic_levels[word] = 'high'
        tracks = [tag for tag in ['ky','cet6'] if tag in row['tag'].split()]
        if not valid(word) or (not tracks and word not in entries): continue
        if not row.get('translation') and word not in entries: continue
        item = entries.setdefault(word, {'word':word,'tracks':[], 'sources':[]})
        for track in tracks:
            if track not in item['tracks']: item['tracks'].append(track)
        if 'ecdict' not in item['sources']: item['sources'].append('ecdict')
        item['tags'] = row['tag'].split()
        if row.get('translation'): item['translation'] = row['translation'].replace('\\n','\n')
        if row.get('phonetic'): item['phonetic'] = row['phonetic']
        if row.get('exchange'): item['exchange'] = row['exchange']
        if row.get('definition'): item['definition'] = row['definition'].replace('\\n','\n')
words = list(entries.values())
words.sort(key=lambda w: w['word'])
for i,item in enumerate(words,1):
    item['rank'] = i
counts = {track:sum(track in x['tracks'] for x in words) for track in ['ky','cet6']}
counts.update(total=len(words),both=sum(len(x['tracks'])==2 for x in words))
metadata = {
    'version':1,'collected':'2026-10-15','counts':counts,
    'method':'由exam_corpus.py逐卷统计原词出现次数。',
    'scope':'公开词表与ECDICT考试标签的并集，统一小写词头。',
    'sources':[
      {'name':'ECDICT','url':'https://github.com/skywind3000/ECDICT','license':'MIT','file':'ecdict.csv','sha256':hashlib.sha256((DATA/'ecdict.csv').read_bytes()).hexdigest()},
      {'name':'Qwerty Learner · 考研2024','url':'https://github.com/RealKai42/qwerty-learner/blob/master/public/dicts/KaoYan_2024.json','license':'GPL-3.0','file':'kaoyan.json','sha256':hashlib.sha256((DATA/'kaoyan.json').read_bytes()).hexdigest()},
      {'name':'Qwerty Learner · CET6','url':'https://github.com/RealKai42/qwerty-learner/blob/master/public/dicts/CET6_T.json','license':'GPL-3.0','file':'cet6.json','sha256':hashlib.sha256((DATA/'cet6.json').read_bytes()).hexdigest()}
    ]
}
from exam_corpus import enrich_exam_counts
words, metadata = enrich_exam_counts(words, metadata, basic_levels)
from attach_senses import attach
words, metadata = attach(words, metadata)
(DIST/'words.json').write_text(json.dumps({'meta':metadata,'words':words},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
licenses = DIST/'licenses'
licenses.mkdir(exist_ok=True)
for name in ['ECDICT-LICENSE.txt','QWERTY-LICENSE.txt']:
    shutil.copyfile(DATA/name,licenses/name)
(BASE/'LICENSE').write_bytes((DATA/'QWERTY-LICENSE.txt').read_bytes())
print(json.dumps(metadata['counts']))
print(json.dumps([{'word':w['word'],'examCount':sum(x['count'] for x in w['exams'].values())} for w in words[:10]]))
