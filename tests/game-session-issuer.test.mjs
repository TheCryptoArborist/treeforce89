import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createGameSessionIssuer} from "../app/game/game-session-issuer.mjs";

const loginToken="a".repeat(64);
function harness({wallet="0x1234",eligible=true,loginFails=false,dbFails=false}={}) {
 const calls={ownership:[],db:[],login:[]};
 const issuer=createGameSessionIssuer({
  loginStore:{resolve:async token=>{calls.login.push(token);if(loginFails)throw new Error("Login expired");return {wallet}}},
  ownershipChecker:async args=>{calls.ownership.push(args);return eligible},
  pool:{query:async(sql,params)=>{calls.db.push({sql,params});if(dbFails)throw new Error("DB offline");return {rows:[{session_id:params[0]}]}}},
  now:()=>1_000_000,
 });
 return {issuer,calls};
}
test("authenticated NFTree holder receives a fresh server-issued game session",async()=>{
 const h=harness();
 const a=await h.issuer.create({loginToken});
 const b=await h.issuer.create({loginToken});
 assert.match(a.sessionToken,/^[a-f0-9]{64}$/);
 assert.notEqual(a.sessionToken,b.sessionToken);
 assert.notEqual(a.sessionId,b.sessionId);
 assert.notEqual(a.runId,b.runId);
 assert.equal(a.expiresAt,8_200_000);
 assert.equal(h.calls.ownership[0].wallet.length,66);
 assert.equal(h.calls.db[0].params[2],createHash("sha256").update(a.sessionToken).digest("hex"));
 assert.equal(h.calls.db[0].params.includes(a.sessionToken),false);
 assert.match(h.calls.db[0].sql,/0,0,FALSE,FALSE,FALSE/);
});
test("no NFTree cannot create a game session",async()=>{
 const h=harness({eligible:false});
 await assert.rejects(h.issuer.create({loginToken}),/NFTree ownership required/);
 assert.equal(h.calls.db.length,0);
});
test("expired wallet login cannot create a game session",async()=>{
 const h=harness({loginFails:true});
 await assert.rejects(h.issuer.create({loginToken}),/Login expired/);
 assert.equal(h.calls.ownership.length,0);
 assert.equal(h.calls.db.length,0);
});
test("malformed login credential rejected without queries",async()=>{
 const h=harness();
 await assert.rejects(h.issuer.create({loginToken:"bad"}),/Valid wallet login credential/);
 assert.equal(h.calls.login.length,0);
});
test("client-provided game state is ignored",async()=>{
 const h=harness();
 await h.issuer.create({loginToken,wallet:"0x9876",wave:99,gameOver:true,runId:"cheat"});
 assert.equal(h.calls.ownership[0].wallet.endsWith("1234"),true);
 assert.equal(h.calls.db[0].params.some(x=>x==="cheat"||x===99),false);
});
test("database errors do not issue session credentials",async()=>{
 const h=harness({dbFails:true});
 await assert.rejects(h.issuer.create({loginToken}),/DB offline/);
});
test("requires all trusted dependencies",()=>{
 assert.throws(()=>createGameSessionIssuer({}),/wallet login store/);
 assert.throws(()=>createGameSessionIssuer({loginStore:{resolve:async()=>{}}}),/ownership checker/);
 assert.throws(()=>createGameSessionIssuer({loginStore:{resolve:async()=>{}},ownershipChecker:async()=>true}),/PostgreSQL/);
});
