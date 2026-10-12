/** Browser-native Sui Wallet Standard discovery, without loading remote code.
 * Wallet names are untrusted display text. No transaction methods are exposed here.
 */
const suiAccount = a => typeof a?.address === 'string' && /^0x[0-9a-f]{1,64}$/i.test(a.address) && a.chains?.includes('sui:mainnet');
const normalize = a => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
const pendingSuiConnections = new WeakMap();
export function discoverAccountWallets(win = window) {
  const rows = [], observers = new Set(); let serial = 0, disposed = false;
  const notify = () => observers.forEach(fn => fn());
  const add = (family, name, provider) => {
    if (disposed || rows.some(r => r.family === family && r.provider === provider)) return;
    rows.push({ id: `${family}-${++serial}`, family, name: String(name || `${family.toUpperCase()} wallet`).slice(0, 60), provider }); notify();
  };
  const register = (...wallets) => {
    const added = [];
    for (const wallet of wallets) {
      try {
        if (typeof wallet?.features?.['standard:connect']?.connect === 'function' && typeof wallet.features['sui:signPersonalMessage']?.signPersonalMessage === 'function' && wallet.chains?.includes('sui:mainnet')) {
          if (!rows.some(r => r.provider === wallet && r.family === 'sui')) { add('sui', wallet.name, wallet); added.push(wallet); }
        }
      } catch { /* Ignore malformed provider announcements. */ }
    }
    return () => { for (let i = rows.length - 1; i >= 0; i--) if (added.includes(rows[i].provider)) rows.splice(i, 1); notify(); };
  };
  const api = Object.freeze({ register });
  const standard = event => { try { if (typeof event.detail === 'function') event.detail(api); } catch {} };
  function refresh() {
    win.dispatchEvent(new win.CustomEvent('wallet-standard:app-ready', { detail: api }));
  }
  win.addEventListener('wallet-standard:register-wallet', standard); refresh();
  return { list: family => rows.filter(r => r.family === family), subscribe(fn) { observers.add(fn); return () => observers.delete(fn); }, refresh,
    destroy() { disposed = true; observers.clear(); win.removeEventListener('wallet-standard:register-wallet', standard); },
  };
}
export async function connectAccountWallet(row, { timeoutMs = 45000 } = {}) {
  if (row.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  const p = row.provider;
  if (pendingSuiConnections.has(p)) throw new Error('Close the existing wallet prompt before connecting again. No sign-in message or payment was requested.');
  const request = Promise.resolve().then(() => p.features['standard:connect'].connect());
  pendingSuiConnections.set(p, request);
  const settled = () => { if (pendingSuiConnections.get(p) === request) pendingSuiConnections.delete(p); };
  request.then(settled, settled);
  let timer, result;
  try {
    result = await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Wallet connection did not finish. If the wallet shows “Malicious website”, choose Return to safety. Sign-in is blocked; no message signature or payment was requested. You can cancel and return to your flight.')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
  const accounts = (result.accounts || []).filter(suiAccount);
  if (!accounts.length) throw new Error('This wallet did not return a Sui Mainnet account.');
  return { ...row, accounts, chainId: 'sui:mainnet' };
}
export function watchAccountWallet(connection, changed) {
  if (connection.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  return connection.provider.features['standard:events']?.on('change', event => { if (event.accounts || event.chains) changed(); }) || (() => {});
}
export async function assertAccountWallet(connection, account) {
  if (connection.family !== 'sui') throw new Error('Only Sui Mainnet wallets are supported.');
  if (!connection.provider.accounts?.some(a => suiAccount(a) && normalize(a.address) === normalize(account.address))) throw new Error('Wallet account changed. Please reconnect.');
}
export async function signAccountMessage(connection, account, message) {
  if (typeof message !== 'string' || !message || message.length > 10000) throw new Error('Invalid sign-in message.');
  await assertAccountWallet(connection, account);
  const bytes = new TextEncoder().encode(message);
  const signed = await connection.provider.features['sui:signPersonalMessage'].signPersonalMessage({ account, message: bytes, chain: 'sui:mainnet' });
  const signature = signed.signature;
  await assertAccountWallet(connection, account);
  if (typeof signature !== 'string' || !signature || signature.length > 14000) throw new Error('The wallet did not return a valid signature.');
  return signature;
}
