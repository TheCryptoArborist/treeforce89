import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewDatabaseStatusHandler} from '../app/game/preview-database-status.mjs';

const build={context:'branch-deploy',branch:'feature/tree-paid-continue',deployId:'deploy-test'};
const context={deploy:{context:'branch-deploy',id:'deploy-test'}};
const request = method => new Request('https://preview.example/.netlify/functions/tree-database-status',{method});

test('database diagnostic denies production, other branches and mismatched deploys before connecting',async()=>{
 for(const [metadata,runtime] of [
   [{...build,context:'production'},context],
   [{...build,branch:'main'},context],
   [build,{deploy:{...context.deploy,context:'production'}}],
   [build,{deploy:{...context.deploy,id:'other'}}],
   [{...build,deployId:''},context],
   [build,undefined],
 ]) {
   let called=false;
   const handler=createPreviewDatabaseStatusHandler({build:metadata,getPool:()=>{called=true;}});
   assert.equal((await handler(request('GET'),runtime)).status,404);
   assert.equal(called,false);
 }
});

test('database diagnostic is read only, checks all tables and redemption constraints',async()=>{
 const definitions=[
  ['tree_wallet_challenges','p',['challenge_hash']],
  ['tree_wallet_logins','p',['token_hash']],
  ['tree_game_sessions','p',['session_id']],
  ['tree_game_sessions','u',['session_token_hash']],
  ['tree_game_sessions','u',['run_id']],
  ['tree_continue_redemptions','p',['digest']],
  ['tree_continue_redemptions','u',['session_id','continuation_number']],
  ['tree_continue_redemptions','f',['session_id'],'tree_game_sessions'],
 ];
 const constraints=definitions.map(([table_name,kind,columns,referenced_table])=>({table_name,kind,columns,referenced_table}));
 for(const complete of [true,false]) {
   const calls=[];
   const pool={query:async(sql,params)=>{
     calls.push(sql);
     assert.match(sql,/^\s*SELECT/);
     if(sql.includes('information_schema.tables'))return {rows:params[0].map(table_name=>({table_name}))};
     return {rows:complete ? constraints : constraints.slice(0,-1)};
   }};
   const handler=createPreviewDatabaseStatusHandler({build,getPool:()=>pool});
   const response=await handler(request('GET'),context);
   assert.equal(response.status,complete ? 200 : 503);
   const body=await response.json();
   assert.equal(body.ready,complete);
   assert.equal(body.tableCount,4);
   assert.equal(body.paymentsEnabled,false);
   assert.equal(calls.length,2);
 }
});

test('database errors cannot leak connection strings or credentials',async()=>{
 const handler=createPreviewDatabaseStatusHandler({build,getPool:()=>{throw new Error('postgres://secret:password@internal/db');}});
 const response=await handler(request('GET'),context);
 assert.equal(response.status,503);
 const body=await response.text();
 assert.doesNotMatch(body,/postgres|password|internal|secret/);
});

test('non-GET requests never reach the database',async()=>{
 let called=false;
 const handler=createPreviewDatabaseStatusHandler({build,getPool:()=>{called=true;}});
 const response=await handler(request('POST'),context);
 assert.equal(response.status,405);
 assert.equal(called,false);
});
