import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import pg from 'pg';
import {createGameRunService} from '../../app/game/game-run-service.mjs';
import {createAuthenticatedSessionResolver} from '../../app/game/authenticated-session.mjs';
import {createCredentialRevoker} from '../../app/game/credential-revocation.mjs';

if(process.env.PGHOST!=='127.0.0.1' || process.env.PGDATABASE!=='tree_auth_test')
  throw Error('Disposable CI PostgreSQL required');
const pool=new pg.Pool();
const hash=value=>createHash('sha256').update(value).digest('hex');
const wallet='0x'+'7'.repeat(64);
const seed=async()=>{
  const sessionToken=randomBytes(32).toString('hex'),runId='grove-'+randomBytes(16).toString('hex');
  const expiresAt=Date.now()+120000;
  await pool.query(`INSERT INTO tree_game_sessions(session_id,wallet,session_token_hash,run_id,expires_at)
    VALUES($1,$2,$3,$4,$5)`,[randomBytes(24).toString('hex'),wallet,hash(sessionToken),runId,new Date(expiresAt)]);
  return {sessionToken,runId,expiresAt};
};
try {
  const resolve=createAuthenticatedSessionResolver(pool);
  const service=createGameRunService({pool,ownershipChecker:async input=>{assert.equal(input.wallet,wallet);return true;}});
  const original=await seed();
  const attempts=await Promise.allSettled([service.restart(original),service.restart(original)]);
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
  const next=attempts.find(x=>x.status==='fulfilled').value;
  assert.notEqual(next.runId,original.runId);assert.notEqual(next.sessionToken,original.sessionToken);
  assert.equal(next.expiresAt,original.expiresAt);
  await assert.rejects(resolve(original),{code:'SESSION_REQUIRED'});
  const active=await resolve(next);
  assert.equal(active.runId,next.runId);assert.equal(active.wallet,wallet);
  assert.equal(active.wave,0);assert.equal(active.continuationNumber,0);
  assert.equal(active.gameOver,false);assert.equal(active.cleared,false);assert.equal(active.continuePending,false);
  const stored=await pool.query('SELECT session_token_hash FROM tree_game_sessions WHERE run_id=$1',[next.runId]);
  assert.equal(stored.rows[0].session_token_hash,hash(next.sessionToken));
  await assert.rejects(service.restart(original),{code:'SESSION_REQUIRED'});
  await assert.rejects(service.restart({...next,runId:original.runId}),{code:'RUN_CHANGED'});

  const denied=createGameRunService({pool,ownershipChecker:async()=>false});
  await assert.rejects(denied.restart(next),{code:'NFTREE_REQUIRED'});
  assert.equal((await resolve(next)).runId,next.runId);

  // An insert failure must leave the old credential valid, with no half-rotation.
  const failingPool={query:(...args)=>pool.query(...args),connect:async()=>{
    const db=await pool.connect();
    return {release:()=>db.release(),query:(sql,args)=>{
      if(/INSERT INTO tree_game_sessions/.test(sql))throw Error('Simulated insert failure');
      return db.query(sql,args);
    }};
  }};
  const failing=createGameRunService({pool:failingPool,ownershipChecker:async()=>true});
  await assert.rejects(failing.restart(next),/Simulated insert failure/);
  assert.equal((await resolve(next)).runId,next.runId);

  // Revoke while the mainnet ownership check is in flight. The second lock
  // must reject it even though the initial credential lookup succeeded.
  let readStarted,finishRead;
  const started=new Promise(resolve=>{readStarted=resolve;});
  const racing=createGameRunService({pool,ownershipChecker:async()=>{readStarted();return new Promise(resolve=>{finishRead=resolve;});}});
  const result=racing.restart(next);await started;
  await createCredentialRevoker(pool).revoke(next);finishRead(true);
  await assert.rejects(result,{code:'SESSION_REQUIRED'});
  const payments=await pool.query('SELECT count(*)::int AS n FROM tree_continue_redemptions WHERE wallet=$1',[wallet]);
  assert.equal(payments.rows[0].n,0);
  console.log('Run lifecycle integration passed: one concurrent restart, fresh hashed credential, original expiry, NFT recheck, rollback and logout race. No payments or trusted Game Over claims.');
} finally {await pool.end();}
