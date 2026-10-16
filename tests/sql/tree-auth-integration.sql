-- Run ONLY against disposable CI PostgreSQL after staged schema is applied.
-- Verify single-use challenge, expiration rules, and atomic redemption rollback.
DO $$
DECLARE
  consumed integer;
  accepted integer;
BEGIN
  INSERT INTO tree_wallet_challenges(challenge_hash,wallet,message,expires_at)
  VALUES(repeat('a',64),'0x1234','TREE FORCE wallet login',now()+interval '5 minutes');
  DELETE FROM tree_wallet_challenges WHERE challenge_hash=repeat('a',64) RETURNING 1 INTO consumed;
  IF consumed IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Challenge not consumed'; END IF;
  consumed:=NULL;
  DELETE FROM tree_wallet_challenges WHERE challenge_hash=repeat('a',64) RETURNING 1 INTO consumed;
  IF consumed IS NOT NULL THEN RAISE EXCEPTION 'Challenge replay succeeded'; END IF;

  INSERT INTO tree_wallet_logins(token_hash,wallet,expires_at)
  VALUES(repeat('b',64),'0x1234',now()-interval '1 minute');
  SELECT count(*) INTO accepted FROM tree_wallet_logins
    WHERE token_hash=repeat('b',64) AND expires_at>now() AND revoked_at IS NULL;
  IF accepted <> 0 THEN RAISE EXCEPTION 'Expired login accepted'; END IF;

  INSERT INTO tree_wallet_logins(token_hash,wallet,expires_at,revoked_at)
  VALUES(repeat('c',64),'0x1234',now()+interval '30 minutes',now());
  SELECT count(*) INTO accepted FROM tree_wallet_logins
    WHERE token_hash=repeat('c',64) AND expires_at>now() AND revoked_at IS NULL;
  IF accepted <> 0 THEN RAISE EXCEPTION 'Revoked login accepted'; END IF;

  INSERT INTO tree_game_sessions(session_id,wallet,run_id,game_over,continue_pending)
  VALUES('session-integration','0x1234','grove-integration',TRUE,TRUE);
  BEGIN
    INSERT INTO tree_continue_redemptions(digest,session_id,continuation_number,wallet,run_id)
    VALUES('digest-rollback','session-integration',0,'0x1234','grove-integration');
    -- An aborted redemption must not leave a committed digest behind.
    RAISE unique_violation USING MESSAGE='simulate failed session update';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  SELECT count(*) INTO accepted FROM tree_continue_redemptions WHERE digest='digest-rollback';
  IF accepted <> 0 THEN RAISE EXCEPTION 'Aborted redemption persisted'; END IF;

  INSERT INTO tree_continue_redemptions(digest,session_id,continuation_number,wallet,run_id)
  VALUES('digest-final','session-integration',0,'0x1234','grove-integration');
  UPDATE tree_game_sessions SET continue_pending=FALSE,game_over=FALSE,
    continuation_number=continuation_number+1
  WHERE session_id='session-integration' AND continuation_number=0
    AND continue_pending=TRUE AND game_over=TRUE;
  GET DIAGNOSTICS accepted = ROW_COUNT;
  IF accepted <> 1 THEN RAISE EXCEPTION 'Continuation state not advanced'; END IF;
  SELECT count(*) INTO accepted FROM tree_game_sessions
    WHERE session_id='session-integration' AND continuation_number=1
      AND continue_pending=FALSE AND game_over=FALSE;
  IF accepted <> 1 THEN RAISE EXCEPTION 'Invalid continuation session state'; END IF;
END $$;
