# TREE FORCE '89 — Paid continuation integration

Status (October 23, 2026): **NFTree sign-in and authenticated new-run rotation are active on the development preview. Checkout review is available after Game Over; wallet transfers and paid continuation remain disabled.**

## Product contract

- NFTree Gateway is the initial game-access mechanism; **20,000 TREE is NOT an entry fee**.
- Only when a player loses all lives, show **Continue for 20,000 TREE**.
- Successful continuation restores 3 lives and resumes the same wave, retaining score, kills, achievements and run ID.
- An unsuccessful, rejected, or unconfirmed payment must not restore lives.
- Each successful payment buys **one** continuation. The next game over requires a new payment.
- Completing the game does not offer a paid continuation.

## Sui mainnet configuration

- TREE coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`
- Price: `20_000` TREE; derive base units from **verified coin metadata decimals**, never assume 9.
- Intended payment recipient from earlier TREE FORCE discussion: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`. Confirm against existing production payment configuration before enabling.
- Network: Sui mainnet only. Gas is paid separately in SUI.

## Required implementation and release gates

1. Inspect the working NFTree.net Gateway implementation and reuse the same collection type and wallet flow, without introducing a second incompatible wallet connection.
2. Install current `@mysten/dapp-kit-react` and `@mysten/sui` with a reproducible lockfile update. Follow current MystenLabs `frontend-apps`, `ptbs`, and `accessing-data` skills.
3. Wallet constructs a TREE transfer and signs/executes it; never split the SUI gas coin to pay TREE. Display recipient, token and amount before wallet approval.
4. A **trusted verifier** reads finalized transaction effects / balance changes on mainnet and validates all of:
   - execution succeeded;
   - transaction sender matches the wallet authorized for this game session;
   - transfer of at least the exact 20,000 TREE base units reached the configured recipient;
   - coin type matches the canonical TREE type;
   - digest is not already redeemed for this purpose;
   - session/run is still eligible for continuation.
5. Persist a one-time redemption record atomically in server-side storage, keyed by transaction digest and session/run, **before** issuing an authorization to continue. Client localStorage, query params, and user-submitted digests alone are not authoritative.
6. Bridge the authorized continuation into Phaser and restart the current wave with the same run stats and three lives. Disallow replay of an old authorization.
7. Test rejected wallet, insufficient TREE, insufficient SUI gas, wrong coin, wrong recipient, duplicate digest, wrong wallet, chain mismatch, delayed indexing, refresh/reconnect, and multiple continues.
8. Run the project build and game regression tests. Preview before merging to main. **Do not enable payments** until the verifier and persistence are deployed and tested.

## Existing source

- `app/game/arcade.ts`: `GameScene.endRun()`, `GameOverScene`, and staged `resumeRun` path.
- `app/CanopyGame.tsx`: React/Phaser mounting boundary.
- `src/main.tsx`: React app entry point.

## Notes

- The staged `resumeRun` parameter is **not** payment proof. No user-facing payment button should call it until a trusted authorization bridge exists.
- The `wave` field in `RunState` is zero-based. Resume at `run.wave`, not `run.wave + 1`.
- Phaser runs in the browser, so score and wave preservation is a gameplay convenience, not an anti-cheat security guarantee. A stronger reward system needs server-authoritative scoring.


## NFTree.net gateway source identified (October 14, 2026)

Canonical site repository: `TheCryptoArborist/nftree_landing`.

- Wallet integration: `src/wallet-mint.js`, using `@mysten/wallet-standard` and `@mysten/sui` (not the deprecated JSON-RPC dApp Kit).
- The NFTree wallet supports `sui:mainnet`, Wallet Standard connection and transaction signing.
- The TREE FORCE branch now includes `app/game/nftree-access.mjs` with a **read-only** direct-ownership check for `0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT`.
- The development gateway now requires a verified personal-message signature and a server-side ownership query before it issues a session. A browser address by itself is not authenticated wallet identity.
- Direct ownership is not equivalent to kiosk or custody holdings. Handle those explicitly rather than rejecting legitimate NFTree owners silently.
- The 20,000 TREE payment remains exclusively for continuation after all lives are lost, never initial entry.


## Security boundary: session creation versus game-over proof

The server-only `nftree-session-service.mjs` composes hashed wallet-login lookup,
mainnet direct NFTree ownership checks, and issuance of a new game session.
It is deployed on `feature/tree-paid-continue`. React keeps the bearer session
in memory and passes only the server-issued run ID and a restart callback to
Phaser. Production remains unchanged.

A server-issued session alone does **not** prove that a player lost all lives.
The current Phaser game executes in the browser and can be modified by the
player. Never allow an HTTP request with `gameOver:true`, `lives:0`, or
`wave:N` to set `continue_pending` in PostgreSQL.

Before accepting real TREE:
- Implement a trusted game-over state transition and define its anti-cheat
  guarantees. If using client-reported outcomes, explicitly acknowledge they
  are not independently verifiable and limit associated rewards accordingly.
- Bind the Phaser run ID to the server-issued run ID and secure session.
- Verify current SDK ownership response shape against actual mainnet data,
  including NFTrees held via kiosks/custody.
- Implement authenticated HTTP handlers, durable DB migrations, and a trusted
  mainnet payment reader with integration tests against real transactions.
- Keep `netlify/functions/tree-continue.mjs` returning 503 until all gates pass.


## React/Phaser run ID bridge (October 15)

