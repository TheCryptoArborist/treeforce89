# Wallet website-check investigation

## Application audit — 2026-10-13 UTC

The preview is a static React/Phaser game built by Vite, with protected Netlify API functions. The live HTML has one same-origin entry script, no inline scripts and no iframe injection. All 16 recursively referenced JavaScript assets were fetched from the existing preview origin and compared with a build of commit `b61d1331a91cd43911f98ea4b9bd3eb618fed4c2`; every file matched byte for byte. This establishes build provenance for those assets, not general site safety or the reason for Slush's classification.

The separate wallet package remains pinned to `@mysten/dapp-kit-core` 1.6.35 and `@mysten/sui` 2.33.2. Its production dependency audit reported zero advisories across 53 dependencies.

The root production dependency audit reported six affected package entries (one critical, four high, one moderate). The obsolete Next.js starter stack was unused: no application or API source imports Next.js, Vinext or React Server Components; Vite uses only the React plugin, and Netlify publishes `dist`. Remove the unused direct packages `next`, `eslint-config-next`, `react-server-dom-webpack`, `vinext` and `@vitejs/plugin-rsc`. The regenerated lockfile removes 348 package entries, adds no entries and changes no retained package versions.

After removal, `npm audit --omit=dev --json` reports zero production dependency advisories. All 52 built files remain byte-identical when built with the same provenance environment value. The campaign and record tests pass. These checks do not audit every development tool or prove the absence of unknown vulnerabilities. The advisories concern unused dependencies; no exploitation or relationship to the wallet website verdict was established.

Representative upstream advisory: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36. Its stated exploitation conditions involve a Windows-hosted Next.js server, which this static Netlify game does not run. Removing the unused stack avoids retaining misleading, affected starter dependencies rather than repairing a demonstrated live exploit.

## Remaining blocker

Slush's reported website block occurs at initial wallet connection, before account challenge/signature verification or TREE payment. The current published extension's connection security query and BLOCK rendering behavior are documented in `same-page-signin-preview.md`. The connection-only diagnostic preserves that check and stops before authentication or commerce.

No detection reason was obtained from the wallet provider. Removing unused dependencies does not establish that Slush has changed its verdict. No provider review submission, wallet security modification, origin replacement, alternate-wallet workaround or blockchain purchase is part of this investigation.


## Independent reputation lookup — 2026-10-13

Read-only checks used GoPlus's documented `GET /api/v1/phishing_site?url=...` endpoint, without authentication or a submitted review. The game preview root, its `/wallet-baseline.html` page, and `https://nftree.net/` each returned HTTP 200 with `code: 1`, `message: OK`, and `phishing_site: 0`. `website_contract_security` was empty. This is a negative result from that provider's phishing lookup, not proof of safety, evidence of a complete code audit, or an explanation of Slush's result. There is no established evidence that Slush uses GoPlus for this check.

Documentation: https://docs.gopluslabs.io/reference/phishingsiteusingget

Further inspection found no named Blockaid, Blowfish or GoPlus integration in the relevant published extension connection flow. Its UI obtains the security result through Slush's own GraphQL API. This does not establish whether Slush has an undisclosed upstream provider.

A remaining diagnostic dimension is browser/profile-specific reproducibility. All user-provided blocking observations come from the user's existing extension environment. A fresh browser profile with the official unmodified Slush extension and an empty, unfunded test wallet could check the exact same baseline URL with all security protections enabled. No seed import, payment, alternate hostname or warning bypass is needed. This test has not been performed. A different result would justify investigating profile, wallet-network and cache differences; the same result would strengthen reproducibility without exposing the detection rule.
