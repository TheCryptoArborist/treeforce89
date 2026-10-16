import {
  TREE_COIN_TYPE,
  TREE_PAYMENT_RECIPIENT,
  normalizeSuiAddress,
  treeBaseUnits,
  validateContinuationClaim,
} from "./tree-payment.mjs";

/**
 * Server-side orchestration only. The caller must supply:
 * - authenticated, server-created session record (not user-provided expected fields)
 * - trusted Sui mainnet transaction lookup
 * - durable store with atomic consumeOnce(digest, sessionId)
 *
 * A digest is NEVER sufficient to grant lives by itself.
 */
export async function verifyAndRedeemContinuation({
  claim, session, fetchTransaction, store, decimals,
}) {
  if (!session || !session.sessionId || !session.wallet || !session.runId) {
    throw new Error("Authenticated game session required");
  }
  if (typeof fetchTransaction !== "function" || typeof store?.consumeOnce !== "function") {
    throw new Error("Trusted verification and atomic redemption storage required");
  }
  if (session.continuePending !== true || session.gameOver !== true || session.cleared === true) {
    throw new Error("Session is not awaiting continuation");
  }
  const verified = validateContinuationClaim(claim, {
    wallet: session.wallet,
    runId: session.runId,
    network: "mainnet",
    gameOver: session.gameOver,
    cleared: session.cleared,
  });

  // fetchTransaction MUST fetch independently from a trusted mainnet provider,
  // not return a transaction object posted by the browser.
  const transaction = await fetchTransaction(verified.digest);
  if (!transaction || transaction.network !== "mainnet" || transaction.success !== true) {
    throw new Error("No successful finalized mainnet transaction");
  }
  if (normalizeSuiAddress(transaction.sender) !== verified.wallet) {
    throw new Error("Payment sender does not match game wallet");
  }
  if (!Array.isArray(transaction.balanceChanges)) {
    throw new Error("Missing verified balance changes");
  }
  // Balance changes must be attributable to the intended recipient.
  // Require a NET positive increase, so outgoing transfers cannot be counted.
  const received = transaction.balanceChanges.reduce((sum, change) => {
    if (change.coinType !== TREE_COIN_TYPE) return sum;
    if (!change.owner || change.owner.kind !== "AddressOwner") return sum;
    if (normalizeSuiAddress(change.owner.address) !== normalizeSuiAddress(TREE_PAYMENT_RECIPIENT)) return sum;
    return sum + BigInt(change.amount);
  }, 0n);
  if (received < treeBaseUnits(decimals)) {
    throw new Error("Insufficient confirmed TREE received");
  }

  // Implement consumeOnce as an atomic transaction enforcing UNIQUE(digest)
  // and UNIQUE(sessionId, continuationNumber). Never use in-memory Set in prod.
  const redeemed = await store.consumeOnce({
    digest: verified.digest,
    sessionId: session.sessionId,
    continuationNumber: session.continuationNumber,
    wallet: verified.wallet,
    runId: verified.runId,
  });
  if (redeemed !== true) throw new Error("Payment already redeemed or session no longer eligible");
  return { authorized: true, runId: verified.runId, lives: 3, wave: session.wave };
}
