# Core game restart

Branch: `restart/core-game`. The previous wallet/NFT/payment preview remains on `preview/flight-recovery`.

This stage retains Phaser gameplay, character and enemy art, wave progression, boss logic, combat polish, local records and achievements. The running app does not load Sui wallets, account authentication, NFT checks, flight storage or payment integrations. New runs start without an access gate. This is a development baseline, not the NFT-only release.

Netlify publishes the static game with an empty function directory. Account callback files and the isolated wallet page are excluded from the output. Historical integration source remains in the repository for reference.

## Connection-first acceptance

Run `npm run build:connection` to produce a standalone official dApp Kit connection page in `dist-connection`, with no game, NFT, account or payment imports. Run `npm run build` separately for the preserved core game. Neither build depends on the other at runtime.

Before merging wallet integration into the game, a real installed Slush extension must accept a fresh manual connection at the intended permanent game URL, return a Sui Mainnet account, disconnect, and reconnect normally. Record the exact URL, extension version, result and Alert ID when present. Automated fixture tests cannot mark this checkpoint as passed. Keep wallet security checks intact.

Current acceptance result: FAILED for `https://deploy-preview-3--treeforce89.netlify.app/wallet-baseline.html`. The user supplied screenshots showing Slush's malicious-website verdict on the isolated official component in Brave and again in Chrome with a test wallet. No game or commerce feature ran before that verdict. This experiment does not identify its cause, prove a false positive or establish that another URL will pass.

After connection passes, add read-only NFTree ownership, validate a real holder and non-holder, then integrate the preserved core game. Payments are a final, separately validated stage. A failure at any stage stops expansion of that stage while the gameplay branch can continue.

No automatic production publication, alternate-domain rotation, wallet-warning bypass or provider review is authorized by this restart. The permanent URL remains an explicit release decision; changing code cannot promise acceptance.

## Paid entry branch

The user subsequently requested in-game 20,000 TREE access without NFTree ownership. `feature/paid-game-entry` implements that separate product. The original wallet-free restart branch remains available. Slush acceptance is still unresolved; paid entry is not evidence that the connection block is fixed. See `paid-entry.md` for terms, verification and deployment status.
