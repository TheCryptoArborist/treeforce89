import test from "node:test";
import assert from "node:assert/strict";
import {checkTreePreviewDatabase} from "../app/game/preview-database-preflight.mjs";

const required=["tree_wallet_challenges","tree_wallet_logins","tree_game_sessions","tree_continue_redemptions"];
function setup({rows=required.map(table_name=>({table_name})),deployContext="branch-deploy",branch="feature/tree-paid-continue",databaseIsolationConfirmed=true}={}){
 const calls=[];
 const pool={query:async(sql,params)=>{calls.push({sql,params});return {rows}}};
 return {calls,params:{pool,deployContext,branch,databaseIsolationConfirmed}};
}
test("read-only preflight accepts isolated preview database with all tables",async()=>{
 const {calls,params}=setup();
 assert.deepEqual(await checkTreePreviewDatabase(params),{ready:true,branch:"feature/tree-paid-continue",tableCount:4});
 assert.match(calls[0].sql,/information_schema\.tables/);
 assert.doesNotMatch(calls[0].sql,/INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/);
});
test("refuses production deploy before touching database",async()=>{
 const {calls,params}=setup({deployContext:"production",branch:"main"});
 await assert.rejects(checkTreePreviewDatabase(params),/outside the approved preview branch/);
 assert.equal(calls.length,0);
});
test("refuses unverified database isolation",async()=>{
 const {calls,params}=setup({databaseIsolationConfirmed:false});
 await assert.rejects(checkTreePreviewDatabase(params),/isolation has not been verified/);
 assert.equal(calls.length,0);
});
test("refuses missing authentication table",async()=>{
 const {params}=setup({rows:required.slice(1).map(table_name=>({table_name}))});
 await assert.rejects(checkTreePreviewDatabase(params),/schema is incomplete/);
});
test("requires database pool",async()=>{
 const {params}=setup();
 await assert.rejects(checkTreePreviewDatabase({...params,pool:null}),/PostgreSQL pool/);
});
test("refuses other branch deploys",async()=>{
 const {params}=setup({branch:"feature/other"});
 await assert.rejects(checkTreePreviewDatabase(params),/outside the approved preview branch/);
});
