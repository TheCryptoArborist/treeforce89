import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNFTreeGate,resetNFTreeGate,updateNFTreeGate,subscribeNFTreeGate } from './nftree-gate.mjs';
const wallet='0x'+'a'.repeat(64);
test('starts locked',()=>{resetNFTreeGate();assert.equal(getNFTreeGate().eligible,false)});
test('requires validated state',()=>{assert.throws(()=>updateNFTreeGate({address:wallet,eligible:'yes'}),/invalid-gate-state/);assert.equal(getNFTreeGate().eligible,false)});
test('grants and revokes local UI eligibility',()=>{updateNFTreeGate({address:wallet,eligible:true});assert.equal(getNFTreeGate().eligible,true);resetNFTreeGate();assert.equal(getNFTreeGate().eligible,false)});
test('notifies and unsubscribes',()=>{let count=0;const unsub=subscribeNFTreeGate(()=>count++);updateNFTreeGate({address:wallet,eligible:true});unsub();resetNFTreeGate();assert.equal(count,1)});
