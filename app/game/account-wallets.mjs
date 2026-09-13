/** Browser-native Wallet Standard and EIP-6963 discovery, without loading remote code.
 * Wallet names are untrusted display text. No transaction methods are exposed here.
 */
const suiAccount = a => typeof a?.address === 'string' && /^0x[0-9a-f]{1,64}$/i.test(a.address) && a.chains?.includes('sui:mainnet');
const normalize = a => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
export const EVM_NETWORKS = Object.freeze({
  97: { chainId: '0x61', chainName: 'BNB Smart Chain Testnet', rpcUrls: ['https://bsc-testnet-dataseed.bnbchain.org'], nativeCurrency: { name: 'Testnet BNB', symbol: 'tBNB', decimals: 18 }, blockExplorerUrls: ['https://testnet.bscscan.com'] },
  46630: { chainId: '0xb626', chainName: 'Robinhood Chain Testnet', rpcUrls: ['https://rpc.testnet.chain.robinhood.com'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://explorer.testnet.chain.robinhood.com'] },
});
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
  const evm = event => { try { const p = event.detail; if (typeof p?.provider?.request === 'function') add('evm', p.info?.name, p.provider); } catch {} };
  function refresh() {
    win.dispatchEvent(new win.CustomEvent('wallet-standard:app-ready', { detail: api }));
    win.dispatchEvent(new win.Event('eip6963:requestProvider'));
    if (!rows.some(r => r.family === 'evm') && typeof win.ethereum?.request === 'function') add('evm', 'Installed EVM wallet', win.ethereum);
  }
  win.addEventListener('wallet-standard:register-wallet', standard); win.addEventListener('eip6963:announceProvider', evm); refresh();
  return { list: family => rows.filter(r => r.family === family), subscribe(fn) { observers.add(fn); return () => observers.delete(fn); }, refresh,
    destroy() { disposed = true; observers.clear(); win.removeEventListener('wallet-standard:register-wallet', standard); win.removeEventListener('eip6963:announceProvider', evm); },
  };
}
export async function connectAccountWallet(row, chainId = 97) {
  const p = row.provider;
  if (row.family === 'sui') {
    const result = await p.features['standard:connect'].connect();
    const accounts = (result.accounts || []).filter(suiAccount);
    if (!accounts.length) throw new Error('This wallet did not return a Sui Mainnet account.');
    return { ...row, accounts, chainId: 'sui:mainnet' };
  }
  const network = EVM_NETWORKS[chainId]; if (!network) throw new Error('Unsupported preview network.');
  await p.request({ method: 'eth_requestAccounts' });
  try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] }); }
  catch (e) {
    if (Number(e.code) !== 4902) throw e;
    await p.request({ method: 'wallet_addEthereumChain', params: [network] });
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] });
  }
  const addresses = await p.request({ method: 'eth_accounts' });
  if (!Array.isArray(addresses) || !addresses.length || !addresses.every(a => /^0x[0-9a-f]{40}$/i.test(a))) throw new Error('No EVM wallet account was returned.');
  if (Number(await p.request({ method: 'eth_chainId' })) !== chainId) throw new Error('Wallet network changed. Please reconnect.');
  return { ...row, accounts: addresses.map(address => ({ address })), chainId };
}
export function watchAccountWallet(connection, changed) {
  if (connection.family === 'sui') return connection.provider.features['standard:events']?.on('change', event => { if (event.accounts || event.chains) changed(); }) || (() => {});
  for (const name of ['accountsChanged', 'chainChanged', 'disconnect']) connection.provider.on?.(name, changed);
  return () => { for (const name of ['accountsChanged', 'chainChanged', 'disconnect']) connection.provider.removeListener?.(name, changed); };
}
export async function assertAccountWallet(connection, account) {
  if (connection.family === 'sui') {
    if (!connection.provider.accounts?.some(a => suiAccount(a) && normalize(a.address) === normalize(account.address))) throw new Error('Wallet account changed. Please reconnect.');
  } else {
    const addresses = await connection.provider.request({ method: 'eth_accounts' });
    const chainId = Number(await connection.provider.request({ method: 'eth_chainId' }));
    if (chainId !== connection.chainId || !addresses.some(a => a.toLowerCase() === account.address.toLowerCase())) throw new Error('Wallet account or network changed. Please reconnect.');
  }
}
export async function signAccountMessage(connection, account, message) {
  if (typeof message !== 'string' || !message || message.length > 10000) throw new Error('Invalid sign-in message.');
  await assertAccountWallet(connection, account);
  const bytes = new TextEncoder().encode(message); let signature;
  if (connection.family === 'sui') {
    const signed = await connection.provider.features['sui:signPersonalMessage'].signPersonalMessage({ account, message: bytes, chain: 'sui:mainnet' });
    signature = signed.signature;
  } else {
    const encoded = '0x' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    signature = await connection.provider.request({ method: 'personal_sign', params: [encoded, account.address] });
  }
  await assertAccountWallet(connection, account);
  if (typeof signature !== 'string' || !signature || signature.length > 14000) throw new Error('The wallet did not return a valid signature.');
  return signature;
}
