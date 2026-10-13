# In-game TREE entry

20,000 TREE purchases one run with three starting lives. NFTree ownership is not required. Losing all lives or completing the campaign ends the run. Gameplay powerups and earned extra lives remain unchanged. No paid continues are installed by this branch.

The official Sui wallet connector submits a standard TREE transfer to the existing sales wallet. A standard-library string input binds the transfer to a unique server order. SUI gas is separate. Wallet connection can still be blocked by Slush; this change does not resolve or bypass that verdict.

The server checks mainnet genesis identity, TREE decimals, successful checkpoint inclusion, payer, order reference, payment timestamp and exact TREE balance changes. PostgreSQL enforces unique transaction digests and binds a paid order to a single run UUID. A random browser-held order secret is stored only as a SHA-256 hash server-side. Public database roles cannot access the private payment schema.

Pending submissions persist locally. A retry with a known digest verifies the existing payment instead of paying again. An unknown submission is held for investigation, not automatically resubmitted. Browser storage must be available before signing. Clearing storage can lose pending recovery information.

This is a browser arcade entry gate, not server-authoritative gameplay or anti-cheat. Modified client code can bypass local scenes. Do not use local scores as authority for financial rewards.

Deployment: enable only the new `netlify/core-functions/tree-entry.mts` proxy for this branch, deploy `tree-game-entry` with the private schema in `netlify/lib/entry-schema.sql`, and retain existing recovery services unchanged. Wallet acceptance and a real payment have not been verified automatically; no transaction is signed by the development agent.

Current status: the user explicitly approved deploying the public capability-authenticated endpoint with JWT checking disabled. `tree-game-entry` version 1 is active in the existing Supabase project. Live service status confirms the fixed price and recipient; direct browser-origin requests are rejected. Real wallet acceptance and a signed payment remain untested. Production gameplay has not been replaced.
