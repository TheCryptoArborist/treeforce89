import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalletGatewayHttpHandler} from '../app/game/wallet-gateway-http.mjs';

const origin='https://feature-tree-paid-continue--treeforce89.netlify.app';
const build={branch:'feature/tree-paid-continue',context:'branch-deploy',deployId:'dev-id'};
const runtime={deploy:{context:build.context,id:build.deployId},site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}};
const request=(body={wallet:'0x1234'},headers={},url=origin)=>new Request(url,{method:'POST',
  headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});

test('production and wrong deployment cannot issue any challenge or session',async()=>{
 for(const [metadata,ctx,url] of [
   [{...build,context:'production'},runtime,origin],
   [{...build,branch:'main'},runtime,origin],
   [build,{deploy:{context:'production',id:'dev-id'}},origin],
   [build,{...runtime,site:{id:'another-site'}},origin],
   [build,runtime,'https://treeforce89.netlify.app'],
 ]) {
   let calls=0;
   const handler=createWalletGatewayHttpHandler({action:'challenge',build:metadata,getService:()=>{calls++;}});
   assert.equal((await handler(request(undefined,{},url),ctx)).status,503);
   assert.equal(calls,0);
 }
});

test('Netlify may reuse an approved branch artifact for a later nonproduction deploy',async()=>{
 const handler=createWalletGatewayHttpHandler({action:'challenge',build,
   getService:()=>({issue:async()=>({nonce:'a'.repeat(64)})})});
 const later={...runtime,deploy:{context:'branch-deploy',id:'later-deploy'}};
 assert.equal((await handler(request(),later)).status,201);
 const prOrigin='https://deploy-preview-7--treeforce89.netlify.app';
 const prRuntime={...runtime,deploy:{context:'deploy-preview',id:'pr-deploy'}};
 assert.equal((await handler(request(undefined,{origin:prOrigin},prOrigin),prRuntime)).status,201);
});

test('same-origin JSON challenge requires only a valid wallet address',async()=>{
 const calls=[];
 const handler=createWalletGatewayHttpHandler({action:'challenge',build,getService:appOrigin=>{
   assert.equal(appOrigin,origin);
   return {issue:async input=>{calls.push(input);return {nonce:'a'.repeat(64)};}};
 }});
 const response=await handler(request(),runtime);
 assert.equal(response.status,201);
 assert.equal(calls[0].wallet.length,66);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('access-control-allow-origin'),null);
});

test('cross-origin requests, extra authority fields and oversized input never reach service',async()=>{
 let calls=0;
 const handler=createWalletGatewayHttpHandler({action:'challenge',build,getService:()=>{calls++;}});
 for(const req of [request(undefined,{origin:'https://attacker.example'}),
   request({wallet:'0x1234',eligible:true}),request({wallet:'x'.repeat(5000)}),
   request(undefined,{'content-type':'text/plain'}),request({wallet:'invalid'})]) {
   assert.ok([400,403].includes((await handler(req,runtime)).status));
 }
 assert.equal(calls,0);
});

test('session endpoint passes proof to trusted service, never accepts a claimed run or eligibility',async()=>{
 const calls=[];
 const handler=createWalletGatewayHttpHandler({action:'enter',build,getService:()=>({enter:async input=>{
   calls.push(input);return {sessionToken:'b'.repeat(64),runId:'grove-'+'c'.repeat(32)};
 }})});
 const proof={wallet:'0x1234',nonce:'a'.repeat(64),signature:'signature'};
 assert.equal((await handler(request({...proof,runId:'fake'}),runtime)).status,400);
 assert.equal((await handler(request(proof),runtime)).status,201);
 assert.equal(calls.length,1);
 assert.deepEqual(Object.keys(calls[0]).sort(),['nonce','signature','wallet']);
});

test('database errors and arbitrary service errors never leak secrets',async()=>{
 const handler=createWalletGatewayHttpHandler({action:'enter',build,getService:()=>{throw Error('postgres://secret:password@internal/db');}});
 const response=await handler(request({wallet:'0x1234',nonce:'a',signature:'b'}),runtime);
 assert.equal(response.status,403);
 assert.doesNotMatch(await response.text(),/postgres|secret|password|internal/);
});

test('verified non-holder gets actionable denial, not a payment prompt',async()=>{
 const handler=createWalletGatewayHttpHandler({action:'enter',build,getService:()=>({enter:async()=>{
   throw Object.assign(Error('private details'),{code:'NFTREE_REQUIRED'});
 }})});
 const response=await handler(request({wallet:'0x1234',nonce:'a',signature:'b'}),runtime);
 assert.equal(response.status,403);
 const result=await response.json();
 assert.equal(result.code,'NFTREE_REQUIRED');
 assert.doesNotMatch(result.error,/private details/);
});
