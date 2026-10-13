import { getSuiApp, getWalletUniqueIdentifier } from './tree-payments/sui-app.mjs';
const normalize = a => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
const suiAccount = a => typeof a?.address === 'string' && /^0x[0-9a-f]{1,64}$/i.test(a.address) && a.chains?.includes('sui:mainnet');
const sameWallet = (a, b) => a === b || (!!a && !!b && getWalletUniqueIdentifier(a) === getWalletUniqueIdentifier(b));
const pendingConnections = new WeakMap();
/** dApp Kit owns Wallet Standard registration. Only installed Sui Mainnet wallets are offered. */
export function discoverAccountWallets(app = getSuiApp(), identify = getWalletUniqueIdentifier) {
  const rows = () => app.stores.$wallets.get().filter(w => w.chains.includes('sui:mainnet') && w.features.includes('sui:signPersonalMessage'))
    .map(w => ({ id: identify(w), family: 'sui', name: String(w.name).slice(0, 60), provider: w, kit: app }));
  const subscriptions = new Set();
  return { app, list: family => family === 'sui' ? rows() : [],
    subscribe(fn) { const off = app.stores.$wallets.subscribe(fn); subscriptions.add(off); return () => { off(); subscriptions.delete(off); }; },
    refresh() {}, destroy() { for (const off of subscriptions) off(); subscriptions.clear(); } };
}
export async function connectAccountWallet(row, { timeoutMs = 45000 } = {}) {
  if (row.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  const app = row.kit;
  if (pendingConnections.has(app)) throw new Error('Close the existing wallet prompt before connecting again. No sign-in message or payment was requested.');
  const request = Promise.resolve().then(() => app.connectWallet({ wallet: row.provider }));
  pendingConnections.set(app, request);
  const settled = () => { if (pendingConnections.get(app) === request) pendingConnections.delete(app); };
  request.then(settled, settled);
  let timer, result;
  try {
    result = await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Wallet connection did not finish. If Slush shows “Malicious website”, choose Return to safety. No sign-in message or payment was requested.')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
  const accounts = (result.accounts || []).filter(suiAccount);
  if (!accounts.length || app.stores.$currentNetwork.get() !== 'mainnet') throw new Error('This wallet did not return a Sui Mainnet account.');
  return { ...row, accounts, chainId: 'sui:mainnet' };
}
export function watchAccountWallet(connection, changed) {
  if (connection.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  const app = connection.kit, initial = app.stores.$connection.get();
  const check = () => {
    const current = app.stores.$connection.get();
    if (!sameWallet(current.wallet, initial.wallet) || current.account?.address !== initial.account?.address || app.stores.$currentNetwork.get() !== 'mainnet') changed();
  };
  const off = app.stores.$connection.subscribe(check), networkOff = app.stores.$currentNetwork.subscribe(check);
  return () => { off(); networkOff(); };
}
export async function assertAccountWallet(connection, account) {
  if (connection.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  const current = connection.kit.stores.$connection.get();
  if (!sameWallet(current.wallet, connection.provider) || !suiAccount(current.account) || normalize(current.account.address) !== normalize(account.address) || connection.kit.stores.$currentNetwork.get() !== 'mainnet') throw new Error('Wallet account changed. Please reconnect.');
}
export async function signAccountMessage(connection, account, message) {
  if (typeof message !== 'string' || !message || message.length > 10000) throw new Error('Invalid sign-in message.');
  await assertAccountWallet(connection, account);
  const app = connection.kit;
  if (pendingConnections.has(app)) throw new Error('Close the existing wallet prompt before connecting again.');
  const request = Promise.resolve().then(() => app.signPersonalMessage({ account, message: new TextEncoder().encode(message), network: 'mainnet' }));
  pendingConnections.set(app, request);
  const settled = () => { if (pendingConnections.get(app) === request) pendingConnections.delete(app); };
  request.then(settled, settled);
  const signed = await request;
  await assertAccountWallet(connection, account);
  if (typeof signed.signature !== 'string' || !signed.signature || signed.signature.length > 14000) throw new Error('The wallet did not return a valid signature.');
  return signed.signature;
}
