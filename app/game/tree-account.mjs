import { discoverAccountWallets, connectAccountWallet, watchAccountWallet, signAccountMessage } from './account-wallets.mjs';
import { holdGameForAccount } from './account-pause.mjs';
const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const button = (text, fn) => { const b = make('button', '', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
const short = address => `${address.slice(0, 8)}…${address.slice(-6)}`;
const valid = i => i?.authenticated === true && i.environment === 'preview' && i.wallet?.family === 'sui';
const messages = { 'sign-in-expired': 'Verification expired. Connect again.', 'expired-or-used-proof': 'Verification expired. Connect again.', 'invalid-signature': 'Wallet verification failed. Connect again.', 'too-many-attempts': 'Wait five minutes before reconnecting.', 'authentication-unavailable': 'Wallet verification is unavailable. Your flight is unchanged.', 'preview-not-configured': 'Use the stable game preview address.' };

/** A top-of-game wallet picker. Connection and ownership verification are one app action. */
export function installTreeAccount(game, frame) {
  if (!frame) return () => {};
  let disposed = false, identity = null, configured = false, revision = 0, epoch = 0, phase = 'idle';
  let connection = null, operation = null, cancelWait = null, changedWhileVerifying = false, checkingOnly = false;
  let releasePause = () => {}, stopWalletWatch = () => {}, cancelPending = Promise.resolve();
  const registry = discoverAccountWallets();
  const bar = make('section', 'tree-account-bar'); bar.setAttribute('aria-label', 'Sui wallet');
  const label = make('strong', '', 'SUI MAINNET'), controls = make('div', 'tree-wallet-controls');
  const walletLabel = make('label', 'tree-wallet-label', 'WALLET'), walletSelect = make('select'); walletSelect.id = 'tree-wallet'; walletSelect.setAttribute('aria-label', 'Sui wallet picker');
  walletLabel.htmlFor = walletSelect.id;
  const accountSelect = make('select'); accountSelect.setAttribute('aria-label', 'Wallet account'); accountSelect.hidden = true;
  const connect = button('CONNECT WALLET', () => void connectWallet()), logout = button('DISCONNECT', () => void signOut()); logout.hidden = true;
  const cancel = button('CANCEL', cancelConnection); cancel.hidden = true;
  const note = make('p', 'tree-wallet-status', 'Checking wallet sign-in…'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  controls.append(walletLabel, walletSelect, accountSelect, connect, logout, cancel); bar.append(label, controls, note);
  const checkMode = new URLSearchParams(window.location.search).get('walletCheck') === '1';
  const check = button('CHECK CONNECTION ONLY', () => void connectWallet({ connectionOnly: true }));
  const checkOutput = make('p', 'tree-wallet-status', 'This check requests wallet connection only. It does not sign a message, sign in, or purchase a continue.');
  if (checkMode) {
    const panel = make('section', 'tree-wallet-check'); panel.setAttribute('aria-label', 'Wallet connection check');
    panel.append(check, checkOutput); bar.append(panel);
  }
  frame.insertBefore(bar, frame.querySelector('.screen-bezel')); frame.classList.add('has-tree-account');
  game.registry.set('treeWalletKit', registry.app);
  game.registry.set('treeAccountConnect', connectWallet);
  const alive = token => !disposed && token === epoch;
  const finalizing = () => phase === 'challenge' || phase === 'verifying' || phase === 'logout';
  function render() {
    if (disposed) return;
    const busy = phase !== 'idle';
    label.textContent = identity ? `${connection?.name || 'SUI WALLET'} · ${short(identity.wallet.address)}` : 'SUI MAINNET';
    walletSelect.hidden = walletLabel.hidden = !!identity;
    walletSelect.disabled = busy; accountSelect.disabled = busy;
    accountSelect.hidden = !identity || (connection?.accounts.length || 0) < 2;
    connect.hidden = !!identity; connect.disabled = busy || !!operation || !configured || !walletSelect.value;
    connect.textContent = busy ? phase === 'connecting' ? 'CONNECTING…' : phase === 'signing' ? 'APPROVE IN WALLET…' : 'VERIFYING…' : 'CONNECT WALLET';
    logout.hidden = !identity; logout.disabled = busy;
    cancel.hidden = phase === 'idle' || phase === 'logout'; cancel.disabled = finalizing();
    check.disabled = busy || !!operation || !!identity || !walletSelect.value;
  }
  function publish() {
    const previous = game.registry.get('treeAccountIdentity'); game.registry.set('treeAccountIdentity', identity);
    if (previous?.accountId !== identity?.accountId || previous?.wallet?.address !== identity?.wallet?.address || previous?.authenticated !== identity?.authenticated) game.events.emit('tree-account:identity', identity);
    render();
  }
  async function api(body, inline = false) {
    const r = await fetch(inline ? '/api/tree-account-inline' : '/api/tree-account', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(22000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const p = await r.json(); if (!r.ok) throw new Error(messages[p.error] || 'Wallet verification was not completed. Please retry.'); return p;
  }
  async function refresh() {
    if (disposed || operation || phase !== 'idle') return;
    const serial = ++revision;
    try {
      const p = await api(); if (disposed || operation || serial !== revision) return;
      identity = valid(p.identity) ? p.identity : null; configured = p.configured === true;
      note.textContent = identity ? 'Wallet verified. Continues cost 20,000 TREE.' : 'Connect and approve a free verification message. Continues cost 20,000 TREE.';
    } catch { if (disposed || operation || serial !== revision) return; identity = null; configured = false; note.textContent = 'Wallet verification unavailable. Free play still works.'; }
    publish();
  }
  function walletOptions() {
    const selected = walletSelect.value, wallets = registry.list('sui'); walletSelect.replaceChildren();
    for (const w of wallets) { const o = make('option', '', w.name); o.value = w.id; walletSelect.append(o); }
    if (wallets.some(w => w.id === selected)) walletSelect.value = selected;
    else if (wallets.some(w => /slush/i.test(w.name))) walletSelect.value = wallets.find(w => /slush/i.test(w.name)).id;
    if (!wallets.length) { const o = make('option', '', 'No Sui wallet detected'); o.value = ''; walletSelect.append(o); }
    game.registry.set('treeWalletId', walletSelect.value); render();
  }
  function clearConnection() { stopWalletWatch(); stopWalletWatch = () => {}; connection = null; accountSelect.replaceChildren(); }
  function finishPause() { releasePause(); releasePause = () => {}; }
  function cancelConnection() {
    if (finalizing() || phase === 'idle') return;
    const connectionOnly = checkingOnly;
    if (connectionOnly) { checkOutput.textContent = 'Connection check canceled. No sign-in message or payment was requested.'; checkingOnly = false; }
    ++epoch; ++revision; phase = 'idle'; clearConnection(); finishPause(); cancelWait?.();
    if (!connectionOnly) cancelPending = api({ action: 'cancel' }, true).catch(() => {});
    note.textContent = 'Connection canceled. Your flight is unchanged.'; render();
  }
  function walletChanged() {
    if (phase === 'verifying') { changedWhileVerifying = true; return; }
    ++epoch; ++revision; phase = 'idle'; identity = null; clearConnection(); finishPause(); cancelWait?.(); publish();
    cancelPending = api({ action: 'cancel' }, true).catch(() => {}).then(() => api({ action: 'logout' }).catch(() => {}));
    note.textContent = 'Wallet changed. Connect again to verify the selected account.';
  }
  async function verify(c, account, token) {
    phase = 'challenge'; changedWhileVerifying = false; note.textContent = 'Preparing a free wallet verification message…'; render();
    const proof = await api({ action: 'challenge', family: 'sui', address: account.address, chainId: 'sui:mainnet' }, true);
    if (!alive(token)) return null;
    phase = 'signing'; note.textContent = 'Approve the verification message in your wallet. No payment is requested.'; render();
    const signature = await signAccountMessage(c, account, proof.message); if (!alive(token)) return null;
    phase = 'verifying'; note.textContent = 'Verifying wallet…'; render();
    const p = await api({ action: 'verify', signature }, true); if (!alive(token)) return null;
    if (changedWhileVerifying) { await api({ action: 'logout' }); throw new Error('Wallet changed. Connect again.'); }
    if (!valid(p.identity) || p.identity.wallet.address.toLowerCase() !== account.address.toLowerCase()) throw new Error('Wallet verification did not complete.');
    identity = p.identity; configured = true; accountSelect.value = account.address;
    note.textContent = 'Wallet verified. Continues cost 20,000 TREE.'; publish(); return identity;
  }
  function connectWallet({ connectionOnly = false } = {}) {
    if (identity) return Promise.resolve(identity);
    if (operation) return operation;
    const row = registry.list('sui').find(w => w.id === walletSelect.value);
    if ((!configured && !connectionOnly) || !row || disposed) { note.textContent = 'Choose a Sui wallet above to connect.'; render(); return Promise.resolve(null); }
    operation = Promise.race([runConnection(row, { connectionOnly }), new Promise(resolve => { cancelWait = () => resolve(null); })]).finally(() => {
      operation = null; cancelWait = null; render();
      if (connectionOnly) void refresh();
    }); return operation;
  }
  async function runConnection(row, { connectionOnly = false } = {}) {
    const token = ++epoch; ++revision; phase = 'connecting'; releasePause = holdGameForAccount(game);
    checkingOnly = connectionOnly;
    if (connectionOnly) checkOutput.textContent = `Checking ${row.name} connection on ${window.location.origin}. No sign-in message or payment is requested.`;
    note.textContent = 'Choose an account in your wallet.'; render();
    try {
      await cancelPending; if (!alive(token)) return null;
      const c = await connectAccountWallet(row); if (!alive(token)) return null;
      if (connectionOnly) {
        checkOutput.textContent = `Connection check PASSED: ${row.name} returned a Sui Mainnet account on ${window.location.origin}. No sign-in message or payment was requested. Use CONNECT WALLET to verify ownership when ready.`;
        note.textContent = 'Connection check passed. You are not signed in.';
        return null;
      }
      clearConnection(); connection = c;
      for (const a of c.accounts) { const o = make('option', '', short(a.address)); o.value = a.address; accountSelect.append(o); }
      const account = registry.app.stores.$connection.get().account;
      stopWalletWatch = watchAccountWallet(c, walletChanged);
      return await verify(c, account, token);
    } catch (e) {
      if (alive(token)) {
        identity = null;
        if (connectionOnly) checkOutput.textContent = `Connection check STOPPED before sign-in: ${row.name} did not return a Sui Mainnet account on ${window.location.origin}. No sign-in message or payment was requested. If the wallet shows “Malicious website”, the block occurred during connection.`;
        note.textContent = Number(e.code) === 4001 || /reject|declin|cancel/i.test(e.message || '') ? 'Wallet approval declined. No payment was made.' : e.message || 'Wallet connection failed.';
        if (!connectionOnly) cancelPending = api({ action: 'cancel' }, true).catch(() => {});
        publish();
      }
      return null;
    } finally { if (alive(token)) { checkingOnly = false; phase = 'idle'; finishPause(); render(); } }
  }
  async function signOut() {
    if (phase !== 'idle' || operation) return;
    phase = 'logout'; ++revision; stopWalletWatch(); stopWalletWatch = () => {}; render();
    try { await api({ action: 'logout' }); identity = null; clearConnection(); if (registry.app.stores.$connection.get().wallet) await registry.app.disconnectWallet(); note.textContent = 'Wallet disconnected. Free play is available.'; }
    catch { note.textContent = 'Disconnect could not be confirmed. Please retry.'; }
    finally { phase = 'idle'; publish(); }
  }
  walletSelect.addEventListener('change', () => { game.registry.set('treeWalletId', walletSelect.value); render(); });
  accountSelect.addEventListener('change', () => {
    if (phase !== 'idle' || !connection || operation) return;
    const c = connection, account = c.accounts.find(a => a.address === accountSelect.value); if (!account) return;
    const token = ++epoch; ++revision; phase = 'logout'; stopWalletWatch(); stopWalletWatch = () => {}; identity = null;
    releasePause = holdGameForAccount(game); publish();
    operation = (async () => {
      try { await api({ action: 'logout' }); if (!alive(token)) return null; registry.app.switchAccount({ account }); stopWalletWatch = watchAccountWallet(c, walletChanged); return await verify(c, account, token); }
      catch (e) { if (alive(token)) { note.textContent = e.message || 'Account verification failed.'; cancelPending = api({ action: 'cancel' }, true).catch(() => {}); } return null; }
      finally { if (alive(token)) { phase = 'idle'; finishPause(); render(); } }
    })().finally(() => { operation = null; render(); });
  });
  bar.addEventListener('keydown', e => e.stopPropagation());
  const open = () => { bar.scrollIntoView({ block: 'nearest' }); walletSelect.focus(); void connectWallet(); };
  const expired = () => { identity = null; note.textContent = 'Session expired. Connect your wallet again.'; publish(); };
  const unsub = registry.subscribe(walletOptions); walletOptions();
  game.events.on('tree-account:open', open); game.events.on('tree-account:expired', expired);
  const focus = () => { if (!operation) void refresh(); }; window.addEventListener('focus', focus);
  const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000); void refresh();
  return () => {
    disposed = true; ++epoch; ++revision; cancelWait?.(); window.clearInterval(timer); window.removeEventListener('focus', focus);
    game.events.off('tree-account:open', open); game.events.off('tree-account:expired', expired); unsub(); registry.destroy(); stopWalletWatch(); finishPause();
    for (const k of ['treeWalletKit', 'treeWalletId', 'treeAccountConnect']) game.registry.remove(k);
    bar.remove(); frame.classList.remove('has-tree-account');
  };
}
