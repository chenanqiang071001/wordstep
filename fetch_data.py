import urllib.request, json, pathlib, concurrent.futures

ROOT = pathlib.Path(__file__).parent / 'data'
ROOT.mkdir(exist_ok=True)
URLS = {
    'ecdict.csv': 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
    'ECDICT-LICENSE.txt': 'https://raw.githubusercontent.com/skywind3000/ECDICT/master/LICENSE',
    'QWERTY-LICENSE.txt': 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/LICENSE',
    'cet6.json': 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET6_T.json',
    'kaoyan.json': 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/KaoYan_2024.json',
}
def fetch(pair):
    name, url = pair
    target = ROOT / name
    if not target.exists():
        with urllib.request.urlopen(url, timeout=180) as response:
            target.write_bytes(response.read())
    return {'file':name, 'bytes':target.stat().st_size}
if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(fetch, URLS.items()):
            print(json.dumps(result), flush=True)
    for name in ['cet6.json','kaoyan.json']:
        data = json.loads((ROOT / name).read_text(encoding='utf-8'))
        print(name,len(data),json.dumps(data[:2],ensure_ascii=True))
