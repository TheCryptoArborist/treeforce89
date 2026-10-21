# TREE FORCE '89 — Preview database activation gate

Status (October 20, 2026): **isolated development database provisioned, migrated, and connected**.

## Deployment verification

- Approved Git branch: `feature/tree-paid-continue`; Netlify context: `branch-deploy`.
- Netlify database branch ID: `feature/tree-paid-continue`, separate from the default `production` database branch.
- Dependency `@netlify/database` is pinned to `2.0.1` with a synchronized lockfile.
- Netlify deploy `6ad82528174cd7200942ae64` reports migration `20261016030500_tree_authentication` applied successfully on the development database branch.
- Runtime verification deploy: `6ad82590a7d08e0ea20a459f`, commit `4a1d5102aa138fce438ffc4dbd90be200b604d21`.
- Read-only runtime check: `https://feature-tree-paid-continue--treeforce89.netlify.app/.netlify/functions/tree-database-status` returned HTTP 200 with `ready:true`, four tables, and eight successful constraint checks.
- Verified tables: `tree_wallet_challenges`, `tree_wallet_logins`, `tree_game_sessions`, `tree_continue_redemptions`.
- Verified primary keys for all four tables, unique game-session token, unique run ID, unique session/continuation pair, and redemption-to-session foreign key.
- Diagnostic refuses production, other Git branches, mismatched deploy IDs, and non-GET requests before connecting. It returns no database credentials, connection details, or user rows.
- All 161 local regression tests and the game build pass. CI additionally validates the migration, authentication/redemption operations and the schema inspector in disposable PostgreSQL 16.
- Production remains at commit `f04261491ae78dc21cb87842bc3a0b1da81cefc6`, published deploy `6a9d79efef404400084bec93`. No production deploy or production schema migration was performed.
- The current production application has no database branch assignment. No production connection string was copied into a preview environment variable.

## Remaining application work

The database blocker is resolved. Wallet authentication and NFTree session issuance still need to be wired into the deployed game. Public session, logout and paid-continuation endpoints remain deliberately disabled; this migration does not activate them. Slush security warnings remain a separate unresolved issue and must not be bypassed. No live 20,000 TREE payments are enabled.

The migration is now in the automatic Netlify migration directory **on this development branch only**. A future merge and production publish would apply it to production; those actions are not authorized by the development-only task.

## Migration and safety notes

- Validated source: `db/staged-migrations/20261016030500_tree_authentication.sql`.
- Applied copy: `netlify/database/migrations/20261016030500_tree_authentication.sql` (byte-for-byte identical).
- Netlify applies hosted migrations during deployment. Never apply DDL through a direct connection or modify a migration already applied.
- The database status function uses only fixed, read-only metadata queries. All game authentication and payment credentials remain server-side.
- Read-only preflight helper: `app/game/preview-database-preflight.mjs`.
- Additional runtime inspection: `app/game/preview-database-status.mjs`.
- CI workflow: `.github/workflows/tree-database-validation.yml`.


## Server-side logout contract (October 16)

- `app/game/game-logout-http.mjs` is a dependency-injected HTTP adapter. It requires an exact 64-hex-character game-session bearer token and calls the trusted `credential-revocation.mjs` service.
- It never accepts a wallet address, run ID or client game-state payload as authority.
- The handler is idempotent: a previously revoked token produces a generic logout response, while database failures return 503 without claiming success.
- `netlify/functions/tree-logout.mjs` is intentionally disabled (503) until an isolated database and verified authentication lifecycle are deployed.
- **Wallet extension disconnect currently only unmounts the Phaser game.** It does not yet revoke backend tokens. Do not advertise server logout as live.
- Game-session logout and wallet-login revocation are distinct. A game-session bearer token cannot revoke another login token by simply naming it.
- When enabling: use a same-origin authenticated request, never log bearer tokens, ensure server revocation succeeds before reporting it, and test logout under replay/concurrent requests.

Production `main` and real TREE payments remain unchanged.
