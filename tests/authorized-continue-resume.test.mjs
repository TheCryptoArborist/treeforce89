import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedContinue} from "../app/game/authorized-continue-resume.mjs";

const run={runId:"grove-"+"a".repeat(32),seed:42,score:18000,wave:6,kills:51,
  perfect:2,maxStage:3,shotsFired:80,shotsHit:59,start:1760000000000,mode:"ARCADE"};
const grant={authorized:true,runId:run.runId,lives:3,wave:6};
test("verified continuation preserves the original run, score and interrupted wave",()=>{
  const resumed=prepareAuthorizedContinue(run,grant);
  assert.deepEqual(resumed,run);
  assert.notEqual(resumed,run);
});
test("rejects authorization missing or disabled",()=>{
  for(const candidate of [null,{}, {...grant,authorized:false},{...grant,lives:2}])
    assert.throws(()=>prepareAuthorizedContinue(run,candidate),/authorized|Missing/);
});
test("rejects wrong run or wave",()=>{
  assert.throws(()=>prepareAuthorizedContinue(run,{...grant,runId:"grove-"+"b".repeat(32)}),/run does not match/);
  assert.throws(()=>prepareAuthorizedContinue(run,{...grant,wave:5}),/wave does not match/);
});
test("rejects forged completed run or out-of-bounds wave",()=>{
  assert.throws(()=>prepareAuthorizedContinue({...run,cleared:true},grant),/Completed/);
  assert.throws(()=>prepareAuthorizedContinue(run,{...grant,cleared:true}),/Completed/);
  assert.throws(()=>prepareAuthorizedContinue({...run,wave:10},{...grant,wave:10}),/wave does not match/);
});
test("rejects malformed or impossible game state",()=>{
  for(const value of [{...run,score:-1},{...run,score:1.5},{...run,shotsHit:100},
    {...run,maxStage:9},{...run,seed:NaN},{...run,mode:"ADMIN"}])
    assert.throws(()=>prepareAuthorizedContinue(value,grant),/Invalid/);
});
test("does not pass browser-injected wallet, payment or authorization fields into Phaser",()=>{
  const resumed=prepareAuthorizedContinue({...run,wallet:"0x999",paid:true,authorized:true,continuePending:true},grant);
  assert.deepEqual(Object.keys(resumed).sort(),Object.keys(run).sort());
  assert.equal("wallet" in resumed,false);
  assert.equal("paid" in resumed,false);
});
test("does not mutate original interrupted run",()=>{
  const original=structuredClone(run);
  prepareAuthorizedContinue(run,grant);
  assert.deepEqual(run,original);
});
