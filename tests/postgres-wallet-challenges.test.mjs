import test from "node:test";
import assert from "node:assert/strict";
import {createPostgresChallengeStore} from "../app/game/postgres-wallet-challenges.mjs";

const challengeHash="a".repeat(64);
const now=Date.now();
function database() {
  const data=new Map(),calls=[];
  const pool={query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.includes("INSERT INTO")){
      if(data.has(params[0]))throw new Error("duplicate challenge");
      data.set(params[0],{wallet:params[1],message:params[2],expires_at:params[3]});
      return {rows:[{challenge_hash:params[0]}]};
    }
    if(sql.includes("DELETE FROM")){
      const item=data.get(params[0]);
      data.delete(params[0]);
      return {rows:item?[item]:[]};
    }
    throw new Error("Unexpected query");
  }};
  return {pool,calls,data};
}
test("challenge saved by hash, then consumed exactly once",async()=>{
 const db=database(),store=createPostgresChallengeStore(db.pool);
 await store.save({challengeHash,wallet:"0x1234",message:"login",expiresAt:now+300000});
 const first=await store.consumeOnce(challengeHash);
 assert.deepEqual(first,{wallet:"0x1234",message:"login",expiresAt:now+300000});
 assert.equal(await store.consumeOnce(challengeHash),null);
 assert.match(db.calls[1].sql,/DELETE FROM tree_wallet_challenges/);
 assert.match(db.calls[1].sql,/RETURNING wallet, message, expires_at/);
});
test("duplicate challenges cannot overwrite",async()=>{
 const db=database(),store=createPostgresChallengeStore(db.pool);
 const claim={challengeHash,wallet:"0x1234",message:"login",expiresAt:now+300000};
 await store.save(claim);
 await assert.rejects(store.save(claim),/duplicate challenge/);
});
test("invalid hashes rejected before database calls",async()=>{
 const db=database(),store=createPostgresChallengeStore(db.pool);
 await assert.rejects(store.consumeOnce("invalid"),/Invalid challenge hash/);
 await assert.rejects(store.save({challengeHash:"bad"}),/Invalid challenge hash/);
 assert.equal(db.calls.length,0);
});
test("missing database fails closed",()=>assert.throws(()=>createPostgresChallengeStore(null),/PostgreSQL/));
test("missing or invalid stored expiration fails closed",async()=>{
 const db=database(),store=createPostgresChallengeStore(db.pool);
 await store.save({challengeHash,wallet:"0x1234",message:"login",expiresAt:now+300000});
 db.data.get(challengeHash).expires_at="not-a-date";
 await assert.rejects(store.consumeOnce(challengeHash),/Invalid stored challenge expiry/);
 assert.equal(await store.consumeOnce(challengeHash),null);
});
