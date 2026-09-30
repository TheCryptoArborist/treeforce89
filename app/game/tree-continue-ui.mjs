import { TREE_CONTINUE as P } from './tree-continue-policy.mjs';
import { createTreeContinueAttempt } from './tree-continue-attempt.mjs';
import { wireDirectContinueGame } from './tree-continue-game.mjs';
import { pendingPurchase } from './tree-payments/pending.mjs';
const el = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
const button = text => { const e = el('button', text); e.type = 'button'; return e; };
const explanations = {
  'checkout-not-enabled': 'TREE checkout is not live yet. No payment was requested. You can start a new game for free.',
  'sui-sign-in-required': 'Sign in with your Sui wallet before purchasing a continue.',
  'wrong-payer': 'Use the same Sui wallet as your signed-in TREE Account.',
  'account-changed': 'The account changed. Return to the original account to recover this purchase.',
  'payment-not-yet-verified': 'Payment is not confirmed yet. Check its status; do not pay again.',
  'delivery-recovery-required': 'This purchase already has a delivery record. Recovery needs verification; do not pay again.',
  'quote-expired': 'This purchase request expired. No new payment will be requested for this order. Start a free game or check the existing purchase.',
};
export function installDirectTreeContinues(game, frame, { api: suppliedApi, wallet: suppliedWallet, storage = localStorage } = {}) {
  if (!frame) return () => {};
  let offer = null, loading = false, disposed = false, wallet = suppliedWallet, walletChoice = null;
  const pending = pendingPurchase(storage);
  const dialog = el('dialog'); dialog.className = 'tree-continue-dialog'; dialog.setAttribute('aria-labelledby', 'tree-continue-heading');
  const kicker = el('p', 'TREE FORCE ’89 / SUI MAINNET'); kicker.className = 'tree-continue-kicker';
  const title = el('h2', 'OUT OF LIVES'); title.id = 'tree-continue-heading';
  const subtitle = el('p', 'Restore 3 lives and resume your current flight.');
  const flight = el('p'); flight.className = 'tree-continue-flight';
  const price = el('strong', P.displayPrice); price.className = 'tree-continue-price';
  const details = el('p', 'Same wave and score. Starting weapon. Brief spawn protection. One continue per flight.');
  const fee = el('p', 'SUI network gas is separate and shown in your wallet. Nothing is charged automatically.');
  fee.className = 'tree-continue-note';
  const signIn = button('SIGN IN WITH SUI');
  const pay = button('CONTINUE — 20,000 TREE'); pay.className = 'tree-continue-primary';
  const status = el('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.className = 'tree-continue-status';
  const wallets = el('div'); wallets.className = 'tree-continue-wallets'; wallets.hidden = true;
  const free = button('START NEW GAME — FREE');
  const warning = el('p', 'No Canopy Credits package is needed. Continued flights are casual, not ranked.'); warning.className = 'tree-continue-note';
  dialog.append(kicker, title, subtitle, flight, price, details, fee, signIn, pay, wallets, status, free, warning);
  document.body.append(dialog);
  function render() {
    if (disposed) return;
    const i = game.registry.get('treeAccountIdentity'), s = offer?.attempt.state;
    signIn.hidden = i?.authenticated === true && i.wallet?.family === 'sui'; signIn.disabled = loading;
    pay.textContent = s?.signingAttempted ? 'CHECK PAYMENT / RESUME' : 'CONTINUE — 20,000 TREE';
    const previous = pending.read();
    const otherPending = previous?.signingAttempted && previous.runId !== offer?.runId;
    pay.disabled = loading || !!s?.done || !!otherPending;
    free.disabled = loading || !!(s?.signingAttempted || s?.restored);
    if (otherPending) status.textContent = 'An unfinished purchase from an earlier flight needs recovery before another payment. Starting a new game is free.';
    if (offer) flight.textContent = `WAVE ${offer.wave} · ${Math.round(offer.score).toLocaleString()} POINTS · PAUSED`;
  }
  const api = suppliedApi || (async body => {
    const r = await fetch('/api/tree-continue', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const p = await r.json(); if (!r.ok) throw Object.assign(Error(p.error || 'service-unavailable'), { code: p.error }); return p;
  });
  async function selectWallet(rows) {
    wallets.replaceChildren(); wallets.hidden = false;
    return new Promise(resolve => {
      walletChoice = resolve;
      for (const row of rows) { const b = button(row.name); b.onclick = () => {
        walletChoice = null; wallets.hidden = true; resolve(row);
      }; wallets.append(b); }
      const cancel = button('CANCEL WALLET CONNECTION'); cancel.onclick = () => {
        walletChoice = null; wallets.hidden = true; resolve(null);
      }; wallets.append(cancel);
    });
  }
  const walletAdapter = {
    async connect(payer) {
      if (!wallet) { const { createPaymentWallet } = await import('./tree-payments/wallet.mjs'); wallet = createPaymentWallet({ selectWallet }); }
      return wallet.connect(payer);
    }, prepare: o => wallet.prepare(o), pay: (tx, o) => wallet.pay(tx, o), wait: d => wallet.wait(d),
  };
  const bridge = wireDirectContinueGame(game, hooks => createTreeContinueAttempt({ ...hooks, api, wallet: walletAdapter,
    identity: () => game.registry.get('treeAccountIdentity'), pending,
    report: s => { status.textContent = explanations[s.message] || s.message || ''; render(); },
  }), { offer(o) { offer = o; status.textContent = 'Choose whether to continue or start over. TREE checkout is pending activation.';
      render(); if (!dialog.open) dialog.showModal(); free.focus(); },
    close() { if (dialog.open) dialog.close(); offer = null; },
  });
  async function task(fn) {
    if (loading || !offer) return; loading = true; render();
    try { await fn(); } catch (e) { status.textContent = explanations[e.code] || 'Unable to confirm this action. Check payment status before trying another payment.'; }
    finally { loading = false; render(); }
  }
  pay.onclick = () => task(() => offer.attempt.continue());
  free.onclick = () => task(() => offer.startNew());
  signIn.onclick = () => game.events.emit('tree-account:open');
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.addEventListener('cancel', e => { e.preventDefault(); if (!free.disabled) void task(() => offer.startNew()); });
  game.events.on('tree-account:identity', render);
  return () => { disposed = true; walletChoice?.(null); bridge.destroy(); game.events.off('tree-account:identity', render); dialog.remove(); };
}
