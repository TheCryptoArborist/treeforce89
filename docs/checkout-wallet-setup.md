# Paused Sui mainnet checkout publication

## Current wallet blocker (October 12)

The operator's Slush Browser Extension displayed “Malicious website” before wallet connection completed. Browser tests and the public-address mainnet simulation do not cover Slush's installed-wallet website classification. The public Mysten wallet lists at `a88d558746f9169a11f5c1a812509facdd24a723` have no exact hostname or parent-suffix block for the preview, but that does not explain the live verdict. No wallet/security exception has been approved and no publication has occurred.

The connected GitHub integration cannot create issues in Mysten's repository (`403 Resource not accessible by integration`). The official support request is prepared but unsubmitted, because it requires a reply email. The Slush web-wallet connection route requires sign-in before reviewing the request. No security setting has been disabled, alternate hostname used to evade the verdict, or transaction approved. The live verdict still needs resolution by its security provider.

Wallet connections now time out after 45 seconds instead of leaving the page stuck indefinitely. A pending underlying request prevents duplicate prompts; late connection responses cannot prepare or publish a transaction. A wallet rejection returns directly to the page without gas simulation or publication. The UI explicitly tells users to return to safety when Slush shows a security warning.

The admin setup page at https://deploy-preview-3--treeforce89.netlify.app/checkout-setup publishes the production checkout from the approved admin wallet. It requires a successful public-account mainnet gas simulation before offering a wallet approval. No custom installer, wallet key import, or testnet setup is involved.

Admin and UpgradeCap recipient: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.

The package initializes paused, with no quote signer, zero payment limits, and no allowed purchasers. Publication transfers no TREE and does not enable the game payment policy. The publisher must approve SUI gas in their wallet. The transaction contains exactly Publish and transfer of its UpgradeCap to the admin. Init sends AdminCap to the same sender.

The page reads the transaction and raw BCS objects from a pinned mainnet gRPC client to verify exact compiled bytecode, sender, capability ownership and bindings, unchanged compatible upgrade policy, and the empty paused checkout. A submitted digest is saved before receipt reads; subsequent clicks and refreshes recover that receipt instead of publishing again.

Production bytecode comes from backend source commit `54701f7072feeb7aacb977f8003926eff8087ebd`, checksum-pinned CLI mainnet-v1.81.1, successful build run https://github.com/TheCryptoArborist/tree-token.xyz/actions/runs/38280192971, and 26 passing Move VM tests. Payload SHA-256: `037ba4b992d3ce185a7af27e1d456c774c08eb5d011d7ad9d2bd84ef6ba48810`. The test command overwrites build files, so staging rebuilds production afterward and rejects test bytecode and test helper names.

19 publisher checks cover actual SDK commands, bytecode tampering, caller mutation, incorrect network/sender/capability binding, failed transactions, paused state, wallet changes, duplicate clicks, and retry after a recorded submission. Mainnet dry-run and hosted mobile/desktop browser results are recorded in the setup workflow. They do not sign or submit transactions.

After actual wallet publication, the verified package ID, shared checkout ID/version, AdminCap and UpgradeCap IDs are used for hosted quote authority configuration. Payment stays off until that configuration and receipt reader are verified. The intended pilot remains 20,000 TREE restoring 3 lives in the same flight, once per flight. Publishing this paused package alone does not complete that payment pilot.
