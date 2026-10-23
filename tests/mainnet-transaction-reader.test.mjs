import test from "node:test";
import assert from "node:assert/strict";
import {createMainnetTransactionReader} from "../app/game/mainnet-transaction-reader.mjs";

const digest="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const successful={
  $kind:"Transaction",
  Transaction:{
    digest,
    status:{success:true},effects:{status:{success:true}},checkpoint:"123",timestampMs:1700000000001,
    transaction:{sender:"0x1234"},
    balanceChanges:[{coinType:"0x2::sui::SUI",amount:"-1000",address:"0x1234"}],
  },
};
const make=(response=successful,network="mainnet")=>{
 const calls=[];
 return {client:{network,core:{getTransaction:async args=>{calls.push(args);return response}}},calls};
};
test("reads mainnet transaction and normalizes trusted balance changes",async()=>{
 const mock=make();
 const result=await createMainnetTransactionReader(mock.client)(digest);
 assert.equal(result.network,"mainnet");
 assert.equal(result.success,true);
 assert.equal(result.sender.length,66);
 assert.equal(result.balanceChanges[0].owner.address.length,66);
 assert.equal(mock.calls[0].digest,digest);
 assert.equal(mock.calls[0].include.balanceChanges,true);
});
test("rejects testnet client",()=>{
 assert.throws(()=>createMainnetTransactionReader(make(successful,"testnet").client),/Mainnet/);
});
test("rejects invalid digest without query",async()=>{
 const mock=make();
 await assert.rejects(createMainnetTransactionReader(mock.client)("invalid"),/Invalid transaction digest/);
 assert.equal(mock.calls.length,0);
});
test("rejects failed transaction",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"FailedTransaction"}).client)(digest),/unavailable or failed/);
});
test("rejects wrong digest",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"Transaction",Transaction:{...successful.Transaction,digest:"different"}}).client)(digest),/Digest mismatch/);
});
test("rejects missing successful effects",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"Transaction",Transaction:{...successful.Transaction,effects:{status:{success:false}}}}).client)(digest),/effects/);
});
test("rejects missing sender",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"Transaction",Transaction:{...successful.Transaction,transaction:{}}}).client)(digest),/sender/);
});
test("rejects missing balance changes",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"Transaction",Transaction:{...successful.Transaction,balanceChanges:undefined}}).client)(digest),/balance changes/);
});
test("rejects malformed balance change",async()=>{
 await assert.rejects(createMainnetTransactionReader(make({$kind:"Transaction",Transaction:{...successful.Transaction,balanceChanges:[{amount:123}]}}).client)(digest),/balance change/);
});
test('rejects uncheckpointed transactions and legacy owner fields',async()=>{
 for(const patch of [{checkpoint:null},{timestampMs:null},{status:{success:false}},
   {balanceChanges:[{coinType:'0x2::sui::SUI',amount:'10',owner:{$kind:'AddressOwner',AddressOwner:'0x1234'}}]}])
   await assert.rejects(createMainnetTransactionReader(make({$kind:'Transaction',Transaction:{...successful.Transaction,...patch}}).client)(digest));
});
