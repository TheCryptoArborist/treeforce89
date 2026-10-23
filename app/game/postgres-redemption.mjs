import { normalizeSuiAddress } from "./tree-payment.mjs";

/**
 * PostgreSQL adapter for one-time TREE continuation redemption.
 *
 * pool.connect() must return a dedicated SQL client with query() and release().
 * The database schema is docs/tree-continuation-schema.sql.
 * The session record MUST be created and authenticated server-side.
 *
 * This module is deliberately not wired to the Netlify HTTP endpoint yet.
 */
export function createPostgresContinuationStore(pool) {
  if (!pool || typeof pool.connect !== "function") {
    throw new Error("PostgreSQL pool with connect() required");
  }

  return {
    async consumeOnce({ digest, sessionId, continuationNumber, wallet, runId }) {
      if (typeof digest !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(digest)) {
        throw new Error("Invalid transaction digest");
      }
      if (typeof sessionId !== "string" || !sessionId || typeof runId !== "string" || !runId) {
        throw new Error("Invalid session or run");
      }
      if (!Number.isSafeInteger(continuationNumber) || continuationNumber < 0) {
        throw new Error("Invalid continuation counter");
      }
      const expectedWallet = normalizeSuiAddress(wallet);
      const db = await pool.connect();
      let inTransaction = false;
      try {
        await db.query("BEGIN");
        inTransaction = true;

        const locked = await db.query(
          `SELECT wallet, run_id, continuation_number, game_over, cleared, continue_pending
           FROM tree_game_sessions WHERE session_id = $1 AND expires_at>clock_timestamp() FOR UPDATE`,
          [sessionId],
        );
        const session = locked.rows?.[0];
        if (
          !session ||
          normalizeSuiAddress(session.wallet) !== expectedWallet ||
          session.run_id !== runId ||
          Number(session.continuation_number) !== continuationNumber ||
          session.game_over !== true ||
          session.cleared !== false ||
          session.continue_pending !== true
        ) {
          await db.query("ROLLBACK");
          inTransaction = false;
          return false;
        }

        // Digest and (session_id, continuation_number) are unique in schema.
        // ON CONFLICT DO NOTHING makes retries and concurrent submissions fail closed.
        const inserted = await db.query(
          `INSERT INTO tree_continue_redemptions
             (digest, session_id, continuation_number, wallet, run_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING RETURNING digest`,
          [digest, sessionId, continuationNumber, expectedWallet, runId],
        );
        if (inserted.rows?.length !== 1) {
          await db.query("ROLLBACK");
          inTransaction = false;
          return false;
        }

        const updated = await db.query(
          `UPDATE tree_game_sessions
           SET continue_pending = FALSE,
               game_over = FALSE,
               continuation_number = continuation_number + 1
           WHERE session_id = $1 AND continuation_number = $2
             AND continue_pending = TRUE AND game_over = TRUE AND cleared = FALSE
             AND expires_at>clock_timestamp()
           RETURNING session_id`,
          [sessionId, continuationNumber],
        );
        if (updated.rows?.length !== 1) {
          await db.query("ROLLBACK");
          inTransaction = false;
          return false;
        }

        await db.query("COMMIT");
        inTransaction = false;
        return true;
      } catch (error) {
        if (inTransaction) {
          try { await db.query("ROLLBACK"); } catch { /* original error preserved */ }
        }
        throw error;
      } finally {
        db.release();
      }
    },
  };
}
