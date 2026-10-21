import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const migration=readFileSync(new URL("../db/staged-migrations/20261016030500_tree_authentication.sql",import.meta.url),"utf8");
const publicSession=readFileSync(new URL("../netlify/functions/tree-session.mjs",import.meta.url),"utf8");
const publicContinue=readFileSync(new URL("../netlify/functions/tree-continue.mjs",import.meta.url),"utf8");
test("staged migration includes all authentication and payment tables",()=>{
 for(const table of ["tree_wallet_challenges","tree_wallet_logins","tree_game_sessions","tree_continue_redemptions"]){
  assert.match(migration,new RegExp("CREATE TABLE IF NOT EXISTS "+table));
 }
 assert.match(migration,/UNIQUE\(session_id,continuation_number\)/);
 assert.match(migration,/digest TEXT PRIMARY KEY/);
});
test("approved Netlify migration exactly matches validated staged SQL",()=>{
 const promoted=new URL("../netlify/database/migrations/20261016030500_tree_authentication.sql",import.meta.url);
 assert.equal(existsSync(promoted),true);
 assert.equal(readFileSync(promoted,"utf8"),migration);
});
test("public session uses guarded authentication and continuation remains disabled",()=>{
 assert.match(publicSession,/createWalletGatewayHttpHandler/);
 assert.match(publicContinue,/status:503/);
 assert.doesNotMatch(publicSession,/sessionToken:/);
 assert.doesNotMatch(publicContinue,/authorized:true/);
});
