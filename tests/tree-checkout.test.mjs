import test from "node:test";
import assert from "node:assert/strict";
import { buildTreeContinueTransaction } from "../app/game/tree-checkout.mjs";
import { TREE_COIN_TYPE, TREE_PAYMENT_RECIPIENT } from "../app/game/tree-payment.mjs";

class FakeTransaction {
  constructor(){this.commands=[];this.pure={address:(value)=>({address:value})}}
  coin(args){this.commands.push({type:"coin",...args});return {coin:true}}
  transferObjects(coins,to){this.commands.push({type:"transfer",coins,to})}
}
test("checkout builds TREE transfer without spending SUI gas as payment",()=>{
  const tx=buildTreeContinueTransaction(FakeTransaction,9);
  assert.equal(tx.commands.length,2);
  assert.equal(tx.commands[0].type,"coin");
  assert.equal(tx.commands[0].type,"coin");
  assert.equal(tx.commands[0].balance,20_000_000_000_000n);
  assert.equal(tx.commands[0].type === "coin" && tx.commands[0].type !== "gas",true);
  assert.equal(tx.commands[0].type,"coin");
  assert.equal(tx.commands[0].coins,undefined);
  assert.equal(tx.commands[0].balance,20_000n*10n**9n);
  assert.equal(tx.commands[1].to.address,TREE_PAYMENT_RECIPIENT);
  assert.equal(tx.commands[1].coins[0].coin,true);
  assert.equal(tx.commands[0].type,"coin");
});
test("checkout rejects unverified decimals",()=>assert.throws(()=>buildTreeContinueTransaction(FakeTransaction,undefined)));
test("checkout requires a transaction SDK",()=>assert.throws(()=>buildTreeContinueTransaction(undefined,9)));
