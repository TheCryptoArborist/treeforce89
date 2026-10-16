# TREE FORCE '89 — Preview database activation gate

Status: **not provisioned or connected**. No database migration has been applied to Netlify.

## Verified
- Disposable PostgreSQL 16 CI migration and uniqueness tests passed.
- Staged SQL: `db/staged-migrations/20261016030500_tree_authentication.sql`.
- Read-only preflight: `app/game/preview-database-preflight.mjs`.

## Before deploying an isolated Netlify database

1. In Netlify, establish a **separate database for the branch preview** `feature/tree-paid-continue`. Verify the branch connection string is distinct from production. Never copy a production connection string into preview environment variables.
2. Confirm whether Netlify Database is enabled for this site and supports isolated database branches on the current plan. The project connector currently exposes inspection and setup guidance, **not database provisioning or migration actions**.
3. Install `@netlify/database` with a synchronized lockfile, then use `getDatabase().pool` only in server functions. Do not bundle database credentials into React or Phaser.
4. After isolation is verified, review and promote the staged SQL into `netlify/database/migrations/` on the preview branch. Netlify auto-applies files in that directory during deployment, so do not move it prematurely.
5. Run read-only `checkTreePreviewDatabase` with trusted Netlify deploy context, branch identity, and an independently verified isolation flag.
6. Verify wallet challenge issuance and atomic consumption, login credential issuance, NFTree eligibility, and session creation against the preview DB. No real payments.
7. Keep `tree-session` and `tree-continue` public endpoints returning 503 until authenticated handlers, safe Game Over policy and Sui transaction verification are ready.

**Do not assume** that a successful GitHub Actions PostgreSQL service test means a Netlify database exists. No secrets or DB URLs should be committed to GitHub.
