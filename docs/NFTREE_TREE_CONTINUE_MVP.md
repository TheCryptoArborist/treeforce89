# TREE Force '89 — NFTree Access + TREE Continue MVP

Status: **implementation plan only**. This branch does not enable purchases, change live authentication, or modify production gameplay.

## Scope and source of truth

The current `app/game/arcade.ts` is a Phaser game with three lives and ten waves; its current source contains no wallet/NFT gating or paid continue. The existing `tree-token.xyz` branch `preview/flight-recovery` has a more elaborate continue implementation; **do not merge its five-account commerce system into this MVP**.

- Network: **Sui mainnet**.
- NFTree eligibility type: `0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT`.
- TREE coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`.
- Continue price: **20,000 TREE = 20,000,000,000 raw units** (6 decimals).
- Recipient: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.
- Continue grants **three lives**, preserving wave, score and current flight. **One paid continue per flight** initially.
- Free new flights after game over for NFTree holders. No Canopy Credits conversion or package sale.

## Minimal architecture

1. **Client wallet connection.** Integrate current `@mysten/dapp-kit-react` + `@mysten/sui` with `SuiGrpcClient`; React wallet UI is client-side. Never put private signing keys or database secrets in the browser.
2. **Ownership gate.** Read owned objects for the connected address via Sui gRPC/GraphQL and check the **exact NFTree Move type**, including pagination. Do not accept a token name, image or user-supplied boolean as proof. Refresh eligibility on account/network changes and before beginning a new flight. A public read may drive UI, but the server must independently check eligibility before issuing a continue entitlement.
3. **Game bridge.** Gate the Phaser Start action on eligible wallet state; preserve the original title/gameplay loop. At zero lives, pause and persist a bounded checkpoint (run ID, wallet, wave, score, lives=0, continuesUsed=0, ruleset/version and integrity data). Never trust a browser-submitted score or lives as authoritative without server validation; choose a server-issued signed checkpoint or a narrowly scoped server-owned run state.
4. **Single trusted API** (one deployment with a minimal persistent store): authenticated wallet challenge/nonce, `POST /runs`, `POST /runs/:id/continue-intent`, `POST /runs/:id/confirm`, `GET /runs/:id`. Store nonce consumption, run state and receipt uniqueness atomically. Bind wallet, run ID, intended amount/coin/recipient and expiry to the intent. A plain client-side digest is not an entitlement.
5. **Payment.** Wallet constructs and signs a Sui mainnet transaction paying the exact TREE type/amount to the configured recipient. Prefer an on-chain Move checkout event containing the run/order identifier so two identical payments cannot be confused; if using direct transfer, the verifier must independently inspect the transaction effects and actual coin movement and bind the digest uniquely to a server-issued intent. **Do not activate paid continues until this receipt-binding design is implemented and reviewed.** No `tx.build()` before handing the transaction to the wallet.
6. **Verification + delivery.** Server reads finalized transaction/effects using a trusted Sui data source, checks success, exact token, exact recipient, amount, payer, mainnet, intent association, uniqueness and no prior redemption. In one atomic database operation, mark receipt consumed and run continued; make retries idempotent. If the transaction is successful but server/network response fails, `GET /runs/:id` restores the entitlement without a second payment.
7. **Resumption.** After verified entitlement, restore the same run with three lives, original wave and score; preserve starting weapon and short protection if consistent with the game rules. If restoration cannot occur, provide an operator-visible recovery path rather than silently retaining payment.

## Non-goals

No five application DB logins, six custom runtime secrets, Windows installers, Canopy Credits purchase flow, cross-chain launch, or live production contract publication in this MVP. Existing Supabase accounts/secrets remain disabled and untouched pending a separate dependency audit.

## Acceptance tests (must pass before mainnet pilot)

- No NFTree -> no game start; eligible NFTree -> start; wallet switch or NFT transfer -> gate updates.
- Incorrect network or wrong NFT Move type -> denied.
- Zero lives -> exactly one continue offer at 20,000 TREE, plus free new game.
- Wallet rejects or transaction fails -> no lives restored; no receipt consumed.
- Wrong coin, wrong amount, wrong recipient, wrong payer, wrong run or reused digest -> denied.
- A successful transaction followed by reload or dropped HTTP response -> exactly one entitlement restored.
- Duplicate confirmation requests -> one receipt and one continue, not two.
- Resume preserves run ID, score, wave, and restores exactly three lives; subsequent paid continue on same run denied.
- Missing or stale NFT eligibility at purchase time -> denied without initiating payment.
- Production remains unchanged until test deployment, security review and owner acceptance.

## Implementation order

A. Build wallet/NFTree ownership gate on a preview branch and test without payment.
B. Add a minimal server-owned flight/receipt store and authenticated API; verify abuse/replay scenarios.
C. Integrate wallet payment + trusted receipt verification with checkout disabled by default.
D. Wire zero-lives pause and exact checkpoint resumption; test cancellation/reload.
E. Review and enable a single restricted mainnet pilot transaction with explicit approval. Do not infer live checkout from UI-only tests.

## References

- MystenLabs/skills: `frontend-apps/SKILL.md`, `frontend-apps/limitations.md`, `frontend-apps/transactions.md`, `accessing-data/SKILL.md` (reviewed October 12, 2026).
- Current game: `TheCryptoArborist/treeforce89/app/game/arcade.ts`.
- Existing, more complex paid-continue code: `TheCryptoArborist/tree-token.xyz/services/canopy-credits/continue-product.mjs` on `preview/flight-recovery`.
