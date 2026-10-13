# Canopy Tyrant city background — preview only

## Requested change

Install Peter's supplied neon-city image as the Wave 10 background, leaving earlier waves, title and victory screens unchanged. Baseline: 0fb8204983166c6a8a605c13fde56c3f77eab833, including the 180-HP boss revision and animated abduction.

## Implementation

The supplied 941x1672 image was center-cropped, without stretching or generative alteration, to a 480x720 AVIF optimized for the game's canvas. File: public/assets/backgrounds/tyrant-neon-city.avif (17,413 bytes). Its Git blob SHA is 395c957ed2a153a9d18cabf89b859fa9932079f2; the returned GitHub upload SHA matched the locally computed SHA. A build test checks the asset's SHA-256 as well.

boss-background.mjs queues the image through the game scene's preload, before its create/startWave. It hooks the existing setWaveBackdrop and adds an opaque city image only for zero-based wave index 9. The forest layers, foreground and mood overlay are hidden only while the city is shown. Their original visibility is restored when leaving the final wave.

The city and a 30% dark navy readability overlay sit behind all gameplay objects. Both have slight same-aspect overscan for camera shakes. The scene is static: no new distracting drift or parallax. No shared forest texture is replaced in place. A failed image load/decode or drawing error keeps the original forest rather than hiding the background.

Repeated boss-wave starts reuse the same two display objects. Scene shutdown, replay, return to title and disposal clean them up. The background remains during the existing in-scene boss destruction animation, then the original standalone victory screen takes over unchanged. An authorized continue does not reset the image or boss progress.

No combat, boss HP, wave timing, scoring, abduction, account, test CC balance, pricing, entitlement or payment code is changed. No production branch, central service or deployment environment variable is modified.

## Validation performed

20 local Node tests passed against the actual new adapter with mocked Phaser scene/loader objects: image integrity, preload/cache behavior, all nine earlier waves, direct boss entry, Wave 9-to-10 transition, depth/aspect/overlay, repeated entry, restoration of hidden layers, shutdown/replay/disposal, failed load/render fallback, pause/continue independence and unchanged game-state fields.

Chromium decoded the actual AVIF at 480x720 and rendered the real adapter's image and overlay via an in-memory canvas harness, with no uncaught page errors. That harness mocks Phaser interfaces; it is not a full Phaser campaign or live preview play-through. Browser network navigation was blocked by runtime policy, so no deployed gameplay acceptance is claimed.

The preview build runs the new 20 checks before the existing build/test gates. Public/payment launch acceptance remains outstanding.

## Acceptance links

Boss-only unranked practice: https://deploy-preview-1--treeforce89.netlify.app/?wave=10&bossPractice=cannon
Normal campaign: https://deploy-preview-1--treeforce89.netlify.app/

Start the game after opening the boss-only link. Confirm the purple moon, neon skyline and waterfalls appear during Wave 10; boss/projectile warning readability is acceptable; and returning to title restores its normal forest background. Also check an ordinary Wave 1 start and a Wave 9-to-10 progression. Starting boss practice does not require a credit purchase.
