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

## Wallet gateway activation (October 21, 2026)

The development preview now supports signed-wallet authentication and server-verified direct NFTree ownership before gameplay. Gateway activation commit: `4ea1c48436848e167cfb8a06f916410eaea6400e`; runtime-context compatibility fix: `72c5d91e566f22f664af5a4d5a35d3dad1c123ce`; source-branch metadata fix: `29c079b23d65475b1865cef26810f987236833be`.

Player flow: Connect Wallet → Verify NFTree & Play → approve a personal-message signature → server checks the single-use challenge and live mainnet ownership → server saves and returns a game session → Phaser starts with the server-issued run ID.

- `tree-challenge`, `tree-session` and `tree-logout` are active only for the approved Git branch and verified Netlify development deploy contexts. Production is rejected before database access.
- Trusted Netlify runtime metadata must identify this site and a nonproduction deployment; the server-only build metadata must identify the approved feature branch. Function artifacts may be reused across nonproduction deploys, so runtime IDs are not compared to the original build ID. Only the branch alias, PR #7 preview alias, and the current immutable runtime deploy URL are accepted.
- Build metadata uses Netlify's `HEAD` source-branch name with `BRANCH` as fallback. Deploy Previews can check out a pull-request ref rather than the source-branch name. The build context still rejects production even when the source branch is approved.
- Challenge and session requests require same-origin JSON, reject extra authority fields and oversized bodies, and are rate limited.
- The intermediate wallet-login token stays server-side and is revoked after the session attempt. The game-session token stays in browser memory; it is never put in URLs or local storage.
- Disconnect, account change, page exit and session expiry close gameplay and attempt server-side revocation. Explicit logout does not claim successful server revocation if the database call fails.
- Personal-message signing and NFT verification send no token transfers and charge no entry fee. The 20,000 TREE continuation endpoint still returns 503 and never authorizes payment.
- Mysten packages are aligned: `@mysten/dapp-kit-react` 2.1.41, `@mysten/sui` 2.37.0, and `@mysten/wallet-standard` 0.21.35. The prior extension-only configuration is retained; no wallet warning is bypassed.

### Verification evidence

- 173 local regression tests pass; the game builds successfully.
- GitHub Actions database run `39537761177` passed the complete gateway test using actual Ed25519 signatures and PostgreSQL 16. NFT ownership was a controlled fixture for positive-holder testing. It verified single-use nonce consumption under concurrency, hashed session persistence, intermediate-login revocation, non-holder denial, replay rejection and logout.
- Final code commit `29c079b23d65475b1865cef26810f987236833be` passed database validation run `39538734561` and continuation check runs `39538734439` and `39538727708`. Netlify PR deploy `6ad83147aeae60cbc8b9f047` is ready and targets the development database branch.
- Live smoke tests on both development URLs used newly generated, unfunded ephemeral keys. A real signature was accepted, a live mainnet query correctly denied the non-holder, and replay, cross-origin requests and forged eligibility were rejected. Payments remained disabled.
- The deployed wallet chooser opens correctly. This cloud test browser has no installed Sui wallet, so a real NFTree-holder wallet acceptance test has not yet been performed.
- Reusable non-payment smoke test: `node tests/integration/gateway-live-smoke.mjs`. It never prints or saves the ephemeral private key, nonce, signature or session token.

### Remaining work and limitations

- Test the preview with a real NFTree-holding wallet. Slush's reported security warning remains unresolved and must not be bypassed.
- This preview recognizes directly wallet-owned NFTrees only. Kiosk and custody ownership remain unsupported and are disclosed on the gateway.
- New-run lifecycle and checkout review were completed on October 23 (see below). Trusted Game Over handling, wallet payment execution and authenticated continuation approval remain unfinished. No live 20,000 TREE payments are enabled.
- Production remains at published deploy `6a9d79efef404400084bec93`; no production source, schema or website was changed.

The migration is now in the automatic Netlify migration directory **on this development branch only**. A future merge and production publish would apply it to production; those actions are not authorized by the development-only task.

## New-run lifecycle verification (October 23, 2026)

