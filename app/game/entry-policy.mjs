import {TREE_CONTINUE} from './tree-continue-policy.mjs';
export const ENTRY = Object.freeze({...TREE_CONTINUE, product:'treeforce89.entry.v1'});
export const entryReference = id => `TREE_FORCE_ENTRY_V1:${id}`;
export function verifyEntryPayment(order, tx) {
  const need=(ok,code)=>{if(!ok)throw Error(code);};
  need(tx?.finalized===true && tx.status==='success' && tx.simulated===false,'payment-not-finalized');
  need(tx.sender===order.payer,'wrong-payer');
  need(tx.timestampMs>=Number(order.issued_at) && tx.timestampMs<=Number(order.expires_at),'payment-outside-window');
  need(tx.paymentReferences?.length===1 && tx.paymentReferences[0]===entryReference(order.id),'wrong-payment-reference');
  const totals=new Map();
  for(const b of tx.balanceChanges||[])if(b.coinType===ENTRY.coinType)totals.set(b.owner,(totals.get(b.owner)||0n)+BigInt(b.amount));
  need(totals.get(order.payer)===-BigInt(ENTRY.amountRaw) && totals.get(ENTRY.recipient)===BigInt(ENTRY.amountRaw) && [...totals].every(([a,n])=>a===order.payer||a===ENTRY.recipient||n===0n),'wrong-payment-amount');
  return true;
}
