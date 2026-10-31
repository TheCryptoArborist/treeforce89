import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
import {createWalletGatewayService} from '../../app/game/wallet-gateway-service.mjs';
import {createAuthenticatedSessionResolver} from '../../app/game/authenticated-session.mjs';
import {NFTREE_TYPE} from '../../app/game/nftree-access.mjs';

if(process.env.PGHOST!=='127.0.0.1' || process.env.PGDATABASE!=='tree_auth_test')
  throw Error('Disposable CI PostgreSQL required');
const pool=new pg.Pool();
const origin='https://feature-tree-paid-continue--treeforce89.netlify.app';
// Real cryptographic signatures and PostgreSQL; only NFT holdings are fixtures.
// These ephemeral test keys never hold assets or submit on-chain transactions.
const client=eligible=>({network:'mainnet',core:{listOwnedObjects:async input=>{
  assert.equal(input.type,NFTREE_TYPE);
  return {objects:eligible?[{type:NFTREE_TYPE}]:[],cursor:null};
}}});
const proof=async(service,keypair)=>{
  const wallet=keypair.toSuiAddress();
  const challenge=await service.issue({wallet});
  const {signature}=await keypair.signPersonalMessage(new TextEncoder().encode(challenge.message));
  return {wallet,nonce:challenge.nonce,signature};
};
try {
  const holder=new Ed25519Keypair();
  const service=createWalletGatewayService({pool,client:client(true),origin});
  const input=await proof(service,holder);
  const outcomes=await Promise.allSettled([service.enter(input),service.enter(input)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  const session=outcomes.find(x=>x.status==='fulfilled').value;
  assert.deepEqual(Object.keys(session).sort(),['expiresAt','runId','sessionToken']);
  const hash=createHash('sha256').update(session.sessionToken).digest('hex');
  const saved=await pool.query('SELECT session_token_hash,run_id FROM tree_game_sessions WHERE wallet=$1',[input.wallet]);
  assert.equal(saved.rows.length,1);
  assert.equal(saved.rows[0].session_token_hash,hash);
  assert.equal(saved.rows[0].run_id,session.runId);
  const login=await pool.query('SELECT revoked_at FROM tree_wallet_logins WHERE wallet=$1',[input.wallet]);
  assert.equal(login.rows.length,1);
  assert.ok(login.rows[0].revoked_at);
  const nonces=await pool.query('SELECT count(*)::int AS n FROM tree_wallet_challenges WHERE wallet=$1',[input.wallet]);
  assert.equal(nonces.rows[0].n,0);
  const payments=await pool.query('SELECT count(*)::int AS n FROM tree_continue_redemptions WHERE wallet=$1',[input.wallet]);
  assert.equal(payments.rows[0].n,0);
  const resolve=createAuthenticatedSessionResolver(pool);
  assert.equal((await resolve({sessionToken:session.sessionToken})).wallet,input.wallet);
  await service.revoke({sessionToken:session.sessionToken});
  await assert.rejects(resolve({sessionToken:session.sessionToken}),/expired|authenticated/);
  assert.equal((await service.revoke({sessionToken:session.sessionToken})).sessionRevoked,false);

  const denied=createWalletGatewayService({pool,client:client(false),origin});
  const nonholder=new Ed25519Keypair();
  await assert.rejects(denied.enter(await proof(denied,nonholder)),{code:'NFTREE_REQUIRED'});
  const deniedSessions=await pool.query('SELECT count(*)::int AS n FROM tree_game_sessions WHERE wallet=$1',[nonholder.toSuiAddress()]);
  assert.equal(deniedSessions.rows[0].n,0);
  const forged=await proof(service,new Ed25519Keypair());
  forged.signature=(await new Ed25519Keypair().signPersonalMessage(new TextEncoder().encode('forged'))).signature;
  await assert.rejects(service.enter(forged),{code:'SIGN_IN_REJECTED'});
  console.log('Gateway integration passed: real signatures, single-use challenges, NFT gate, hashed sessions, replay rejection and logout. Holdings were fixtures; no payments.');
} finally {await pool.end();}
