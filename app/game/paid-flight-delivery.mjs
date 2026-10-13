/** Receipt-backed delivery only. This module never connects a wallet or pays.
 * Kept separate from the practice recovery action. No live endpoint is enabled.
 * loadPaused must reconstruct/validate the saved flight and return synchronous
 * assertPaused(), restore(3), resume() methods for that exact scene instance.
 */
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=(ok,code)=>{if(!ok)fail(code);};
const protocol='tree-paid-delivery.v1';
const randomKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
export function createPaidFlightDelivery({api,identity,runId,expectedOrderId=null,loadPaused,report=()=>{}}){
 check(typeof api==='function'&&typeof identity==='function'&&typeof loadPaused==='function'&&ID.test(runId),'invalid-paid-delivery-setup');
 let owner=null,prepared=null,scene=null,activation=null,busy=false,closed=false,applyStarted=false,restored=false,done=false,terminal=false,phase='ready';
 // Deliberately memory-only. A new tab/page must acquire its own unconsumed lease.
 const clientKey=randomKey();
 const notify=value=>{phase=value;try{report({phase,runId,orderId:prepared?.orderId,requiresPayment:false});}catch{}};
 function assertOwner(){
  check(!closed,'delivery-page-closed');const i=identity();
  check(i?.authenticated===true&&i.wallet?.family==='sui'&&ID.test(i.accountId||''),'sui-sign-in-required');
  const current={accountId:i.accountId,payer:i.wallet.address};
  if(owner)check(current.accountId===owner.accountId&&current.payer===owner.payer,'account-changed');else owner=current;
 }
 function response(value){
  check(value?.protocol===protocol&&value.runId===runId&&ID.test(value.orderId||'')&&value.requiresPayment===false,'invalid-paid-delivery-response');
  if(expectedOrderId)check(value.orderId===expectedOrderId,'paid-order-mismatch');
  return value;
 }
 return{
  get state(){return{phase,busy,restored,done,terminal,requiresPayment:false};},
  async resume(){
   if(busy||closed||done)return false;if(terminal)fail('delivery-review-required');busy=true;
   try{
    assertOwner();
    if(!prepared){
     notify('preparing');const p=response(await api({action:'prepare_delivery',runId,clientKey}));assertOwner();
     if(p.status!=='prepared')fail(p.status==='review-required'?'delivery-review-required':p.status==='in-use'?'delivery-in-use':'payment-not-yet-verified');
     check(p.restoreAuthorized===false&&ID.test(p.leaseId||'')&&HEX.test(p.checkpointHash||'')&&typeof p.snapshotText==='string'&&new TextEncoder().encode(p.snapshotText).byteLength<=262144,'invalid-paid-checkpoint');
     check(await hash(p.snapshotText)===p.checkpointHash,'paid-checkpoint-corrupt');assertOwner();
     const snapshot=JSON.parse(p.snapshotText);
     check(snapshot.runId===runId&&snapshot.format==='treeforce89.checkpoint.v1'&&snapshot.lives===0&&snapshot.continuesUsed===0,'paid-checkpoint-mismatch');
     const port=await loadPaused(snapshot,{runId,orderId:p.orderId,checkpointHash:p.checkpointHash});assertOwner();
     check(port&&['assertPaused','restore','resume'].every(k=>typeof port[k]==='function'),'invalid-paused-flight');
     port.assertPaused();scene=port;prepared=p;
     activation={action:'activate_delivery',runId,clientKey,leaseId:p.leaseId,requestId:crypto.randomUUID(),checkpointHash:p.checkpointHash};
    }
    assertOwner();scene.assertPaused();notify('activating');
    // A lost response is UNKNOWN: retry precisely this command in this page.
    const a=response(await api(activation));assertOwner();
    if(a.status==='review-required'){terminal=true;fail('delivery-review-required');}
    check(a.status==='started'&&a.restoreAuthorized===true&&a.lives===3&&a.orderId===prepared.orderId&&
     a.leaseId===activation.leaseId&&a.activationId===activation.requestId&&a.checkpointHash===activation.checkpointHash,'invalid-paid-activation');
    scene.assertPaused();
    if(!applyStarted){
     // Set the latch BEFORE touching Phaser: partial application must not replay.
     applyStarted=true;
     try{const result=scene.restore(3);check(!result?.then,'asynchronous-flight-restore');restored=true;}
     catch{terminal=true;fail('delivery-review-required');}
    }
    if(!restored){terminal=true;fail('delivery-review-required');}
    try{const result=scene.resume();check(!result?.then,'asynchronous-flight-resume');}
    catch{terminal=true;fail('delivery-review-required');}
    done=true;notify('complete');return true;
   }catch(e){
    if(e.code==='delivery_lease_expired'&&!applyStarted){prepared=null;scene=null;activation=null;}
    notify(terminal||e.code==='delivery-review-required'?'review-required':'retry-without-payment');throw e;
   }finally{busy=false;}
  },
  dispose(){closed=true;notify('closed');},
 };
}
