import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankState,ensureDay,grade,dueWords,addDays,streak,mergeState,validateImport,makeProfile,eligibleNew,examCount,orderedWords,refreshPlan,markKnown,basicExcluded} from '../dist/core.js';
const words=Array.from({length:30},(_,i)=>({word:'word'+String.fromCharCode(97+i),rank:i+1,tracks:i<15?['ky']:['cet6'],difficulty:'advanced',exams:{ky1:{count:i<15?30-i:0},ky2:{count:0},cet6:{count:i>=15?30-i:0}}}));
const today='2026-10-15';
test('daily plan chooses ten, freezes after starting, and resumes across mode changes',()=>{
  const state=blankState(),d=ensureDay(state,words,today);assert.equal(d.plan.length,10);assert.deepEqual(d.plan,words.slice(0,10).map(w=>w.word));
  d.started=true;grade(state,words[0],'good','new',today);state.mode='cet6';assert.equal(ensureDay(state,words,today),d);assert.equal(d.done.length,1);
  for(const w of words.slice(1,10))grade(state,w,'good','new',today);
  assert.equal(ensureDay(state,words,today).done.length,10);assert.equal(ensureDay(state,words,today).plan.length,10);
  const tomorrow=ensureDay(state,words,addDays(today,1));assert.ok(tomorrow.plan.every(k=>words.find(w=>w.word===k).tracks.includes('cet6')));
});
test('changing a mode before the first study updates the daily selection',()=>{
  const s=blankState();ensureDay(s,words,today);s.mode='cet6';const d=ensureDay(s,words,today);assert.equal(d.plan[0],words[15].word);
});
test('forgotten cards remain unfinished and correct answers schedule intervals',()=>{
  const s=blankState();ensureDay(s,words,today);const w=words[0];grade(s,w,'again','new',today);assert.equal(s.days[today].done.length,0);assert.equal(s.records[w.word].learnedAt,undefined);
  grade(s,w,'good','new',today);assert.equal(s.records[w.word].due,'2026-10-16');assert.equal(s.records[w.word].level,0);assert.equal(s.records[w.word].lapses,1);
  assert.equal(dueWords(s,words,today).length,0);ensureDay(s,words,'2026-10-16');assert.equal(dueWords(s,words,'2026-10-16').length,1);
  grade(s,w,'good','review','2026-10-16');assert.equal(s.records[w.word].due,'2026-10-19');assert.equal(dueWords(s,words,'2026-10-16').length,0);
  grade(s,w,'again','review','2026-10-19');assert.equal(s.records[w.word].level,0);assert.equal(s.records[w.word].due,'2026-10-19');
});
test('very familiar first answer starts a three day interval and no duplicate daily counts',()=>{
  const s=blankState();ensureDay(s,words,today);grade(s,words[0],'easy','new',today);grade(s,words[0],'good','new',today);assert.equal(s.days[today].done.length,1);
  const other=blankState();ensureDay(other,words,today);grade(other,words[0],'easy','new',today);assert.equal(other.records[words[0].word].due,'2026-10-18');
});
test('overdue cards remain due and respect the selected exam',()=>{
  const s=blankState();ensureDay(s,words,today);grade(s,words[0],'good','new',today);grade(s,words[15],'good','new',today);
  s.mode='ky';assert.deepEqual(dueWords(s,words,'2026-10-25').map(w=>w.word),[words[0].word]);
});
test('date arithmetic handles leap years and streaks count review days',()=>{
  assert.equal(addDays('2028-02-28',1),'2028-02-29');assert.equal(addDays('2026-12-31',1),'2027-01-01');
  const s=blankState();s.days['2026-10-14']={done:['a'],reviews:[]};s.days[today]={done:[],reviews:['b']};assert.equal(streak(s,today),2);assert.equal(streak(s,'2026-10-17'),0);
});
test('backup validation rejects corrupt or unknown words and invalid dates',()=>{
  const s=blankState();ensureDay(s,words,today);grade(s,words[0],'good','new',today);assert.deepEqual(validateImport(s,words),s);
  const bad=structuredClone(s);bad.records[words[0].word].due='2026-02-30';assert.throws(()=>validateImport(bad,words));
  assert.throws(()=>validateImport({...s,records:{unknown:{}}},words));
});
test('merging two devices preserves progress and limits one daily plan to ten',()=>{
  const a=blankState(),b=blankState();ensureDay(a,words,today);b.mode='cet6';ensureDay(b,words,today);
  for(const w of words.slice(0,8))grade(a,w,'good','new',today);
  for(const w of words.slice(15,23))grade(b,w,'good','new',today);
  const merged=mergeState(a,b);assert.equal(merged.days[today].plan.length,10);assert.equal(merged.days[today].done.length,10);assert.equal(Object.keys(merged.records).length,16);assert.doesNotThrow(()=>validateImport(merged,words));
});
test('bundled dictionary is unique, sorted by actual paper occurrences, and counts match',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../dist/words.json',import.meta.url),'utf8'));
  assert.equal(new Set(data.words.map(w=>w.word)).size,data.words.length);assert.equal(data.meta.counts.total,data.words.length);
  let last=Infinity;
  for(const w of data.words){assert.ok(w.translation&&w.tracks.length);const score=Object.values(w.exams).reduce((n,x)=>n+x.count,0);assert.ok(score<=last);last=score;assert.equal(w.frq,undefined);assert.equal(w.bnc,undefined);for(const x of Object.values(w.exams)){assert.equal(x.count,x.hits.reduce((n,hit)=>n+hit[1],0));assert.equal(x.papers,x.hits.length);}}
  for(const track of ['ky','cet6'])assert.equal(data.meta.counts[track],data.words.filter(w=>w.tracks.includes(track)).length);
});
test('CET6 passed profile excludes junior and high-school words without faking learned records',()=>{
  const s=blankState();s.profile=makeProfile('cet6',504);const junior={...words[0],difficulty:'junior'},high={...words[1],difficulty:'high'};
  assert.equal(eligibleNew(s,junior),false);assert.equal(eligibleNew(s,high),false);assert.equal(eligibleNew(s,words[2]),true);assert.deepEqual(s.records,{});
  s.includeWords=[junior.word];assert.equal(eligibleNew(s,junior),true);
});
test('new recommendations contain only words found in the selected exam sample',()=>{
  const s=blankState();const absent={...words[0],exams:{ky1:{count:0},ky2:{count:0},cet6:{count:0}}};assert.equal(eligibleNew(s,absent),false);
  s.profile=makeProfile('cet6',504,{kyPaper:'ky2'});s.mode='ky';assert.equal(examCount(words[0],s),0);assert.equal(eligibleNew(s,words[0]),false);
});
test('marking known replaces a card without consuming one of ten daily new words',()=>{
  const s=blankState();s.mode='ky';s.profile=makeProfile('cet6',504);ensureDay(s,words,today);grade(s,words[0],'good','new',today);
  const old=s.days[today].plan[1];markKnown(s,old,words,today);assert.equal(s.days[today].done.length,1);assert.equal(s.days[today].plan.length,10);assert.equal(s.days[today].plan.includes(old),false);assert.equal(s.records[old],undefined);assert.equal(s.knownWords.includes(old),true);
  const restored=validateImport(JSON.parse(JSON.stringify(s)),words);assert.equal(ensureDay(restored,words,today).plan.includes(old),false);
});
test('changing level immediately rebuilds remaining plan and preserves completed progress',()=>{
  const list=words.map((w,i)=>({...w,difficulty:i===1?'junior':'advanced'})),s=blankState();ensureDay(s,list,today);grade(s,list[0],'good','new',today);s.profile=makeProfile('cet6',504);refreshPlan(s,list,today);assert.equal(s.days[today].done.length,1);assert.equal(s.days[today].plan.includes(list[1].word),false);assert.equal(s.days[today].plan.length,10);
});
test('old backups migrate without losing records and new profile/known words survive merge',()=>{
  const a=blankState();ensureDay(a,words,today);grade(a,words[0],'good','new',today);delete a.profile;delete a.knownWords;delete a.includeWords;
  const migrated=validateImport(a,words);assert.equal(migrated.records[words[0].word].learnedAt,today);assert.equal(migrated.profile,null);
  const b=blankState();b.profile=makeProfile('cet6',504);b.knownWords=[words[1].word];const merged=mergeState(migrated,b);assert.equal(merged.profile.score,504);assert.deepEqual(merged.knownWords,[words[1].word]);
});
test('basic lemma forms are also filtered and real default plan contains no beginner words',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../dist/words.json',import.meta.url),'utf8'));const s=blankState();s.profile=makeProfile('cet6',504);
  for(const word of ['take','given','learning','marked'])assert.equal(basicExcluded(s,data.words.find(w=>w.word===word)),true);
  const d=ensureDay(s,data.words,today);assert.equal(d.plan.length,10);for(const key of d.plan){const w=data.words.find(w=>w.word===key);assert.ok(!['junior','high'].includes(w.difficulty));assert.ok(examCount(w,s)>0);}
});
