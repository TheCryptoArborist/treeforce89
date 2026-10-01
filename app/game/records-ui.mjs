import {ACHIEVEMENTS,accuracy,weekStart} from './records-core.mjs';
const names=Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,a.name]));
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;}
function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
const number=value=>Math.floor(value||0).toLocaleString();
const duration=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const date=value=>new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
export function createRecordsDesk(frame,store,onVisibility=()=>{}) {
  let tab='scoreboard',period='all',open=false,lastResult=null,toastTimer;
  const toolbar=el('nav','records-toolbar');toolbar.setAttribute('aria-label','Pilot records');
  const scores=button('SCOREBOARD',()=>show('scoreboard'));
  const achievements=button('ACHIEVEMENTS 0/12',()=>show('achievements'));
  toolbar.append(scores,achievements);frame.classList.add('has-records');
  frame.insertBefore(toolbar,frame.querySelector('.screen-bezel'));
  const dialog=el('dialog','records-dialog');dialog.setAttribute('aria-labelledby','records-heading');
  const top=el('header','records-heading-row'),heading=el('h2','','PILOT RECORDS');heading.id='records-heading';
  const closeButton=button('CLOSE ×',close,'records-close');closeButton.setAttribute('aria-label','Close pilot records and return to game');
  top.append(el('div','records-kicker','TREE FORCE ’89 / FLIGHT ARCHIVE'),closeButton,heading);
  const scope=el('p','records-scope','PERSONAL PREVIEW · THIS BROWSER ONLY');
  const tabs=el('nav','records-tabs');tabs.setAttribute('aria-label','Record sections');
  const tabButtons=['scoreboard','achievements','pilot'].map(key=>{
    const b=button(key.toUpperCase(),()=>{tab=key;render();});tabs.append(b);return b;
  });
  const content=el('section','records-content');content.setAttribute('aria-live','polite');
  const foot=el('p','records-foot','Local test records are not a verified global leaderboard. No wallet, tokens, or credits are required.');
  dialog.append(top,scope,tabs,content,foot);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  const toast=el('aside','records-toast');toast.setAttribute('role','status');toast.hidden=true;document.body.append(toast);
  function close(){if(!open)return;open=false;dialog.close();onVisibility(false);scores.focus();}
  function show(key){tab=key;render();if(!open){open=true;onVisibility(true);dialog.showModal();closeButton.focus();}}
  function empty(message){const node=el('div','records-empty');node.append(el('span','records-emblem','◇'),el('p','',message));return node;}
  function stat(label,value){const box=el('div','records-stat');box.append(el('span','',label),el('strong','',value));return box;}
  function render(){
    const {state,warning,persistent}=store.get();
    const count=Object.keys(state.badges).length;achievements.textContent=`ACHIEVEMENTS ${count}/12`;
    for(let i=0;i<tabButtons.length;i++)tabButtons[i].setAttribute('aria-pressed',String(['scoreboard','achievements','pilot'][i]===tab));
    content.replaceChildren();
    scope.textContent=persistent?'PERSONAL PREVIEW · SAVED IN THIS BROWSER':'SESSION ONLY · NOT SAVED AFTER CLOSING';
    if(warning)content.append(el('p','records-warning',warning));
    const summary=el('div','records-summary');summary.append(stat('PERSONAL BEST',number(state.best[0]?.score)),stat('NORMAL RUNS',number(state.career.runs)),stat('BADGES',`${count} / 12`));content.append(summary);
    if(tab==='scoreboard'){
      const filters=el('div','records-filters');
      for(const [key,label] of [['all','All-time best'],['week','This week · UTC'],['recent','Recent flights']]){const b=button(label,()=>{period=key;render();});b.setAttribute('aria-pressed',String(period===key));filters.append(b);}
      content.append(filters);
      const rows=period==='recent'?state.recent.slice(0,15):period==='week'?(state.weekly.start===weekStart()?state.weekly.runs:[]):state.best;
      content.append(el('p','records-caption',period==='recent'?'Recent normal, practice, and continued runs. Only normal runs count toward records and badges.':'Your top 10 normal runs. Higher score wins; equal scores are ordered by the earlier finish.'));
      if(!rows.length)content.append(empty('No flights recorded here yet. Finish a run to put your Arborwing on the board.'));
      else{
        const wrap=el('div','records-table-wrap'),table=el('table','records-table'),thead=el('thead'),tr=el('tr');
        for(const label of [period==='recent'?'MODE':'#','PILOT / FLIGHT','SCORE','WAVE'])tr.append(el('th','',label));thead.append(tr);table.append(thead);
        const tbody=el('tbody');rows.forEach((r,i)=>{
          const row=el('tr',period!=='recent'&&i===0?'records-leading':''),pilot=el('td');
          pilot.append(el('strong','',r.callsign||state.pilot.callsign),el('small','',`${date(r.endedAt)} · ${duration(r.elapsedMs)} · ${r.shotsFired?Math.round(accuracy(r))+'%':'—'} accuracy`));
          if(r.title&&names[r.title])pilot.append(el('small','',names[r.title]));
          if(r.reasons.length)pilot.append(el('small','records-reason',r.reasons.join(' · ')));
          row.append(el('td','records-rank',period==='recent'?r.kind.toUpperCase():String(i+1).padStart(2,'0')),pilot,el('td','records-score',number(r.score)),el('td','',r.cleared?'CLEAR':`${r.waveReached}/10`));tbody.append(row);
        });table.append(tbody);wrap.append(table);content.append(wrap);
      }
      content.append(el('p','records-caption','Records begin with this build. Older unsaved runs cannot be recovered. Weekly boards reset Monday at 00:00 UTC; all-time bests remain.'));
    }else if(tab==='achievements'){
      content.append(el('p','records-caption','Earn badges through normal gameplay, then finish the run to save them. Practice, debug, and post-continue play do not unlock badges.'));
      const grid=el('div','records-badge-grid');
      for(const a of ACHIEVEMENTS){
        const earned=!!state.badges[a.id],card=el('article',`records-badge ${earned?'earned':''}`),icon=el('span','records-badge-icon',earned?'◆':a.mark),copy=el('div');
        icon.setAttribute('aria-hidden','true');copy.append(el('h3','',a.name),el('p','',a.detail));
        const progress=document.createElement('progress');progress.max=a.target;progress.value=Math.min(a.target,state.career[a.metric]||0);progress.setAttribute('aria-label',`${a.name} progress`);
        copy.append(progress,el('small','',earned?`UNLOCKED · ${date(state.badges[a.id])}`:`${Math.floor(progress.value)} / ${a.target}${a.id==='sharpshooter'?'% qualifying accuracy':''}`));card.append(icon,copy);grid.append(card);
      }content.append(grid);
    }else{
      content.append(el('h3','','YOUR PILOT IDENTITY'),el('p','records-caption','Choose a local callsign and an earned title. This is a guest profile, not a connected TREE Account.'));
      const form=el('form','records-profile'),label=el('label','','CALLSIGN'),input=el('input');input.id='records-callsign';label.htmlFor=input.id;input.value=state.pilot.callsign;input.maxLength=16;input.autocomplete='off';input.pattern='[A-Za-z0-9 _-]{1,16}';input.required=true;
      const titleLabel=el('label','','EARNED TITLE'),select=el('select');select.id='records-title';titleLabel.htmlFor=select.id;
      const basic=el('option','','Canopy Cadet');basic.value='';select.append(basic);
      for(const a of ACHIEVEMENTS)if(state.badges[a.id]){const opt=el('option','',a.name);opt.value=a.id;select.append(opt);}select.value=state.pilot.title;
      const save=el('button','records-primary','SAVE PILOT');save.type='submit';
      form.append(label,input,el('small','','1–16 letters, numbers, spaces, underscores or hyphens.'),titleLabel,select,save);
      form.addEventListener('submit',event=>{event.preventDefault();store.profile(input.value,select.value);announce('PILOT SAVED',`${store.get().state.pilot.callsign} · ${names[select.value]||'Canopy Cadet'}`);});content.append(form);
      content.append(el('p','records-caption','Earned titles are cosmetic. They do not change damage, lives, score multipliers, or credit balances.'));
      content.append(el('p','records-warning','Use the same preview address and browser to keep testing your records. Clearing site data or using a different device will not carry them over. Shared TREE Account sync is not enabled yet.'));
    }
  }
  function announce(title,body){clearTimeout(toastTimer);toast.replaceChildren(el('strong','',title),el('span','',body));toast.hidden=false;toastTimer=setTimeout(()=>{toast.hidden=true;},6500);}
  const unsubscribe=store.subscribe(()=>{
    const result=store.get().lastResult;
    if(result&&result!==lastResult){lastResult=result;announce(result.newBest?'NEW PERSONAL BEST':result.run.kind==='normal'?'FLIGHT RECORDED':'PRACTICE / CASUAL FLIGHT SAVED',result.unlocked.length?`Unlocked: ${result.unlocked.map(id=>names[id]).join(' · ')}`:result.run.kind==='normal'?`${number(result.run.score)} points · Open Scoreboard to review.`:'Excluded from personal bests and achievements.');}
    render();
  });render();
  return {show,close,isOpen:()=>open,destroy(){close();unsubscribe();clearTimeout(toastTimer);toolbar.remove();dialog.remove();toast.remove();frame.classList.remove('has-records');}};
}
