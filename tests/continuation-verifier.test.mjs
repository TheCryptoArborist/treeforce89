import test from "node:test";
import assert from "node:assert/strict";
import {verifyAndRedeemContinuation} from "../app/game/continuation-verifier.mjs";
import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT} from "../app/game/tree-payment.mjs";

const digest="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const wallet="0x1234";
const claim={digest,wallet,runId:"grove-123"};
const session={sessionId:"server-session-1",wallet,runId:"grove-123",wave:4,gameOver:true,cleared:false,continuePending:true,continuationNumber:1,createdAt:1700000000000,expiresAt:1900000000000};
const goodTx={network:"mainnet",success:true,checkpoint:"123",timestampMs:1700000000001,sender:wallet,balanceChanges:[{coinType:TREE_COIN_TYPE,owner:{kind:"AddressOwner",address:TREE_PAYMENT_RECIPIENT},amount:"20000000000000"}]};
const make=({tx=goodTx,storeResult=true,overrideSession=session}={})=>{
 let fetchCount=0,consumeCount=0;
 return {
  deps:{claim,session:overrideSession,decimals:9,fetchTransaction:async()=>{fetchCount++;return tx},store:{consumeOnce:async()=>{consumeCount++;return storeResult}}},
  counts:()=>({fetchCount,consumeCount}),
 };
};
test("redeems exactly one confirmed TREE payment",async()=>{
 const ctx=make();
 const result=await verifyAndRedeemContinuation(ctx.deps);
 assert.deepEqual(result,{authorized:true,runId:"grove-123",lives:3,wave:4});
 assert.deepEqual(ctx.counts(),{fetchCount:1,consumeCount:1});
});
test("rejects wrong coin without consuming",async()=>{
 const ctx=make({tx:{...goodTx,balanceChanges:[{...goodTx.balanceChanges[0],coinType:"0x2::sui::SUI"}]}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/Insufficient/);
 assert.equal(ctx.counts().consumeCount,0);
});
test("rejects insufficient recipient net increase",async()=>{
 const ctx=make({tx:{...goodTx,balanceChanges:[{...goodTx.balanceChanges[0],amount:"20000000000000"},{...goodTx.balanceChanges[0],amount:"-1"}]}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/Insufficient/);
 assert.equal(ctx.counts().consumeCount,0);
});
test("rejects wrong recipient",async()=>{
 const ctx=make({tx:{...goodTx,balanceChanges:[{...goodTx.balanceChanges[0],owner:{kind:"AddressOwner",address:"0x999"}}]}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/Insufficient/);
});
test("rejects wrong sender",async()=>{
 const ctx=make({tx:{...goodTx,sender:"0x999"}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/sender/);
});
test("rejects failed transaction",async()=>{
 const ctx=make({tx:{...goodTx,success:false}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/successful/);
});
test("rejects wrong network",async()=>{
 const ctx=make({tx:{...goodTx,network:"testnet"}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/mainnet/);
});
test("rejects completed run before transaction lookup",async()=>{
 const ctx=make({overrideSession:{...session,cleared:true}});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/not awaiting/);
 assert.equal(ctx.counts().fetchCount,0);
});
test("rejects duplicate redemption",async()=>{
 const ctx=make({storeResult:false});
 await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/already redeemed/);
});
test("fails closed without trusted dependencies",async()=>{
 await assert.rejects(verifyAndRedeemContinuation({claim,session,decimals:9}),/Trusted verification/);
});
test('old receipts, receipts after expiry and uncheckpointed receipts never reach redemption',async()=>{
 for(const patch of [{timestampMs:session.createdAt-1},{timestampMs:session.expiresAt},{checkpoint:null},{timestampMs:null}]){
   const ctx=make({tx:{...goodTx,...patch}});
   await assert.rejects(verifyAndRedeemContinuation(ctx.deps),/lifetime|checkpointed/);
   assert.equal(ctx.counts().consumeCount,0);
 }
});
