# Isolated Netlify branch preview

Netlify project: `treeforce89`.
Preview branch: `feature/tree-paid-continue`.
Production branch remains `main`; the production domain is unchanged.

Branch deploys are enabled only for this feature branch in the Netlify project settings. Pushes to this branch build an isolated branch deployment using the existing `netlify.toml` configuration (`npm run build`, publish `dist`).

Testing scope: NFTree Gateway rendering, Sui mainnet wallet detection and connection, and NFTree ownership verification.

Live 20,000 TREE payments remain disabled. This preview does not authorize enabling payment collection or paid continuation. The `tree-continue` endpoint continues to reject authorization until the trusted verifier and durable redemption storage are implemented and tested.
