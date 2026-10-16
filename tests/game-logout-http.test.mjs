import test from "node:test";
import assert from "node:assert/strict";
import {createGameLogoutHttpHandler} from "../app/game/game-logout-http.mjs";
import disabled from "../netlify/functions/tree-logout.mjs";

const url="https://feature-tree-paid-continue--treeforce89.netlify.app/.netlify/functions/tree-logout";
const token="a".repeat(64);
const req=(opts={})=>new Request(url,{
  ...opts,
  method:"POST",
  headers:{authorization:"Bearer "+token,...opts.headers},
});

test("authenticated logout revokes only the presented game session token",async()=>{
  const calls=[];
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async input=>{
    calls.push(input);
    return {sessionRevoked:true,loginRevoked:false};
  }}});
  const res=await handle(req());
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{loggedOut:true});
  assert.deepEqual(calls,[{sessionToken:token}]);
  assert.equal(res.headers.get("cache-control"),"no-store");
});
test("repeated logout is idempotent",async()=>{
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>({sessionRevoked:false})}});
  const res=await handle(req());
  assert.equal(res.status,200);
  assert.equal((await res.json()).loggedOut,true);
});
test("missing bearer token is rejected without revocation",async()=>{
  let calls=0;
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>{calls++}}});
  const res=await handle(new Request(url,{method:"POST"}));
  assert.equal(res.status,401);
  assert.equal(calls,0);
});
test("cross-origin requests cannot revoke",async()=>{
  let calls=0;
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>{calls++}}});
  const res=await handle(req({headers:{origin:"https://attacker.example"}}));
  assert.equal(res.status,403);
  assert.equal(calls,0);
});
test("client-submitted game state is rejected",async()=>{
  let calls=0;
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>{calls++}}});
  const res=await handle(req({body:JSON.stringify({wallet:"0x1234",runId:"fake"})}));
  assert.equal(res.status,400);
  assert.equal(calls,0);
});
test("database failure does not claim successful logout",async()=>{
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>{throw new Error("secret database failure")}}});
  const res=await handle(req());
  assert.equal(res.status,503);
  const body=await res.json();
  assert.equal(body.loggedOut,false);
  assert.equal(JSON.stringify(body).includes("secret database failure"),false);
});
test("GET is rejected",async()=>{
  const handle=createGameLogoutHttpHandler({revoker:{revoke:async()=>{throw new Error("must not run")}}});
  assert.equal((await handle(new Request(url))).status,405);
});
test("public Netlify logout endpoint stays disabled",async()=>{
  const res=await disabled(req());
  assert.equal(res.status,503);
  assert.deepEqual((await res.json()).loggedOut,false);
});
test("public endpoint cannot revoke with arbitrary input",async()=>{
  const res=await disabled(req({body:JSON.stringify({sessionToken:token})}));
  assert.equal(res.status,503);
  assert.equal((await res.json()).enabled,false);
});
