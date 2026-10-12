import test from 'node:test';
import assert from 'node:assert/strict';
import { toBase58 } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';
import { CHECKOUT_PACKAGE as P } from './checkout-package.mjs';
import { ADMIN, SETUP_ORIGIN, RECEIPT_KEY, validatePackage, publicationTransaction, verifyPublication, createPublisher, CheckoutBCS, AdminBCS, UpgradeBCS } from './checkout-publisher.mjs';
const address = n => '0x' + n.repeat(64);
const digest = toBase58(new Uint8Array(32).fill(7));
const chainIdentifier = toBase58(Uint8Array.from(Buffer.from('35834a8a' + '00'.repeat(28), 'hex')));
function fixture() {
  const packageId = address('3'), checkoutId = address('4'), adminCapId = address('5'), upgradeCapId = address('6');
  const created = [packageId, checkoutId, adminCapId, upgradeCapId].map((objectId, i) => ({objectId, idOperation: 'Created', outputState: i ? 'ObjectWrite' : 'PackageWrite'}));
  const t = {digest, status: {success: true}, transaction: {sender: ADMIN, commands: [{Publish: {modules: P.modules, dependencies: P.dependencies}}, {TransferObjects: {objects: [{Result: 0}], address: {Input: 0}}}], inputs: [{Pure: {bytes: Buffer.from(bcs.Address.serialize(ADMIN).toBytes()).toString('base64')}}]}, effects: {changedObjects: created}, objectTypes: {[checkoutId]: packageId+'::checkout::Checkout', [adminCapId]: packageId+'::checkout::AdminCap', [upgradeCapId]: '0x2::package::UpgradeCap'}};
  const checkout = {id: checkoutId, paused: true, quote_key: [], key_epoch: '0', max_payment_raw: '0', total_cap_raw: '0', total_received_raw: '0', allowed_payers: [], used_orders: {id: address('7'), size: '0'}};
  const objects = {
    [checkoutId]: {objectId: checkoutId, owner: {$kind: 'Shared', Shared: {initialSharedVersion: '42'}}, content: CheckoutBCS.serialize(checkout).toBytes()},
    [adminCapId]: {objectId: adminCapId, owner: {AddressOwner: ADMIN}, content: AdminBCS.serialize({id: adminCapId, checkout_id: checkoutId}).toBytes()},
    [upgradeCapId]: {objectId: upgradeCapId, owner: {AddressOwner: ADMIN}, content: UpgradeBCS.serialize({id: upgradeCapId, package: packageId, version: '1', policy: 0}).toBytes()},
  };
  const client = {core: {getChainIdentifier: async () => ({chainIdentifier}), waitForTransaction: async () => ({Transaction: t}), getObject: async ({objectId}) => ({object: objects[objectId]})}};
  return {client, t, objects, checkout, checkoutId, adminCapId, upgradeCapId};
}
test('actual compiled bytecode is pinned and publish only retains UpgradeCap in approved admin account', async () => {
  const tx = await publicationTransaction(), d = tx.getData();
  assert.equal(d.sender, ADMIN); assert.equal(d.commands.length, 2);
  assert.deepEqual(d.commands[0].Publish.modules, P.modules);
  assert.deepEqual(d.commands[1].TransferObjects.objects[0], {$kind: 'NestedResult', NestedResult: [0, 0]});
  assert.equal(bcs.Address.parse(Buffer.from(d.inputs[0].Pure.bytes, 'base64')), ADMIN);
});
for (const [name, mutate] of [['bytecode', p => p.modules[0] += 'AAAA'], ['recipient', p => p.admin = address('2')], ['network', p => p.network = 'testnet'], ['dependencies', p => p.dependencies.push(address('9'))]]) {
  test('rejects altered ' + name, async () => { const p = structuredClone(P); mutate(p); await assert.rejects(validatePackage(p)); });
}
test('caller mutation during validation cannot change pinned bytecode', async () => {
  const p = structuredClone(P), result = publicationTransaction(p); p.modules[0] = 'AAAA';
  assert.deepEqual((await result).getData().commands[0].Publish.modules, P.modules);
});
test('independent receipt read verifies initial shared checkout and both capability bindings', async () => {
  const f = fixture(), r = await verifyPublication(f.client, digest);
  assert.equal(r.checkoutId, f.checkoutId); assert.equal(r.initialSharedVersion, '42'); assert.equal(r.paused, true);
});
for (const [name, mutate] of [
  ['failed transaction', f => f.t.status.success = false],
  ['wrong sender', f => f.t.transaction.sender = address('1')],
  ['extra command', f => f.t.transaction.commands.push({MoveCall: {}})],
  ['modified publication', f => f.t.transaction.commands[0].Publish = {modules: ['AAAA'], dependencies: P.dependencies}],
  ['wrong capability owner', f => f.objects[f.adminCapId].owner.AddressOwner = address('1')],
  ['wrong checkout binding', f => f.objects[f.adminCapId].content = AdminBCS.serialize({id: f.adminCapId, checkout_id: address('9')}).toBytes()],
  ['unpaused instance', f => f.objects[f.checkoutId].content = CheckoutBCS.serialize({...f.checkout, paused: false}).toBytes()],
  ['configured key', f => f.objects[f.checkoutId].content = CheckoutBCS.serialize({...f.checkout, quote_key: [1]}).toBytes()],
  ['weakened upgrade policy', f => f.objects[f.upgradeCapId].content = UpgradeBCS.serialize({id: f.upgradeCapId, package: address('3'), version: '1', policy: 128}).toBytes()],
  ['testnet node', f => f.client.core.getChainIdentifier = async () => ({chainIdentifier: toBase58(new Uint8Array(32).fill(1))})],
]) test('rejects receipt with ' + name, async () => {const f = fixture(); mutate(f); await assert.rejects(verifyPublication(f.client, digest));});
test('production origin cannot initialize publication', () => assert.throws(() => createPublisher({origin: 'https://treeforce89.netlify.app', storage: {}}), /approved preview/));
test('wallet switching and concurrent clicks never create another submission', async () => {
  let account = ADMIN, sends = 0; const stored = new Map(), storage = {getItem: k => stored.get(k), setItem: (k, v) => stored.set(k, v)};
  const kit = {stores: {$currentNetwork: {get: () => 'mainnet'}, $connection: {get: () => ({account: {address: account}})}, $wallets: {get: () => []}}, connectWallet: async () => {}, signAndExecuteTransaction: async () => {sends++; return {Transaction: {digest, status: {success: true}}};}};
  const f = fixture(); f.client.core.simulateTransaction = async () => ({Transaction: {status: {success: true}, effects: {gasUsed: {computationCost: '1000000', storageCost: '2000000', storageRebate: '0'}}, transaction: {gasData: {budget: '10000000'}}}});
  const p = createPublisher({origin: SETUP_ORIGIN, storage, kit, client: f.client});
  await p.connect({}); account = address('1'); await assert.rejects(p.publish(), /approved admin/); assert.equal(sends, 0);
  account = ADMIN; await p.connect({}); const pending = p.publish(); await assert.rejects(p.publish()); await pending;
  assert.equal(sends, 1); assert.equal(JSON.parse(stored.get(RECEIPT_KEY)).paused, true);
  await p.connect({}); await assert.rejects(p.publish(), /already submitted/); assert.equal(sends, 1);
});
