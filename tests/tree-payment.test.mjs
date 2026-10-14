import test from "node:test";
import assert from "node:assert/strict";
import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT,treeBaseUnits,validateContinuationClaim,validateObservedPayment} from "../app/game/tree-payment.mjs";

const wallet="0x1234";
const digest="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijk";
const claim={digest,wallet,runId:"grove-123"};
const expected={wallet,runId:"grove-123",network:"mainnet",gameOver:true,cleared:false,decimals:9};
const observed={network:"mainnet",success:true,sender:wallet,coinType:TREE_COIN_TYPE,recipient:TREE_PAYMENT_RECIPIENT,amount:"20000000000000"};

test("20,000 TREE is represented exactly in base units",()=>assert.equal(treeBaseUnits(9),20_000_000_000_000n));
test("eligible claim",()=>assert.equal(validateContinuationClaim(claim,expected).runId,"grove-123"));
test("reject wrong run",()=>assert.throws(()=>validateContinuationClaim({...claim,runId:"other"},expected)));
test("reject wrong wallet",()=>assert.throws(()=>validateContinuationClaim({...claim,wallet:"0x5678"},expected)));
test("reject completed run",()=>assert.throws(()=>validateContinuationClaim(claim,{...expected,cleared:true})));
test("reject not-game-over",()=>assert.throws(()=>validateContinuationClaim(claim,{...expected,gameOver:false})));
test("reject testnet",()=>assert.throws(()=>validateContinuationClaim(claim,{...expected,network:"testnet"})));
test("accept observed payment facts",()=>assert.equal(validateObservedPayment(observed,expected),true));
test("reject wrong recipient",()=>assert.throws(()=>validateObservedPayment({...observed,recipient:"0x9876"},expected)));
test("reject wrong token",()=>assert.throws(()=>validateObservedPayment({...observed,coinType:"0x2::sui::SUI"},expected)));
test("reject insufficient payment",()=>assert.throws(()=>validateObservedPayment({...observed,amount:"19999999999999"},expected)));
test("reject failed transaction",()=>assert.throws(()=>validateObservedPayment({...observed,success:false},expected)));
test("reject wrong sender",()=>assert.throws(()=>validateObservedPayment({...observed,sender:"0x9876"},expected)));
test("reject unverified decimals",()=>assert.throws(()=>treeBaseUnits(undefined)));
