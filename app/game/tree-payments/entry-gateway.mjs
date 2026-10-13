import '@mysten/dapp-kit-core/web';
import {Transaction} from '@mysten/sui/transactions';
import {getSuiApp} from './sui-app.mjs';
import {ENTRY,entryReference} from '../entry-policy.mjs';
const KEY='treeforce89.entry.pending.v1';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export function installEntryGateway(game,frame){
 const kit=getSuiApp();let busy=false,disposed=false;
 const panel=document.createElement('section');panel.className='tree-entry-panel';
 const heading=document.createElement('strong');heading.textContent='PLAY FOR 20,000 TREE';
 const terms=document.createElement('p');terms.textContent='One run · 3 lives · Sui Mainnet. SUI gas is separate. No NFTree required.';
 const connect=document.createElement('mysten-dapp-kit-connect-button');connect.instance=kit;connect.modalOptions={filterFn:w=>w.chains.includes('sui:mainnet')};
 const pay=document.createElement('button');pay.type='button';pay.textContent='PAY 20,000 TREE & PLAY';
 const note=document.createElement('p');note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.textContent='Connect your Sui wallet, then approve the payment.';
 panel.append(heading,terms,connect,pay,note);frame.insertBefore(panel,frame.querySelector('.screen-bezel'));
 function read(){const text=localStorage.getItem(KEY);return text?JSON.parse(text):null;}
 function save(p){localStorage.setItem(KEY,JSON.stringify(p));}
 async function api(c){const r=await fetch('/api/tree-entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),signal:AbortSignal.timeout(30000)});const p=await r.json();if(!r.ok)throw Error(p.error||'payment-service-unavailable');return p;}
 const current=()=>kit.stores.$connection.get().account?.address;
 async function checkout(){
  if(disposed||busy||game.scene.isActive('game'))return false;
  busy=true;pay.disabled=true;
  try{
   const payer=current();if(!payer){note.textContent='Connect your Sui wallet using the button above. If the wallet blocks this site, payment cannot proceed.';return false;}
   if(kit.stores.$currentNetwork.get()!=='mainnet')throw Error('wrong-network');
   let p=read();if(p&&p.payer!==payer)throw Error('wallet-changed');
   if(!p){const config=await api({action:'status'});if(!config.enabled||config.product?.coinType!==ENTRY.coinType||config.product?.amountRaw!==ENTRY.amountRaw||config.product?.recipient!==ENTRY.recipient)throw Error('checkout-not-enabled');
    p={token:token(),payer,runId:crypto.randomUUID(),signing:false,digest:null};save(p);
   }
   const {order,product}=await api({action:'order',token:p.token,payer});
   if(product?.amountRaw!==ENTRY.amountRaw||product?.recipient!==ENTRY.recipient||product?.coinType!==ENTRY.coinType||order.payer!==payer)throw Error('wrong-order');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(order.id))throw Error("wrong-order");
   p.orderId=order.id;if(order.digest){p.digest=order.digest;p.signing=true;}save(p);
   if(!p.signing&&!p.digest){
    if(Date.now()>Number(order.expires_at)){localStorage.removeItem(KEY);throw Error('order-expired');}
    if(current()!==payer||disposed)throw Error('wallet-changed');
    const tx=new Transaction();tx.setSender(payer);
    tx.moveCall({target:'0x1::string::utf8',arguments:[tx.pure.vector('u8',[...new TextEncoder().encode(entryReference(order.id))])]});
    tx.transferObjects([tx.coin({balance:BigInt(ENTRY.amountRaw),type:ENTRY.coinType})],tx.pure.address(ENTRY.recipient));
    note.textContent='Approve 20,000 TREE in your wallet. SUI gas is separate.';p.signing=true;save(p);
    let result;
    try{result=await kit.signAndExecuteTransaction({transaction:tx});}catch(e){if(e.code===4001||e.code==='USER_REJECTED_REQUEST'){p.signing=false;save(p);throw Error('payment-declined');}throw e;}
    if(result.$kind==='FailedTransaction'){p.signing=false;save(p);throw Error('transaction-failed');}
    p.digest=result.Transaction?.digest;if(!p.digest)throw Error('confirmation-unknown');save(p);
   }
   if(!p.digest)throw Error('confirmation-unknown');
   note.textContent='Verifying your payment. Do not pay again.';
   try{await kit.getClient('mainnet').core.waitForTransaction({digest:p.digest});}catch{}
   const verified=await api({action:'verify',token:p.token,digest:p.digest});if(!verified.verified||verified.orderId!==p.orderId)throw Error('payment-not-verified');
   if(current()!==payer||disposed)throw Error('wallet-changed');
   const started=await api({action:'start',token:p.token,runId:p.runId});if(!started.authorized||started.runId!==p.runId)throw Error('payment-not-verified');
   if(current()!==payer||disposed)throw Error('wallet-changed');
   note.textContent='Payment verified. Starting your run…';game.registry.set('treeEntryRun',p.runId);
   return true;
  }catch(e){
   const messages={'wallet-changed':'Select the wallet used for this pending payment. No additional payment will be requested.','wrong-network':'Select Sui Mainnet in your wallet.','payment-declined':'Payment declined. You can try again.','transaction-failed':'Transaction failed. TREE payment did not succeed; SUI gas may have been charged.','confirmation-unknown':'Payment submission is uncertain. Do not pay again. Check your wallet transaction history; keep this page and contact support.','order-expired':'The unpaid order expired. Press Pay to prepare a new order.','payment-already-used':'This payment has already been used for a run.'};
   note.textContent=messages[e.message]||'Payment could not be confirmed. Keep this page and retry verification; do not send another payment.';return false;
  }finally{busy=false;if(!disposed){pay.disabled=false;try{pay.textContent=read()?.signing?'CHECK PAYMENT & PLAY':'PAY 20,000 TREE & PLAY';}catch{}}}
 }
 async function enter(){
  if(!navigator.locks){note.textContent='Use a current browser with payment locking support.';return false;}
  return navigator.locks.request('treeforce89-entry',{ifAvailable:true},async lock=>lock?checkout():false);
 }
 const requestStart=async()=>{if(await enter()&&!disposed){game.scene.stop('title');game.scene.stop('gameover');game.scene.start('game');}};
 pay.onclick=()=>void requestStart();game.registry.set('treeEntryCheck',enter);
 const started=()=>{localStorage.removeItem(KEY);pay.disabled=true;note.textContent='Run in progress. Losing all 3 lives ends this run.';};
 const ended=()=>{pay.disabled=false;note.textContent='Run ended. Your next run costs 20,000 TREE.';};
 game.events.on('tree-entry:started',started);game.events.on('tree-entry:ended',ended);
 return()=>{disposed=true;game.events.off('tree-entry:started',started);game.events.off('tree-entry:ended',ended);game.registry.remove('treeEntryCheck');panel.remove();};
}
