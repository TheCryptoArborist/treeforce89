import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinuationOfferService} from '../app/game/continuation-offer.mjs';
import {createContinuationOfferHttpHandler} from '../app/game/continuation-offer-http.mjs';
import {reviewContinuation} from '../app/game/continuation-review-client.mjs';
import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT} from '../app/game/tree-payment.mjs';

const origin='https://feature-tree-paid-continue--treeforce89.netlify.app';
const runId='grove-'+'a'.repeat(32),sessionToken='b'.repeat(64);
const offer={enabled:false,runId,network:'sui:mainnet',coinType:TREE_COIN_TYPE,recipient:TREE_PAYMENT_RECIPIENT,
  recipientConfirmed:false,price:'20000',decimals:6,amountBaseUnits:'20000000000',lives:3,
  message:'Paid continues are being tested. No TREE will be transferred.'};
const client={network:'mainnet',core:{getCoinMetadata:async input=>{
  assert.equal(input.coinType,TREE_COIN_TYPE);return {coinMetadata:{decimals:6}};
}}};
test('checkout review authenticates current run, uses verified decimals and stays disabled even for an eligible session',async()=>{
  const service=createContinuationOfferService({client,sessionResolver:async input=>{
    assert.deepEqual(input,{sessionToken});return {runId,continuePending:true,gameOver:true};
  }});
  assert.deepEqual(await service.review({sessionToken,runId}),offer);
  await assert.rejects(service.review({sessionToken,runId:'another'}),{code:'RUN_CHANGED'});
});
test('unverified metadata or unauthenticated sessions cannot produce a checkout offer',async()=>{
  for(const coinMetadata of [null,{decimals:undefined},{decimals:19},{decimals:-1}]){
    const service=createContinuationOfferService({sessionResolver:async()=>({runId}),
      client:{network:'mainnet',core:{getCoinMetadata:async()=>({coinMetadata})}}});
    await assert.rejects(service.review({sessionToken,runId}),/metadata/);
  }
  let calls=0;
  const service=createContinuationOfferService({sessionResolver:async()=>{throw Error('Not authenticated');},
    client:{network:'mainnet',core:{getCoinMetadata:()=>{calls++;}}}});
  await assert.rejects(service.review({sessionToken,runId}),/authenticated/);assert.equal(calls,0);
});
const build={branch:'feature/tree-paid-continue',context:'branch-deploy',deployId:'dev'};
const context={deploy:{context:'branch-deploy',id:'dev'},site:{id:'35f5591a-5c7d-4bc6-ae9a-3e61e816b641'}};
const request=(body={runId},headers={})=>new Request(origin,{method:'POST',
  headers:{origin,'Content-Type':'application/json',authorization:'Bearer '+sessionToken,...headers},body:JSON.stringify(body)});
test('offer HTTP handler refuses production and forged eligibility before reading any session',async()=>{
  let calls=0;const getService=()=>({review:async()=>{calls++;return offer;}});
  const handler=createContinuationOfferHttpHandler({build,getService});
  assert.equal((await handler(request(),context)).status,201);assert.equal(calls,1);
  assert.equal((await handler(request({runId,gameOver:true}),context)).status,400);
  assert.equal((await handler(request(undefined,{origin:'https://other.example'}),context)).status,403);
  assert.equal((await handler(request(undefined,{authorization:''}),context)).status,401);
  assert.equal((await createContinuationOfferHttpHandler({build:{...build,context:'production'},getService})(request(),context)).status,503);
  assert.equal(calls,1);
});
test('browser requests read-only details with bearer header and validates amount without asking a wallet',async()=>{
  let calls=0;
  const result=await reviewContinuation({runId,sessionToken},{fetchImpl:async(path,options)=>{
    calls++;assert.equal(path,'/.netlify/functions/tree-continue-offer');
    assert.equal(options.headers.Authorization,'Bearer '+sessionToken);
    assert.deepEqual(JSON.parse(options.body),{runId});return Response.json(offer,{status:201});
  }});
  assert.deepEqual(result,offer);assert.equal(calls,1);
});
test('browser rejects activation, recipient substitution, wrong run, amount and network',async()=>{
  for(const result of [{...offer,enabled:true},{...offer,recipient:'0x1234'},{...offer,runId:'other'},
    {...offer,amountBaseUnits:'20000'},{...offer,network:'sui:testnet'},{...offer,recipientConfirmed:true}])
    await assert.rejects(reviewContinuation({runId,sessionToken},{fetchImpl:async()=>Response.json(result)}),/could not be verified/);
});
