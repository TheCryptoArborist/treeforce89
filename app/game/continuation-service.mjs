import { verifyAndRedeemContinuation } from "./continuation-verifier.mjs";
import { createMainnetTransactionReader } from "./mainnet-transaction-reader.mjs";
import { createPostgresContinuationStore } from "./postgres-redemption.mjs";

/**
 * Server-side composition root for the TREE continuation verifier.
 * Not a public HTTP handler. Only the server may construct these dependencies.
 *
 * sessionResolver(authContext) MUST authenticate the caller and load the
 * authoritative session from the database, never trust session fields in
 * a browser POST. decimals must come from verified TREE coin metadata.
 */
export function createContinuationService({
  suiClient,
  postgresPool,
  sessionResolver,
  treeDecimals,
}) {
  if (typeof sessionResolver !== "function") {
    throw new Error("Authenticated session resolver required");
  }
  if (!Number.isInteger(treeDecimals) || treeDecimals < 0 || treeDecimals > 18) {
    throw new Error("Verified TREE decimals required");
  }
  const fetchTransaction = createMainnetTransactionReader(suiClient);
  const store = createPostgresContinuationStore(postgresPool);

  return {
    async redeem({ digest, runId, authContext }) {
      if (typeof digest !== "string" || typeof runId !== "string") {
        throw new Error("Missing payment digest or run");
      }
      const session = await sessionResolver(authContext);
      if (!session || typeof session.wallet !== "string" || typeof session.runId !== "string") {
        throw new Error("Authenticated game session required");
      }
      // The wallet is derived exclusively from the authenticated server session.
      // A client-supplied wallet must never influence authorization.
      const claim = { digest, runId, wallet: session.wallet };
      return verifyAndRedeemContinuation({
        claim,
        session,
        fetchTransaction,
        store,
        decimals: treeDecimals,
      });
    },
  };
}
