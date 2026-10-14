-- Example PostgreSQL schema for a future trusted continuation service.
-- This is not deployed and is NOT connected to the Netlify endpoint.
-- An authenticated game session must be created server-side.
CREATE TABLE IF NOT EXISTS tree_game_sessions (
  session_id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  session_token_hash CHAR(64) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  run_id TEXT NOT NULL,
  wave INTEGER NOT NULL CHECK (wave >= 0),
  continuation_number INTEGER NOT NULL DEFAULT 0 CHECK (continuation_number >= 0),
  game_over BOOLEAN NOT NULL DEFAULT FALSE,
  cleared BOOLEAN NOT NULL DEFAULT FALSE,
  continue_pending BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tree_continue_redemptions (
  digest TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES tree_game_sessions(session_id),
  continuation_number INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  run_id TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, continuation_number)
);

-- Redemption must be implemented as one DB transaction:
-- 1) SELECT session FOR UPDATE, validate ownership, pending flag, counter.
-- 2) INSERT redemption (digest PK and session/counter unique).
-- 3) UPDATE session SET continue_pending=false, game_over=false,
--      continuation_number=continuation_number+1.
-- 4) COMMIT. Roll back on any conflict.
-- Session state must not be writable directly by an unauthenticated browser.

-- Session tokens must be generated with cryptographically secure randomness
-- by a trusted backend AFTER verifying a signed wallet-login challenge.
-- Only the SHA-256 token hash is stored. Session issuance and wallet-signature
-- validation are not implemented yet; the public payment endpoint stays disabled.
-- Add session_token_hash / expires_at via a reviewed migration for existing DBs.

-- Wallet authentication challenges. The backend must store only a hash of
-- each cryptographically random nonce. Issue challenge and consume atomically.
CREATE TABLE IF NOT EXISTS tree_wallet_challenges (
  challenge_hash CHAR(64) PRIMARY KEY,
  wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- consumeOnce(challenge_hash) must DELETE ... WHERE challenge_hash=$1
-- RETURNING wallet,message,expires_at inside a DB transaction.
-- Verification failure must NOT restore a consumed challenge.
-- Signature validation and credential issuance remain to be implemented.
