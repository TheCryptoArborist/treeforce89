# NFTree Gateway — Real-wallet acceptance checklist

Development branch: `feature/tree-paid-continue`. **No live TREE payment should be made.**

Prerequisites: Sui mainnet wallet with one NFTree held directly, a second wallet with no NFTree, and a preview deployment of this branch.

1. **Holder** — connect a mainnet wallet with an NFTree directly owned at `0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT`. Confirm the game mounts once and accepts keyboard/mouse/touch controls.
2. **Non-holder** — connect an empty wallet. Confirm the gateway does not mount Phaser and displays a clear NFTree.net link.
3. **Switch account** — switch the connected wallet to an account without an NFTree. Confirm the old Phaser instance is destroyed and the gateway returns to its connect state.
4. **Disconnect** — disconnect during gameplay. Confirm gameplay is destroyed, not merely hidden.
5. **RPC failure** — simulate a failed Sui mainnet ownership query. Confirm an error and retry are shown, never unlocked gameplay.
6. **Kiosk-held NFTree** — record whether a legitimate holder is rejected due to custody. This remains an acknowledged unsupported ownership path, not evidence that the NFTree is absent.
7. **Game over** — exhaust lives. Confirm the 20,000 TREE continuation section is informational and checkout is not clickable.
8. **New run** — confirm starting a new run still resets score and wave as before.

Acceptance gates: screenshot/video of each case, no console errors, successful GitHub Actions build and regression tests, and no payment activation. Do not merge the draft PR before all gates are met.
