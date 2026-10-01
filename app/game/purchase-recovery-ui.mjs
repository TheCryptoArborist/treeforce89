import {createPaidFlightDelivery} from './paid-flight-delivery.mjs';
import {holdGameForAccount} from './account-pause.mjs';
const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
const button=text=>{const b=el('button',text);b.type='button';return b;};
const copy={
 'delivery-review-required':'This continue has an activation record and needs review. Do not pay again. Keep the order and flight details below.',
 'delivery-in-use':'This continue is being prepared in another tab. Return there, or wait for its reservation to expire. No new payment is needed.',
 'payment-not-yet-verified':'The payment is not confirmed yet. Check again in a moment; do not pay again.',
 'sui-sign-in-required':'Sign in with the same Sui wallet used for the purchase.',
 'account-changed':'The account changed. Reopen this panel using the original Sui account.',
 'checkout-not-enabled':'Purchase recovery is not connected to the hosted payment service yet. No payment was requested.',
};
/** Explicit order recovery from server storage, including when localStorage was
 * cleared. Never imports a wallet or submits an order/transaction. */
export function installPurchaseRecovery(game,frame,{api,loader,pending}){
 const open=button('RECOVER TREE PURCHASE');open.className='tree-purchase-recovery';
 Object.assign(open.style,{display:'block',margin:'12px auto',padding:'12px 18px',border:'1px solid #a9cbbc',borderRadius:'10px',background:'#09231c',color:'#edf9f2',fontWeight:'700',cursor:'pointer'});
 const dialog=el('dialog');dialog.className='tree-continue-dialog';dialog.setAttribute('aria-label','Recover TREE purchase');
 const message=el('p');message.setAttribute('role','status');
 const rows=el('div'),details=el('p');details.style.overflowWrap='anywhere';details.style.whiteSpace='pre-line';
 const signIn=button('SIGN IN WITH SUI'),refresh=button('CHECK PURCHASES — NO PAYMENT'),more=button('OLDER PURCHASES'),close=button('CLOSE');more.hidden=true;
 dialog.append(el('h2','RECOVER YOUR CONTINUE'),el('p','Check an existing purchase without sending TREE again.'),signIn,refresh,message,rows,more,details,close);
 (frame.parentElement||frame).append(open);document.body.append(dialog);
 let disposed=false,busy=false,epoch=0,owner=null,cursor=null,release=null;const controllers=new Map();
 const identity=()=>game.registry.get('treeAccountIdentity');
 const defaultPrompt=()=>document.getElementById('tree-continue-heading')?.closest('dialog');
 function current(){const i=identity();if(i?.authenticated!==true||i.wallet?.family!=='sui')throw Object.assign(Error('sui-sign-in-required'),{code:'sui-sign-in-required'});if(owner&&(i.accountId!==owner.accountId||i.wallet.address!==owner.payer))throw Object.assign(Error('account-changed'),{code:'account-changed'});return i;}
 function refreshButtons(){signIn.hidden=identity()?.authenticated===true&&identity()?.wallet?.family==='sui';refresh.disabled=busy;more.disabled=busy;close.disabled=busy;open.disabled=busy;}
 function error(e){message.textContent=copy[e.code]||'Recovery could not be confirmed. Keep these purchase details and do not pay again.';}
 function stop(){
  epoch++;for(const c of controllers.values())c.dispose();controllers.clear();owner=null;cursor=null;rows.replaceChildren();details.textContent='';release?.();release=null;if(dialog.open)dialog.close();
  const scene=game.scene.getScene('game'),prompt=defaultPrompt();
  // Presentation only: leaving recovery restores the exhausted-flight options,
  // not gameplay. A consumed entitlement still requires server review.
  if(!disposed&&scene?.lives===0&&scene.paused&&game.scene.isPaused('game')&&prompt&&!prompt.open)prompt.showModal();
 }
 async function list(older=false){
  if(busy||disposed)return;busy=true;refreshButtons();const version=epoch;
  try{
   const i=current();owner??={accountId:i.accountId,payer:i.wallet.address};
   const result=await api({action:'list_purchases',...(older&&cursor?{afterOrderId:cursor}:{})});
   if(disposed||version!==epoch)return;current();
   if(result?.accountId!==owner.accountId||result.deliveryProtocol!=='tree-paid-delivery.v1'||result.requiresPayment!==false||!Array.isArray(result.purchases)||result.purchases.length>25)throw Error('invalid-list');
   if(!older)rows.replaceChildren();
   message.textContent=result.purchases.length?'Select your purchase to check its payment and continue.':'No purchases were found for this signed-in account.';
   cursor=result.afterOrderId;more.hidden=!cursor;
   for(const row of result.purchases){
    const b=button(`CHECK WAVE ${row.wave} · ${Number(row.score).toLocaleString()} POINTS — NO PAYMENT`);b.dataset.orderId=row.orderId;
    b.onclick=async()=>{
     if(busy||disposed)return;busy=true;refreshButtons();const version=epoch;
     try{
      current();details.textContent=`Order: ${row.orderId}\nFlight: ${row.runId}`;
      const result=await api({action:'recover_purchase',runId:row.runId});
      if(disposed||version!==epoch)return;current();
      if(result?.accountId!==owner.accountId||result.deliveryProtocol!=='tree-paid-delivery.v1'||result.authorization!==null||result.order?.orderId!==row.orderId||result.order.runId!==row.runId)throw Error('invalid-order');
      if(!['verified','delivered'].includes(result.status))throw Object.assign(Error('pending'),{code:'payment-not-yet-verified'});
      release?.();release=null;
      let c=controllers.get(row.orderId);
      if(!c){c=createPaidFlightDelivery({api,identity,runId:row.runId,expectedOrderId:row.orderId,loadPaused:async(s,b)=>{
       const port=await loader.loadPaused(s,b);
       // Fresh scene exhaustion opens its normal dialog. Keep this recovery
       // panel on top so a lost response can be retried using the same lease.
       const prompt=defaultPrompt();if(prompt?.open)prompt.close();return port;
      }});controllers.set(row.orderId,c);}
      message.textContent='Preparing your saved flight. No payment request.';
      if(await c.resume()){try{pending.clear(row.runId,row.orderId);}catch{}stop();}
     }catch(e){error(e);}finally{busy=false;refreshButtons();}
    };
    rows.append(b);
   }
  }catch(e){error(e);}finally{busy=false;refreshButtons();}
 }
 function openPanel(){if(disposed||busy||dialog.open)return;release=holdGameForAccount(game);dialog.showModal();refreshButtons();void list();}
 open.onclick=openPanel;
 refresh.onclick=()=>list();more.onclick=()=>list(true);close.onclick=stop;
 signIn.onclick=()=>game.events.emit('tree-account:open');
 dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('cancel',e=>{e.preventDefault();if(!busy)stop();});
 const changed=()=>{epoch++;for(const c of controllers.values())c.dispose();controllers.clear();owner=null;cursor=null;rows.replaceChildren();details.textContent='';more.hidden=true;message.textContent='Account changed. Check purchases for the current Sui account.';refreshButtons();};
 game.events.on('tree-account:identity',changed);game.events.on('tree-purchase-recovery:open',openPanel);
 return()=>{disposed=true;stop();game.events.off('tree-account:identity',changed);game.events.off('tree-purchase-recovery:open',openPanel);open.remove();dialog.remove();};
}
