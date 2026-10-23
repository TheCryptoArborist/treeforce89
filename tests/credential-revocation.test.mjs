import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createCredentialRevoker} from "../app/game/credential-revocation.mjs";

const loginToken="a".repeat(64),sessionToken="b".repeat(64);
function fixture({failOn="",loginRows=[{token_hash:"ok"}],sessionRows=[{session_id:"s"}]}={}){
 const calls=[];let releases=0;
 const pool={connect:async()=>({
   query:async(sql,params=[])=>{
     calls.push({sql,params});
     if(failOn&&sql.includes(failOn))throw new Error("database failure");
     if(sql.includes("UPDATE tree_wallet_logins"))return {rows:loginRows};
     if(sql.includes("UPDATE tree_game_sessions"))return {rows:sessionRows};
     return {rows:[]};
   },
   release:()=>{releases++},
 })};
 return {service:createCredentialRevoker(pool),calls,releases:()=>releases};
}
test("revokes both hashed credentials in one transaction",async()=>{
 const f=fixture();
 assert.deepEqual(await f.service.revoke({loginToken,sessionToken}),{loginRevoked:true,sessionRevoked:true});
 assert.deepEqual(f.calls.map(c=>c.sql.trim().split(/\s+/)[0]),["BEGIN","UPDATE","UPDATE","COMMIT"]);
 assert.equal(f.calls[1].params[0],createHash("sha256").update(loginToken).digest("hex"));
 assert.equal(f.calls[2].params[0],createHash("sha256").update(sessionToken).digest("hex"));
 assert.equal(f.calls[2].sql.includes("continue_pending=FALSE"),true);
 assert.equal(f.releases(),1);
});
test("logout is idempotent for already revoked credentials",async()=>{
 const f=fixture({loginRows:[],sessionRows:[]});
 assert.deepEqual(await f.service.revoke({loginToken,sessionToken}),{loginRevoked:false,sessionRevoked:false});
 assert.equal(f.calls.at(-1).sql,"COMMIT");
});
test("can revoke only a login token",async()=>{
 const f=fixture();
 assert.deepEqual(await f.service.revoke({loginToken}),{loginRevoked:true,sessionRevoked:false});
 assert.equal(f.calls.filter(c=>c.sql.includes("UPDATE")).length,1);
});
test("can revoke only a game session token",async()=>{
 const f=fixture();
 assert.deepEqual(await f.service.revoke({sessionToken}),{loginRevoked:false,sessionRevoked:true});
 assert.equal(f.calls.filter(c=>c.sql.includes("UPDATE")).length,1);
});
test("invalid or missing tokens fail before opening a DB transaction",async()=>{
 const f=fixture();
 await assert.rejects(f.service.revoke({}),/At least one credential/);
 await assert.rejects(f.service.revoke({loginToken:"invalid"}),/Invalid authentication/);
 await assert.rejects(f.service.revoke({loginToken,sessionToken:"bad"}),/Invalid authentication/);
 assert.equal(f.calls.length,0);
});
test("database failure rolls back and releases connection",async()=>{
 const f=fixture({failOn:"UPDATE tree_game_sessions"});
 await assert.rejects(f.service.revoke({loginToken,sessionToken}),/database failure/);
 assert.equal(f.calls.at(-1).sql,"ROLLBACK");
 assert.equal(f.releases(),1);
});
test("pool must support dedicated transactions",()=>{
 assert.throws(()=>createCredentialRevoker({query:async()=>{}}),/transaction pool/);
});
