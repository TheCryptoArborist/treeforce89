import { TREE_COIN_TYPE, TREE_PAYMENT_RECIPIENT, treeBaseUnits } from "./tree-payment.mjs";

/**
 * Construct the unsigned Sui mainnet TREE continuation transfer.
 *
 * Transaction is injected from @mysten/sui/transactions by the wallet UI.
 * This builder never signs, submits, or grants a continuation. The browser
 * must pass the transaction to dApp Kit; a trusted server must verify and
 * redeem the final digest before Phaser resumes.
 */
export function buildTreeContinueTransaction(Transaction, verifiedDecimals) {
  if (typeof Transaction !== "function") throw new Error("Sui Transaction SDK is required");
  const amount = treeBaseUnits(verifiedDecimals);
  const tx = new Transaction();
  const coin = tx.coin({ type: TREE_COIN_TYPE, balance: amount });
  tx.transferObjects([coin], tx.pure.address(TREE_PAYMENT_RECIPIENT));
  return tx;
}
