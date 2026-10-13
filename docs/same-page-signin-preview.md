# Top wallet picker — Sui Mainnet preview

Choose an installed Sui wallet above the game and select CONNECT WALLET. The single app action connects the wallet and requests the existing free personal-message verification. Ownership verification still uses the central TREE Account service and HttpOnly game session. The connected wallet address replaces the connection controls; DISCONNECT revokes the game session and wallet connection. Wallets with multiple authorized accounts expose an account selector; changing it requires a new ownership verification.

The account modal, wallet-family buttons and network selector are removed. Installed wallet discovery, message signing and payments share the same `@mysten/dapp-kit-core` instance. No separate wallet picker is shown at payment. If the browser is refreshed while an account session remains valid, payment reconnects the wallet chosen in the top picker and explicitly selects the verified payer when that wallet already exposes multiple authorized accounts.

When lives run out, a compact offer appears above the game with CONTINUE — 20,000 TREE and START NEW GAME — FREE. The paid button can first connect/verify a guest wallet, then request the separately approved transfer. The same wave and score remain paused while waiting. The continue action waits for private checkpoint storage before requesting an order; recovery-test controls are visible only with `?recoveryTest=1`. Account connection alone never orders or pays for a continue. One paid continue restores 3 lives and makes later scores casual. Existing receipt verification, saved-flight recovery and one-use delivery are preserved.

Connection and signature waiting can be canceled from the top bar. Creating/verifying a server challenge remains temporarily non-cancelable to protect cookie ordering. Wallet account changes invalidate the in-flight sign-in; late approvals cannot sign in or submit a payment after cancellation. Wallet security warnings remain intact. This interface change does not establish that Slush has cleared its website verdict.

## Validation

Node checks cover dApp Kit adapter calls, Mainnet-only discovery, account changes, duplicate/pending connection rejection, message-signature rejection, and reuse of the already connected payment wallet. The compiled-game browser workflow checks top-picker connection and automatic ownership verification at 320/390/1200 pixels using a fixture wallet and authentication server, preserves malicious-site rejection and signature rejection, and checks inline continues during ten real Phaser/PostgreSQL recovery scenarios. No installed user wallet or real payment is used by those checks.

Preview: https://deploy-preview-3--treeforce89.netlify.app/

## Connection-only diagnosis

Open the same preview with `?walletCheck=1` to expose CHECK CONNECTION ONLY. This uses the same installed-wallet dApp Kit connection and existing pending-prompt/cancellation safeguards. It returns before account challenges, message signing, server verification, flight storage, order creation or payment. A successful connection does not authenticate the player. A blocked connection is preserved and reported as stopping before sign-in; it does not prove maliciousness or a false positive. The ordinary game has no diagnostic controls.

The compiled-game browser workflow checks both successful and rejected connection-only attempts at 320, 390 and 1200 pixels, asserting no message signatures, no account challenge/verification calls, no transaction requests and no authenticated identity. These remain fixture-wallet checks; they cannot establish acceptance by an installed Slush extension.

On 2026-10-13 UTC, inspected the publicly distributed official Slush Chrome extension 26.21.1 (fb0b74f), downloaded using the extension ID linked from https://slush.app/download. In that build, `ApproveConnection` queries `dAppInteraction` with `input.connect = {network, url}`. `SignPersonalMessage` separately queries it with `input.signMessage = {network, url}`; neither query supplies the personal-message content. `ScamProtectionGuard` renders the blocking screen when returned `securityScan.issues` contains level `BLOCK`. The displayed Alert ID is `securityScan.scanId`. The GraphQL transport's default backend is https://api.slush.app/graphql and can be configured remotely. Thus the warning screen depends on a wallet security result, rather than the game's error copy. This does not identify why this specific site was classified.

A single unauthenticated read-only reproduction of the published connection query was attempted without wallet credentials. The backend returned HTTP 403 / error code 1010, so no site verdict was obtained and no response was treated as evidence of site safety. No feedback/report mutation, wallet modification, origin change or security bypass was attempted. Further diagnosis requires an actual installed-wallet outcome on the existing site.
