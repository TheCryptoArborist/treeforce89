import { TREE_CONTINUE, requireContinue, validateOrder, sameAddress } from './tree-continue-policy.mjs';

/** One flight, one order, at most one wallet submission in this tab.
 * The server, not browser flags, owns payment verification and receipt deduplication.
 * A timeout is UNKNOWN, never proof of nonpayment. Retrying reconciles the order.
 */
export function createTreeContinueAttempt({ api, wallet, identity, clientRunId, prepare, apply,
  boundary, resume, report = () => {}, pending = { save() {}, clear() {} } }) {
  let order = null, owner = null, busy = false, signingAttempted = false, digest = null;
  let restored = false, done = false, closed = false, boundarySet = false, phase = 'ready';
  const ids = Object.fromEntries(['order', 'reconcile', 'deliver', 'cancel'].map(k => [k, crypto.randomUUID()]));
  const update = (value, message) => { phase = value; report({ phase, message, order, digest }); };
  const account = () => {
    const i = identity();
    requireContinue(i?.authenticated === true && i.wallet?.family === 'sui', 'sui-sign-in-required');
    if (owner) requireContinue(i.accountId === owner.accountId && sameAddress(i.wallet.address, owner.payer), 'account-changed');
    return { accountId: i.accountId, payer: i.wallet.address };
  };
  const persist = () => pending.save({ runId: clientRunId, orderId: order.orderId,
    accountId: owner.accountId, payer: owner.payer, digest, signingAttempted });
  const command = (action, extra = {}) => api({ action, requestId: ids[action], runId: clientRunId, ...extra });
  async function reconcile() {
    update('verifying', 'Checking this purchase. Do not pay again.');
    const result = await command('reconcile', { orderId: order.orderId, digest });
    account();
    validateOrder(result.order, clientRunId, owner.accountId, owner.payer);
    requireContinue(result.order.orderId === order.orderId, 'wrong-reconciled-order');
    requireContinue(result.status === 'verified' || result.status === 'delivered', 'payment-not-yet-verified');
    requireContinue(result.authorization?.orderId === order.orderId && result.authorization?.runId === clientRunId &&
      result.authorization?.lives === TREE_CONTINUE.lives && typeof result.authorization?.receiptId === 'string', 'invalid-delivery-authorization');
    requireContinue(result.status !== 'delivered' || restored, 'delivery-recovery-required');
    prepare();
    if (!restored) {
      if (!boundarySet) { boundary(); boundarySet = true; }
      apply(TREE_CONTINUE.lives); restored = true;
    }
    update('restoring', 'Payment verified. Confirming your continue…');
    const delivery = await command('deliver', { orderId: order.orderId, receiptId: result.authorization.receiptId });
    account();
    requireContinue(delivery.status === 'delivered' && delivery.orderId === order.orderId && delivery.runId === clientRunId,
      'delivery-not-confirmed');
    resume(); done = true;
    try { pending.clear(clientRunId, order.orderId); } catch { /* Server delivery remains authoritative. */ }
    update('complete', 'Continue ready.'); return true;
  }
  return {
    get state() { return { busy, restored, done, closed, phase, order, digest, signingAttempted,
      canDecline: !busy && !signingAttempted && !restored }; },
    async continue() {
      if (busy || done || closed) return false;
      busy = true;
      try {
        prepare(); const current = account();
        owner ??= current;
        if (!order) {
          update('checking', 'Checking TREE checkout availability…');
          const config = await api({ action: 'status' });
          requireContinue(config.enabled === true, 'checkout-not-enabled');
          update('connecting', 'Connect the Sui wallet used for this TREE Account.');
          await wallet.connect(owner.payer); account(); prepare();
          update('ordering', 'Preparing your 20,000 TREE continue…');
          const result = await command('order');
          account(); prepare();
          order = structuredClone(validateOrder(result.order, clientRunId, owner.accountId, owner.payer));
          requireContinue(order.payable === true, 'checkout-not-enabled');
        }
        if (!signingAttempted) {
          const transaction = await wallet.prepare(order); account(); prepare();
          signingAttempted = true; persist();
          update('wallet', 'Approve 20,000 TREE in your wallet. SUI network gas is separate.');
          let result;
          try { result = await wallet.pay(transaction, order); }
          catch (e) {
            if (e?.code === 4001 || e?.code === 'USER_REJECTED_REQUEST') {
              signingAttempted = false; persist(); update('cancelled', 'Payment declined. No TREE payment was submitted.');
              return false;
            }
            throw e;
          }
          if (result?.$kind === 'Transaction' && result.Transaction?.digest) digest = result.Transaction.digest;
          else if (result?.$kind === 'FailedTransaction') digest = result.FailedTransaction?.digest || null;
          persist(); account();
          if (digest) {
            update('confirming', 'Waiting for transaction confirmation…');
            try { await wallet.wait(digest); } catch { /* Reconcile independently below. */ }
          }
        }
        return await reconcile();
      } catch (e) {
        update(signingAttempted ? 'pending' : 'error', e.code || e.message || 'continue-unavailable');
        throw e;
      } finally { busy = false; }
    },
    async cancel() {
      if (busy || done || restored || signingAttempted) return false;
      if (order) await command('cancel', { orderId: order.orderId });
      closed = true; if (order) pending.clear(clientRunId, order.orderId); return true;
    },
    async finish() { /* Do not refund or erase a pending/paid entitlement on scene shutdown. */ },
  };
}
