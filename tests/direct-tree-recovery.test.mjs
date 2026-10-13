import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingPurchase } from '../app/game/tree-payments/pending.mjs';
import { createTreeContinueAttempt } from '../app/game/tree-continue-attempt.mjs';
function store() { const values=new Map(); return pendingPurchase({ getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k) }); }
test('free restart never erases another flight pending payment',async()=>{
 const pending=store(),previous={runId:crypto.randomUUID(),orderId:crypto.randomUUID(),signingAttempted:true};pending.save(previous);
 const attempt=createTreeContinueAttempt({clientRunId:crypto.randomUUID(),pending});await attempt.cancel();assert.deepEqual(pending.read(),previous);
});
test('pending marker clears only its own run and order',()=>{
 const pending=store(),previous={runId:'a',orderId:'b'};pending.save(previous);pending.clear('other','b');assert.deepEqual(pending.read(),previous);
 pending.clear('a','other');assert.deepEqual(pending.read(),previous);pending.clear('a','b');assert.equal(pending.read(),null);
});
