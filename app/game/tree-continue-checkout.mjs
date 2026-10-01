import {TREE_CONTINUE,requireContinue as check,validateOrder,sameAddress} from './tree-continue-policy.mjs';
import {createPaidFlightDelivery} from './paid-flight-delivery.mjs';
const PROTOCOL='tree-paid-delivery.v1';
/** Default checkout orchestration. Verification NEVER directly restores lives.
 * All restoration goes through the receipt-bound preparation/activation controller.
 * Reload recovery first consults the server; browser markers are hints, not proof.
 */
export function createTreeContinueAttempt({api,wallet,identity,clientRunId,prepare,loadPaused,report=()=>{},pending}){
 let order=null,owner=null,busy=false,closed=false,done=false,signingAttempted=false,digest=null,delivery=null,phase='ready';
 const ids=Object.fromEntries(['order','reconcile','cancel'].map(k=>[k,crypto.randomUUID()]));
 const update=(value,message)=>{phase=value;try{report({phase,message,order,digest});}catch{}};
 function account(){
  const i=identity();check(!closed,'flight-ended');check(i?.authenticated===true&&i.wallet?.family==='sui','sui-sign-in-required');
  if(owner)check(i.accountId===owner.accountId&&sameAddress(i.wallet.address,owner.payer),'account-changed');
  else owner={accountId:i.accountId,payer:i.wallet.address};return owner;
 }
 const send=(action,extra={})=>api({action,runId:clientRunId,requestId:ids[action],...extra});
 const persist=()=>pending.save({runId:clientRunId,orderId:order.orderId,accountId:owner.accountId,payer:owner.payer,digest,signingAttempted});
 function validate(result){
  account();check(result?.deliveryProtocol===PROTOCOL&&result.authorization===null,'delivery-protocol-required');
  const next=validateOrder(result.order,clientRunId,owner.accountId,owner.payer);
  if(order)check(order.orderId===next.orderId,'wrong-reconciled-order');return next;
 }
 async function deliver(result){
  order=structuredClone(validate(result));
  check(['verified','delivered'].includes(result.status),'payment-not-yet-verified');
  prepare();
  delivery??=createPaidFlightDelivery({api,identity,runId:clientRunId,expectedOrderId:order.orderId,loadPaused,
   report:s=>update(s.phase,s.phase==='complete'?'Continue ready.':'Confirming this saved-flight continue. No additional payment.')});
  const ok=await delivery.resume();account();
  if(ok){done=true;try{pending.clear(clientRunId,order.orderId);}catch{}update('complete','Continue ready.');}
  return ok;
 }
 return{
  get state(){return{busy,closed,done,phase,order,digest,signingAttempted,restored:!!delivery?.state.restored,canDecline:!busy&&!signingAttempted&&!delivery};},
  async continue(){
   if(busy||closed||done)return false;busy=true;
   try{
    account();prepare();
    if(!order){
     const saved=pending.read?.();
     if(saved?.signingAttempted&&saved.runId!==clientRunId)check(false,'earlier-purchase-recovery-required');
     if(saved?.runId===clientRunId)check(saved.accountId===owner.accountId&&sameAddress(saved.payer,owner.payer),'account-changed');
     update('checking','Checking for an existing purchase before requesting payment…');
     const previous=await api({action:'recover_purchase',runId:clientRunId});account();prepare();
     check(previous?.deliveryProtocol===PROTOCOL&&previous.requiresPayment===false&&previous.accountId===owner.accountId,'delivery-protocol-required');
     if(previous.status!=='not-found'){
      order=structuredClone(validate(previous));
      if(saved?.runId===clientRunId)check(saved.orderId===order.orderId,'wrong-reconciled-order');
      signingAttempted=true;digest=saved?.runId===clientRunId?saved.digest:null;persist();return await deliver(previous);
     }
     check(!saved||saved.runId!==clientRunId,'missing-purchase-review-required');
     const config=await api({action:'status'});account();prepare();
     check(config.enabled===true&&config.deliveryProtocol===PROTOCOL,'checkout-not-enabled');
     update('connecting','Connect the Sui wallet used for this TREE Account.');
     await wallet.connect(owner.payer);account();prepare();
     const result=await send('order');account();prepare();
     order=structuredClone(validateOrder(result.order,clientRunId,owner.accountId,owner.payer));check(order.payable===true,'checkout-not-enabled');
    }
    if(!signingAttempted){
     const tx=await wallet.prepare(order);account();prepare();
     signingAttempted=true;persist();
     update('wallet','Approve 20,000 TREE in your wallet. SUI network gas is separate.');
     let result;
     try{result=await wallet.pay(tx,order);}catch(e){
      if(e?.code===4001||e?.code==='USER_REJECTED_REQUEST'){signingAttempted=false;persist();update('cancelled','Payment declined in wallet.');return false;}throw e;
     }
     digest=result?.$kind==='Transaction'?result.Transaction?.digest||null:result?.$kind==='FailedTransaction'?result.FailedTransaction?.digest||null:null;
     persist();account();
     if(digest)try{await wallet.wait(digest);}catch{/* Independent server verification is still required. */}
    }
    update('verifying','Checking your purchase. Do not pay again.');
    const result=digest?await send('reconcile',{orderId:order.orderId,digest}):await api({action:'recover_purchase',runId:clientRunId});
    return await deliver(result);
   }catch(e){update(signingAttempted?'pending':'error',e.code||'continue-unavailable');throw e;}
   finally{busy=false;}
  },
  async cancel(){
   if(busy||done||signingAttempted||delivery)return false;
   if(order)await send('cancel',{orderId:order.orderId});closed=true;if(order)pending.clear(clientRunId,order.orderId);return true;
  },
  finish(){closed=true;delivery?.dispose();},
 };
}
