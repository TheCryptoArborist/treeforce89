import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.value = ''; this.classList = { add() {}, remove() {} }; }
  append(...nodes) { this.children.push(...nodes); if (this.tagName === 'select' && !this.value) this.value = nodes[0]?.value || ''; }
  replaceChildren(...nodes) { this.children = []; this.value = ''; this.append(...nodes); }
  insertBefore(node) { this.append(node); }
  setAttribute() {} querySelector() { return null; } scrollIntoView() {} focus() {} remove() {}
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled() { for (let i = 0; i < 8; i++) await tick(); }
function fixture({ unavailable = false, connect = null, rejectSignature = false } = {}) {
  const first = { address: '0x' + '1'.repeat(64) }, second = { address: '0x' + '2'.repeat(64) };
  const calls = [], account = { current: first }, registry = new Map(), events = new EventEmitter(), frame = new Element('div');
  registry.remove = key => registry.delete(key);
  const kit = { stores: { $connection: { get: () => ({ account: account.current, wallet: {} }) } },
    switchAccount: async ({ account: a }) => { calls.push('switch'); account.current = a; },
    disconnectWallet: async () => { calls.push('disconnect'); } };
  const row = { id: 'slush', name: 'Slush fixture' }, connection = { ...row, accounts: [first, second] };
  const identity = () => ({ authenticated: true, environment: 'preview', accountId: 'fixture', wallet: { family: 'sui', address: account.current.address } });
  let session = null;
  const source = readFileSync(new URL('../app/game/tree-account.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export function installTreeAccount', 'function installTreeAccount');
  const install = runInNewContext(source + '\ninstallTreeAccount;', {
    document: { createElement: tag => new Element(tag), hidden: false }, URLSearchParams, AbortSignal,
    window: { location: { search: '', origin: 'https://fixture.invalid' }, addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {} },
    discoverAccountWallets: () => ({ app: kit, list: () => [row], subscribe: () => () => {}, destroy() {} }),
    connectAccountWallet: async () => { calls.push('connect'); return connect ? await connect() : connection; },
    watchAccountWallet: () => () => {}, holdGameForAccount: () => () => {},
    signAccountMessage: async () => { calls.push('sign'); if (rejectSignature) throw Object.assign(Error('User rejected'), { code: 4001 }); return 'fixture-signature'; },
    fetch: async (_url, options) => {
      if (!options.method) return { ok: true, json: async () => ({ identity: session, configured: !unavailable }) };
      const body = JSON.parse(options.body); calls.push(body.action);
      if (body.action === 'verify') session = identity();
      if (body.action === 'logout') session = null;
      return { ok: true, json: async () => body.action === 'challenge' ? { message: 'fixture proof' } : { identity: session } };
    },
  });
  const dispose = install({ registry, events }, frame);
  const bar = frame.children[0], controls = bar.children[1], note = bar.children[2];
  const button = label => controls.children.find(n => n.textContent === label);
  return { calls, registry, events, dispose, note, accountSelect: controls.children[2], click: label => button(label).listeners.click() };
}
test('ordinary connection displays account without authentication, signature, challenge or payment', async () => {
  const f = fixture(); await settled(); f.click('CONNECT WALLET'); await settled();
  assert.deepEqual(f.calls, ['connect']); assert.equal(f.registry.get('treeAccountIdentity'), null);
  assert.equal(f.registry.get('treeWalletConnection').address, '0x' + '1'.repeat(64));
  assert.match(f.note.textContent, /Wallet connected/); f.dispose();
});
test('connection does not require the ownership service to be configured', async () => {
  const f = fixture({ unavailable: true }); await settled(); f.click('CONNECT WALLET'); await settled();
  assert.deepEqual(f.calls, ['connect']); assert.equal(await f.registry.get('treeAccountConnect')(), null);
  assert.deepEqual(f.calls, ['connect']); f.dispose();
});
test('protected action verifies connected account without a second connection and account selection defers re-verification', async () => {
  const f = fixture(); await settled(); f.click('CONNECT WALLET'); await settled();
  assert.equal((await f.registry.get('treeAccountConnect')()).authenticated, true);
  assert.deepEqual(f.calls, ['connect', 'challenge', 'sign', 'verify']);
  f.accountSelect.value = '0x' + '2'.repeat(64); f.accountSelect.listeners.change(); await settled();
  assert.equal(f.registry.get('treeAccountIdentity'), null);
  assert.deepEqual(f.calls, ['connect', 'challenge', 'sign', 'verify', 'logout', 'switch']);
  const verified = await f.registry.get('treeAccountConnect')();
  assert.equal(verified.wallet.address, '0x' + '2'.repeat(64));
  assert.equal(f.calls.filter(c => c === 'connect').length, 1); f.dispose();
});
test('rejected protected signature cannot authenticate an ordinary connected account', async () => {
  const f = fixture({ rejectSignature: true }); await settled(); f.click('CONNECT WALLET'); await settled();
  assert.equal(await f.registry.get('treeAccountConnect')(), null);
  assert.deepEqual(f.calls, ['connect', 'challenge', 'sign', 'cancel']);
  assert.equal(f.registry.get('treeAccountIdentity'), null); f.dispose();
});
test('late connection approval after cancellation never signs or authenticates', async () => {
  let release; const f = fixture({ connect: () => new Promise(resolve => { release = resolve; }) });
  await settled(); f.click('CONNECT WALLET'); await settled(); f.click('CANCEL');
  release({ name: 'Slush fixture', accounts: [{ address: '0x' + '1'.repeat(64) }] }); await settled();
  assert.deepEqual(f.calls, ['connect']); assert.equal(f.registry.get('treeAccountIdentity'), null);
  assert.equal(f.registry.get('treeWalletConnection'), null); f.dispose();
});

test('disconnecting an ordinary connection does not call ownership service', async () => {
  const f = fixture({ unavailable: true }); await settled(); f.click('CONNECT WALLET'); await settled();
  f.click('DISCONNECT'); await settled();
  assert.deepEqual(f.calls, ['connect', 'disconnect']);
  assert.equal(f.registry.get('treeWalletConnection'), null);
  assert.match(f.note.textContent, /Wallet disconnected/); f.dispose();
});
