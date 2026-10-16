import sys,pathlib,re,json,unittest,collections
BASE=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE))
from exam_corpus import tokenize

class CorpusTests(unittest.TestCase):
    def test_literal_counting_and_case(self):
        words=collections.Counter(tokenize('Impact impact impacts IMPACT. Economic economics.'))
        self.assertEqual(words['impact'],3)
        self.assertEqual(words['impacts'],1)
        self.assertEqual(words['economic'],1)
    def test_latex_control_words_are_not_exam_vocabulary(self):
        words=tokenize(r'\begin{tasks}\task Economic impact.\end{tasks} % comment',latex=True)
        self.assertEqual(words,['economic','impact'])
    def test_paper_inventory_and_aggregates(self):
        data=json.loads((BASE/'dist'/'words.json').read_text(encoding='utf-8'))
        papers=json.loads((BASE/'dist'/'exam-papers.json').read_text(encoding='utf-8'))
        ids={p['id']:p for p in papers['papers']}
        self.assertEqual(len(ids),95)
        self.assertEqual(data['meta']['exams']['cet6']['papers'],62)
        for word in data['words']:
            for exam,stats in word['exams'].items():
                for key,count in stats['hits']:
                    self.assertEqual(ids[key]['exam'],exam)
                    self.assertGreater(count,0)
                self.assertEqual(stats['count'],sum(n for _,n in stats['hits']))
    def test_known_word_against_source_text(self):
        root=BASE.parent/'corpora'
        if not (root/'cet6').exists():self.skipTest('Run fetch_exam_corpus.py to independently recount source files')
        data=json.loads((BASE/'dist'/'words.json').read_text(encoding='utf-8'))
        target=next(w for w in data['words'] if w['word']=='economic')
        # Independent literal-token regex; not the production tokenizer.
        total=0
        for path in (root/'cet6').rglob('*.txt'):
            text=path.read_text(encoding='utf-8-sig').lower().replace('\u2019',"'").replace('\u2018',"'")
            total+=len(re.findall(r"(?<![a-z])(?<![a-z]['-])economic(?![a-z]|['-][a-z])",text))
        self.assertEqual(target['exams']['cet6']['count'],total)

if __name__=='__main__':unittest.main()
