import { discoverAccountWallets, connectAccountWallet, watchAccountWallet, signAccountMessage } from './account-wallets.mjs';
import { holdGameForAccount } from './account-pause.mjs';
const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const button = (text, fn, cls = '') => { const b = make('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
const short = address => `${address.slice(0, 8)}…${address.slice(-6)}`;
const messages = { 'sign-in-expired': 'The sign-in request expired. Please sign again.', 'expired-or-used-proof': 'This request expired or was already used. Please sign again.', 'invalid-signature': 'The signature could not be verified. Please reconnect and try again.', 'too-many-attempts': 'Too many sign-in attempts. Wait five minutes, then retry.', 'authentication-unavailable': 'Account verification is unavailable. Cancel to return to your flight, then retry.', 'preview-not-configured': 'Use the stable game preview address for sign-in.' };

/** Same-page sign-in. Wallet approval remains in the wallet's own trusted UI. */
export function installTreeAccount(game, frame) {
  if (!frame) return () => {};
  let disposed = false, identity = null, configured = false, revision = 0, epoch = 0;
  let family = 'sui', connection = null, phase = 'idle', open = false, changedWhileVerifying = false;
  let releasePause = () => {}, stopWalletWatch = () => {}, cancelPending = Promise.resolve(), focusReturn = null;
  const registry = discoverAccountWallets();
  const bar = make('section', 'tree-account-bar'); bar.setAttribute('aria-label', 'TREE Account sign-in');
  const copy = make('div'), label = make('strong', '', 'GUEST PLAY'), note = make('small', '', 'Checking account sign-in…'); note.setAttribute('role', 'status'); copy.append(label, note);
  const login = button('SIGN IN', () => show()), logout = button('SIGN OUT', () => signOut()); logout.hidden = true; login.disabled = true;
  bar.append(copy, login, logout); frame.insertBefore(bar, frame.querySelector('.screen-bezel')); frame.classList.add('has-tree-account');
  const dialog = make('dialog', 'account-dialog'); dialog.setAttribute('aria-labelledby', 'account-dialog-heading');
  const heading = make('h2', '', 'SIGN IN TO TREE'); heading.id = 'account-dialog-heading';
  const intro = make('p', 'account-dialog-intro', 'Stay in the game. Choose one wallet to verify your TREE Account.');
  const safety = make('p', 'account-dialog-safety', 'MESSAGE SIGNATURE ONLY · No payment, token approval, or asset transfer. Your flight stays paused.');
  const tabs = make('div', 'account-dialog-tabs'); tabs.setAttribute('aria-label', 'Wallet type');
  const sui = button('SUI', () => chooseFamily('sui')), evm = button('EVM', () => chooseFamily('evm')); tabs.append(sui, evm);
  const walletLabel = make('label', '', 'WALLET'), walletSelect = make('select'); walletSelect.id = 'inline-wallet'; walletLabel.htmlFor = walletSelect.id;
  const networkLabel = make('label', '', 'PREVIEW NETWORK'), network = make('select'); network.id = 'inline-network'; networkLabel.htmlFor = network.id;
  for (const [value, text] of [['97', 'BNB Smart Chain Testnet'], ['46630', 'Robinhood Chain Testnet']]) { const o = make('option', '', text); o.value = value; network.append(o); }
  const chainNote = make('p', 'account-dialog-hint', 'Sui Mainnet · identity verification only.');
  const connect = button('CONNECT WALLET', () => connectWallet());
  const accountLabel = make('label', '', 'ACCOUNT'), accountSelect = make('select'); accountSelect.id = 'inline-wallet-account'; accountLabel.htmlFor = accountSelect.id;
  const sign = button('SIGN IN WITH SUI', () => signIn(), 'account-dialog-primary');
  const status = make('p', 'account-dialog-status', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const cancel = button('CANCEL & RETURN TO GAME', () => close('Sign-in canceled. Your flight is unchanged.'));
  const hint = make('p', 'account-dialog-hint', 'The wallet may open its own approval prompt. TREE does not open a second page. Scores and badges remain browser-local; test credits stay tied to your existing TREE Account.');
  dialog.append(make('p', 'account-dialog-kicker', 'TREE ARCADE / ACCOUNT PREVIEW'), heading, intro, safety, tabs, walletLabel, walletSelect, networkLabel, network, chainNote, connect, accountLabel, accountSelect, sign, status, cancel, hint);
  document.body.append(dialog);
  const finalizing = () => phase === 'challenge' || phase === 'verifying';
  const alive = token => !disposed && open && token === epoch;
  function render() {
    if (disposed) return;
    label.textContent = identity ? `TREE ACCOUNT · ${short(identity.wallet.address)}` : 'GUEST PLAY';
    label.title = identity ? `Preview TREE Account ${identity.accountId}` : '';
    login.hidden = !!identity; logout.hidden = !identity; login.disabled = !configured || phase === 'logout'; logout.disabled = phase === 'logout';
    const busy = phase !== 'idle';
    sui.setAttribute('aria-pressed', String(family === 'sui')); evm.setAttribute('aria-pressed', String(family === 'evm'));
    sui.disabled = evm.disabled = walletSelect.disabled = network.disabled = busy;
    network.hidden = networkLabel.hidden = family !== 'evm'; chainNote.hidden = family !== 'sui';
    connect.disabled = busy || !walletSelect.value; connect.textContent = phase === 'connecting' ? 'CONNECTING…' : 'CONNECT WALLET';
    accountLabel.hidden = accountSelect.hidden = sign.hidden = !connection; accountSelect.disabled = busy;
    sign.textContent = phase === 'signing' ? 'APPROVE IN YOUR WALLET…' : phase === 'verifying' ? 'VERIFYING ACCOUNT…' : `SIGN IN WITH ${family.toUpperCase()}`;
    sign.disabled = busy || !accountSelect.value; cancel.disabled = finalizing();
    cancel.textContent = finalizing() ? 'VERIFYING — PLEASE WAIT' : 'CANCEL & RETURN TO GAME';
  }
  function publish() { game.registry.set('treeAccountIdentity', identity); game.events.emit('tree-account:identity', identity); render(); }
  async function api(body, inline = false) {
    const r = await fetch(inline ? '/api/tree-account-inline' : '/api/tree-account', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(22000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const p = await r.json(); if (!r.ok) throw new Error(messages[p.error] || 'Account sign-in was not completed. Please retry.'); return p;
  }
  async function refresh() {
    if (disposed || open || phase !== 'idle') return;
    const serial = ++revision;
    try { const p = await api(); if (disposed || open || serial !== revision) return;
      identity = p.identity?.authenticated === true && p.identity.environment === 'preview' ? p.identity : null;
      configured = p.configured === true;
      note.textContent = identity ? 'Signed in · scores and badges remain browser-local.' : 'Sui or EVM · sign in here · no payment';
    } catch { if (disposed || open || serial !== revision) return; identity = null; configured = false; note.textContent = 'Sign-in service unavailable. Guest play still works.'; }
    publish();
  }
  function walletOptions() {
    const selected = walletSelect.value; walletSelect.replaceChildren();
    const wallets = registry.list(family);
    for (const w of wallets) { const option = make('option', '', w.name); option.value = w.id; walletSelect.append(option); }
    if (wallets.some(w => w.id === selected)) walletSelect.value = selected;
    if (!wallets.length) { const option = make('option', '', `No compatible ${family.toUpperCase()} wallet detected`); option.value = ''; walletSelect.append(option); }
    render();
  }
  function disconnectSelection() { stopWalletWatch(); stopWalletWatch = () => {}; connection = null; accountSelect.replaceChildren(); }
  function chooseFamily(value) { if (phase !== 'idle') return; family = value; disconnectSelection(); status.textContent = ''; walletOptions(); }
  walletSelect.addEventListener('change', () => { disconnectSelection(); render(); });
  network.addEventListener('change', () => { disconnectSelection(); render(); });
  function show() {
    if (disposed || open || phase === 'logout') return;
    open = true; ++epoch; ++revision; phase = 'idle'; disconnectSelection();
    focusReturn = document.activeElement; releasePause = holdGameForAccount(game);
    status.textContent = 'Choose a wallet. Sign-in does not spend TREE or test credits.';
    walletOptions(); dialog.showModal(); registry.refresh(); cancel.focus();
  }
  function close(message, success = false) {
    if (!open || finalizing()) return;
    open = false; ++epoch; ++revision; phase = 'idle'; disconnectSelection();
    dialog.close(); releasePause(); releasePause = () => {};
    if (!success) cancelPending = api({ action: 'cancel' }, true).catch(() => {});
    note.textContent = message; render();
    if (focusReturn?.isConnected && !focusReturn.hidden) focusReturn.focus(); else (identity ? logout : login).focus();
  }
  function walletChanged() {
    if (phase === 'verifying') { changedWhileVerifying = true; return; }
    ++epoch; phase = 'idle'; disconnectSelection();
    cancelPending = api({ action: 'cancel' }, true).catch(() => {});
    status.textContent = 'Wallet account or network changed. Reconnect before signing.'; render();
  }
  async function connectWallet() {
    if (phase !== 'idle') return;
    const row = registry.list(family).find(w => w.id === walletSelect.value); if (!row) return;
    const token = ++epoch; phase = 'connecting'; status.textContent = 'Choose an account in your wallet.'; render();
    try {
      await cancelPending; if (!alive(token)) return;
      const c = await connectAccountWallet(row, Number(network.value)); if (!alive(token)) return;
      disconnectSelection(); connection = c;
      for (const a of c.accounts) { const option = make('option', '', short(a.address)); option.value = a.address; accountSelect.append(option); }
      stopWalletWatch = watchAccountWallet(c, walletChanged);
      status.textContent = 'Connected. Select your account, then approve the sign-in message.';
    } catch (e) { if (alive(token)) status.textContent = e.message || 'Wallet connection was canceled.'; }
    finally { if (alive(token)) { phase = 'idle'; render(); } }
  }
  async function signIn() {
    if (phase !== 'idle' || !connection) return;
    const c = connection, account = c.accounts.find(a => a.address === accountSelect.value); if (!account) return;
    const token = ++epoch; phase = 'challenge'; changedWhileVerifying = false; status.textContent = 'Preparing a one-time sign-in message…'; render();
    try {
      await cancelPending; if (!alive(token)) return;
      const proof = await api({ action: 'challenge', family: c.family, address: account.address, chainId: c.chainId }, true);
      if (!alive(token)) return;
      phase = 'signing'; status.textContent = 'Review the sign-in message in your wallet. No payment is requested.'; render();
      const signature = await signAccountMessage(c, account, proof.message); if (!alive(token)) return;
      phase = 'verifying'; status.textContent = 'Verifying your signature. The flight is still paused…'; render();
      const p = await api({ action: 'verify', signature }, true); if (!alive(token)) return;
      if (changedWhileVerifying) { await api({ action: 'logout' }); throw new Error('Wallet changed during verification. Reconnect and sign again.'); }
      if (!p.identity?.authenticated || p.identity.environment !== 'preview') throw new Error('Account verification did not complete.');
      identity = p.identity; configured = true; phase = 'idle'; publish(); close('Signed in · same flight · scores and badges remain browser-local.', true);
    } catch (e) {
      if (!alive(token)) return;
      phase = 'idle'; cancelPending = api({ action: 'cancel' }, true).catch(() => {});
      if (Number(e.code) === 4001 || /reject|declin|cancel/i.test(e.message || '')) close('Signature declined. No payment was made; your flight is unchanged.');
      else { status.textContent = e.name === 'TimeoutError' ? 'Verification timed out. Cancel to return to your flight, then retry.' : e.message || 'Sign-in failed. Please retry.'; render(); }
    }
  }
  async function signOut() {
    if (phase !== 'idle') return; phase = 'logout'; ++revision; render();
    try { await api({ action: 'logout' }); identity = null; note.textContent = 'Signed out. Local records and gameplay are unchanged.'; }
    catch { note.textContent = 'Sign-out could not be confirmed. Please retry.'; }
    finally { phase = 'idle'; publish(); }
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close('Sign-in canceled. Your flight is unchanged.'); });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  const unsub = registry.subscribe(walletOptions);
  const focus = () => { if (!open) void refresh(); };
  const expired = () => { identity = null; note.textContent = 'Session expired. Sign in here to use test credits.'; publish(); };
  game.events.on('tree-account:open', show); game.events.on('tree-account:expired', expired);
  window.addEventListener('focus', focus);
  const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
  void refresh();
  return () => {
    disposed = true; ++epoch; ++revision; window.clearInterval(timer); window.removeEventListener('focus', focus);
    game.events.off('tree-account:open', show); game.events.off('tree-account:expired', expired); unsub(); registry.destroy(); stopWalletWatch();
    releasePause(); dialog.remove(); bar.remove(); frame.classList.remove('has-tree-account');
  };
}
