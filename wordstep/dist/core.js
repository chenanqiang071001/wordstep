export const TARGET = 10;
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const MODES = {both:'考研 + 六级',ky:'考研英语',cet6:'大学英语六级'};
export const LEVELS = {foundation:'基础重建',high:'高中 / 四级备考',cet4:'四级已过 / 六级备考',cet6:'六级已过，强化提升'};
export function makeProfile(level='cet6',score=null,options={}) {
  return {level,score:Number.isInteger(score)?score:null,excludeJunior:true,excludeHigh:level==='cet4'||level==='cet6',kyPaper:'all',updatedAt:new Date().toISOString(),...options};
}
export function examKeys(state,mode=state.mode) {
  const ky=state.profile?.kyPaper==='ky1'?['ky1']:state.profile?.kyPaper==='ky2'?['ky2']:['ky1','ky2'];
  return mode==='cet6'?['cet6']:mode==='ky'?ky:[...ky,'cet6'];
}
export function examCount(word,state,mode=state.mode) {
  return examKeys(state,mode).reduce((n,key)=>n+(word.exams?.[key]?.count||0),0);
}
export function orderedWords(state,words,mode=state.mode) {
  return words.filter(w=>inTrack(w,mode)).sort((a,b)=>examCount(b,state,mode)-examCount(a,state,mode)||a.word.localeCompare(b.word,'en'));
}
export function basicExcluded(state,word) {
  if(state.includeWords?.includes(word.word))return false;
  return !!((state.profile?.excludeJunior&&word.difficulty==='junior')||(state.profile?.excludeHigh&&word.difficulty==='high'));
}
export function eligibleNew(state,word,mode=state.mode) {
  return inTrack(word,mode)&&examCount(word,state,mode)>0&&!basicExcluded(state,word)&&!state.knownWords?.includes(word.word)&&!state.records[word.word]?.learnedAt;
}
export function refreshPlan(state,words,today=dateKey()) {
  const old=state.days[today];
  const completed=old?.done||[], mode=old?.mode||state.mode;
  const candidates=orderedWords(state,words,mode).filter(w=>eligibleNew(state,w,mode)&&!completed.includes(w.word));
  state.days[today]={mode,plan:[...completed,...candidates.slice(0,TARGET-completed.length).map(w=>w.word)],done:completed,reviews:old?.reviews||[],started:old?.started||false};
  return state.days[today];
}
export function markKnown(state,word,words,today=dateKey()) {
  state.knownWords??=[];if(!state.knownWords.includes(word))state.knownWords.push(word);
  state.includeWords=(state.includeWords||[]).filter(w=>w!==word);
  return refreshPlan(state,words,today);
}
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(key, count) {
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d+count));
  return dt.toISOString().slice(0,10);
}
export function blankState() {
  return {version:1,mode:'both',accent:'en-US',records:{},days:{},favorites:[],profile:null,knownWords:[],includeWords:[]};
}
export function inTrack(word, mode) {return mode==='both'||word.tracks.includes(mode);}
export function ensureDay(state,words,today=dateKey()) {
  let day = state.days[today];
  if (!day || (day.mode!==state.mode && !day.started)) {
    day={mode:state.mode,plan:orderedWords(state,words).filter(w=>eligibleNew(state,w)).slice(0,TARGET).map(w=>w.word),done:[],reviews:[],started:false};
    state.days[today]=day;
  }
  return day;
}
export function dueWords(state,words,today=dateKey()) {
  return words.filter(w=>inTrack(w,state.mode)&&!basicExcluded(state,w)&&!state.knownWords?.includes(w.word)&&state.records[w.word]?.learnedAt&&state.records[w.word].due<=today&&!state.days[today]?.reviews.includes(w.word)).sort((a,b)=>state.records[a.word].due.localeCompare(state.records[b.word].due)||a.rank-b.rank);
}
export function grade(state,word,quality,kind,today=dateKey()) {
  const key=word.word;
  const prev=state.records[key]||{level:0,lapses:0};
  const again=quality==='again';
  const level=again?0:Math.min(5,prev.learnedAt?prev.level+1:quality==='easy'?1:0);
  const record={...prev,level,lapses:(prev.lapses||0)+(again?1:0),due:again?today:addDays(today,INTERVALS[level]),updatedAt:new Date().toISOString()};
  if (!again && !prev.learnedAt) record.learnedAt=today;
  state.records[key]=record;
  const day=state.days[today];
  if (day) {
    day.started=true;
    if (!again) {
      const field=kind==='new'?'done':'reviews';
      if (!day[field].includes(key)) day[field].push(key);
    } else if(kind==='review') day.reviews=day.reviews.filter(x=>x!==key);
  }
  return record;
}
export function streak(state,today=dateKey()) {
  let n=0,key=today;
  if(!state.days[key]?.done.length&&!state.days[key]?.reviews.length) key=addDays(key,-1);
  for(let i=0;i<40000;i++) {
    const d=state.days[key];
    if(!d || (!d.done.length&&!d.reviews.length)) break;
    n++;key=addDays(key,-1);
  }
  return n;
}
export function validateImport(data,knownWords) {
  if(!data||data.version!==1||!MODES[data.mode]||!data.records||typeof data.records!=='object'||Array.isArray(data.records)||!data.days||typeof data.days!=='object'||Array.isArray(data.days)) throw new Error('备份格式不正确，请选择拾词导出的 JSON 文件。');
  const known=new Set(knownWords.map(w=>w.word));
  const result=blankState();result.mode=data.mode;result.accent=data.accent==='en-GB'?'en-GB':'en-US';
  const isDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  for(const [word,r] of Object.entries(data.records)) {
    if(!known.has(word)||!r||!Number.isInteger(r.level)||r.level<0||r.level>5||!isDate(r.due)||(r.learnedAt&&!isDate(r.learnedAt))||!Number.isSafeInteger(r.lapses)||r.lapses<0) throw new Error('备份中的单词记录有误。');
    result.records[word]={level:r.level,due:r.due,lapses:r.lapses,...(r.learnedAt?{learnedAt:r.learnedAt}:{}),updatedAt:typeof r.updatedAt==='string'?r.updatedAt:''};
  }
  for(const [date,day] of Object.entries(data.days)) {
    if(!isDate(date)||!day||!MODES[day.mode]||!Array.isArray(day.plan)||day.plan.length>TARGET||!Array.isArray(day.done)||!Array.isArray(day.reviews)||[...day.plan,...day.done,...day.reviews].some(w=>!known.has(w))||day.done.some(w=>!day.plan.includes(w))) throw new Error('备份中的学习计划有误。');
    result.days[date]={mode:day.mode,plan:[...new Set(day.plan)],done:[...new Set(day.done)],reviews:[...new Set(day.reviews)],started:!!day.started};
  }
  result.favorites=Array.isArray(data.favorites)?[...new Set(data.favorites.filter(w=>known.has(w)))]:[];
  result.knownWords=Array.isArray(data.knownWords)?[...new Set(data.knownWords.filter(w=>known.has(w)))]:[];
  result.includeWords=Array.isArray(data.includeWords)?[...new Set(data.includeWords.filter(w=>known.has(w)))]:[];
  if(data.profile){
    const p=data.profile;
    if(!LEVELS[p.level]||typeof p.excludeJunior!=='boolean'||typeof p.excludeHigh!=='boolean'||!['all','ky1','ky2'].includes(p.kyPaper)||(p.score!==null&&(!Number.isInteger(p.score)||p.score<0||p.score>710)))throw new Error('备份中的水平设置有误。');
    result.profile=makeProfile(p.level,p.score,{excludeJunior:p.excludeJunior,excludeHigh:p.excludeHigh,kyPaper:p.kyPaper,updatedAt:typeof p.updatedAt==='string'?p.updatedAt:''});
  }
  return result;
}
export function mergeState(current,incoming) {
  const result=structuredClone(current);
  result.mode=incoming.mode;result.accent=incoming.accent;
  for(const [w,r] of Object.entries(incoming.records)) {
    const old=result.records[w];
    if(!old||(r.updatedAt||'')>=(old.updatedAt||''))result.records[w]=r;
  }
  for(const [key,day] of Object.entries(incoming.days)) {
    const old=result.days[key];
    if(!old)result.days[key]=day;
    else {
      // A single global daily allowance survives imports from another device.
      const done=[...new Set([...old.done,...day.done])].slice(0,TARGET);
      const plan=[...new Set([...done,...old.plan,...day.plan])].slice(0,TARGET);
      result.days[key]={mode:old.mode,started:old.started||day.started,plan,done,reviews:[...new Set([...old.reviews,...day.reviews])]};
    }
  }
  result.favorites=[...new Set([...current.favorites,...incoming.favorites])];
  result.knownWords=[...new Set([...(current.knownWords||[]),...(incoming.knownWords||[])])];
  result.includeWords=[...new Set([...(current.includeWords||[]),...(incoming.includeWords||[])])];
  if(incoming.profile&&(!current.profile||incoming.profile.updatedAt>=current.profile.updatedAt))result.profile=incoming.profile;
  return result;
}
