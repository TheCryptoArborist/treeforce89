# Top wallet picker — Sui Mainnet preview

Choose an installed Sui wallet above the game and select CONNECT WALLET. The single app action connects the wallet and requests the existing free personal-message verification. Ownership verification still uses the central TREE Account service and HttpOnly game session. The connected wallet address replaces the connection controls; DISCONNECT revokes the game session and wallet connection. Wallets with multiple authorized accounts expose an account selector; changing it requires a new ownership verification.

The account modal, wallet-family buttons and network selector are removed. Installed wallet discovery, message signing and payments share the same `@mysten/dapp-kit-core` instance. No separate wallet picker is shown at payment. If the browser is refreshed while an account session remains valid, payment reconnects the wallet chosen in the top picker and explicitly selects the verified payer when that wallet already exposes multiple authorized accounts.

When lives run out, a compact offer appears above the game with CONTINUE — 20,000 TREE and START NEW GAME — FREE. The paid button can first connect/verify a guest wallet, then request the separately approved transfer. The same wave and score remain paused while waiting. The continue action waits for private checkpoint storage before requesting an order; recovery-test controls are visible only with `?recoveryTest=1`. Account connection alone never orders or pays for a continue. One paid continue restores 3 lives and makes later scores casual. Existing receipt verification, saved-flight recovery and one-use delivery are preserved.

Connection and signature waiting can be canceled from the top bar. Creating/verifying a server challenge remains temporarily non-cancelable to protect cookie ordering. Wallet account changes invalidate the in-flight sign-in; late approvals cannot sign in or submit a payment after cancellation. Wallet security warnings remain intact. This interface change does not establish that Slush has cleared its website verdict.

## Validation

Node checks cover dApp Kit adapter calls, Mainnet-only discovery, account changes, duplicate/pending connection rejection, message-signature rejection, and reuse of the already connected payment wallet. The compiled-game browser workflow checks top-picker connection and automatic ownership verification at 320/390/1200 pixels using a fixture wallet and authentication server, preserves malicious-site rejection and signature rejection, and checks inline continues during ten real Phaser/PostgreSQL recovery scenarios. No installed user wallet or real payment is used by those checks.

Preview: https://deploy-preview-3--treeforce89.netlify.app/
