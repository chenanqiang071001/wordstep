import urllib.request, pathlib, zipfile, io, json, hashlib, re
ROOT=pathlib.Path(__file__).parent/'corpora'
REPOS={
 'cet6':('AndrewYuZhenYu/cet6_exam_questions_txt_collection','fed0636592f7bceee518419fc00b3739b615e6cc'),
 'ky':('pfoocc/201_204_kaoyan','f52a3e7e457af13e66ab9c88fb15eba136f9d0ed')
}
for name,(repo,sha) in REPOS.items():
    target=ROOT/name
    target.mkdir(exist_ok=True)
    url=f'https://codeload.github.com/{repo}/zip/{sha}'
    with urllib.request.urlopen(url,timeout=120) as response: archive=zipfile.ZipFile(io.BytesIO(response.read()))
    selected=[]
    for file in archive.namelist():
        rel=file.split('/',1)[-1]
        wanted=bool(re.fullmatch(r'cet6_zhenti_cleaned/\d{4}-\d{2}[-_]\d{2}\.txt',rel)) if name=='cet6' else bool(re.fullmatch(r'20[14]/\d{4}/(?:cloze|read)/(?:articles\d*|options\d*)\.tex',rel))
        if not wanted: continue
        data=archive.read(file)
        path=target/rel
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
        selected.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'url':f'https://github.com/{repo}/blob/{sha}/{rel}'})
    (ROOT/(name+'-manifest.json')).write_text(json.dumps({'repo':repo,'commit':sha,'files':selected},ensure_ascii=False,indent=2),encoding='utf-8')
    print(name,len(selected),'files',flush=True)
    print((target/selected[0]['path']).read_text(encoding='utf-8-sig')[:1700],flush=True)
