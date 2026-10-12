import { createTreeContinueAttempt } from './tree-continue-checkout.mjs';
import { createPaidFlightSceneLoader } from './paid-flight-scene.mjs';
import { installPurchaseRecovery } from './purchase-recovery-ui.mjs';
import { wireDirectContinueGame } from './tree-continue-game.mjs';
import { pendingPurchase } from './tree-payments/pending.mjs';
import { getWalletUniqueIdentifier } from './tree-payments/sui-app.mjs';
const el = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
const button = text => { const e = el('button', text); e.type = 'button'; return e; };
const explanations = {
  'checkout-not-enabled': 'TREE checkout is not live yet. No payment was requested. You can start a new game for free.',
  'sui-sign-in-required': 'Sign in with your Sui wallet before purchasing a continue.',
  'wrong-payer': 'Use the same Sui wallet as your signed-in TREE Account.',
  'wallet-connection-timeout': 'Wallet connection did not finish. Check your wallet prompt. If Slush shows a security warning, choose Return to safety. No payment was requested.',
  'wallet-connection-pending': 'Close the existing wallet connection prompt before trying again.',
  'account-changed': 'The account changed. Return to the original account to recover this purchase.',
  'payment-not-yet-verified': 'Payment is not confirmed yet. Check its status; do not pay again.',
  'delivery-review-required': 'This continue has an activation record and needs review. Do not pay again. Open RECOVER TREE PURCHASE to keep its order and flight details.',
  'delivery-in-use': 'This continue is reserved in another tab. Return there or wait for the reservation to expire. No new payment is needed.',
  'earlier-purchase-recovery-required': 'An earlier purchase needs recovery before another payment. Open RECOVER TREE PURCHASE.',
  'missing-purchase-review-required': 'A saved purchase marker could not be matched. Do not pay again; keep its order details for review.',
  'delivery-protocol-required': 'The payment service is not ready for the new recovery protocol. No additional payment was requested.',
  'quote-expired': 'This purchase request expired. Start a free game or check the existing purchase; do not submit a second payment.',
};
export function installDirectTreeContinues(game, frame, { api: suppliedApi, wallet: suppliedWallet, storage = localStorage } = {}) {
  if (!frame) return () => {};
  let offer = null, loading = false, disposed = false, wallet = suppliedWallet;
  const pending = pendingPurchase(storage), loader = createPaidFlightSceneLoader(game);
  const dialog = el('section'); dialog.className = 'tree-continue-dialog tree-continue-panel'; dialog.setAttribute('aria-labelledby', 'tree-continue-heading'); dialog.hidden = true;
  const title = el('h2', 'OUT OF LIVES'); title.id = 'tree-continue-heading';
  const subtitle = el('p', 'Restore 3 lives. Keep your wave and score. One continue per flight.');
  const flight = el('p'); flight.className = 'tree-continue-flight';
  const fee = el('p', 'SUI gas is shown in your wallet. Continued scores stay casual.');
  fee.className = 'tree-continue-note';
  const pay = button('CONTINUE — 20,000 TREE'); pay.className = 'tree-continue-primary';
  const status = el('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.className = 'tree-continue-status';
  const free = button('START NEW GAME — FREE');
  const actions = el('div'); actions.className = 'tree-continue-actions'; actions.append(pay, free);
  dialog.append(title, subtitle, flight, actions, status, fee);
  frame.insertBefore(dialog, frame.querySelector('.screen-bezel'));
  function render() {
    if (disposed) return;
    const s = offer?.attempt.state;
    pay.textContent = s?.signingAttempted ? 'CHECK PAYMENT / RESUME' : 'CONTINUE — 20,000 TREE';
    let previous=null,storageError=false;try{previous=pending.read();}catch{storageError=true;}
    const otherPending = previous?.signingAttempted && previous.runId !== offer?.runId;
    pay.disabled = loading || !!s?.done || !!otherPending || storageError;
    free.disabled = loading || !!(s?.signingAttempted || s?.restored);
    if (otherPending) status.textContent = 'An unfinished purchase from an earlier flight needs recovery before another payment. Starting a new game is free.';
    if(storageError)status.textContent='Browser purchase storage is unavailable. Use RECOVER TREE PURCHASE to check existing orders without paying.';
    if (offer) flight.textContent = `WAVE ${offer.wave} · ${Math.round(offer.score).toLocaleString()} POINTS · PAUSED`;
  }
  const api = suppliedApi || (async body => {
    const r = await fetch('/api/tree-continue', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const p = await r.json(); if (!r.ok) throw Object.assign(Error(p.error || 'service-unavailable'), { code: p.error }); return p;
  });
  const selectWallet = async rows => rows.find(row => getWalletUniqueIdentifier(row) === game.registry.get('treeWalletId')) || null;
  const walletAdapter = {
    async connect(payer) {
      if (!wallet) { const { createPaymentWallet } = await import('./tree-payments/wallet.mjs'); wallet = createPaymentWallet({ selectWallet, kit: game.registry.get('treeWalletKit') }); }
      return wallet.connect(payer);
    }, prepare: o => wallet.prepare(o), pay: (tx, o) => wallet.pay(tx, o), wait: d => wallet.wait(d),
  };
  const bridge = wireDirectContinueGame(game, hooks => createTreeContinueAttempt({ ...hooks, api, wallet: walletAdapter,
    loadPaused:(snapshot,binding)=>loader.loadPaused(snapshot,binding),
    identity: () => game.registry.get('treeAccountIdentity'), pending,
    report: s => { status.textContent = explanations[s.message] || s.message || ''; render(); },
  }), { offer(o) { offer = o; status.textContent = 'Continue for 20,000 TREE or start a new game for free.';
      render(); dialog.hidden = false; dialog.scrollIntoView({ block: 'nearest' }); pay.focus(); },
    close() { dialog.hidden = true; offer = null; },
  });
  const disposeRecovery=installPurchaseRecovery(game,frame,{api,loader,pending});
  async function task(fn) {
    if (loading || !offer) return; loading = true; render();
    try { await fn(); } catch (e) { status.textContent = explanations[e.code] || 'Unable to confirm this action. Check payment status before trying another payment.'; }
    finally { loading = false; render(); }
  }
  pay.onclick = () => task(async () => {
    const current = offer;
    if (!game.registry.get('treeAccountIdentity')?.authenticated) {
      status.textContent = 'Connect and verify your Sui wallet above. No payment yet.';
      const connect = game.registry.get('treeAccountConnect');
      if (typeof connect !== 'function' || !await connect()) { status.textContent = 'Wallet verification was not completed. No payment was requested.'; return; }
    }
    if (disposed || offer !== current) return;
    const save = game.registry.get('treeFlightSave');
    if (typeof save === 'function') { status.textContent = 'Preparing your continue…'; await save(current.runId); }
    if (disposed || offer !== current) return;
    await current.attempt.continue();
  });
  free.onclick = () => task(() => offer.startNew());
  dialog.addEventListener('keydown', e => e.stopPropagation());
  game.events.on('tree-account:identity', render);
  return () => { disposed = true; disposeRecovery(); loader.dispose(); bridge.destroy(); game.events.off('tree-account:identity', render); dialog.remove(); };
}
