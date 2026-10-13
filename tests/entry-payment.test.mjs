import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ENTRY,entryReference,verifyEntryPayment} from '../app/game/entry-policy.mjs';
import {createEntryService} from '../netlify/lib/entry-service.mjs';
const payer='0x'+'a'.repeat(64),id='e93b5297-ef1b-4afe-aac7-6eb4a87ef410';
const order={id,payer,issued_at:'1000',expires_at:'901000'};
function payment(){return {finalized:true,simulated:false,status:'success',sender:payer,timestampMs:2000,paymentReferences:[entryReference(id)],balanceChanges:[{owner:payer,coinType:ENTRY.coinType,amount:'-20000000000'},{owner:ENTRY.recipient,coinType:ENTRY.coinType,amount:'20000000000'}]};}
test('finalized exact TREE entry payment is accepted',()=>assert.equal(verifyEntryPayment(order,payment()),true));
for(const [name,mutate] of [
 ['failed transaction',t=>t.status='failed'],['simulation',t=>t.simulated=true],['unfinalized transaction',t=>t.finalized=false],
 ['another payer',t=>t.sender=ENTRY.recipient],['old payment',t=>t.timestampMs=999],['expired quote',t=>t.timestampMs=901001],
 ['another order',t=>t.paymentReferences=[entryReference('other')]],['duplicate reference',t=>t.paymentReferences.push(entryReference(id))],
 ['underpayment',t=>t.balanceChanges[1].amount='19999999999'],['wrong token',t=>t.balanceChanges.forEach(b=>b.coinType='0x2::sui::SUI')],
 ['wrong recipient',t=>t.balanceChanges[1].owner='0x'+'b'.repeat(64)],['additional TREE recipient',t=>t.balanceChanges.push({owner:'0x'+'b'.repeat(64),coinType:ENTRY.coinType,amount:'1'})]
])test(`rejects ${name}`,()=>{const tx=payment();mutate(tx);assert.throws(()=>verifyEntryPayment(order,tx));});

test('browser assertions cannot start an unpaid run',async()=>{
 const service=createEntryService({pool:{query:async()=>({rows:[{...order,digest:null}]})},reader:{}});
 await assert.rejects(service({action:'start',token:'a'.repeat(64),runId:crypto.randomUUID(),verified:true}),/payment-not-verified/);
});
test('another browser capability cannot access an existing order',async()=>{
 const service=createEntryService({pool:{query:async()=>({rows:[]})},reader:{}});
 await assert.rejects(service({action:'verify',token:'b'.repeat(64),digest:'abc'}),/order-not-found/);
});
test('verification failure never writes a payment record',async()=>{
 let writes=0;const pool={query:async(sql)=>{if(sql.startsWith('update'))writes++;return {rows:[order]};}};
 const tx=payment();tx.balanceChanges[1].amount='1';
 const reader={getNetworkIdentity:async()=>{},getFinalizedTransaction:async()=>tx};
 const service=createEntryService({pool,reader});
 await assert.rejects(service({action:'verify',token:'a'.repeat(64),digest:'4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S'}),/wrong-payment-amount/);assert.equal(writes,0);
});
test('a paid order already bound to another run cannot authorize a new run',async()=>{
 const pool={query:async sql=>({rows:sql.startsWith('update')?[]:[{...order,digest:'known',run_id:crypto.randomUUID()}]})};
 const service=createEntryService({pool,reader:{}});
 await assert.rejects(service({action:'start',token:'a'.repeat(64),runId:crypto.randomUUID()}),/payment-already-used/);
});
