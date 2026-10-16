import test from "node:test";
import assert from "node:assert/strict";
import {createGameSessionHttpHandler} from "../app/game/game-session-http.mjs";
import disabled from "../netlify/functions/tree-session.mjs";

const url="https://feature-tree-paid-continue--treeforce89.netlify.app/.netlify/functions/tree-session";
const token="a".repeat(64);
const req=(opts={})=>new Request(url,{method:"POST",headers:{authorization:"Bearer "+token,...opts.headers},...opts});
test("trusted handler creates a session without accepting wallet or game state",async()=>{
 const calls=[];
 const handle=createGameSessionHttpHandler({service:{create:async input=>{
  calls.push(input);
  return {sessionToken:"b".repeat(64),runId:"grove-"+"c".repeat(32),expiresAt:1234,wallet:"0x1234"};
 }}});
 const response=await handle(req());
 assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{sessionToken:"b".repeat(64),runId:"grove-"+"c".repeat(32),expiresAt:1234});
 assert.deepEqual(calls,[{loginToken:token}]);
});
test("rejects missing bearer token without calling service",async()=>{
 let calls=0;
 const handle=createGameSessionHttpHandler({service:{create:async()=>{calls++}}});
 const response=await handle(new Request(url,{method:"POST"}));
 assert.equal(response.status,401);assert.equal(calls,0);
});
test("rejects cross-origin requests",async()=>{
 const handle=createGameSessionHttpHandler({service:{create:async()=>{throw Error("should not be called")}}});
 const response=await handle(req({headers:{origin:"https://attacker.example"}}));
 assert.equal(response.status,403);
});
test("rejects client-submitted game state",async()=>{
 let calls=0;
 const handle=createGameSessionHttpHandler({service:{create:async()=>{calls++}}});
 const response=await handle(req({headers:{"content-type":"application/json"},body:JSON.stringify({wallet:"0x1234",wave:9,gameOver:true})}));
 assert.equal(response.status,400);assert.equal(calls,0);
});
test("does not expose internal database errors",async()=>{
 const handle=createGameSessionHttpHandler({service:{create:async()=>{throw Error("secret DB details")}}});
 const response=await handle(req());
 assert.equal(response.status,403);
 assert.equal(JSON.stringify(await response.json()).includes("secret DB details"),false);
});
test("public Netlify endpoint remains disabled",async()=>{
 const response=await disabled(req());
 assert.equal(response.status,503);
 assert.equal((await response.json()).enabled,false);
});
test("public endpoint does not issue credentials for any input",async()=>{
 const response=await disabled(req({body:JSON.stringify({runId:"grove-fake"})}));
 assert.equal(response.status,503);
 assert.equal((await response.text()).includes("sessionToken"),false);
});
