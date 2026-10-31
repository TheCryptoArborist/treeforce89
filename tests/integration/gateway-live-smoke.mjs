import assert from 'node:assert/strict';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';

// Non-holder smoke test only. Generates an unfunded ephemeral key in memory.
// No wallet credentials, token transfers, payments or on-chain writes.
const origin=process.env.TREE_GATEWAY_SMOKE_ORIGIN || 'https://feature-tree-paid-continue--treeforce89.netlify.app';
assert.ok(['https://feature-tree-paid-continue--treeforce89.netlify.app',
  'https://deploy-preview-7--treeforce89.netlify.app'].includes(origin));
const post=async(path,body,requestOrigin=origin)=>{
  const response=await fetch(origin+'/.netlify/functions/'+path,{
    method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin},
    body:JSON.stringify(body),signal:AbortSignal.timeout(45000),
  });
  return {status:response.status,body:await response.json()};
};
const keypair=new Ed25519Keypair();
const wallet=keypair.toSuiAddress();
const challenge=await post('tree-challenge',{wallet});
assert.equal(challenge.status,201,JSON.stringify({stage:'challenge',status:challenge.status,error:challenge.body.error}));
const {signature}=await keypair.signPersonalMessage(new TextEncoder().encode(challenge.body.message));
const proof={wallet,nonce:challenge.body.nonce,signature};
const denied=await post('tree-session',proof);
assert.equal(denied.status,403,JSON.stringify({stage:'nonholder',status:denied.status,code:denied.body.code}));
assert.equal(denied.body.code,'NFTREE_REQUIRED',JSON.stringify({stage:'nonholder',code:denied.body.code}));
const replay=await post('tree-session',proof);
assert.equal(replay.status,401);
assert.equal(replay.body.code,'SIGN_IN_REJECTED');
const crossOrigin=await post('tree-challenge',{wallet},'https://attacker.example');
assert.equal(crossOrigin.status,403);
const forged=await post('tree-session',{...proof,eligible:true,runId:'fake'});
assert.equal(forged.status,400);
const payment=await post('tree-continue',{digest:'smoke-not-a-transaction',runId:'smoke-not-a-run'});
assert.equal(payment.status,503);
assert.equal(payment.body.authorized,false);
console.log(JSON.stringify({origin,challengeIssued:true,realSignatureVerified:true,
  liveMainnetNonholderDenied:true,replayRejected:true,crossOriginRejected:true,
  forgedEligibilityRejected:true,paymentsDisabled:true}));
