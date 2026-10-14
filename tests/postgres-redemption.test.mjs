import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresContinuationStore } from "../app/game/postgres-redemption.mjs";

const digest = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const claim = {digest,sessionId:"session-1",continuationNumber:2,wallet:"0x1234",runId:"grove-123"};
const validSession = {
  wallet:"0x1234",run_id:"grove-123",continuation_number:2,
  game_over:true,cleared:false,continue_pending:true,
};

function makeDb({session=validSession,inserted=true,updated=true,failAt=""}={}) {
  const commands=[];
  let released=0;
  const db={
    async query(sql,params=[]) {
      commands.push({sql,params});
      if(failAt && sql.includes(failAt)) throw new Error("database unavailable");
      if(sql.includes("FOR UPDATE")) return {rows:session?[session]:[]};
      if(sql.includes("INSERT INTO")) return {rows:inserted?[{digest}]:[]};
      if(sql.includes("UPDATE tree_game_sessions")) return {rows:updated?[{session_id:"session-1"}]:[]};
      return {rows:[]};
    },
    release(){released++},
  };
  return {pool:{connect:async()=>db},commands,releaseCount:()=>released};
}

test("atomic redemption commits once with row lock, unique insert and update",async()=>{
  const db=makeDb();
  const result=await createPostgresContinuationStore(db.pool).consumeOnce(claim);
  assert.equal(result,true);
  assert.deepEqual(db.commands.map(c=>c.sql.trim().split(/\s+/)[0]),["BEGIN","SELECT","INSERT","UPDATE","COMMIT"]);
  assert.match(db.commands[1].sql,/FOR UPDATE/);
  assert.match(db.commands[2].sql,/ON CONFLICT DO NOTHING/);
  assert.equal(db.releaseCount(),1);
});
test("already redeemed digest rolls back without session update",async()=>{
  const db=makeDb({inserted:false});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
  assert.deepEqual(db.commands.map(c=>c.sql.trim().split(/\s+/)[0]),["BEGIN","SELECT","INSERT","ROLLBACK"]);
  assert.equal(db.releaseCount(),1);
});
test("wrong wallet fails closed before insert",async()=>{
  const db=makeDb({session:{...validSession,wallet:"0x9876"}});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
  assert.equal(db.commands.some(c=>c.sql.includes("INSERT INTO")),false);
});
test("already continued session cannot redeem again",async()=>{
  const db=makeDb({session:{...validSession,continue_pending:false}});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
});
test("stale continuation counter is rejected",async()=>{
  const db=makeDb({session:{...validSession,continuation_number:3}});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
});
test("missing server session is rejected",async()=>{
  const db=makeDb({session:null});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
});
test("failed conditional update rolls back the inserted digest",async()=>{
  const db=makeDb({updated:false});
  assert.equal(await createPostgresContinuationStore(db.pool).consumeOnce(claim),false);
  assert.equal(db.commands.at(-1).sql,"ROLLBACK");
});
test("database failure rolls back and releases connection",async()=>{
  const db=makeDb({failAt:"INSERT INTO"});
  await assert.rejects(createPostgresContinuationStore(db.pool).consumeOnce(claim),/database unavailable/);
  assert.equal(db.commands.at(-1).sql,"ROLLBACK");
  assert.equal(db.releaseCount(),1);
});
test("invalid digest and counter rejected before opening connection",async()=>{
  const db=makeDb();
  const store=createPostgresContinuationStore(db.pool);
  await assert.rejects(store.consumeOnce({...claim,digest:"invalid"}),/Invalid transaction digest/);
  await assert.rejects(store.consumeOnce({...claim,continuationNumber:-1}),/Invalid continuation counter/);
  assert.equal(db.commands.length,0);
});
