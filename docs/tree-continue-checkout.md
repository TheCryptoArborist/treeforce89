# TREE FORCE '89 — Paid continuation integration

Status: **staged; no payment collection or paid unlock enabled**.

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
- Ownership is not yet a game-entry gate. Connect a wallet and verify actual ownership before enabling access restrictions. A browser address by itself is not authenticated wallet identity.
- Direct ownership is not equivalent to kiosk or custody holdings. Handle those explicitly rather than rejecting legitimate NFTree owners silently.
- The 20,000 TREE payment remains exclusively for continuation after all lives are lost, never initial entry.
