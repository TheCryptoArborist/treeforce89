import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
import {createAuthenticatedSessionResolver} from '../../app/game/authenticated-session.mjs';
import {createContinuationService} from '../../app/game/continuation-service.mjs';
import {createContinuationOfferService} from '../../app/game/continuation-offer.mjs';
import {createCredentialRevoker} from '../../app/game/credential-revocation.mjs';
import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT} from '../../app/game/tree-payment.mjs';
import {toBase58} from '@mysten/sui/utils';

if(process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='tree_auth_test')throw Error('Disposable CI PostgreSQL required');
const pool=new pg.Pool(),resolve=createAuthenticatedSessionResolver(pool);
const wallet='0x'+'8'.repeat(64),amount='20000000000'; // Fixtures use real TREE decimals: 6.
const digest=()=>toBase58(randomBytes(32));
const seed=async()=>{
  const sessionToken=randomBytes(32).toString('hex'),runId='grove-'+randomBytes(16).toString('hex'),id=randomBytes(24).toString('hex');
  await pool.query(`INSERT INTO tree_game_sessions(session_id,wallet,run_id,session_token_hash,created_at,expires_at,game_over,continue_pending,wave)
    VALUES($1,$2,$3,$4,now()-interval '1 minute',now()+interval '10 minutes',TRUE,TRUE,4)`,
  [id,wallet,runId,createHash('sha256').update(sessionToken).digest('hex')]);
  return {sessionToken,runId,id};
};
// Only chain receipts and eligibility are fixtures. Nothing signs or submits
// transactions; no HTTP request can mark Game Over or enable paid checkout.
const receipt=(d,patch={})=>({$kind:'Transaction',Transaction:{digest:d,status:{success:true},
  effects:{status:{success:true}},checkpoint:'123456',timestampMs:Date.now(),transaction:{sender:wallet},
  balanceChanges:[{coinType:TREE_COIN_TYPE,address:wallet,amount:'-'+amount},
    {coinType:TREE_COIN_TYPE,address:TREE_PAYMENT_RECIPIENT,amount}],...patch}});
const service=(fetchTransaction)=>createContinuationService({postgresPool:pool,sessionResolver:resolve,treeDecimals:6,
  suiClient:{network:'mainnet',core:{getTransaction:({digest:d})=>fetchTransaction(d)}}});
const claim=(session,d)=>({digest:d,runId:session.runId,authContext:{sessionToken:session.sessionToken}});
try {
  const session=await seed(),d=digest(),normal=service(async id=>receipt(id));
  const outcomes=await Promise.allSettled([normal.redeem(claim(session,d)),normal.redeem(claim(session,d))]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.deepEqual(outcomes.find(x=>x.status==='fulfilled').value,{authorized:true,runId:session.runId,lives:3,wave:4});
  const state=await resolve(session);assert.equal(state.continuationNumber,1);assert.equal(state.continuePending,false);
  const saved=await pool.query('SELECT count(*)::int AS n FROM tree_continue_redemptions WHERE session_id=$1',[session.id]);assert.equal(saved.rows[0].n,1);
  await pool.query('UPDATE tree_game_sessions SET game_over=TRUE,continue_pending=TRUE WHERE session_id=$1',[session.id]);
  await assert.rejects(normal.redeem(claim(session,d)),/already redeemed/);
  assert.equal((await resolve(session)).continuationNumber,1);
  await normal.redeem(claim(session,digest()));assert.equal((await resolve(session)).continuationNumber,2);

  const pending=await seed();
  for(const patch of [{transaction:{sender:'0x1234'}},
    {balanceChanges:[{coinType:TREE_COIN_TYPE,address:'0x1234',amount}]},
    {balanceChanges:[{coinType:TREE_COIN_TYPE,address:TREE_PAYMENT_RECIPIENT,amount:'19999999999'}]},
    {balanceChanges:[{coinType:'0x2::sui::SUI',address:TREE_PAYMENT_RECIPIENT,amount}]},
    {timestampMs:Date.now()-120000},{checkpoint:null}]){
    await assert.rejects(service(async id=>receipt(id,patch)).redeem(claim(pending,digest())));
  }
  const offerService=createContinuationOfferService({sessionResolver:resolve,
    client:{network:'mainnet',core:{getCoinMetadata:async()=>({coinMetadata:{decimals:6}})}}});
  const offer=await offerService.review(pending);assert.equal(offer.enabled,false);assert.equal(offer.amountBaseUnits,amount);
  assert.equal((await resolve(pending)).continuePending,true); // Read-only offer made no changes.
  const none=await pool.query('SELECT count(*)::int AS n FROM tree_continue_redemptions WHERE session_id=$1',[pending.id]);assert.equal(none.rows[0].n,0);

  // Expiry or logout while the fullnode read is in flight must beat redemption.
  for(const logout of [false,true]){
    const racing=await seed();let begin,finish;
    const started=new Promise(resolve=>{begin=resolve;});
    const slow=service(async id=>{const tx=receipt(id);begin();await new Promise(resolve=>{finish=resolve;});return tx;});
    const result=slow.redeem(claim(racing,digest()));await started;
    if(logout)await createCredentialRevoker(pool).revoke(racing);
    else await pool.query('UPDATE tree_game_sessions SET expires_at=clock_timestamp() WHERE session_id=$1',[racing.id]);
    finish();await assert.rejects(result,/no longer eligible/);
    const count=await pool.query('SELECT count(*)::int AS n FROM tree_continue_redemptions WHERE session_id=$1',[racing.id]);assert.equal(count.rows[0].n,0);
  }
  console.log('Continuation integration passed: SDK-shaped receipt verification, exact TREE units, concurrent one-time redemption, duplicate receipt rejection, multiple continues, expiry/logout races and read-only disabled offers. No real transfers.');
} finally {await pool.end();}
