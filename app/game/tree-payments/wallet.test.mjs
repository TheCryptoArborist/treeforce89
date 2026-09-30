import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { bcs } from '@mysten/sui/bcs';
import { paymentTransaction, APPROVED_DEPLOYMENT } from './wallet.mjs';
import { TREE_CONTINUE as P } from '../tree-continue-policy.mjs';
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const Quote=bcs.struct('Quote',{domain:bcs.vector(bcs.u8()),checkout_id:bcs.Address,key_epoch:bcs.u64(),order_id:bcs.vector(bcs.u8()),account_id:bcs.vector(bcs.u8()),payer:bcs.Address,recipient:bcs.Address,coin_type:bcs.string(),amount_raw:bcs.u64(),issued_at_ms:bcs.u64(),expires_at_ms:bcs.u64(),quote_hash:bcs.vector(bcs.u8())});
function fixture(){
 const now=1800000000000,{privateKey,publicKey}=generateKeyPairSync('ed25519');
 const d={network:P.network,packageId:'0x'+'3'.repeat(64),checkoutId:'0x'+'4'.repeat(64),initialSharedVersion:'1',keyEpoch:'1',quotePublicKey:publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex')};
 const t={kind:'direct-continue',product:P.product,policyVersion:'treeforce89-20000-tree-v1',quantity:1,restoreLives:3,
 network:P.network,chainIdentifier:'35834a8a',decimals:6,coinType:P.coinType,recipient:P.recipient,requiredRaw:P.amountRaw,
 orderId:crypto.randomUUID(),runId:crypto.randomUUID(),accountId:crypto.randomUUID(),payer:'0x'+'1'.repeat(64),
 checkoutPackage:d.packageId,checkoutId:d.checkoutId,keyEpoch:d.keyEpoch,eventType:d.packageId+'::checkout::Purchase',flightHash:'a'.repeat(64),issuedAtMs:now,expiresAtMs:now+45000};
 t.quoteHash=createHash('sha256').update(stable(t)).digest('hex');
 const q={domain:[...new TextEncoder().encode('TREE_CC_CHECKOUT_V1:sui:mainnet')],checkout_id:d.checkoutId,key_epoch:d.keyEpoch,
 order_id:[...Buffer.from(t.orderId.replaceAll('-',''),'hex')],account_id:[...Buffer.from(t.accountId.replaceAll('-',''),'hex')],
 payer:t.payer,recipient:t.recipient,coin_type:t.coinType,amount_raw:t.requiredRaw,issued_at_ms:String(now),expires_at_ms:String(now+45000),quote_hash:[...Buffer.from(t.quoteHash,'hex')]};
 const bytes=Quote.serialize(q).toBytes();
 const o={...P,orderId:t.orderId,runId:t.runId,accountId:t.accountId,payer:t.payer,terms:t,payable:true,
 quoteBase64:Buffer.from(bytes).toString('base64'),signatureBase64:sign(null,bytes,privateKey).toString('base64')};
 return {o,d,now};
}
test('deployment stays unset and no real transaction can be prepared by default',async()=>{
 const f=fixture();assert.equal(APPROVED_DEPLOYMENT,null);await assert.rejects(paymentTransaction(f.o,null,f.now),/checkout-not-enabled/);
});
test('actual SDK prepares fixed TREE Transaction without fetch, building bytes, or gas selection',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden');};
 try {const tx=await paymentTransaction(f.o,f.d,f.now),data=tx.getData();
 assert.equal(data.sender,f.o.payer);assert.equal(data.gasData.budget,null);assert.equal(data.gasData.payment,null);
 const call=data.commands.find(c=>c.$kind==='MoveCall');assert.equal(call.MoveCall.package,f.d.packageId);
 assert.equal(call.MoveCall.function,'pay');assert.deepEqual(call.MoveCall.typeArguments,[P.coinType]);
 const serialized=await tx.toJSON();assert.ok(serialized.includes(P.amountRaw));
 }finally{globalThis.fetch=old;}
});
for(const [name,mutate] of [
 ['underpriced order',f=>f.o.amountRaw='1'],['redirect',f=>f.o.recipient='0x'+'2'.repeat(64)],['wrong network',f=>f.o.network='sui:testnet'],
 ['modified flight',f=>f.o.terms.runId=crypto.randomUUID()],['wrong key',f=>f.d.quotePublicKey='1'.repeat(64)],
 ['wrong instance',f=>f.d.checkoutId='0x'+'5'.repeat(64)],['expired',f=>f.now+=45001],['future',f=>f.now--],
 ['tampered signature',f=>f.o.signatureBase64=Buffer.alloc(64).toString('base64')],['extra BCS bytes',f=>f.o.quoteBase64=Buffer.concat([Buffer.from(f.o.quoteBase64,'base64'),Buffer.from([0])]).toString('base64')]
])test('browser builder rejects '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(paymentTransaction(f.o,f.d,f.now));});
test('caller mutation cannot change the exact transaction being prepared',async()=>{
 const f=fixture(),promise=paymentTransaction(f.o,f.d,f.now);f.o.amountRaw='1';f.d.packageId='0x'+'6'.repeat(64);
 const tx=await promise;assert.equal(tx.getData().commands.find(c=>c.$kind==='MoveCall').MoveCall.package,'0x'+'3'.repeat(64));
});
