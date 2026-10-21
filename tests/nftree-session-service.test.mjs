import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createNFTreeSessionService} from "../app/game/nftree-session-service.mjs";
import {NFTREE_TYPE} from "../app/game/nftree-access.mjs";

const loginToken="a".repeat(64);
function fixture({owns=true,loginValid=true,rpcError=false}={}) {
  const calls={sql:[],chain:[]};
  const pool={query:async(sql,params)=>{
    calls.sql.push({sql,params});
    if(sql.includes("FROM tree_wallet_logins")) {
      return {rows:loginValid?[{wallet:"0x1234"}]:[]};
    }
    if(sql.includes("INSERT INTO tree_game_sessions")) return {rows:[{session_id:params[0]}]};
    throw new Error("Unexpected SQL");
  }};
  const suiClient={network:"mainnet",core:{listOwnedObjects:async args=>{
    calls.chain.push(args);
    if(rpcError)throw new Error("Sui provider unavailable");
    return {objects:owns?[{type:NFTREE_TYPE}]:[],cursor:null};
  }}};
  return {calls,service:createNFTreeSessionService({postgresPool:pool,suiClient,now:()=>1_000_000})};
}
test("authenticated holder receives server-created session after on-chain ownership lookup",async()=>{
  const {calls,service}=fixture();
  const session=await service.create({loginToken});
  assert.equal(session.wallet.endsWith("1234"),true);
  assert.match(session.sessionToken,/^[a-f0-9]{64}$/);
  assert.match(session.runId,/^grove-[a-f0-9]{32}$/);
  assert.equal(calls.chain.length,1);
  assert.equal(calls.chain[0].type,NFTREE_TYPE);
  assert.equal(calls.sql[0].params[0],createHash("sha256").update(loginToken).digest("hex"));
  assert.equal(calls.sql[1].params.includes(session.sessionToken),false);
});
test("non-holder denied and no session inserted",async()=>{
  const {calls,service}=fixture({owns:false});
  await assert.rejects(service.create({loginToken}),/NFTree ownership required/);
  assert.equal(calls.sql.some(c=>c.sql.includes("INSERT INTO tree_game_sessions")),false);
});
test("invalid wallet login cannot query NFT ownership",async()=>{
  const {calls,service}=fixture({loginValid:false});
  await assert.rejects(service.create({loginToken}),/expired or revoked/);
  assert.equal(calls.chain.length,0);
});
test("provider errors fail closed without inserting session",async()=>{
  const {calls,service}=fixture({rpcError:true});
  await assert.rejects(service.create({loginToken}),/Sui provider unavailable/);
  assert.equal(calls.sql.some(c=>c.sql.includes("INSERT INTO tree_game_sessions")),false);
});
test("client-supplied wallet and run state are ignored",async()=>{
  const {calls,service}=fixture();
  await service.create({loginToken,wallet:"0x999",runId:"fake",wave:100,gameOver:true});
  assert.equal(calls.chain[0].owner.endsWith("1234"),true);
  assert.equal(calls.sql[1].params.some(v=>v==="fake"||v===100),false);
});
test("rejects untrusted Sui network",()=>{
  const pool={query:async()=>({rows:[]})};
  assert.throws(()=>createNFTreeSessionService({postgresPool:pool,suiClient:{network:"testnet",core:{listOwnedObjects:async()=>({})}}}),/mainnet/);
});
