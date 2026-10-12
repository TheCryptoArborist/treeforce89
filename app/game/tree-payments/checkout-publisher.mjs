import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { fromBase58, normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils';
import { CHECKOUT_PACKAGE } from './checkout-package.mjs';

export const ADMIN = '0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4';
export const SETUP_ORIGIN = 'https://deploy-preview-3--treeforce89.netlify.app';
export const RECEIPT_KEY = 'tree-checkout-publication-v1';
const need = (condition, message) => { if (!condition) throw new Error(message); };
const hex = bytes => [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
const payload = p => ({ modules: p.modules, dependencies: p.dependencies });
const hash = async p => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload(p))))));
const pinnedHash = CHECKOUT_PACKAGE.payloadSha256;
export async function validatePackage(p = CHECKOUT_PACKAGE) {
  p = structuredClone(p);
  need(p.version === 1 && p.network === 'mainnet' && p.chainIdentifier === '35834a8a' && p.admin === ADMIN && p.initiallyPaused === true, 'Wrong checkout package settings.');
  need(/^[a-f0-9]{40}$/.test(p.sourceCommit) && p.cli === 'mainnet-v1.81.1', 'Missing build provenance.');
  need(p.modules?.length === 1 && p.dependencies?.length > 0 && p.dependencies.every(x => ['0x1', '0x2'].map(x => normalizeSuiAddress(x)).includes(normalizeSuiAddress(x))), 'Unexpected checkout modules or dependencies.');
  need(p.payloadSha256 === pinnedHash && await hash(p) === pinnedHash, 'Checkout bytecode does not match the tested build.');
  return structuredClone(p);
}
export async function publicationTransaction(p = CHECKOUT_PACKAGE) {
  const verified = await validatePackage(p), tx = new Transaction();
  tx.setSender(ADMIN);
  const [upgradeCap] = tx.publish(payload(verified));
  tx.transferObjects([upgradeCap], ADMIN);
  return tx;
}
export async function checkNetwork(client) {
  const { chainIdentifier } = await client.core.getChainIdentifier();
  need(hex(fromBase58(chainIdentifier).slice(0, 4)) === '35834a8a', 'The connected node is not Sui mainnet.');
}
export const CheckoutBCS = bcs.struct('Checkout', {
  id: bcs.Address, paused: bcs.bool(), quote_key: bcs.vector(bcs.u8()), key_epoch: bcs.u64(),
  max_payment_raw: bcs.u64(), total_cap_raw: bcs.u64(), total_received_raw: bcs.u64(),
  allowed_payers: bcs.vector(bcs.Address), used_orders: bcs.struct('Table', {id: bcs.Address, size: bcs.u64()}),
});
export const AdminBCS = bcs.struct('AdminCap', {id: bcs.Address, checkout_id: bcs.Address});
export const UpgradeBCS = bcs.struct('UpgradeCap', {id: bcs.Address, package: bcs.Address, version: bcs.u64(), policy: bcs.u8()});
function decode(type, object) {
  const parsed = type.parse(object.content);
  need(hex(type.serialize(parsed).toBytes()) === hex(object.content) && parsed.id === object.objectId, 'Noncanonical checkout object.');
  return parsed;
}
export async function verifyPublication(client, digest) {
  need(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest), 'Enter a Sui transaction digest.');
  await checkNetwork(client);
  const result = await client.core.waitForTransaction({digest, include: {effects: true, objectTypes: true, transaction: true}, timeout: 60000});
  const t = result.Transaction;
  need(t?.status.success === true && t.digest === digest && t.transaction.sender === ADMIN, 'Publication did not succeed from the approved admin wallet.');
  const commands = t.transaction.commands;
  need(commands.length === 2 && commands[0].Publish && commands[1].TransferObjects && await hash(commands[0].Publish) === pinnedHash, 'Transaction does not publish the tested checkout.');
  const transfer = commands[1].TransferObjects;
  const cap = transfer.objects[0];
  need(transfer.objects.length === 1 && (cap?.Result === 0 || (cap?.NestedResult?.length === 2 && cap.NestedResult[0] === 0 && cap.NestedResult[1] === 0)) && Number.isInteger(transfer.address.Input), 'Unexpected capability transfer.');
  const recipient = t.transaction.inputs[transfer.address.Input]?.Pure?.bytes;
  need(recipient && bcs.Address.parse(Uint8Array.from(atob(recipient), x => x.charCodeAt(0))) === ADMIN, 'Wrong upgrade capability recipient.');
  const created = t.effects.changedObjects.filter(o => o.idOperation === 'Created');
  const packages = created.filter(o => o.outputState === 'PackageWrite');
  need(packages.length === 1, 'Expected exactly one published package.');
  const packageId = packages[0].objectId;
  const find = type => {
    const matches = created.filter(o => t.objectTypes[o.objectId] && normalizeStructTag(t.objectTypes[o.objectId]) === normalizeStructTag(type));
    need(matches.length === 1, 'Missing or duplicate checkout control object.'); return matches[0].objectId;
  };
  const checkoutId = find(`${packageId}::checkout::Checkout`), adminCapId = find(`${packageId}::checkout::AdminCap`), upgradeCapId = find('0x2::package::UpgradeCap');
  const objects = await Promise.all([checkoutId, adminCapId, upgradeCapId].map(objectId => client.core.getObject({objectId, include: {content: true}}).then(r => r.object)));
  const [co, ao, uo] = objects, c = decode(CheckoutBCS, co), a = decode(AdminBCS, ao), u = decode(UpgradeBCS, uo);
  need(co.owner.$kind === 'Shared' && c.paused && c.quote_key.length === 0 && c.key_epoch === '0' && c.max_payment_raw === '0' && c.total_cap_raw === '0' && c.total_received_raw === '0' && c.allowed_payers.length === 0 && c.used_orders.size === '0', 'Checkout is not in its initial paused state.');
  need(ao.owner.AddressOwner === ADMIN && uo.owner.AddressOwner === ADMIN && a.checkout_id === checkoutId && u.package === packageId && u.version === '1' && u.policy === 0, 'Checkout capabilities do not match the approved ownership and upgrade policy.');
  return {network: 'mainnet', digest, packageId, checkoutId, initialSharedVersion: co.owner.Shared.initialSharedVersion, adminCapId, upgradeCapId, paused: true, payloadSha256: pinnedHash, sourceCommit: CHECKOUT_PACKAGE.sourceCommit};
}
export function createPublisher({origin, storage = localStorage, kit, client, connectTimeoutMs = 45000} = {}) {
  need(origin === SETUP_ORIGIN, 'Checkout setup is available on the approved preview only.');
  const node = client || new SuiGrpcClient({network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443'});
  const app = kit || createDAppKit({networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false, createClient: () => node});
  let prepared = null, busy = false, connectionPending = null;
  const checkWallet = () => {
    need(app.stores.$currentNetwork.get() === 'mainnet', 'Switch your wallet to Sui mainnet.');
    need(app.stores.$connection.get().account?.address === ADMIN, 'Select the approved admin wallet account.');
  };
  return {
    wallets: () => app.stores.$wallets.get(),
    async connect(wallet) {
      need(!connectionPending, 'Close the existing wallet prompt before trying to connect again.');
      prepared = null;
      const request = app.connectWallet({wallet});
      connectionPending = request;
      const finished = () => {if (connectionPending === request) connectionPending = null;};
      request.then(finished, finished);
      let timer;
      try {
        await Promise.race([request, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Wallet connection has not completed. Check the wallet prompt. If Slush shows a security warning, choose Return to safety. Publication has not started.')), connectTimeoutMs);
        })]);
      } finally {clearTimeout(timer);}
      checkWallet(); await checkNetwork(node);
      const tx = await publicationTransaction();
      const result = await node.core.simulateTransaction({transaction: tx, doGasSelection: true, include: {effects: true, transaction: true}});
      need(result.Transaction?.status.success, 'The mainnet publication simulation failed. Check the admin account has SUI for gas.');
      const t = result.Transaction, gas = t.effects.gasUsed;
      const estimate = BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);
      const budget = BigInt(t.transaction.gasData.budget);
      need(estimate >= 0n && budget > 0n && budget <= 1000000000n, 'Publication gas exceeds the 1 SUI maximum.');
      checkWallet(); prepared = {budget: String(budget), expires: Date.now() + 60000};
      return {estimateSui: Number(estimate) / 1e9, maximumSui: Number(budget) / 1e9};
    },
    async publish() {
      need(!busy && prepared && Date.now() <= prepared.expires, 'Connect again to refresh the publication estimate.');
      need(!storage.getItem(RECEIPT_KEY), 'A publication was already submitted. Verify its receipt before publishing again.');
      checkWallet(); busy = true;
      try {
        await checkNetwork(node); checkWallet();
        const tx = await publicationTransaction(); tx.setGasBudget(prepared.budget); checkWallet();
        const result = await app.signAndExecuteTransaction({transaction: tx, network: 'mainnet'});
        const transaction = result.Transaction || result.FailedTransaction;
        need(transaction?.digest, 'The wallet returned no publication digest.');
        storage.setItem(RECEIPT_KEY, JSON.stringify({digest: transaction.digest, submitted: true}));
        need(result.Transaction?.status.success, 'The publication failed. Keep its digest and check the transaction.');
        const receipt = await verifyPublication(node, transaction.digest);
        storage.setItem(RECEIPT_KEY, JSON.stringify(receipt)); return receipt;
      } finally {busy = false; prepared = null;}
    },
    async recover(digest) { const receipt = await verifyPublication(node, digest); storage.setItem(RECEIPT_KEY, JSON.stringify(receipt)); return receipt; },
    saved: () => { try {return JSON.parse(storage.getItem(RECEIPT_KEY) || 'null');} catch {return null;} },
  };
}
