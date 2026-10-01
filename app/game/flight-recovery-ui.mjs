import {captureCheckpoint,validateCheckpoint,rehydrateCheckpoint} from './flight-checkpoint.mjs';
const exactOrigin='https://deploy-preview-3--treeforce89.netlify.app';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
const btn=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
const allowed=()=>location.origin===exactOrigin||(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('recoveryTest')==='1');
export function installFlightRecovery(game,frame){
 if(!allowed()||!frame)return()=>{};
 game.registry.set('treeRecoveryPracticeAllowed',true);
 let closed=false,current=null,snapshot=null,saved=false,busy=false,revision=0,savedOwner=null,loaded=null;
 const box=el('section');box.className='flight-recovery-box';
 const status=el('p','RECOVERY PREVIEW · No TREE payment is enabled.');status.setAttribute('role','status');
 const save=btn('SAVE FLIGHT FOR RELOAD TEST',()=>void saveCurrent());
 const practice=btn('RESUME AS PRACTICE — NO TREE',()=>{try{current?.practiceResume();}catch(e){status.textContent=e.message;}});
 const signInPrompt=el('section');signInPrompt.className='flight-recovery-signin';signInPrompt.hidden=true;
 signInPrompt.setAttribute('aria-label','Sign in to save your flight');
 const signInHelp=el('p','Sign in with your Sui wallet, then save this wave and score before closing the tab.');
 const signInSafety=el('p','Free sign-in message only. No TREE or SUI is spent.');signInSafety.className='flight-recovery-signin-safety';
 const signIn=btn('SIGN IN WITH SUI WALLET',()=>{
  // Reuse same-page account verification. Never start a wallet payment from this prompt.
  if(!closed&&!busy&&current&&!signInPrompt.hidden)game.events.emit('tree-account:open');
 });
 signIn.className='tree-continue-primary';
 signInPrompt.append(el('strong','SIGN IN TO SAVE YOUR FLIGHT'),signInHelp,signIn,signInSafety);
 box.append(el('strong','RECOVERY TEST · NO PAYMENT'),status,save,signInPrompt,practice);
 const direct=document.querySelector('.tree-continue-dialog');direct?.append(box);
 const dialog=el('dialog');dialog.className='tree-continue-dialog';dialog.setAttribute('aria-label','Saved flight recovery');
 const info=el('p','Sign in with the same Sui wallet to retrieve your saved flight.');info.setAttribute('role','status');
 const rows=el('div');
 const closeButton=btn('CLOSE',()=>dialog.close());
 dialog.append(el('h2','SAVED FLIGHTS'),el('p','Testing recovery only. No TREE is spent, and this is not a paid-continue authorization.'),info,rows,closeButton);document.body.append(dialog);
 const open=btn('SAVED FLIGHTS',()=>{if(!dialog.open)dialog.showModal();void refreshList();});frame.querySelector('.records-toolbar')?.append(open);
 const identity=()=>game.registry.get('treeAccountIdentity');
 const signedInWithSui=()=>identity()?.authenticated===true&&identity()?.wallet?.family==='sui'&&!!identity()?.accountId;
 async function api(c){
  const r=await fetch('/api/tree-flight',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),signal:AbortSignal.timeout(23000)});
  const p=await r.json();if(!r.ok)throw Error(p.error==='sign-in-required'?'Sign in with your Sui wallet, then retry.':p.error||'Recovery service unavailable');
  if(p.accountId!==identity()?.accountId||p.paymentsEnabled!==false||p.restoreAuthorized!==false)throw Error('Recovery identity or mode changed');return p.result;
 }
 function render(){
  if(closed)return;
  const signedIn=signedInWithSui();
  save.disabled=busy||!current||!snapshot||!signedIn||saved;
  signInPrompt.hidden=!current||!snapshot||saved||signedIn;
  signIn.disabled=busy||signInPrompt.hidden;
  signInHelp.textContent=identity()?.authenticated&&identity()?.wallet?.family!=='sui'
   ?'This flight needs a Sui wallet. Sign in with Sui, then save this wave and score before closing the tab.'
   :'Sign in with your Sui wallet, then save this wave and score before closing the tab.';
  practice.disabled=busy||!current;
  save.textContent=saved?'SAVED — SAFE TO RELOAD FOR TEST':'SAVE FLIGHT FOR RELOAD TEST';
 }
 async function saveCurrent(){
  if(busy||!current||!snapshot||saved)return;
  const account=identity()?.accountId;if(!signedInWithSui()){status.textContent='Sign in with your Sui wallet, then save this exhausted flight.';return;}
  if(savedOwner&&savedOwner!==account){status.textContent='Return to the original signed-in account.';return;}
  const serial=++revision,runId=current.runId;busy=true;render();
  try{
   status.textContent='Saving the paused flight to private storage…';
   await api({action:'save',runId,requestId:crypto.randomUUID(),snapshot});
   if(closed||serial!==revision||current?.runId!==runId||identity()?.accountId!==account)return;
   saved=true;savedOwner=account;status.textContent='Flight saved. Refresh or close this tab; sign in with the same wallet and select SAVED FLIGHTS.';
  }catch(e){if(!closed&&serial===revision)status.textContent=e.message;}
  finally{if(serial===revision){busy=false;render();}}
 }
 async function load(runId){
  if(busy)return;const active=game.scene.isActive('game')||game.scene.isPaused('game');
  if(active){info.textContent='Finish the current flight or refresh before loading a saved flight.';return;}
  busy=true;render();const account=identity()?.accountId;
  try{
   info.textContent='Retrieving your saved checkpoint…';const result=await api({action:'recover',runId});
   if(closed||identity()?.accountId!==account)throw Error('Account changed');
   if(result.purchaseState||result.paymentsEnabled!==false||result.restoreAuthorized!==false)throw Error('A purchase record needs paid recovery; practice cannot consume it.');
   if(!result.snapshotText)throw Error('This flight has no saved checkpoint');
   const bytes=new TextEncoder().encode(result.snapshotText),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==result.checkpointHash)throw Error('Saved checkpoint failed integrity verification');
   loaded=validateCheckpoint(JSON.parse(result.snapshotText));if(loaded.runId!==runId)throw Error('Wrong saved flight');
   savedOwner=account;dialog.close();game.registry.set('treeRecoveryRunId',runId);
   game.scene.stop('title');game.scene.stop('gameover');game.scene.start('game');
  }catch(e){info.textContent=e.message;loaded=null;}
  finally{busy=false;render();}
 }
 async function refreshList(){
  if(!signedInWithSui()){info.textContent='Sign in with your Sui wallet using the SIGN IN button first.';return;}
  const account=identity().accountId;try{const result=await api({action:'list'});if(closed||identity()?.accountId!==account)return;
   rows.replaceChildren();const list=result.flights||[];info.textContent=list.length?'Select a saved flight. Recovered test flights remain unranked.':'No saved flights yet. Play until all lives are lost, then save.';
   for(const f of list){const b=btn(`LOAD WAVE ${f.wave} · ${Number(f.score).toLocaleString()} POINTS — PRACTICE`,()=>void load(f.runId));rows.append(b);}
  }catch(e){info.textContent=e.message;}
 }
 function exhausted(f){
  ++revision;busy=false;current=f;saved=f.recovered;snapshot=null;
  try{snapshot=f.recovered?null:captureCheckpoint(f.scene,f.runId);status.textContent=f.recovered?'Saved wave, score, survivors and boss health loaded. Attacking invaders reset to formation. Resume as practice; no payment.':signedInWithSui()?'Save this exhausted flight before refreshing to test recovery. No TREE will be charged.':'Your flight is paused, but it is not saved yet. Sign in below to save it.';}
  catch(e){status.textContent='Cannot save this checkpoint: '+e.message;}
  render();if(!f.recovered&&snapshot&&signedInWithSui())void saveCurrent();
 }
 function flightClosed(){++revision;busy=false;current=null;snapshot=null;saved=false;savedOwner=null;render();}
 const s=game.scene.getScene('game');let restoreCreate;
 function attach(){
  const scene=game.scene.getScene('game');if(!scene)return;
  const previous=scene.create;
  scene.create=function(...args){previous.apply(this,args);if(loaded){const value=loaded;loaded=null;try{rehydrateCheckpoint(this,value);this.endRun(false);}catch(e){this.paused=true;this.physics.world.pause();info.textContent='Recovery stopped safely: '+e.message;if(!dialog.open)dialog.showModal();}}};
  restoreCreate=()=>{scene.create=previous;};
 }
 if(s)attach();else game.events.once('ready',attach);
 game.events.on('tree-flight:exhausted',exhausted);game.events.on('tree-flight:closed',flightClosed);
 const changed=()=>{
  ++revision;busy=false;
  if(current&&snapshot&&!saved)status.textContent=signedInWithSui()
   ?'Signed in. Select SAVE FLIGHT FOR RELOAD TEST before closing this tab. No TREE payment is needed.'
   :'Your flight is paused, but it is not saved yet. Sign in below to save it.';
  render();if(dialog.open)void refreshList();
 };game.events.on('tree-account:identity',changed);
 dialog.addEventListener('keydown',e=>e.stopPropagation());render();
 return()=>{closed=true;++revision;signIn.onclick=null;game.registry.remove('treeRecoveryPracticeAllowed');game.events.off('ready',attach);game.events.off('tree-flight:exhausted',exhausted);game.events.off('tree-flight:closed',flightClosed);game.events.off('tree-account:identity',changed);restoreCreate?.();dialog.remove();box.remove();open.remove();};
}
