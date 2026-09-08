/** Local preview records. Never treat client records as verified leaderboard submissions. */
export const STORAGE_KEY = 'treeforce89.records.preview.v1';
export const RULESET = 'treeforce89-campaign-1';
export const ACHIEVEMENTS = Object.freeze([
  {id:'first-flight',name:'First Flight',detail:'Finish your first normal run.',metric:'runs',target:1,mark:'01'},
  {id:'mistwood-defender',name:'Mistwood Defender',detail:'Clear Wave 1 in normal play.',metric:'wavesCleared',target:1,mark:'02'},
  {id:'canopy-defender',name:'Canopy Defender',detail:'Complete all 10 waves without continuing.',metric:'clears',target:1,mark:'03'},
  {id:'sharpshooter',name:'Sharpshooter',detail:'Finish a normal run at 80% accuracy or better, with at least 50 shots.',metric:'qualifiedAccuracy',target:80,mark:'04'},
  {id:'combo-climber',name:'Combo Climber',detail:'Reach a 25-enemy combo in one normal run.',metric:'bestCombo',target:25,mark:'05'},
  {id:'ancient-arborwing',name:'Ancient Arborwing',detail:'Reach Ancient growth in normal play.',metric:'maxGrowth',target:5,mark:'06'},
  {id:'fully-armed',name:'Fully Armed',detail:'Reach the Canopy Cannon weapon level in normal play.',metric:'maxWeapon',target:5,mark:'07'},
  {id:'wingman',name:'Wingman',detail:'Rescue a captured Arborwing in normal play.',metric:'rescues',target:1,mark:'08'},
  {id:'boom-catcher',name:'BOOM Catcher',detail:'Collect a BOOM pickup by touching it in normal play.',metric:'boom',target:1,mark:'09'},
  {id:'ghost-protocol',name:'Ghost Protocol',detail:'Collect the Sovereign City cloaking shield in normal play.',metric:'ghost',target:1,mark:'10'},
  {id:'perfect-shield',name:'Perfect Shield',detail:'Clear at least 8 enemy shots with one Tree Shield in normal play.',metric:'perfect',target:1,mark:'11'},
  {id:'seasoned-pilot',name:'Seasoned Pilot',detail:'Finish 10 normal runs.',metric:'runs',target:10,mark:'12'},
]);
export const cleanCallsign = value => String(value ?? '').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16) || 'ARBORIST';
export const integer = (value, max = 1e9) => Number.isFinite(value) ? Math.max(0,Math.min(max,Math.floor(value))) : 0;
export const accuracy = run => run.shotsFired > 0 ? Math.min(100,100 * run.shotsHit / run.shotsFired) : 0;
export function weekStart(timestamp = Date.now()) {
  const day = new Date(timestamp); day.setUTCHours(0,0,0,0);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay()+6)%7);
  return day.toISOString().slice(0,10);
}
const metricKeys = ['runs','kills','clears','wavesCleared','qualifiedAccuracy','bestCombo','maxGrowth','maxWeapon','rescues','boom','ghost','perfect'];
export function emptyState(id = 'guest', timestamp = Date.now()) {
  return {schema:1,pilot:{id,callsign:'ARBORIST',title:''},career:Object.fromEntries(metricKeys.map(k=>[k,0])),badges:{},best:[],weekly:{start:weekStart(timestamp),runs:[]},recent:[],seen:[]};
}
export function validRun(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || r.id.length > 100) return false;
  if (!['normal','practice','continued'].includes(r.kind) || r.ruleset !== RULESET || typeof r.cleared !== 'boolean') return false;
  const bounds = {score:1e9,kills:1e6,shotsFired:1e7,shotsHit:1e7,startWave:10,waveReached:10,wavesCleared:10,elapsedMs:259200000,maxCombo:1e6,maxGrowth:5,maxWeapon:5,rescues:1e4,boom:1e4,ghost:1e4,perfect:1e4,endedAt:8640000000000000};
  if (!Object.entries(bounds).every(([key,max]) => Number.isSafeInteger(r[key]) && r[key] >= 0 && r[key] <= max)) return false;
  return r.startWave >= 1 && r.waveReached >= r.startWave && r.shotsHit <= r.shotsFired && r.wavesCleared <= r.waveReached && Array.isArray(r.reasons) && r.reasons.every(x=>typeof x==='string' && x.length<=100);
}
export const eligible = r => validRun(r) && r.kind==='normal' && r.startWave===1 && r.reasons.length===0;
export function topRuns(rows) {
  return [...new Map(rows.filter(eligible).map(r=>[r.id,r])).values()]
    .sort((a,b)=>b.score-a.score || a.endedAt-b.endedAt || a.id.localeCompare(b.id)).slice(0,10);
}
export function addRun(state, run) {
  if (!validRun(run) || state.seen.includes(run.id)) return {state,unlocked:[],saved:false,newBest:false};
  const next = JSON.parse(JSON.stringify(state));
  next.seen = [...next.seen,run.id].slice(-500);
  next.recent = [run,...next.recent].slice(0,50);
  const unlocked=[]; let newBest=false;
  if (eligible(run)) {
    const c=next.career;
    c.runs++; c.kills+=run.kills; c.clears+=run.cleared?1:0;
    c.wavesCleared=Math.max(c.wavesCleared,run.wavesCleared);
    c.qualifiedAccuracy=Math.max(c.qualifiedAccuracy,run.shotsFired>=50?accuracy(run):0);
    c.bestCombo=Math.max(c.bestCombo,run.maxCombo); c.maxGrowth=Math.max(c.maxGrowth,run.maxGrowth); c.maxWeapon=Math.max(c.maxWeapon,run.maxWeapon);
    for (const key of ['rescues','boom','ghost','perfect']) c[key]+=run[key];
    for (const a of ACHIEVEMENTS) if (!next.badges[a.id] && c[a.metric]>=a.target) { next.badges[a.id]=run.endedAt; unlocked.push(a.id); }
    newBest=run.score>(state.best[0]?.score??0);
    next.best=topRuns([...next.best,run]);
    const week=weekStart(run.endedAt);
    if (week>next.weekly.start) next.weekly={start:week,runs:[]};
    if (week===next.weekly.start) next.weekly.runs=topRuns([...next.weekly.runs,run]);
  }
  return {state:next,unlocked,saved:true,newBest};
}
export function readState(raw, fallback) {
  if (!raw) return fallback;
  const s=JSON.parse(raw);
  if (s?.schema!==1 || !s.pilot || typeof s.pilot.id!=='string' || !s.career || !s.badges || !s.weekly || !Array.isArray(s.best) || !Array.isArray(s.weekly.runs) || !Array.isArray(s.recent) || !Array.isArray(s.seen)) throw new Error('Unsupported or damaged saved records');
  if (!metricKeys.every(k=>Number.isFinite(s.career[k])&&s.career[k]>=0) || !/^\d{4}-\d{2}-\d{2}$/.test(s.weekly.start)) throw new Error('Invalid career records');
  s.pilot.callsign=cleanCallsign(s.pilot.callsign);
  s.badges=Object.fromEntries(ACHIEVEMENTS.filter(a=>Number.isSafeInteger(s.badges[a.id]) && s.badges[a.id]>0).map(a=>[a.id,s.badges[a.id]]));
  if (!s.badges[s.pilot.title]) s.pilot.title='';
  s.best=topRuns(s.best); s.weekly.runs=topRuns(s.weekly.runs);
  s.recent=s.recent.filter(validRun).slice(0,50);
  s.seen=s.seen.filter(x=>typeof x==='string').slice(-500);
  return s;
}
/** Storage failures switch to an explicitly labelled session-only mode. */
export function createRecordStore(storage, id='guest', clock=()=>Date.now()) {
  let state=emptyState(id,clock()),warning='',persistent=!!storage,lastResult=null;
  const listeners=new Set();
  try { if(storage) state=readState(storage.getItem(STORAGE_KEY),state); else warning='Session only: browser storage is unavailable.'; }
  catch { persistent=false; warning='Saved records could not be read. This session will not overwrite them.'; }
  const notify=()=>listeners.forEach(fn=>fn());
  function refresh() {
    if (!persistent) return;
    try { state=readState(storage.getItem(STORAGE_KEY),state); }
    catch { persistent=false; warning='Storage is unavailable. New records are session only.'; }
  }
  function write() {
    try { if(persistent) storage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch { persistent=false; warning='Storage is full or blocked. New records are session only.'; }
    notify();
  }
  return {
    get:()=>({state,warning,persistent,lastResult}),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    save(run){refresh();const result=addRun(state,run);if(!result.saved)return result;state=result.state;lastResult={...result,run};write();return result;},
    profile(callsign,title){refresh();state={...state,pilot:{...state.pilot,callsign:cleanCallsign(callsign),title:state.badges[title]?title:''}};write();},
    sync(){refresh();notify();},
  };
}
