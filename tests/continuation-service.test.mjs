import test from "node:test";
import assert from "node:assert/strict";
import { createContinuationService } from "../app/game/continuation-service.mjs";
import { TREE_COIN_TYPE, TREE_PAYMENT_RECIPIENT } from "../app/game/tree-payment.mjs";

const digest="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const wallet="0x1234";
const session={
  sessionId:"session-1",wallet,runId:"grove-123",wave:5,
  continuationNumber:0,gameOver:true,cleared:false,continuePending:true,
};
const payment={
  $kind:"Transaction",
  Transaction:{
    digest,
    effects:{status:{$kind:"Success"}},
    transaction:{sender:wallet},
    balanceChanges:[
      {coinType:TREE_COIN_TYPE,amount:"-20000000000000",owner:{$kind:"AddressOwner",AddressOwner:wallet}},
      {coinType:TREE_COIN_TYPE,amount:"20000000000000",owner:{$kind:"AddressOwner",AddressOwner:TREE_PAYMENT_RECIPIENT}},
    ],
  },
};
function mock({tx=payment,record=session,duplicate=false}={}){
  const statements=[];
  let lookups=0,authCalls=0,released=0;
  const pool={connect:async()=>({
    query:async(sql)=>{
      statements.push(sql);
      if(sql.includes("FOR UPDATE"))return {rows:record?[{
        wallet:record.wallet,run_id:record.runId,
        continuation_number:record.continuationNumber,
        game_over:record.gameOver,cleared:record.cleared,
        continue_pending:record.continuePending,
      }]:[]};
      if(sql.includes("INSERT INTO"))return {rows:duplicate?[]:[{digest}]};
      if(sql.includes("UPDATE tree_game_sessions"))return {rows:[{session_id:"session-1"}]};
      return {rows:[]};
    },
    release:()=>released++,
  })};
  const suiClient={network:"mainnet",core:{getTransaction:async()=>{lookups++;return tx}}};
  const sessionResolver=async(context)=>{authCalls++;return context?.valid===true?record:null};
  const service=createContinuationService({suiClient,postgresPool:pool,sessionResolver,treeDecimals:9});
  return {service,counts:()=>({lookups,authCalls,released,statements})};
}
test("successful trusted payment atomically redeems and restores three lives",async()=>{
  const ctx=mock();
  const result=await ctx.service.redeem({digest,runId:session.runId,authContext:{valid:true}});
  assert.deepEqual(result,{authorized:true,runId:session.runId,lives:3,wave:5});
  assert.equal(ctx.counts().lookups,1);
  assert.equal(ctx.counts().released,1);
  assert.equal(ctx.counts().statements.at(-1),"COMMIT");
});
test("unauthenticated browser cannot fetch or redeem",async()=>{
  const ctx=mock();
  await assert.rejects(ctx.service.redeem({digest,runId:session.runId,authContext:{valid:false}}),/Authenticated/);
  assert.equal(ctx.counts().lookups,0);
  assert.equal(ctx.counts().statements.length,0);
});
test("wrong run rejected before transaction lookup",async()=>{
  const ctx=mock();
  await assert.rejects(ctx.service.redeem({digest,runId:"other",authContext:{valid:true}}),/Wrong run/);
  assert.equal(ctx.counts().lookups,0);
});
test("failed chain transaction never reaches redemption store",async()=>{
  const ctx=mock({tx:{$kind:"FailedTransaction"}});
  await assert.rejects(ctx.service.redeem({digest,runId:session.runId,authContext:{valid:true}}),/unavailable or failed/);
  assert.equal(ctx.counts().statements.length,0);
});
test("wrong recipient rejected before redemption",async()=>{
  const ctx=mock({tx:{$kind:"Transaction",Transaction:{...payment.Transaction,balanceChanges:[
    {coinType:TREE_COIN_TYPE,amount:"20000000000000",owner:{$kind:"AddressOwner",AddressOwner:"0x999"}},
  ]}}});
  await assert.rejects(ctx.service.redeem({digest,runId:session.runId,authContext:{valid:true}}),/Insufficient/);
  assert.equal(ctx.counts().statements.length,0);
});
test("duplicate digest rejected and rolled back",async()=>{
  const ctx=mock({duplicate:true});
  await assert.rejects(ctx.service.redeem({digest,runId:session.runId,authContext:{valid:true}}),/already redeemed/);
  assert.equal(ctx.counts().statements.at(-1),"ROLLBACK");
});
test("service requires authenticated resolver and verified decimals",()=>{
  assert.throws(()=>createContinuationService({sessionResolver:undefined}),/resolver/);
  assert.throws(()=>createContinuationService({sessionResolver:()=>{},treeDecimals:undefined}),/decimals/);
});
