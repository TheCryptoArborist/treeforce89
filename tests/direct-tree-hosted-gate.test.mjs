import test from 'node:test';
import assert from 'node:assert/strict';
import { directContinueGate, READONLY_CONTINUE_PREVIEW as P } from '../netlify/lib/tree-continue-gate.mjs';
const request = (origin, command, cookie = '') => new Request(origin + '/api/tree-continue', {
 method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(command),
});
test('production and unreviewed previews remain closed', async () => {
 for (const origin of ['https://treeforce89.netlify.app', 'https://deploy-preview-4--treeforce89.netlify.app', 'https://other.example']) {
  const r = await directContinueGate(request(origin, { action: 'status', enabled: true }));
  assert.equal(r.status, 503); assert.equal((await r.json()).enabled, false);
 }
});
test('reviewed preview status never claims active checkout', async () => {
 const r = await directContinueGate(new Request(P.gameOrigin + '/api/tree-continue?enabled=true'));
 const p = await r.json(); assert.equal(r.status, 200); assert.equal(p.paymentsEnabled, false); assert.equal(p.restoreAuthorized, false);
});
test('preview requires session and same-origin before upstream', async () => {
 assert.equal((await directContinueGate(request(P.gameOrigin, { action: 'list_purchases' }))).status, 401);
 const r = request(P.gameOrigin, { action: 'status' }); r.headers.set('Origin', 'https://evil.example');
 assert.equal((await directContinueGate(r)).status, 403);
});
test('preview forwards the private cookie only to the pinned readonly service', async () => {
 const original = globalThis.fetch; let calls = 0;
 globalThis.fetch = async (url, options) => {
  calls++; assert.equal(url, P.serviceUrl); assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer ' + 'a'.repeat(64));
  assert.equal(options.headers.Origin, undefined);
  return Response.json({ enabled: false, paymentsEnabled: false, purchases: [], requiresPayment: false });
 };
 try {
  const r = await directContinueGate(request(P.gameOrigin, { action: 'list_purchases' }, '__Host-tree-game-session=' + 'a'.repeat(64)));
  assert.equal(r.status, 200); assert.equal((await r.json()).enabled, false); assert.equal(calls, 1);
  const injected = await directContinueGate(request(P.gameOrigin, { action: 'list_purchases', payer: 'injected' }, '__Host-tree-game-session=' + 'a'.repeat(64)));
  assert.equal(injected.status, 400); assert.equal(calls, 1);
 } finally { globalThis.fetch = original; }
});
