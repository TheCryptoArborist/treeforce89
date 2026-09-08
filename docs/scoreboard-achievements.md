# TREE FORCE '89 — Records preview / launch boundary

## Shipped in the preview

A guest-first personal scoreboard, 12 gameplay achievements, callsigns, and cosmetic earned titles. All-time top 10 normal runs, current-week top 10 (Monday 00:00 UTC), and 50 recent flights. Achievements and career totals commit when a normal run ends, not when a tab is abandoned. The normal-game HUD uses the local best, not the previous fixed 89,000 example. Badges are not NFTs and do not issue credits, tokens, multipliers, or extra lives.

Browser storage key: `treeforce89.records.preview.v1`. Records are per browser and origin. Keep using the stable deploy-preview-1 address while testing: a different immutable deploy hostname has separate storage. Old unrecorded flights cannot be reconstructed. Storage corruption or denied writes produce an explicit session-only warning; existing unreadable data is not overwritten. Preview records are unverified and must never be imported as verified rankings.

## Fair-play boundary

Normal runs begin at Wave 1. Wave-select, developer lab use (even if later switched off), invincibility, and speed modification are practice-only. Practice scores appear only in recent history; they cannot unlock badges or replace normal bests. The client-side checks enforce local UI rules; they are NOT anti-cheat proof.

A future CC adapter can emit `game.events.emit('arcade:continue-authorized')` after payment authorization and before restoring lives. This freezes the first-credit record and labels the remainder continued/casual. The hook does not process payments, spend credits, grant lives, or implement a continue offer. Ended runs are idempotent within retained local IDs. Backends require a durable unique constraint, not this bounded local deduplication list.

## Still required before public multichain rankings

Use one authenticated TREE Account UUID for Sui, BNB, and Robinhood players, not separate wallet-address leaderboards. A guest ID or cosmetic callsign is not proof of account ownership. Keep account verification and payment operations in their existing services.

The server must issue run IDs and seeds, bind each run to the authenticated account and ruleset, record its opening time, and enforce a single finalization. Do not trust client score, timestamps, flags, claimed badges, chain, or account ID. Authoritative or replay-validated results and server-side achievement evaluation are required. Build rate limits, replay/duplicate rejection, suspicious-run review, and ruleset/season separation. Confirm the current game's determinism before selecting replay verification: random sources, wall clocks, and frame-dependent physics need normalization.

Global boards should select one best verified score per account and period, show UTC boundaries, and distinguish daily/weekly/all-time competitive play from casual continued play. A paid continue freezes competitive scoring rather than buying a higher rank. Preserve earned gameplay reputation across chains. Any future CC achievement rewards require a separate economy decision and server-ledger controls; this build intentionally pays nothing.

Preview skill badges should be earned again on the verified launch ruleset; never silently promote localStorage achievements to server-authoritative records. Keep existing rounded pickups, contact-only BOOM, campaign boss, and finale adapters unchanged during this phase.

## Testing

`node --test tests/records.test.mjs` covers 26 pure-record and scene-adapter checks. Browser UI was exercised separately in Chromium with the actual records modules at 1200x900, 390x844, and 320x700: empty/populated boards, all 12 cards, profile saves, dialog close/open, and overflow checks. This isolated browser harness is not a complete Phaser campaign play-through. Run `npm run build` to include both existing campaign tests and the new record tests before Vite bundling.
