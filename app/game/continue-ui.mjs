import { wireContinueGame, requestId } from './continue-flow.mjs';
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,cls='')=>{const b=make('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
const errors={
  'sign-in-required':'Sign in to your TREE Account above, then reopen Test CC. No payment is requested.',
  'simulation-disabled':'The test ledger is not enabled on this address. Use the stable game preview.',
  'insufficient-test-credits':'You need 100 test CC. Create and confirm a simulated TREE top-up below.',
  'quote-expired':'That 45-second quote expired. Create a new test quote; nothing was charged.',
  'test-topup-limit':'This preview account has reached its five simulated top-up limit.',
  'simulation-paused':'The test service is paused. Existing test balances are preserved.',
};
export function installTreeContinues(game,frame) {
  if(!frame)return()=>{};
  let ledger=null,quote=null,quoteCommand=null,creditCommand=null,loading=false,mode=null,offer=null,disposed=false,owner=null,unpause=()=>{};
  const toolbar=frame.querySelector('.records-toolbar');if(!toolbar)return()=>{};
  const bankButton=button('TEST CC',()=>openBank());toolbar.append(bankButton);
  const dialog=make('dialog','cc-dialog');dialog.setAttribute('aria-labelledby','cc-heading');
  const kicker=make('p','cc-kicker','TREE ARCADE / SIMULATION ONLY');
  const title=make('h2','','TEST CANOPY CREDITS');title.id='cc-heading';
  const warning=make('p','cc-warning','No real TREE is spent. Test credits have no monetary value and will not carry into launch.');
  const flight=make('p','cc-flight');
  const total=make('div','cc-total','Sign in to view your test balance');
  const info=make('p','cc-info','100 test CC restores three Seedling lives with the starting weapon. One continue per run.');
  const primary=button('CONTINUE · 100 TEST CC',()=>continueRun(), 'cc-primary');
  const quoteButton=button('CREATE SIMULATED TREE QUOTE',()=>newQuote());
  const quoteBox=make('section','cc-quote');quoteBox.hidden=true;
  const quoteAmount=make('strong'),quoteDetails=make('p'),expiry=make('p');
  const payButton=button('CONFIRM SIMULATED PAYMENT',()=>fund(),'cc-primary');
  quoteBox.append(quoteAmount,quoteDetails,expiry,payButton);
  const message=make('p','cc-message');message.setAttribute('role','status');
  const failButton=button('TEST FAILED CONTINUE',()=>continueRun(true),'cc-secondary');
  const quickTest=()=>{if(!disposed&&!bridge.testNow())openBank('Start a flight first. The shortcut is available once per run.');};
  const quickButton=button('TEST CONTINUE NOW (PRACTICE)',()=>{close();game.events.once('poststep',quickTest);});
  const closeButton=button('BACK TO GAME',()=>decline());
  const foot=make('p','cc-foot','Continue stops competitive scoring for this run. Scores and achievements are still local preview records. This does not unlock NFTree content or bonus levels.');
  dialog.append(kicker,title,warning,flight,total,info,primary,quoteButton,quoteBox,message,failButton,quickButton,closeButton,foot);document.body.append(dialog);
  function render(){
    if(disposed)return;
    bankButton.textContent=ledger?`TEST CC ${ledger.available.toLocaleString()}`:'TEST CC';
    total.textContent=ledger?`${ledger.available.toLocaleString()} TEST CC AVAILABLE${ledger.held?' · '+ledger.held+' RESERVED':''}`:'Sign in to view your test balance';
    title.textContent=mode==='continue'?'INSERT TEST CREDITS':'TEST CANOPY CREDITS';
    flight.textContent=offer?`Wave ${offer.wave} · ${Math.round(offer.score).toLocaleString()} points. Your flight is paused.`:'';
    primary.hidden=mode!=='continue';failButton.hidden=mode!=='continue';quickButton.hidden=mode!=='bank';
    const state=offer?.attempt.state;
    primary.textContent=state?.reservation?'RETRY / CONFIRM CONTINUE':'CONTINUE · 100 TEST CC';
    primary.disabled=loading||!!state?.closed||(!state?.reservation&&(!ledger||ledger.available<100));
    failButton.disabled=loading||!!state?.reservation||!!state?.closed||!ledger||ledger.available<100;
    quoteButton.disabled=loading||!ledger;payButton.disabled=loading||!quote;
    closeButton.disabled=loading||!!(state?.restored&&!state.done);
    closeButton.textContent=mode==='continue'?'FINISH RUN WITHOUT CONTINUING':'BACK TO GAME';
    quickButton.disabled=loading;
  }
  async function api(command){
    let response;
    try{response=await fetch('/api/canopy-credits',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(25000)});}
    catch{throw new Error('Connection interrupted. Retry this same action to reconcile it; do not start another purchase.');}
    const payload=await response.json();
    if(!response.ok){const e=new Error(errors[payload.error]||payload.error||'Test service is unavailable.');e.code=payload.error;throw e;}
    if(payload.ledger?.mode!=='simulation')throw new Error('Invalid test ledger response.');
    ledger=payload.ledger;render();return payload;
  }
  async function refresh(){try{await api({action:'balance'});}catch(e){ledger=null;message.textContent=e.message;render();}}
  async function task(fn){if(loading)return;loading=true;render();try{await fn();}catch(e){message.textContent=e.message;}finally{loading=false;render();}}
  function pause(){
    const paused=[];
    for(const s of game.scene.getScenes(true)){const k=s.sys.settings.key,keyboard=s.input?.keyboard;paused.push({k,keyboard,enabled:keyboard?.enabled});if(keyboard)keyboard.enabled=false;game.scene.pause(k);}
    unpause=()=>{for(const p of paused){if(p.keyboard)p.keyboard.enabled=p.enabled;if(game.scene.isPaused(p.k))game.scene.resume(p.k);}unpause=()=>{};};
  }
  function close(){if(dialog.open)dialog.close();unpause();mode=null;offer=null;quote=null;quoteBox.hidden=true;quoteCommand=null;creditCommand=null;}
  async function decline(){if(loading)return;if(mode==='continue'&&offer){await task(async()=>{await offer.decline();});}else close();}
  function openBank(note=''){
    mode='bank';offer=null;message.textContent=note;pause();render();dialog.showModal();closeButton.focus();void refresh();
  }
  const bridge=wireContinueGame(game,api,{
    offer(o){offer=o;mode='continue';message.textContent='Normal play is free until your lives run out. This is an optional test continue.';render();if(!dialog.open)dialog.showModal();primary.focus();void refresh();},
    close,
  });
  function newQuote(){return task(async()=>{
    // Explicit refresh replaces an expired quote; retries of confirmation retain their ID.
    quoteCommand={action:'quote',requestId:requestId()};const p=await api(quoteCommand);quote=p.result;
    creditCommand={action:'simulate',requestId:requestId(),quoteId:quote.quote.id,signature:quote.signature};
    quoteAmount.textContent='1,000 SIMULATED TREE → 1,100 TEST CC';
    quoteDetails.textContent='1,000 base credits + 100 credits (10% TREE bonus). Mock rate: 1 TREE = $0.001. This is not a market price or a real payment quote.';
    expiry.textContent=`Test quote expires at ${new Date(quote.quote.expiresAt).toLocaleTimeString()}.`;
    quoteBox.hidden=false;message.textContent='Confirming creates a simulated receipt only. Your wallet will not be asked to pay.';
  });}
  function fund(){return task(async()=>{
    if(!creditCommand)return;await api(creditCommand);message.textContent='Simulated TREE funding recorded once. 1,100 test CC credited. No real tokens moved.';quoteBox.hidden=true;quote=null;
  });}
  function continueRun(fail=false){return task(async()=>{
    const current=offer;if(!current)return;
    message.textContent=fail?'Testing a failed delivery and credit release…':'Reserving test credits and restoring the Arborwing…';
    try{await current.attempt.continue({failPreparation:fail});}
    finally{await refresh();}
  });}
  dialog.addEventListener('cancel',e=>{e.preventDefault();if(!closeButton.disabled)void decline();});
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  function identityChanged(identity){const next=identity?.accountId||null;if(next===owner)return;owner=next;ledger=null;render();if(next)void refresh();}
  game.events.on('tree-account:identity',identityChanged);
  render();
  return ()=>{disposed=true;game.events.off('poststep',quickTest);bridge.destroy();game.events.off('tree-account:identity',identityChanged);close();bankButton.remove();dialog.remove();};
}
