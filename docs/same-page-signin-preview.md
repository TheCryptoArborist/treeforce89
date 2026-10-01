# Same-page TREE Account sign-in — preview only

The SIGN IN button now opens an accessible dialog over the game. It contains Sui/EVM choices, detected wallets, account selection, and an explicit message-signing step. There is no TREE popup, iframe, page redirect, or game reload. The user's wallet still opens its own permission/signature UI. The two EVM choices remain BNB and Robinhood testnets; Sui is Mainnet authentication only.

## Flight preservation

The dialog temporarily pauses active scenes, physics and keyboard/pointer input. Closing it restores only its own pause, not an existing manual pause or continue pause. The same wave, score, lives, boss state and credit balance are retained; no scene restart is called. Cancel or a rejected wallet signature returns to the game. A stale wallet response after cancel/account change cannot finish login. To avoid a cookie-write race, dismissal is briefly disabled while creating a challenge or finalizing server verification; the wallet connection and signature-wait stages can be canceled.

A SIGN IN HERE button is also available inside the test-credit modal for guest/expired sessions. The account dialog opens above it. Signing in or canceling does not accidentally resume a flight still waiting for a continue decision. No credit charge, refund, top-up or continue restoration occurs as part of sign-in.

## Account compatibility and security

The new game proxy uses the existing game session cookie name and existing identity validator. It keeps browser-binding secrets and access tokens out of JavaScript, enforces same-origin POST, caps body size, and only runs on the explicitly configured preview origin. It talks server-to-server to the central inline endpoint, which reuses the current central account service, alias namespace, nonce validation, official signature verification and existing one-use session exchange. The same wallet resolves to the same TREE Account UUID, so the existing server-side test CC balance is not reset. Different wallets are not merged. No local scores are uploaded or made verified; no NFTree entitlements are granted.

Legacy popup/callback routes remain for old open tabs, but the new UI never invokes them. All accounts and credits remain preview-only. No dependency versions, environment variables, production branches, credit journal, gameplay tuning, city background, abduction or boss combat are changed.

## Validation

35 new local Node checks passed: 14 central service tests, 8 game-proxy tests and 13 wallet/pause checks. Signature/upstream/storage/Phaser dependencies were mocked where needed; central account tests reuse the existing service logic. The new tests run in the paired preview builds alongside the existing test gates, including the central SDK signature checks.

The authored UI, wallet and pause modules were exercised in an in-memory Chromium harness at 1200x900, 390x844 and 320x700. All 21 scenario/viewport checks passed: open/cancel, Sui success, delayed response after cancel, signature rejection, account changes, EVM sign-in, and nested credit-panel preservation/balance refresh. No uncaught page errors, extra browser pages, or horizontal overflow were observed. Wallets, API responses and Phaser interfaces were simulated. Outbound navigation was blocked by runtime policy; no installed-wallet or full deployed Phaser acceptance is claimed.

## Acceptance

Use https://deploy-preview-1--treeforce89.netlify.app/ . Finish any active flight before refreshing once to load the update. Do not clear site data or load more test credits for this check.

When signed in already, note the balance and select SIGN OUT. Start a guest flight, then open SIGN IN: the game should pause with the panel on the same page. Choose Sui, CONNECT WALLET, the same account used before, and SIGN IN WITH SUI. Approve only the personal message in the wallet. The panel should close and the same flight should resume with its wave, score, lives and remaining test balance preserved. Repeat with Cancel before signing. Check that an already-paused continue screen stays paused after sign-in is dismissed.

Live wallet/device acceptance and the larger continue-system acceptance checklist remain outstanding. Real TREE purchases are not enabled by this change.