- Code commit: `46317aedf9f03cbadb0a26e26d13324e7e690aaa`, exclusively on `feature/tree-paid-continue`.
- Start New Run and Return to Title obtain a fresh server-issued run and bearer credential. Direct NFTree ownership is rechecked before rotating sessions atomically. The original sign-in expiry is preserved.
- Pending inputs are deduplicated; unsuccessful restarts stay at the debrief with retry. Expired credentials or lost ownership return to the gateway. No bearer credential is passed into Phaser.
- The `tree-run` function accepts only the authenticated credential and current run correlation. Browser score, wave, lives and Game Over claims cannot grant continuation eligibility. No database migration was added or changed.
- All 182 local tests and the build pass. GitHub Actions continuation checks `40004854831` / `40004850454` and PostgreSQL validation `40004854836` / `40004850466` passed. The new PostgreSQL integration step covers concurrent rotation, hashed storage, original expiry, NFT refusal, rollback on insert failure and logout during the ownership query. Positive holdings are fixtures.
- Netlify PR deploy `6adba978fee7ff840a3b401f` is ready, contains `tree-run`, and targets database branch `feature/tree-paid-continue`.
- Live checks on both branch and PR preview URLs reject missing and unknown credentials, forged Game Over fields and cross-origin requests. Existing signed-wallet smoke tests also pass on both URLs, including actual cryptographic signatures, live mainnet non-holder denial and replay rejection. The payment endpoint still returns 503 with `authorized:false`.
- The branch database status remains HTTP 200 / `ready:true`, with all four tables and all eight constraint checks passing.
- The gateway page loads after deployment. A real holder's full play/restart flow and the Slush warning remain unverified. Paid checkout remains unfinished and disabled; browser-calculated Game Over is not independently verified by the server.
- Production `main` remains at `f04261491ae78dc21cb87842bc3a0b1da81cefc6`, published deploy `6a9d79efef404400084bec93`.

## Checkout review and receipt verification (October 23, 2026)

- Development code commit `5ab4962ee7763bd99ea5fdf0a9b5ebd49f95240a` adds a read-only checkout review opened from a lost run's 20,000 TREE panel. The payment button is disabled with no signing/execution handler. The proposed recipient is labeled unconfirmed.
- `tree-continue-offer` requires the current bearer session and run, derives TREE decimals from mainnet metadata, and always returns `enabled:false`. It cannot write Game Over or redemption state. Mainnet metadata confirmed six decimals: 20,000 TREE = 20,000,000,000 base units.
- The staged Sui reader now matches the installed Core API status and address fields, requires a checkpoint/timestamp, and rejects malformed amounts. A read-only real mainnet receipt check passed for `77DCKTD1egsqSEYB1WaSurYNtnrdi85ArkjqP2hgQ4op`; this was not a TREE checkout payment and was not redeemed.
- Session creation/expiry timestamps now bound accepted receipts. The redemption transaction rechecks current session expiry under its row lock and conditional update.
- 189 local tests and the game build pass. Continuation checks `40007796610` / `40007789710` and PostgreSQL validation `40007796654` / `40007789935` all passed. The new PostgreSQL step validates six-decimal TREE receipts, concurrent one-time redemption, duplicate refusal, multiple continues, bad receipt fields, and expiry/logout during a chain lookup. Positive chain receipts and eligible Game Over state were fixtures.
- Live checks passed on both development URLs: unknown credentials are rejected through the database, forged eligibility fields and cross-origin requests are rejected, and `tree-continue` still returns 503 / `authorized:false`.
- Full holder-facing UI acceptance remains unverified. The cloud browser refused the isolated local HTML test file because its URL policy permits HTTP/HTTPS only; no alternate route was used to open that file. The local test fixture was not deployed or used to bypass the gateway.
- Remaining release gates: real NFTree-holder and Slush acceptance, confirmation of the proposed recipient, a reviewed Game Over eligibility policy, wallet execution and the authenticated Phaser continuation bridge. No schema migration or production change was made.

## Migration and safety notes

- Validated source: `db/staged-migrations/20261016030500_tree_authentication.sql`.
- Applied copy: `netlify/database/migrations/20261016030500_tree_authentication.sql` (byte-for-byte identical).
- Netlify applies hosted migrations during deployment. Never apply DDL through a direct connection or modify a migration already applied.
- The database status function uses only fixed, read-only metadata queries. All game authentication and payment credentials remain server-side.
- Read-only preflight helper: `app/game/preview-database-preflight.mjs`.
- Additional runtime inspection: `app/game/preview-database-status.mjs`.
- CI workflow: `.github/workflows/tree-database-validation.yml`.


## Server-side logout contract

- `game-logout-http.mjs` accepts only an exact 64-hex-character bearer session token, validates same-origin requests, refuses client state bodies and uses transactional credential revocation.
- Logout is idempotent; database errors return 503 without claiming success.
- The deployed preview `tree-logout` adapter is protected by the same trusted build/runtime isolation guard as sign-in. Production remains disabled.
- A game-session credential can revoke only that session. Intermediate wallet-login credentials are revoked by the server during session exchange.

Production `main` and real TREE payments remain unchanged.
