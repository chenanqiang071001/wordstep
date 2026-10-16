// Sense priorities are calculated only from the reviewed contexts of the
// currently selected exams. A word's total frequency never becomes a sense count.
export function spellingGloss(gloss,headword) {
  const safe=String(headword).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return String(gloss).replace(/[（(][^()（）]*[a-zA-Z][^()（）]*[）)]/g,'').replace(new RegExp('\\b'+safe+'\\b','gi'),'____').trim();
}
export function dictionaryFocus(word) {
  const lines=String(word.translation||'').split('\n');
  const result=[];
  for(const line of lines){
    if(/^\s*\[/.test(line))continue;
    const match=line.trim().match(/^((?:(?:vt|vi|v|n|a|adj|adv|prep|pron|conj|aux|num|int|art)\.?\s*\/?)+)\s*(.*)$/i);
    const pos=match?match[1].trim():'';
    const body=match?match[2]:line;
    for(const piece of body.split(/[,，;；、]/)){
      const gloss=piece.trim();
      if(!gloss||gloss.length>35||/^\[/.test(gloss)||result.some(r=>r.gloss===gloss))continue;
      result.push({id:'dictionary-'+result.length,pos,gloss,count:null,evidence:[]});
      if(result.length===2)return result;
    }
  }
  if(!result.length&&word.translation)result.push({id:'dictionary-0',pos:'',gloss:String(word.translation).split('\n')[0].slice(0,70),count:null,evidence:[]});
  return result;
}

export function senseFocus(word,keys) {
  const review=word.senseReview;
  const total=keys.reduce((n,key)=>n+(word.exams?.[key]?.count||0),0);
  if(!review)return {kind:'dictionary',senses:dictionaryFocus(word),total,inspected:0,classified:0,unknown:0,scope:'词典义，词义考频待核对'};
  const aggregate=new Map(review.senses.map(s=>[s.id,{...s,count:0,evidence:[]}]));
  let inspected=0,classified=0,unknown=0;
  for(const key of keys){
    const exam=review.exams[key];if(!exam)continue;
    inspected+=exam.inspected;classified+=exam.classified;unknown+=exam.unknown;
    for(const sample of exam.samples){
      if(sample.senseId===null)continue;
      const sense=aggregate.get(sample.senseId);if(!sense)continue;
      sense.count++;sense.evidence.push({...sample,exam:key});
    }
  }
  const ranked=[...aggregate.values()].filter(s=>s.count>0).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id,'en'));
  if(!ranked.length)return {kind:'dictionary',senses:dictionaryFocus(word),total,inspected,classified,unknown,scope:'当前考试暂无足够归义语境'};
  // Do not force users to learn a marginal second sense seen only once.
  const senses=[ranked[0]];
  if(ranked[1]&&ranked[1].count>=Math.max(2,ranked[0].count*.15))senses.push(ranked[1]);
  return {kind:'reviewed',senses,allSenses:ranked,total,inspected,classified,unknown,complete:inspected===total,scope:'已核对真题语境中的优先义',note:review.note||''};
}
