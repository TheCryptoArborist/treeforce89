# TREE FORCE '89 — Slush malicious-site warning investigation
Date: 2026-10-29 (UTC)
Status: **Open / no security clearance granted**

## Scope
- Preview origin: https://feature-tree-paid-continue--treeforce89.netlify.app
- Production origin: https://treeforce89.netlify.app
- Source: https://github.com/TheCryptoArborist/treeforce89
- Branch: `feature/tree-paid-continue`, draft PR #7.
- No production changes, no wallet-warning bypass, no real TREE payment.

## Reproduced observations (user screenshots, October 14)
1. Passive wallet detection reported Slush and did not display a malicious-site warning.
2. Isolated `StandardConnect.connect()` requested authorization and Slush displayed **Malicious website** before account access was granted.
3. No NFTree query, signing, or TREE transfer was initiated by that isolated test.
4. Screenshot of Brave extension details (October 30) showed Slush 26.21.6 (e2be7f2), enabled, extension source Web Extensions Store, site access on all sites. These permissions alone do not demonstrate compromise.

## Current source review (preliminary; not an independent deployment audit)
- `index.html` loads the local `/src/main.tsx` module; no external script tag in the checked entry HTML.
- `app/dapp-kit.ts` uses `@mysten/dapp-kit-react` and a Sui mainnet fullnode; autoConnect is false.
- `app/NFTreeGateway.tsx` requests a personal-message login signature after wallet connection, not a TREE payment.
- `app/ContinuationReview.tsx` has a disabled payment button with no payment execution handler.
- `netlify.toml` sets X-Content-Type-Options and X-Frame-Options. It does not configure a CSP. Missing CSP alone does not establish malware.
- `src/main.tsx` still exposes the older `?walletDiagnostics=connect` route, which deliberately invokes wallet connect. Recommend retiring diagnostic routes after evidence collection to reduce confusion and surface area.
- Source review does not establish that deployed assets match GitHub or that transitive dependencies are clean.

## Public Mysten blocklist review
- https://github.com/MystenLabs/wallet_blocklist
- `allowlists/domain-list.json` currently contains `wal.app` and `wal.site`; TREE FORCE origins are absent.
- Absence from the public allowlist does **not** prove a domain is on a blocklist or reveal Slush's detection vendor/rule.
- Similar unverified community allowlist request: https://github.com/MystenLabs/wallet_blocklist/issues/56 .
- Direct issue creation in the Mysten repository was attempted with the connected GitHub integration and failed with HTTP 403 (insufficient repository permissions). **No request was filed there.**

## Requested triage
1. Ask Slush/Mysten to identify whether the origin was blocked by their public list, an external reputation feed, extension heuristics, or another system.
2. Ask for classification review of the **exact preview hostname**, and production hostname for comparison.
3. Supply reproducible passive-vs-connect screenshots and Slush alert IDs privately when requested.
4. Request allowlisting **only after** maintainers' security review.

## Required independent checks before any allowlisting claim
- Retrieve deployed HTML/JS and response headers, compare artifact hashes against CI build.
- Review transitive dependency lockfile and run security advisories; inspect network requests and redirects.
- Query independent reputation providers (Google Safe Browsing, VirusTotal, urlscan) and record dates, engines, and exact URL. A clean report from one service does not override Slush.
- Reproduce in a clean browser profile with official current Slush, no other wallet extensions, using a nonvaluable test account **only after** the security team says testing is appropriate. Never bypass a warning.
- Confirm Slush support case status and provider disposition.
- Verify recipient wallet and Game Over eligibility before ever enabling TREE payments.

## GitHub issue draft for MystenLabs/wallet_blocklist
Title: `Review request: Slush malicious-site warning on TREE FORCE '89 Netlify preview`

Body:
> Please review the classification of `https://feature-tree-paid-continue--treeforce89.netlify.app`.
> Our passive wallet detection test succeeds without a warning, but a minimal
> Wallet Standard `connect()` request triggers Slush's `Malicious website`
> warning before NFTree queries, signing, or payments. Source:
> https://github.com/TheCryptoArborist/treeforce89/tree/feature/tree-paid-continue
> and draft PR https://github.com/TheCryptoArborist/treeforce89/pull/7 .
> The 20,000 TREE checkout is disabled. Please advise the block source,
> required remediation, and whether allowlisting is appropriate after review.
> We are not asking users to bypass wallet protections.

**Release gate:** Slush classification addressed; deployed code audited; real holder/non-holder tests; verified payment recipient; safe Game Over policy; atomic payment verification; production approval.
