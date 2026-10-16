"""Validate and attach sense annotations; never infer counts from dictionary order."""
import pathlib,json,collections
BASE=pathlib.Path(__file__).parent

def attach(words,meta):
    filename=BASE/'sense-annotations.json'
    if not filename.exists():return words,meta
    source=json.loads(filename.read_text(encoding='utf-8'))
    papers=json.loads((BASE/'dist/exam-papers.json').read_text(encoding='utf-8'))
    paper_map={p['id']:p for p in papers['papers']}
    by_word={w['word']:w for w in words}
    reviewed=0;inspected=0;classified=0
    seen_words=set()
    for item in source['words']:
        word=item['word'];assert word in by_word and word not in seen_words,word
        seen_words.add(word)
        senses=item['senses'];ids={s['id'] for s in senses}
        assert len(ids)==len(senses) and all(s['gloss'].strip() and len(s['gloss'])<=100 for s in senses),word
        exams={}
        for key,rows in item['exams'].items():
            assert key in {'cet6','ky1','ky2'},(word,key)
            unique=set()
            for row in rows:
                p=paper_map[row['paperId']]
                assert p['exam']==key,(word,key)
                assert row['path'] in {f['path'] for f in p['files']},(word,row)
                assert isinstance(row['tokenIndex'],int) and row['tokenIndex']>=0
                occurrence=(row['paperId'],row['path'],row['tokenIndex'])
                assert occurrence not in unique,(word,occurrence)
                unique.add(occurrence)
                assert row['senseId'] is None or row['senseId'] in ids,(word,row)
            total=by_word[word]['exams'][key]['count']
            assert len(rows)<=total,(word,key)
            counts=collections.Counter(row['senseId'] for row in rows if row['senseId'] is not None)
            unknown=sum(row['senseId'] is None for row in rows)
            exams[key]={'total':total,'inspected':len(rows),'classified':sum(counts.values()),'unknown':unknown,'counts':dict(counts),'samples':rows}
            inspected+=len(rows);classified+=sum(counts.values())
        by_word[word]['senseReview']={'method':'context-sample-assisted-review','senses':senses,'exams':exams,'note':item.get('note','')}
        reviewed+=1
    meta['senseReview']={'version':1,'words':reviewed,'inspected':inspected,'classified':classified,'method':'按当前各考种的已核对语境归义，只展示其中更常见的1–2个义项。每考试按固定散列选择最多14条语境；不对未核对处估算词义，不把原词总次数当作词义次数。未归义语境保留为空。','fallback':'未核对词使用明确标为“考频待核对”的精简词典义，完整释义可展开。'}
    return words,meta

if __name__=='__main__':
    path=BASE/'dist/words.json'
    data=json.loads(path.read_text(encoding='utf-8'))
    for w in data['words']:w.pop('senseReview',None)
    data['words'],data['meta']=attach(data['words'],data['meta'])
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps(data['meta'].get('senseReview',{}),ensure_ascii=True))
