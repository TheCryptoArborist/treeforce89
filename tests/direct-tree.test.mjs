import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTreeContinueAttempt } from '../app/game/tree-continue-attempt.mjs';
import { TREE_CONTINUE as P } from '../app/game/tree-continue-policy.mjs';
import { pendingPurchase } from '../app/game/tree-payments/pending.mjs';
import { directContinueGate } from '../netlify/lib/tree-continue-gate.mjs';
function fixture() {
  const runId = crypto.randomUUID(), accountId = crypto.randomUUID(), orderId = crypto.randomUUID();
  const payer = '0x' + '1'.repeat(64), counts = { pay: 0, apply: 0, resume: 0, boundary: 0, connect: 0, order: 0, deliver: 0 };
  const order = { product: P.product, network: P.network, coinType: P.coinType, recipient: P.recipient,
    amountRaw: P.amountRaw, decimals: 6, lives: 3, runId, accountId, orderId, payer, payable: true };
  let who = { authenticated: true, accountId, wallet: { family: 'sui', address: payer } };
  const storage = new Map(), pending = pendingPurchase({ getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) });
  const env = { enabled: true, verified: true, validFlight: true, serverDelivered: false, deliveryFail: false, applyFail: false };
  const api = async c => {
    if (c.action === 'status') return { enabled: env.enabled };
    if (c.action === 'order') { counts.order++; return { order }; }
    if (c.action === 'reconcile') return { status: env.serverDelivered ? 'delivered' : env.verified ? 'verified' : 'pending', order,
      authorization: { orderId, runId, lives: 3, receiptId: 'sui:mainnet:fixture:0' } };
    if (c.action === 'deliver') { counts.deliver++; env.serverDelivered = true; if (env.deliveryFail) throw Error('timeout'); return { status: 'delivered', runId, orderId }; }
    if (c.action === 'cancel') return { status: 'cancelled' };
    throw Error('Unexpected action ' + c.action);
  };
  const wallet = { async connect() { counts.connect++; }, async prepare() { return { transaction: 'fixture' }; },
    async pay() { counts.pay++; return { $kind: 'Transaction', Transaction: { digest: 'fake-digest-for-tests' } }; }, async wait() {} };
  const make = () => createTreeContinueAttempt({ api, wallet, identity: () => who, clientRunId: runId, pending,
    prepare() { if (!env.validFlight) throw Error('Flight ended'); },
    apply(lives) { if (env.applyFail) throw Error('render failed'); assert.equal(lives, 3); counts.apply++; },
    boundary() { counts.boundary++; }, resume() { counts.resume++; } });
  return { env, counts, order, wallet, make, pending, setIdentity: i => who = i, identity: () => who, attempt: make() };
}
test('fixed price is exactly 20,000 TREE at six decimals, no dollar conversion', () => {
  assert.equal(BigInt(P.amountRaw), 20000n * 10n ** 6n); assert.equal(P.maxPerFlight, 1);
});
test('checkout disabled cannot connect or request a wallet payment', async () => {
  const f = fixture(); f.env.enabled = false; await assert.rejects(f.attempt.continue(), /checkout-not-enabled/);
  assert.equal(f.counts.pay, 0); assert.equal(f.counts.connect, 0); assert.equal(f.counts.order, 0);
});
test('verified purchase restores exactly once, clears marker and never touches CC', async () => {
  const f = fixture(); assert.equal(await f.attempt.continue(), true); assert.equal(await f.attempt.continue(), false);
  assert.equal(f.counts.pay, 1); assert.equal(f.counts.apply, 1); assert.equal(f.counts.resume, 1); assert.equal(f.pending.read(), null);
});
test('double click produces one wallet request and one restore', async () => {
  const f = fixture(); await Promise.all([f.attempt.continue(), f.attempt.continue()]); assert.equal(f.counts.pay, 1); assert.equal(f.counts.apply, 1);
});
test('wallet success alone never restores while server verification is pending', async () => {
  const f = fixture(); f.env.verified = false; await assert.rejects(f.attempt.continue(), /payment-not-yet-verified/);
  assert.equal(f.counts.apply, 0); assert.equal(f.pending.read().signingAttempted, true);
  f.env.verified = true; await f.attempt.continue(); assert.equal(f.counts.pay, 1);
});
test('unknown wallet outcome can only reconcile, not submit another payment', async () => {
  const f = fixture(); f.wallet.pay = async () => { f.counts.pay++; throw Error('Network lost'); };
  await assert.rejects(f.attempt.continue(), /Network lost/); assert.equal(await f.attempt.cancel(), false);
  await f.attempt.continue(); assert.equal(f.counts.pay, 1); assert.equal(f.counts.apply, 1);
});
test('explicit rejection leaves free restart available', async () => {
  const f = fixture(); f.wallet.pay = async () => { throw Object.assign(Error('Rejected'), { code: 4001 }); };
  assert.equal(await f.attempt.continue(), false); assert.equal(f.counts.apply, 0); assert.equal(await f.attempt.cancel(), true);
});
test('a generic error containing cancelled is not mistaken for a wallet rejection', async () => {
  const f = fixture(); f.wallet.pay = async () => { throw Error('Connection cancelled after submission'); };
  await assert.rejects(f.attempt.continue()); assert.equal(f.attempt.state.signingAttempted, true); assert.equal(await f.attempt.cancel(), false);
});
test('lost delivery acknowledgment does not reapply lives or recharge', async () => {
  const f = fixture(); f.env.deliveryFail = true; await assert.rejects(f.attempt.continue());
  f.env.deliveryFail = false; await f.attempt.continue(); assert.equal(f.counts.pay, 1); assert.equal(f.counts.apply, 1); assert.equal(f.counts.resume, 1);
});
test('render failure retains verified purchase for same-flight retry without payment', async () => {
  const f = fixture(); f.env.applyFail = true; await assert.rejects(f.attempt.continue());
  f.env.applyFail = false; await f.attempt.continue(); assert.equal(f.counts.pay, 1); assert.equal(f.counts.boundary, 1); assert.equal(f.counts.apply, 1);
});
for (const [key, value] of [['amountRaw','1'], ['recipient','0x'+'2'.repeat(64)], ['network','sui:testnet'], ['coinType','FAKE'], ['runId',crypto.randomUUID()], ['lives',30], ['decimals',9], ['product','cc-package']]) {
  test('reject substituted order ' + key + ' before paying', async () => {
    const f = fixture(); f.order[key] = value; await assert.rejects(f.attempt.continue()); assert.equal(f.counts.pay, 0);
  });
}
test('account switching while signing cannot deliver to another account', async () => {
  const f = fixture(), original = f.identity(); f.wallet.pay = async () => { f.counts.pay++; f.setIdentity({ ...original, accountId: crypto.randomUUID() }); return { $kind: 'Transaction', Transaction: { digest: 'fixture' } }; };
  await assert.rejects(f.attempt.continue(), /account-changed/); assert.equal(f.counts.apply, 0);
  f.setIdentity(original); await f.attempt.continue(); assert.equal(f.counts.pay, 1);
});
test('guest and EVM sign-in cannot pay TREE', async () => {
  for (const i of [null, { authenticated: true, wallet: { family: 'evm' } }]) { const f = fixture(); f.setIdentity(i); await assert.rejects(f.attempt.continue(), /sui-sign-in/); assert.equal(f.counts.pay, 0); }
});
test('leaving flight during wallet connection stops before payment', async () => {
  const f = fixture(); f.wallet.connect = async () => { f.env.validFlight = false; };
  await assert.rejects(f.attempt.continue()); assert.equal(f.counts.pay, 0);
});
test('delivery previously acknowledged in another tab is not automatically replayed', async () => {
  const f = fixture(); f.env.serverDelivered = true;
  await assert.rejects(f.attempt.continue(), /delivery-recovery-required/); assert.equal(f.counts.apply, 0);
});
test('free restart on an unpaid attempt never invokes wallet or credit functions', async () => {
  const f = fixture(); assert.equal(await f.attempt.cancel(), true); assert.equal(f.counts.pay, 0); assert.equal(f.counts.order, 0);
});
test('pending marker contains no login/session or wallet signature', async () => {
  const f = fixture(); f.env.verified = false; await assert.rejects(f.attempt.continue());
  assert.deepEqual(Object.keys(f.pending.read()).sort(), ['accountId','digest','orderId','payer','runId','signingAttempted']);
});
test('activation endpoint is hard disabled, ignores flags and rejects cross-origin POST', async () => {
  process.env.TREE_PAYMENTS_ENABLED = 'true';
  let r = directContinueGate(new Request('https://preview.example/api/tree-continue?live=true', { method: 'POST', headers: { Origin: 'https://preview.example' }, body: '{}' }));
  assert.equal(r.status, 503); assert.equal((await r.json()).enabled, false);
  r = directContinueGate(new Request('https://preview.example/api/tree-continue', { method: 'POST', headers: { Origin: 'https://evil.example' } }));
  assert.equal(r.status, 403); delete process.env.TREE_PAYMENTS_ENABLED;
});
