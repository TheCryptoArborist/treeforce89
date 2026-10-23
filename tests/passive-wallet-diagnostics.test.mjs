import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const passive=readFileSync(new URL("../app/PassiveWalletDiagnostics.tsx",import.meta.url),"utf8");
const entry=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");

test("passive diagnostic route is isolated from the gateway",()=>{
  assert.match(entry,/walletDiagnostics"\)=== "passive"|walletDiagnostics"\)==="passive"/);
  assert.match(entry,/<PassiveWalletDiagnostics\s*\/>/);
});
test("passive diagnostic has no connection, signing or NFT ownership imports",()=>{
  assert.match(passive,/getWallets\(\)\.get\(\)/);
  assert.doesNotMatch(passive,/from "\.\/game\/nftree-wallet"/);
  assert.doesNotMatch(passive,/\.connect\s*\(/);
  assert.doesNotMatch(passive,/signAndExecute|signPersonalMessage|checkDirectNFTreeOwnership|listOwnedObjects|transferObjects/);
});
test("passive diagnostic never requests a wallet account address",()=>{
  assert.doesNotMatch(passive,/wallet\.accounts|account\.address|wallet\.address/);
});
