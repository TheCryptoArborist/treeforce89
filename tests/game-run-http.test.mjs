import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRunHttpHandler} from '../app/game/game-run-http.mjs';

const origin='https://feature-tree-paid-continue--treeforce89.netlify.app';
const runId='grove-'+'a'.repeat(32),token='b'.repeat(64);
const build={branch:'feature/tree-paid-continue',context:'branch-deploy',deployId:'dev'};
const runtime={deploy:{context:'branch-deploy',id:'dev'},site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}};
const request=(body={runId},headers={},url=origin)=>new Request(url,{method:'POST',
  headers:{origin,'content-type':'application/json',authorization:'Bearer '+token,...headers},body:JSON.stringify(body)});

test('restart derives identity only from bearer credentials and refuses all gameplay claims',async()=>{
  const calls=[];
  const handler=createGameRunHttpHandler({build,getService:()=>({restart:async input=>{calls.push(input);return {runId:'new'};}})});
  for(const body of [{runId,wallet:'0x1234'},{runId,gameOver:true},{runId,lives:0},{runId,wave:1},
    {runId,score:100},{runId,continuePending:true},{runId:'invalid'},['array'],{runId:'x'.repeat(300)}])
    assert.equal((await handler(request(body),runtime)).status,400);
  assert.equal(calls.length,0);
  const result=await handler(request(),runtime);
  assert.equal(result.status,201);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,[{runId,sessionToken:token}]);
});

test('production, other branches, wrong site and unexpected hosts never reach restart storage',async()=>{
  let calls=0;
  for(const [metadata,ctx,url] of [[{...build,context:'production'},runtime,origin],
    [{...build,branch:'main'},runtime,origin],[build,{...runtime,deploy:{id:'dev',context:'production'}},origin],
    [build,{...runtime,site:{id:'another'}},origin],[build,runtime,'https://treeforce89.netlify.app']]){
    const handler=createGameRunHttpHandler({build:metadata,getService:()=>{calls++;}});
    assert.equal((await handler(request(undefined,{},url),ctx)).status,503);
  }
  assert.equal(calls,0);
});

test('cross-origin, missing token, GET and oversized streaming requests are rejected before service',async()=>{
  let calls=0;const handler=createGameRunHttpHandler({build,getService:()=>{calls++;}});
  assert.equal((await handler(request(undefined,{origin:'https://other.example'}),runtime)).status,403);
  assert.equal((await handler(request(undefined,{'sec-fetch-site':'cross-site'}),runtime)).status,403);
  assert.equal((await handler(request(undefined,{authorization:''}),runtime)).status,401);
  assert.equal((await handler(new Request(origin),runtime)).status,405);
  const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(257)));c.close();}});
  assert.equal((await handler(new Request(origin,{method:'POST',headers:{origin,authorization:'Bearer '+token,
    'content-type':'application/json'},body:stream,duplex:'half'}),runtime)).status,400);
  assert.equal(calls,0);
});

test('safe typed failures and database outages never leak credentials or return new sessions',async()=>{
  for(const [code,status] of [['SESSION_REQUIRED',401],['RUN_CHANGED',409],['NFTREE_REQUIRED',403],['ECONNREFUSED',503]]){
    const handler=createGameRunHttpHandler({build,getService:()=>({restart:async()=>{
      throw Object.assign(Error('postgres://private:password@db/secret'),{code});
    }})});
    const response=await handler(request(),runtime);assert.equal(response.status,status);
    assert.doesNotMatch(await response.text(),/postgres|private|password|secret|sessionToken/);
  }
});
