# TREE FORCE '89 — preview.tree-token.xyz setup gate

Target: `https://preview.tree-token.xyz` for the existing `treeforce89` **feature/tree-paid-continue** branch. The production `tree-token` Netlify project, `tree-token.xyz`, and `www.tree-token.xyz` must remain unchanged.

## Verified before DNS change
- Netlify project `treeforce89` site ID `35f5591a-5c7d-4bc6-ae9a-3e61e816b641`.
- Separate production TREE Token project site ID `aa62f324-b880-47d6-85b8-4ba0700ff5bf`.
- Existing preview `https://feature-tree-paid-continue--treeforce89.netlify.app/`.
- Code now accepts `preview.tree-token.xyz` only when Netlify runtime metadata identifies the expected **branch-deploy** context, branch build and `treeforce89` site ID. This does not configure DNS or Netlify routing.
- Live 20,000 TREE payments remain disabled.

## Critical routing warning
**Do not add `preview.tree-token.xyz` as the primary/custom production domain of the existing `treeforce89` site.** An ordinary site custom domain may serve that site's `main` production deployment rather than the intended feature branch. It is not a substitute for branch-specific domain routing.

Netlify's documented automatic branch-deploy subdomains usually include the branch name, e.g. `feature-tree-paid-continue.preview.tree-token.xyz`, and require Netlify DNS. A simple exact hostname `preview.tree-token.xyz` may instead require a dedicated preview site with the feature branch set as its production branch, or a verified branch-specific custom-domain mapping supported by Netlify. A dedicated preview site would be a **separate Netlify site**, not a replacement for the existing site, and must have its own isolated database and site-ID security checks. **Do not create or switch sites without revisiting the backend trust guard.**

## Work/browser inspection checklist — do not change anything until these pass
1. In Netlify, inspect `treeforce89` Domain management, Branch deploy settings and the `tree-token` domain DNS zone.
2. Identify the authoritative DNS provider. Verify whether `tree-token.xyz` or a delegated subdomain is managed by Netlify DNS. Do not change apex nameservers or existing `@/www` records.
3. Determine whether Netlify supports binding the exact hostname `preview.tree-token.xyz` **only** to the existing feature branch of the existing site. If not, stop and present the supported alternative (branch-qualified hostname or separate preview site) for user approval.
4. Verify database isolation for the exact deploy context; no production DB connection string may be used.
5. Only after branch routing is proven, add the new DNS record(s) and HTTPS certificate. Validate hostname resolves to the expected branch deploy, not either production deployment.
6. Verify same-origin wallet challenge, session, logout and offer endpoints; all payment execution remains disabled.
7. Submit the new hostname for Slush security review. Do not use it to bypass a malicious-site warning.

## Approval required
- Any DNS write, custom-domain attachment or certificate change.
- Any separate preview site creation or additional paid service.
- Any database or production site change.

Reference: https://docs.netlify.com/manage/domains/configure-domains/configure-an-automatic-subdomain-for-deploys/
