import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {senseFocus,dictionaryFocus,spellingGloss} from '../dist/senses.js';
const sense=(id,pos,gloss)=>({id,pos,gloss});
const row=(id)=>({senseId:id,paperId:'paper',path:'file',tokenIndex:0});
const word={word:'sample',translation:'n. 词典第一义, 次要义\nvt. 别的意思',exams:{cet6:{count:100},ky1:{count:9},ky2:{count:0}},senseReview:{senses:[sense('finance','n.','资本；资金'),sense('city','n.','首都；中心城市')],exams:{cet6:{inspected:6,classified:5,unknown:1,samples:[row('finance'),row('finance'),row('finance'),row('finance'),row('city'),row(null)]},ky1:{inspected:4,classified:4,unknown:0,samples:[row('city'),row('city'),row('city'),row('finance')]}}}};
test('meaning priorities change by selected exam rather than dictionary order',()=>{
  assert.equal(senseFocus(word,['cet6']).senses[0].id,'finance');
  assert.equal(senseFocus(word,['ky1']).senses[0].id,'city');
  assert.equal(senseFocus(word,['cet6']).senses[0].count,4);
});
test('word frequency is never silently converted to sense frequency',()=>{
  const f=senseFocus(word,['cet6']);assert.equal(f.total,100);assert.equal(f.inspected,6);assert.equal(f.classified,5);assert.equal(f.unknown,1);assert.equal(f.complete,false);assert.equal(f.allSenses.reduce((n,s)=>n+s.count,0),5);
});
test('combine only chosen exam context counts and show at most two focus meanings',()=>{
  const f=senseFocus(word,['cet6','ky1']);assert.equal(f.senses.length,2);assert.equal(f.senses[0].count,5);assert.equal(f.senses[1].count,4);assert.equal(f.total,109);assert.equal(f.inspected,10);
});
test('do not force a marginal one-occurrence secondary sense into the learning burden',()=>{
  const f=senseFocus(word,['cet6']);assert.equal(f.senses.length,1);assert.equal(f.allSenses.length,2);
});
test('unreviewed meanings are clearly fallback and carry no invented sense counts',()=>{
  const f=senseFocus({...word,senseReview:undefined},['cet6']);assert.equal(f.kind,'dictionary');assert.equal(f.inspected,0);assert.ok(f.senses.length<=2);assert.ok(f.senses.every(s=>s.count===null));
  assert.equal(senseFocus(word,['ky2']).kind,'dictionary');
});
test('dictionary fallback excludes specialist-only lines and keeps full source unchanged',()=>{
  const w={translation:'n. 应用, 申请\n[医] 专门术语'};assert.equal(dictionaryFocus(w).length,2);assert.equal(dictionaryFocus(w)[0].gloss,'应用');assert.equal(w.translation,'n. 应用, 申请\n[医] 专门术语');
});
test('spelling prompts retain Chinese meaning without revealing the answer inside collocations',()=>{
  assert.equal(spellingGloss('考虑；重视（take account of）','account'),'考虑；重视');
  assert.equal(spellingGloss('占（比例）','account'),'占（比例）');
  assert.equal(spellingGloss('account for：解释原因','account'),'____ for：解释原因');
});
test('every attached sense sample preserves exact audit scope and totals',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../dist/words.json',import.meta.url),'utf8'));
  const reviewed=data.words.filter(w=>w.senseReview);assert.ok(reviewed.length>=200,'reviewed dataset must be bundled');
  assert.equal(data.meta.senseReview.words,reviewed.length);
  for(const w of reviewed){
    const ids=new Set(w.senseReview.senses.map(s=>s.id));
    for(const [exam,e] of Object.entries(w.senseReview.exams)){
      assert.equal(e.total,w.exams[exam].count);assert.ok(e.inspected<=e.total);assert.equal(e.inspected,e.samples.length);assert.equal(e.classified+e.unknown,e.inspected);
      assert.equal(Object.values(e.counts).reduce((n,x)=>n+x,0),e.classified);assert.equal(e.samples.filter(r=>r.senseId===null).length,e.unknown);assert.ok(e.samples.every(r=>r.senseId===null||ids.has(r.senseId)));
    }
  }
});
test('independently checked exam examples select problem-solving address and method approach',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../dist/words.json',import.meta.url),'utf8'));
  const address=data.words.find(w=>w.word==='address'),approach=data.words.find(w=>w.word==='approach');
  assert.match(senseFocus(address,['cet6']).senses[0].gloss,/处理|应对/);
  assert.match(senseFocus(approach,['cet6']).senses[0].gloss,/方法|方式|做法/);
});
