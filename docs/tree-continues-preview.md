# TREE-funded continue preview — 13 September 2026

## Test entry

Use https://deploy-preview-1--treeforce89.netlify.app/ and sign in using the existing TREE Account button. Stable paired preview origins are required. This is SIMULATION ONLY: no real TREE payment, wallet approval, on-chain checkout, NFTree entitlement change or production rollout.

1. Open TEST CC above the game.
2. Create and confirm a simulated TREE quote. 1,000 base test CC plus a 10% TREE bonus gives 1,100 test CC.
3. Start a normal flight, exhaust lives, and choose CONTINUE · 100 TEST CC. For a quick check, open TEST CC during a flight and choose TEST CONTINUE NOW (PRACTICE), which permanently excludes that flight from normal records.
4. Confirm the same wave resumes with three Seedling lives, the starting weapon and three seconds of protection. The account balance should be 1,000 test CC after a fresh top-up and one successful continue. One continue per run is the temporary prototype limit.
5. On another fresh flight, TEST FAILED CONTINUE reserves and releases 100 test CC without delivering a continue. The balance returns to its pre-attempt value. Finish that run and start another for a successful attempt.

The displayed quote uses a deliberately fictional 1 TREE = $0.001 rate. The resulting 1,000 SIMULATED TREE amount is NOT a current market price or payable mainnet quote. Quotes expire after 45 seconds. A preview account can receive at most five simulated top-ups. Test balances will not become launch balances.

## Integration boundary

The new central endpoint lives in the paired TREE Arcade account preview, not in this game's browser storage. The game proxy uses its existing HttpOnly account session, so server writes are scoped to the authenticated preview TREE Account. The central simulation ledger is private, account-scoped, double-entry and conditional-write protected; the production Postgres/Supabase ledger remains unimplemented and untouched. See central repo docs/tree-continues-simulation.md for accounting, provenance and failure semantics.

reserve -> prepare paused game -> commit -> restore while paused -> acknowledge delivery -> resume. Duplicate requests and uncertain-response retries retain their action IDs. Failed preparation releases its hold; failed application reverses the committed debit. Unfinished reservations and unacknowledged delivery charges are returned after a 90-second timeout when the ledger is next read or changed. A crash after acknowledgment but before visible resume remains a production recovery-policy gap; this non-monetary preview must not be promoted directly to live payments.

Successful continues call the existing first-credit record boundary before restoring the player. Additional points are casual and do not improve the main normal-play records or unlock normal-play achievements. Test shortcuts permanently taint the whole flight. All gameplay records remain browser-local and unverified. There are no shared verified rankings yet.

Wave/enemy/boss progress, score and already-earned extra-life milestones are preserved; combat loadout, temporary boosts, combo, shield charge, hostile/player bullets, captive/companion wing and snare visuals are reset for the continue. No existing arcade.ts, campaign art, pickup artwork or wave tuning is edited.

## Verification

Locally passed: 22 central ledger tests, 18 game flow/proxy tests and five cross-repository reducer/controller integration tests. An isolated Chromium harness used the real new UI/controller/reducer with mocked scene/account/storage dependencies at 1200x900, 390x844 and 320x700; successful funding/continue, failed delivery/release, modal closure, page error and overflow checks passed. This is not a deployed Phaser campaign or installed-wallet acceptance test. Two additional record-separation tests are included in this repository's test-gated preview build, alongside existing account, campaign and records tests.

Exclusive paid levels, real TREE pricing and finality verification, real-money credit issuance and production database migration are not included. Existing NFTree-promised content is not restricted or charged again.
