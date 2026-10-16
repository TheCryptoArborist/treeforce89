import test from "node:test";
import assert from "node:assert/strict";
import {createWalletLoginIssuer,createWalletLoginService} from "../app/game/wallet-login-issuer.mjs";
import {createPostgresWalletLoginStore} from "../app/game/postgres-wallet-logins.mjs";

function mockDb(){
 const records=new Map(),calls=[];
 const pool={query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.includes("INSERT INTO")){records.set(params[0],{wallet:params[1],expiresAt:params[2].getTime()});return {rows:[{token_hash:params[0]}]}}
  if(sql.includes("SELECT wallet")){const row=records.get(params[0]);return {rows:row?[{wallet:row.wallet}]:[]}}
  throw new Error("Unexpected SQL");
 }};
 return {pool,calls,records};
}
test("verified challenge issues a unique credential and persists only its hash",async()=>{
 const db=mockDb(),store=createPostgresWalletLoginStore(db.pool);
 const issuer=createWalletLoginIssuer({store,now:()=>1000000});
 const challengeService={verify:async()=>({verified:true,wallet:"0x1234"})};
 const service=createWalletLoginService({challengeService,issuer});
 const a=await service.authenticate({wallet:"0x1234",nonce:"nonce",signature:"signed"});
 const b=await service.authenticate({wallet:"0x1234",nonce:"nonce2",signature:"signed2"});
 assert.match(a.token,/^[a-f0-9]{64}$/);
 assert.notEqual(a.token,b.token);
 assert.equal(a.expiresAt,2800000);
 assert.equal(db.records.size,2);
 assert.equal(db.calls[0].params[0]===a.token,false);
 assert.equal((await store.resolve(a.token)).wallet.length,66);
});
test("failed challenge cannot issue credential",async()=>{
 const db=mockDb(),issuer=createWalletLoginIssuer({store:createPostgresWalletLoginStore(db.pool)});
 const service=createWalletLoginService({challengeService:{verify:async()=>{throw new Error("signature invalid")}},issuer});
 await assert.rejects(service.authenticate({wallet:"0x1234",nonce:"n",signature:"s"}),/signature invalid/);
 assert.equal(db.calls.length,0);
});
test("unverified proof cannot issue credential",async()=>{
 const db=mockDb(),issuer=createWalletLoginIssuer({store:createPostgresWalletLoginStore(db.pool)});
 const service=createWalletLoginService({challengeService:{verify:async()=>({verified:false,wallet:"0x1234"})},issuer});
 await assert.rejects(service.authenticate({wallet:"0x1234",nonce:"n",signature:"s"}),/not verified/);
 assert.equal(db.calls.length,0);
});
test("issuer rejects direct unverified wallet",async()=>{
 const issuer=createWalletLoginIssuer({store:{save:async()=>{}}});
 await assert.rejects(issuer.issueVerifiedWallet({wallet:"0x1234",verified:false}),/Verified wallet signature/);
});
test("login resolver rejects malformed token before SQL",async()=>{
 const db=mockDb(),store=createPostgresWalletLoginStore(db.pool);
 await assert.rejects(store.resolve("invalid"),/Invalid login credential/);
 assert.equal(db.calls.length,0);
});
test("login resolver rejects missing or expired record",async()=>{
 const db=mockDb(),store=createPostgresWalletLoginStore(db.pool);
 await assert.rejects(store.resolve("a".repeat(64)),/expired or revoked/);
});
test("issuer fails closed if database write fails",async()=>{
 const issuer=createWalletLoginIssuer({store:{save:async()=>{throw new Error("DB unavailable")}}});
 await assert.rejects(issuer.issueVerifiedWallet({wallet:"0x1234",verified:true}),/DB unavailable/);
});
