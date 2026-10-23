import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT,treeBaseUnits} from './tree-payment.mjs';

export async function reviewContinuation(session,{fetchImpl=fetch,signal}={}) {
  const response=await fetchImpl('/.netlify/functions/tree-continue-offer',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.sessionToken},
    body:JSON.stringify({runId:session.runId}),cache:'no-store',signal,
  });
  let offer;
  try {offer=await response.json();}catch{throw Error('Checkout details could not be loaded. Please retry.');}
  if(!response.ok)throw Error(offer.error||'Checkout details could not be loaded.');
  if(offer.enabled!==false || offer.recipientConfirmed!==false || offer.runId!==session.runId ||
    offer.network!=='sui:mainnet' || offer.coinType!==TREE_COIN_TYPE ||
    offer.recipient!==TREE_PAYMENT_RECIPIENT || offer.price!=='20000' || offer.lives!==3 ||
    offer.amountBaseUnits!==treeBaseUnits(offer.decimals).toString())
    throw Error('Checkout details could not be verified. No payment was requested.');
  return offer;
}
