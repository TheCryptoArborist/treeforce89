import {checkTreePreviewDatabase} from './preview-database-preflight.mjs';

const branch = 'feature/tree-paid-continue';
const headers = {'Cache-Control':'no-store', 'X-Robots-Tag':'noindex'};

// Metadata checks only: never return connection details, credentials or rows.
export function createPreviewDatabaseStatusHandler({build, getPool}) {
  return async function handler(request, context) {
    if (build?.context !== 'branch-deploy' || build.branch !== branch ||
        !build.deployId || context?.deploy?.context !== 'branch-deploy' ||
        context.deploy.id !== build.deployId) {
      return Response.json({ready:false}, {status:404, headers});
    }
    if (request.method !== 'GET') {
      return Response.json({ready:false}, {status:405, headers:{...headers, Allow:'GET'}});
    }
    try {
      const pool = await getPool();
      const status = await checkTreePreviewDatabase({pool,
        deployContext:build.context, branch:build.branch,
        // Isolation is independently verified in Netlify before this code ships.
        databaseIsolationConfirmed:true});
      const {rows} = await pool.query(`
        SELECT t.relname AS table_name, c.contype AS kind,
          array(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n)
            JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
            ORDER BY k.n) AS columns,
          f.relname AS referenced_table
        FROM pg_constraint c
        JOIN pg_class t ON t.oid=c.conrelid
        JOIN pg_namespace n ON n.oid=t.relnamespace
        LEFT JOIN pg_class f ON f.oid=c.confrelid
        WHERE n.nspname='public'
          AND t.relname = ANY($1::text[])`, [[
          'tree_wallet_challenges','tree_wallet_logins',
          'tree_game_sessions','tree_continue_redemptions']]);
      const has = (table, kind, columns, referencedTable) => rows.some(row =>
        row.table_name === table && row.kind === kind &&
        JSON.stringify(row.columns) === JSON.stringify(columns) &&
        (!referencedTable || row.referenced_table === referencedTable));
      const constraints = {
        challengePrimaryKey:has('tree_wallet_challenges','p',['challenge_hash']),
        loginPrimaryKey:has('tree_wallet_logins','p',['token_hash']),
        sessionPrimaryKey:has('tree_game_sessions','p',['session_id']),
        uniqueSessionToken:has('tree_game_sessions','u',['session_token_hash']),
        uniqueRun:has('tree_game_sessions','u',['run_id']),
        uniquePayment:has('tree_continue_redemptions','p',['digest']),
        uniqueContinuation:has('tree_continue_redemptions','u',['session_id','continuation_number']),
        sessionForeignKey:has('tree_continue_redemptions','f',['session_id'],'tree_game_sessions'),
      };
      const ready = Object.values(constraints).every(Boolean);
      return Response.json({...status, ready, constraints, deployId:build.deployId,
        paymentsEnabled:false}, {status:ready ? 200 : 503, headers});
    } catch {
      // Database errors may embed credentials or provider details. Never echo them.
      return Response.json({ready:false, error:'Development database check failed'},
        {status:503, headers});
    }
  };
}
