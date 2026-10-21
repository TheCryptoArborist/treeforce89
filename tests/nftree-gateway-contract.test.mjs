import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticateGateway,revokeGatewaySession,isGatewaySessionCurrent} from '../app/game/gateway-client.mjs';
import {normalizeSuiAddress} from '../app/game/tree-payment.mjs';

const wallet=normalizeSuiAddress('0x1234');
const origin='https://feature-tree-paid-continue--treeforce89.netlify.app';
function challenge() {
 const nonce='a'.repeat(64),expiresAt=Date.now()+300000;
 const message=["TREE FORCE '89 wallet login",'Origin: '+origin,'Network: sui:mainnet',
  'Wallet: '+wallet,'Nonce: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),
  'This signature does not authorize a token transfer.'].join('\n');
 return {nonce,message,expiresAt};
}
const session=()=>({sessionToken:'b'.repeat(64),runId:'grove-'+'c'.repeat(32),expiresAt:Date.now()+3600000});

test('gateway requires wallet signature and server session before returning access',async()=>{
 const proof=challenge(),calls=[];
 const result=await authenticateGateway({wallet,origin,signMessage:async message=>{
   assert.equal(new TextDecoder().decode(message),proof.message);
   calls.push('sign');return {signature:'real-signed-proof'};
 },fetchImpl:async(path,options)=>{
   calls.push(path);
   if(path.endsWith('tree-challenge'))return Response.json(proof,{status:201});
   assert.deepEqual(JSON.parse(options.body),{wallet,nonce:proof.nonce,signature:'real-signed-proof'});
   return Response.json(session(),{status:201});
 }});
 assert.equal(result.wallet,wallet);
 assert.deepEqual(calls,['/.netlify/functions/tree-challenge','sign','/.netlify/functions/tree-session']);
});

test('tampered sign-in message never reaches the wallet',async()=>{
 const proof=challenge();proof.message+='\nTransfer tokens';
 let prompted=false;
 await assert.rejects(authenticateGateway({wallet,origin,
  fetchImpl:async()=>Response.json(proof),signMessage:async()=>{prompted=true;}}),/could not be validated/);
 assert.equal(prompted,false);
});

test('wallet rejection never requests a session',async()=>{
 let calls=0;
 await assert.rejects(authenticateGateway({wallet,origin,
   fetchImpl:async()=>{calls++;return Response.json(challenge());},
   signMessage:async()=>{throw Error('User cancelled');}}),/User cancelled/);
 assert.equal(calls,1);
});

test('aborted account-change flow cannot request a session after signing',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(authenticateGateway({wallet,origin,signal:controller.signal,
  fetchImpl:async()=>{calls++;return Response.json(challenge());},
  signMessage:async()=>{controller.abort();return {signature:'unused'};}}),/cancelled/);
 assert.equal(calls,1);
});

test('non-holder server denial does not return a playable session',async()=>{
 await assert.rejects(authenticateGateway({wallet,origin,signMessage:async()=>({signature:'proof'}),
  fetchImpl:async path=>path.endsWith('tree-challenge')?Response.json(challenge()):
   Response.json({error:'NFTree ownership required'},{status:403})}),/NFTree ownership required/);
});

test('account change, disconnect and expiry invalidate the current session',()=>{
 const saved={...session(),wallet};
 assert.equal(isGatewaySessionCurrent(saved,wallet),true);
 assert.equal(isGatewaySessionCurrent(saved,'0x9999'),false);
 assert.equal(isGatewaySessionCurrent(saved,undefined),false);
 assert.equal(isGatewaySessionCurrent(saved,wallet,saved.expiresAt),false);
});

test('logout sends credential only in authorization header, never in URL or body',async()=>{
 const saved=session();
 await revokeGatewaySession(saved,{fetchImpl:async(path,options)=>{
  assert.equal(path,'/.netlify/functions/tree-logout');assert.equal(options.body,undefined);
  assert.equal(options.headers.Authorization,'Bearer '+saved.sessionToken);
  return Response.json({loggedOut:true});
 }});
});
