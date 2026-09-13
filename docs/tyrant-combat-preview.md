# Canopy Tyrant combat revision — preview only

## Trigger and scope

Peter's 13 September play-test reported that the final boss was far too easy. The inspected preview (553e2461bffc40537df718d08fcc26da1e16ca2d) used only 24 HP, while each Canopy Cannon projectile deals 2 damage. The old attack was a repeated five-projectile aimed fan every 1,150 ms. This revision changes only boss combat and its optional practice entry, not the account/credit ledger or other games.

## First balance pass

- Fixed 180 HP for all pilots. No health scaling based on equipment, account, balances, purchases or continues. Player damage and all earlier waves are unchanged. This is a provisional play-test value, not a claim of final balance or a guaranteed fight duration.
- Entrance armor prevents damage until the original arrival animation has finished. Boss remains damageable throughout all three combat phases; there are no recurring invulnerability windows or health regeneration.
- Phase 1 (above 120 HP): Root Armor, aimed five-shot fans.
- Phase 2 (61–120 HP): Thorn Barrage, alternating wider fans and twin-cannon outside volleys.
- Phase 3 (60 HP or less): Core Frenzy, faster pacing and a broad crown storm with an intentional center opening, alternating with twin volleys.
- All attacks have 600–700 ms of visible warning, aim locks at the warning, and the boss holds its firing position. Shots travel in fixed directions and do not home. Bounded motion resumes without teleporting after windup. Total hostile projectile count is capped at 30.
- Phase changes clear previous hostile shots and provide a short warning interval. Existing shield stun still interrupts attacks; boss damage and cracked armor use the correct percentage thresholds.
- Ramming no longer deletes the boss through the ordinary enemy contact callback. Cloaking remains protective. Player/enemy and pickup rules outside the boss are preserved.
- A continue preserves the boss's remaining HP and phase. It cancels the current warning and gives a brief restart interval; it does not replay arrival, heal the boss, or change the continue cost.
- Existing boss art and victory sequence are retained.

## Preview test

Normal game: https://deploy-preview-1--treeforce89.netlify.app/
Boss-only practice: https://deploy-preview-1--treeforce89.netlify.app/?wave=10&bossPractice=cannon

The boss-only route begins Wave 10 with Ancient growth and the Canopy Cannon, without invincibility. It is explicitly practice/unranked and must not earn normal records or achievements. It does not require a top-up to start. The normal campaign keeps normal growth and weapons. Check the 180-point boss health bar and PHASE 1/2/3 warnings to identify the new build.

## Implementation and validation

New tyrant-combat.mjs is installed after campaign polish and before records/continue wrappers. config.ts changes only boss HP. The adapter derives percentage armor stages itself because older campaign/collision callbacks still pass fixed 24-HP stage arguments; neither may revert the correct armor texture. Disposal and scene shutdown remove pending warning graphics and listeners.

28 new Node tests passed locally using the real combat module with mocked scene/physics interfaces. They cover phase/armor thresholds, projectile trajectories and intentional gaps, warning and pause timing, aim locking, smooth movement, projectile cap, entrance protection, collision preservation, continue HP preservation, finale delegation, replay cleanup, and practice isolation. The test-gated Netlify build runs these along with the existing account, continue, campaign and records tests.

Limitations: no full Phaser campaign play-through or live wallet-to-continue test was completed for this revision. Container network access to the repository/preview was unavailable; repository reads and writes used the GitHub connector. Unit tests do not establish human difficulty or guarantee that every overlapping projectile situation is avoidable. Desktop/mobile play-test with ordinary and upgraded weapons remains necessary.

No production branch, central account service, test balance, pricing, token payment path, NFT entitlement or continue allowance is changed. Prior local scores are not deleted or promoted to verified rankings. The broader continue acceptance test remains pending Peter's explicit confirmation of same-wave resumption, movement/shooting and the expected balance change.
