# Arborwing abduction animation — preview only, 13 September 2026

Peter requested a more animated Arborwing abduction. Baseline: 4500a296a2fbeb8eb4bf01be40f9012be2b1bdc5, retaining the revised 180-HP Canopy Tyrant and simulation-only continues. This change is a visual adapter, not a new capture mechanic or a payment change.

## New presentation

The Root Captor's underside projector glows during approach. Its former flat beam rectangle is rendered as a layered tractor beam with upward-moving energy rings and particles. Straight gold rails retain the existing 72px lane boundary.

On capture, the player's existing Arborwing texture and growth frame are used for a display-only copy. The plane visibly shudders, banks, compresses slightly and rises from its actual position toward the moving captor over 520ms, with three fading afterimages. The logical captive stays active in its original location, temporarily hidden only for rendering. It becomes visible again when the lift finishes, before the existing 600ms departure completes.

A violet containment halo and tethers mark the captured wing. They turn gold during the existing rescue window. A successful rescue adds a brief release pulse and light trail toward the companion; it does not move the actual companion's firing origin or delay its availability.

Reduced-motion preferences remove the rocking/stretching/afterimages and reduce beam motion, while keeping the same capture timing. Two reused Graphics objects and four short-lived display images are the maximum added objects; the adapter does not spawn sprites every frame.

## Preserved rules

The existing 72px lane, 3100ms beam window, one-life capture cost, weapon downgrade, original retreat and respawn/game-over timers, corruption logic, rescue eligibility, rescue bonus and dual-fire mechanics are not rewritten. Original methods still make those decisions. The logical captive body is never moved by the added display effect. Added frame-driven effects stop advancing while the scene/physics is paused; existing game timers and tweens are not replaced by this adapter.

Cleanup runs on scene shutdown, replay, wave clearing, and an authorized continue. It also handles captive destruction, captor removal and corruption during the visible lift. Boss combat, account sign-in, credits, previous wave tuning and production are outside this change. The previously proposed city background is not included in this capture patch.

## Test

Preview: https://deploy-preview-1--treeforce89.netlify.app/
Wave 3 practice: https://deploy-preview-1--treeforce89.netlify.app/?wave=3

Start the Wave 3 practice run and wait for the Root Captor (normally after about ten seconds of active wave time). Let its gold beam catch the Arborwing to see the lift, then attack during the existing gold rescue window. This is the existing unranked wave-select route, not a new paid level. Starting practice does not require a credit purchase.

## Validation

23 new Node tests passed locally against the actual new module with mocked scene/rendering interfaces. They cover start/end positions, timing within the original departure, preserved life/weapon/timer behavior, display-only sprite ownership, correct growth artwork, reduced motion, pause gating, cleanup, rescue gating/reward/firing origin, repeated installation and replay listener counts. The Netlify build is configured to run these in addition to its existing test gates.

No full browser/Phaser play-through or live wallet transaction was performed locally. The container had no repository/CDN network access and no installed Phaser package, so local tests are not a substitute for the deployed Wave 3 acceptance test. Difficulty and live animation readability remain to be checked in that preview.
