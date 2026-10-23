import assert from 'node:assert/strict';
import pg from 'pg';
import {createPreviewDatabaseStatusHandler} from '../../app/game/preview-database-status.mjs';

// Runs only against the disposable PostgreSQL service configured by CI.
if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'tree_auth_test') {
  throw new Error('This integration test requires the disposable CI database');
}
const pool = new pg.Pool();
try {
  const build={context:'branch-deploy',branch:'feature/tree-paid-continue',deployId:'ci'};
  const handler=createPreviewDatabaseStatusHandler({build,getPool:()=>pool});
  const response=await handler(new Request('https://preview.example/status'),{
    deploy:{context:'branch-deploy',id:'ci'},
  });
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.ready,true);
  assert.equal(result.tableCount,4);
  assert.equal(Object.keys(result.constraints).length,8);
  assert.equal(Object.values(result.constraints).every(Boolean),true);
  console.log('Real PostgreSQL: all four tables and eight constraint checks passed');
} finally {
  await pool.end();
}
