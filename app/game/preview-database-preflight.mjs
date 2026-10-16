/**
 * Read-only preflight for an isolated TREE FORCE preview PostgreSQL database.
 * This is a server-side helper, NOT a publicly exposed endpoint.
 *
 * Requires explicit branch deployment context and database isolation proof.
 * No migrations or writes occur here.
 */
export async function checkTreePreviewDatabase({
  pool,
  deployContext,
  branch,
  expectedBranch = "feature/tree-paid-continue",
  databaseIsolationConfirmed = false,
}) {
  if (deployContext !== "branch-deploy" || branch !== expectedBranch) {
    throw new Error("Refusing database preflight outside the approved preview branch");
  }
  if (databaseIsolationConfirmed !== true) {
    throw new Error("Preview database isolation has not been verified");
  }
  if (typeof pool?.query !== "function") {
    throw new Error("PostgreSQL pool required");
  }
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [[
      "tree_wallet_challenges",
      "tree_wallet_logins",
      "tree_game_sessions",
      "tree_continue_redemptions",
    ]],
  );
  const names = new Set((result.rows || []).map(row => row.table_name));
  const required = [
    "tree_wallet_challenges",
    "tree_wallet_logins",
    "tree_game_sessions",
    "tree_continue_redemptions",
  ];
  if (!required.every(name => names.has(name))) {
    throw new Error("TREE preview database schema is incomplete");
  }
  return {ready:true,branch,tableCount:required.length};
}
