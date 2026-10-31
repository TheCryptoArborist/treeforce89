import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunRestartController} from '../app/game/run-restart.mjs';
import {restartGatewayRun} from '../app/game/gateway-client.mjs';

test('replay and title inputs wait for one server restart before starting again',async()=>{
  const calls=[],pending=[];let finish;
  const restart=createRunRestartController({managed:true,
    requestNewRun:destination=>{calls.push(destination);return new Promise(resolve=>{finish=resolve;});},
    startOffline:()=>assert.fail('Managed run must not start locally'),onPending:value=>pending.push(value)});
  const first=restart('game');
  assert.equal(await restart('title'),false);
  assert.deepEqual(calls,['game']);assert.deepEqual(pending,[true]);
  finish();assert.equal(await first,true);assert.deepEqual(pending,[true,false]);
});

test('failed restart stays at Game Over and can be retried',async()=>{
  let tries=0;const errors=[];
  const restart=createRunRestartController({managed:true,requestNewRun:async()=>{if(++tries===1)throw Error('Offline');},
    startOffline:()=>assert.fail('No offline fallback'),onError:error=>errors.push(error)});
  assert.equal(await restart('title'),false);assert.deepEqual(errors,['Offline']);
  assert.equal(await restart('title'),true);assert.equal(tries,2);
});

test('missing managed host fails closed; explicit offline games retain replay',async()=>{
  let offline=0;
  assert.equal(await createRunRestartController({managed:true,startOffline:()=>offline++})('game'),false);
  assert.equal(offline,0);
  assert.equal(await createRunRestartController({managed:false,startOffline:target=>{assert.equal(target,'title');offline++;}})('title'),true);
  assert.equal(offline,1);
});

const session={wallet:'0x1234',sessionToken:'a'.repeat(64),runId:'grove-'+'b'.repeat(32),expiresAt:Date.now()+120000};
const next={sessionToken:'c'.repeat(64),runId:'grove-'+'d'.repeat(32),expiresAt:session.expiresAt};
test('restart carries only bearer credential and current run correlation; new token stays in memory',async()=>{
  const signal=new AbortController().signal;
  const result=await restartGatewayRun(session,{signal,fetchImpl:async(path,options)=>{
    assert.equal(path,'/.netlify/functions/tree-run');
    assert.equal(options.headers.Authorization,'Bearer '+session.sessionToken);
    assert.deepEqual(JSON.parse(options.body),{runId:session.runId});
    assert.equal(options.signal,signal);assert.equal(options.cache,'no-store');
    return Response.json(next,{status:201});
  }});
  assert.deepEqual(result,{...next,wallet:session.wallet});
});

test('old credentials, reused IDs, expiry extensions and failed responses never start a new run',async()=>{
  for(const body of [{...next,sessionToken:session.sessionToken},{...next,runId:session.runId},
    {...next,expiresAt:session.expiresAt+1},{...next,expiresAt:0}]){
    await assert.rejects(restartGatewayRun(session,{fetchImpl:async()=>Response.json(body,{status:201})}),/valid new run/);
  }
  await assert.rejects(restartGatewayRun(session,{fetchImpl:async()=>Response.json({code:'SESSION_REQUIRED',error:'Sign in again'},{status:401})}),{code:'SESSION_REQUIRED'});
});
