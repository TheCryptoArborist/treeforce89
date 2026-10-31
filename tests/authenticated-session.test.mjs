import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createAuthenticatedSessionResolver} from "../app/game/authenticated-session.mjs";

const token="a".repeat(64);
const row={session_id:"session-1",wallet:"0x1234",run_id:"grove-123",wave:5,
  created_at:new Date(1700000000000),expires_at:new Date(1900000000000),continuation_number:2,game_over:true,cleared:false,continue_pending:true};
function makePool(rows=[row]){
 const calls=[];
 return {calls,query:async(sql,params)=>{calls.push({sql,params});return {rows}}};
}
test("valid session token resolves authoritative database fields",async()=>{
 const pool=makePool();
 const session=await createAuthenticatedSessionResolver(pool)({sessionToken:token});
 assert.equal(session.wallet.length,66);
 assert.equal(session.wave,5);
 assert.equal(session.continuePending,true);
 assert.equal(pool.calls[0].params[0],createHash("sha256").update(token).digest("hex"));
 assert.equal(pool.calls[0].sql.includes("expires_at > NOW()"),true);
 assert.equal(pool.calls[0].params[0].includes(token),false);
});
test("missing or malformed token never queries DB",async()=>{
 const pool=makePool();const resolver=createAuthenticatedSessionResolver(pool);
 await assert.rejects(resolver({}),/token/);
 await assert.rejects(resolver({sessionToken:"short"}),/token/);
 assert.equal(pool.calls.length,0);
});
test("unknown or expired token fails closed",async()=>{
 await assert.rejects(createAuthenticatedSessionResolver(makePool([]))({sessionToken:token}),/expired or not authenticated/);
});
test("duplicate session token lookup fails closed",async()=>{
 await assert.rejects(createAuthenticatedSessionResolver(makePool([row,row]))({sessionToken:token}),/expired or not authenticated/);
});
test("invalid session counter fails closed",async()=>{
 await assert.rejects(createAuthenticatedSessionResolver(makePool([{...row,continuation_number:-1}]))({sessionToken:token}),/Invalid authoritative/);
});
test("requires database connection",()=>{
 assert.throws(()=>createAuthenticatedSessionResolver(null),/PostgreSQL/);
});
