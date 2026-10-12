import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bcs} from '@mysten/sui/bcs';
import {paymentTransaction,createPaymentWallet} from './wallet.mjs';
import {TREE_CONTINUE as P} from '../tree-continue-policy.mjs';
const stable=v=>v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
function fixture(){
 const now=Date.now(),t={kind:'direct-continue',product:P.product,policyVersion:'treeforce89-20000-tree-v1',network:P.network,chainIdentifier:'35834a8a',decimals:6,coinType:P.coinType,recipient:P.recipient,requiredRaw:P.amountRaw,quantity:1,restoreLives:3,orderId:crypto.randomUUID(),accountId:crypto.randomUUID(),runId:crypto.randomUUID(),payer:'0x'+'1'.repeat(64),paymentMethod:'tree-transfer-v1',flightHash:'a'.repeat(64),issuedAtMs:now,expiresAtMs:now+900000};
 t.quoteHash=createHash('sha256').update(stable(t)).digest('hex');
 return{now,order:{...P,orderId:t.orderId,accountId:t.accountId,runId:t.runId,payer:t.payer,terms:t,payable:true}};
}
test('standard transfer needs no custom deployment, quote signature, network fetch or app gas selection',async()=>{
 const f=fixture(),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('network forbidden');};
 try{
  const tx=await paymentTransaction(f.order,undefined,f.now),d=tx.getData();
  assert.equal(d.sender,f.order.payer);assert.equal(d.gasData.budget,null);assert.equal(d.gasData.payment,null);
  const memo=d.commands.find(c=>c.MoveCall)?.MoveCall;
  assert.equal(memo.package,'0x'+'0'.repeat(63)+'1');assert.equal(memo.module,'string');assert.equal(memo.function,'utf8');
  assert.equal(bcs.string().parse(Buffer.from(d.inputs[memo.arguments[0].Input].Pure.bytes,'base64')),'TREE_FORCE_CONTINUE_V1:'+f.order.terms.quoteHash);
  const transfer=d.commands.find(c=>c.TransferObjects)?.TransferObjects;
  assert.equal(transfer.objects.length,1);assert.equal(bcs.Address.parse(Buffer.from(d.inputs[transfer.address.Input].Pure.bytes,'base64')),P.recipient);
  assert.ok(JSON.stringify(d,(_k,v)=>typeof v==='bigint'?String(v):v).includes(P.amountRaw));
 }finally{globalThis.fetch=old;}
});
for(const [name,change] of [
 ['wrong recipient',f=>f.order.recipient='0x'+'2'.repeat(64)],['underpriced',f=>f.order.amountRaw='1'],
 ['other flight',f=>f.order.terms.runId=crypto.randomUUID()],['other payer',f=>f.order.terms.payer='0x'+'2'.repeat(64)],
 ['modified reference',f=>f.order.terms.quoteHash='b'.repeat(64)],['extra contract fields',f=>f.order.terms.checkoutId='0x'+'3'.repeat(64)],
 ['future',f=>f.now--],['not payable',f=>f.order.payable=false]
])test('standard transfer rejects '+name,async()=>{const f=fixture();change(f);await assert.rejects(paymentTransaction(f.order,undefined,f.now));});
test('wallet connect timeout cannot request a payment or leave a second pending connection',async()=>{
 const f=fixture();let resolve,connections=0,payments=0;
 const kit={stores:{$connection:{get:()=>({})},$wallets:{get:()=>[{}]},$currentNetwork:{get:()=> 'mainnet'}},connectWallet:()=>{connections++;return new Promise(r=>resolve=r);},signAndExecuteTransaction:()=>{payments++;}};
 const wallet=createPaymentWallet({kit,selectWallet:async rows=>rows[0],connectTimeoutMs:5});
 await assert.rejects(wallet.connect(f.order.payer),/wallet-connection-timeout/);
 await assert.rejects(wallet.connect(f.order.payer),/wallet-connection-pending/);
 resolve({});await new Promise(r=>setImmediate(r));assert.equal(connections,1);assert.equal(payments,0);
});

test('late approval remains payable for this exact saved flight',async()=>{const f=fixture();const tx=await paymentTransaction(f.order,undefined,f.now+9000001);assert.equal(tx.getData().sender,f.order.payer);});
