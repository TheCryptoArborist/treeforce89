import test from "node:test";
import assert from "node:assert/strict";
import { buildTreeContinueTransaction } from "../app/game/tree-checkout.mjs";
import { TREE_COIN_TYPE, TREE_PAYMENT_RECIPIENT } from "../app/game/tree-payment.mjs";

class FakeTransaction {
  constructor(){this.commands=[];this.pure={address:(value)=>({address:value})}}
  coin(args){this.commands.push({kind:"coin",...args});return {coin:true}}
  transferObjects(coins,to){this.commands.push({kind:"transfer",coins,to})}
}
test("checkout constructs exactly one TREE transfer to the configured recipient",()=>{
  const tx=buildTreeContinueTransaction(FakeTransaction,9);
  assert.equal(tx.commands.length,2);
  assert.deepEqual(tx.commands[0],{kind:"coin",type:TREE_COIN_TYPE,balance:20_000_000_000_000n});
  assert.deepEqual(tx.commands[1],{kind:"transfer",coins:[{coin:true}],to:{address:TREE_PAYMENT_RECIPIENT}});
});
test("checkout rejects unverified decimals",()=>assert.throws(()=>buildTreeContinueTransaction(FakeTransaction,undefined)));
test("checkout requires a transaction SDK",()=>assert.throws(()=>buildTreeContinueTransaction(undefined,9)));
