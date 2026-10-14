import test from "node:test";
import assert from "node:assert/strict";
import {createWalletChallengeService} from "../app/game/wallet-challenge.mjs";

function harness({clock=1000000,verifier=async()=>true}={}) {
 const records=new Map();
 let calls=0;
 const store={
  save:async record=>{records.set(record.challengeHash,record)},
  consumeOnce:async key=>{const value=records.get(key);records.delete(key);return value},
 };
 const service=createWalletChallengeService({
  challengeStore:store,signatureVerifier:async args=>{calls++;return verifier(args)},
  origin:"https://feature-tree-paid-continue--treeforce89.netlify.app",
  now:()=>clock,
 });
 return {service,records,calls:()=>calls};
}
test("issue binds fresh challenge to origin, mainnet, wallet and expiration",async()=>{
 const h=harness();const a=await h.service.issue({wallet:"0x1234"});
 const b=await h.service.issue({wallet:"0x1234"});
 assert.notEqual(a.nonce,b.nonce);
 assert.match(a.message,/Network: sui:mainnet/);
 assert.match(a.message,/Origin: https:\/\/feature-tree-paid-continue--treeforce89.netlify.app/);
 assert.match(a.message,/does not authorize a token transfer/);
 assert.equal(a.expiresAt,1300000);
 assert.equal(h.records.size,2);
 assert.equal(JSON.stringify([...h.records.keys()]).includes(a.nonce),false);
});
test("valid signed challenge verifies exactly once",async()=>{
 const h=harness();const c=await h.service.issue({wallet:"0x1234"});
 assert.equal((await h.service.verify({wallet:"0x1234",nonce:c.nonce,signature:"valid-signature"})).verified,true);
 await assert.rejects(h.service.verify({wallet:"0x1234",nonce:c.nonce,signature:"valid-signature"}),/already used/);
 assert.equal(h.calls(),1);
});
test("wrong wallet cannot authenticate",async()=>{
 const h=harness();const c=await h.service.issue({wallet:"0x1234"});
 await assert.rejects(h.service.verify({wallet:"0x9876",nonce:c.nonce,signature:"valid-signature"}),/wallet mismatch/);
 assert.equal(h.calls(),0);
});
test("invalid signature is rejected",async()=>{
 const h=harness({verifier:async()=>false});const c=await h.service.issue({wallet:"0x1234"});
 await assert.rejects(h.service.verify({wallet:"0x1234",nonce:c.nonce,signature:"bad-signature"}),/signature invalid/);
});
test("expired challenge cannot authenticate",async()=>{
 const h=harness({clock:1000000});const c=await h.service.issue({wallet:"0x1234"});
 const expired=createWalletChallengeService({
  challengeStore:{save:async()=>{},consumeOnce:async key=>h.records.get(key)},
  signatureVerifier:async()=>true,
  origin:"https://feature-tree-paid-continue--treeforce89.netlify.app",
  now:()=>1300001,
 });
 await assert.rejects(expired.verify({wallet:"0x1234",nonce:c.nonce,signature:"valid-signature"}),/expired/);
});
test("invalid nonce rejected before consuming",async()=>{
 const h=harness();await assert.rejects(h.service.verify({wallet:"0x1234",nonce:"abc",signature:"valid-signature"}),/nonce/);
});
test("requires durable store, verifier and fixed HTTPS origin",()=>{
 assert.throws(()=>createWalletChallengeService({}),/store/);
 assert.throws(()=>createWalletChallengeService({challengeStore:{save(){},consumeOnce(){}}}),/verifier/);
 assert.throws(()=>createWalletChallengeService({challengeStore:{save(){},consumeOnce(){}},signatureVerifier:()=>true,origin:"http://localhost"}),/HTTPS/);
});