`CanopyGame` and `createCanopyGame` now accept an optional `serverRunId`
with the format `grove-<32 lowercase hex characters>`. When provided, a new
Phaser run uses it. Without it, the existing offline run ID is generated.
A paid continuation retains the prior run ID. The paid resume path remains staged.

The development gateway now obtains an authenticated server-issued run ID.
The ID alone remains only a correlation value: a browser echo does not prove
wallet identity, NFTree ownership, score, lives or Game Over.

Authenticated session creation is complete. Real TREE transfers remain blocked
pending the continuation trust policy, paid checkout acceptance testing and
resolution of the Slush security warning.


## Authenticated new-run lifecycle (October 23, 2026)

After a loss or victory, **Start New Run** and **Return to Title** both request
`POST /.netlify/functions/tree-run` with the current bearer credential and run
ID. The endpoint is restricted to this development branch and site, same-origin
requests, exact input fields and an IP rate limit. It accepts no wallet, score,
wave, lives, Game Over or continuation claims.

The server resolves the wallet from the hashed credential, rechecks direct
NFTree ownership on mainnet, then locks the old session. In one PostgreSQL
transaction it expires the old credential and creates a fresh session, token
and run ID at wave zero with continuation number zero. Authentication expiry
is retained rather than extended. Concurrent restarts can succeed only once;
an insert failure rolls back the old session's expiry. A logout during the
ownership lookup is rechecked under the lock.

The game stays at its debrief while the request is pending. Duplicate replay,
title and keyboard inputs share one request. Failure offers retry; an expired
session or lost NFTree returns to verification. The new Phaser instance starts
at the requested title or gameplay scene. Bearer credentials never enter Phaser,
URLs or persistent browser storage.

This endpoint **abandons** the previous run. It does not resume that run, restore
its score, collect tokens, create a redemption, or set `game_over` or
`continue_pending` to true. Browser-calculated Game Over remains informational.
The 20,000 TREE offer appears only after a loss and explicitly says payments
are disabled. The public payment endpoint continues returning 503.

Automated coverage includes UI input coordination and retry, exact HTTP
contracts, production denial, credential expiry, mainnet ownership failure,
concurrent rotation, database rollback and logout races. PostgreSQL tests run
in disposable CI storage; positive NFT holdings are fixtures. Real holder and
Slush acceptance remain separate from these automated checks.


## Checkout review and receipt hardening (October 23, 2026)

A lost run's 20,000 TREE panel now opens a React checkout review. It explains
three restored lives, retaining the current score/wave, mainnet and separate
SUI gas. Its payment button is disabled and has no signing or execution handler.
Victory does not expose this offer. Closing the review returns to the debrief.

`tree-continue-offer` authenticates the current session and run through the same
branch/site/origin/input guard as restart. It only reads the session and mainnet
coin metadata; it does not set Game Over, eligibility or redemption state. Both
the server and browser require `enabled:false`. The proposed recipient remains
explicitly unconfirmed. Browser review rejects substituted amounts, recipients,
runs, networks or activation flags.

Mainnet coin metadata returned **6 decimals** for the canonical TREE type:
20,000 TREE is **20,000,000,000 base units**. Metadata ID:
`0xe4dcc3ff58d2069c18b024fb69c925abb95748dbeb16a99258e1d3433c140902`.
This was a read-only query; no tokens moved.

The staged receipt reader now uses the installed Sui 2.37.0 Core response:
`Transaction.status.success`, `effects.status.success` and balance changes with
`address`, rather than legacy tagged status/owner fields. It requires a
checkpoint and timestamp, checks successful effects and validates all amounts.
Its actual mainnet read was checked using transaction
`77DCKTD1egsqSEYB1WaSurYNtnrdi85ArkjqP2hgQ4op`, checkpoint `337313991`, timestamp
`1792781491679`. This transaction established SDK/receipt compatibility; it was
not a TREE checkout payment and was not redeemed.

The verifier rejects receipts outside the authenticated run's creation/expiry
window. Atomic redemption rechecks expiry under the database row lock and again
in the conditional update, so a slow fullnode query cannot redeem an expired or
logged-out session.

Disposable PostgreSQL tests cover SDK-shaped TREE receipt verification at six
decimals, concurrent redemption, duplicate receipts, multiple continuations,
wrong sender/coin/recipient/amount, old or uncheckpointed receipts and
expiry/logout during the chain lookup. Positive receipts and server eligibility
are fixtures; no real wallet transaction or hosted payment row is created.

Still required before any activation: real holder/Slush acceptance, confirmation
of the recipient, a reviewed Game Over eligibility policy, wallet execution and
the authenticated authorization bridge into Phaser. `tree-continue` remains
unchanged and returns 503 / `authorized:false`. No migration was added and no
production branch, schema or deployment was modified.


## Staged continuation resume contract (October 29, 2026)

`app/game/authorized-continue-resume.mjs` now prepares an explicitly whitelisted
Phaser run snapshot only when a trusted authorization result matches the exact
run ID, interrupted wave and three restored lives. It preserves the existing
score, seed and game statistics while rejecting completed runs, malformed
snapshots, mismatched authorization and injected wallet/payment fields.

**This module is not wired to the game or payment endpoint.** It cannot grant
payment authorization and is not a proof of Game Over. The backend still needs
a reviewed eligibility policy, confirmed TREE recipient, real holder/Slush
acceptance and a verified payment receipt before any real continue can occur.
The payment button remains disabled and `tree-continue` must keep returning
503 until those gates are met.
