import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/ConnectionOnlyDiagnostics.tsx",import.meta.url),"utf8");
const entry=readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
test("isolated connect diagnostic is routed independently",()=>{
  assert.match(entry,/walletDiagnostics"\)==="connect"/);
  assert.match(entry,/<ConnectionOnlyDiagnostics\s*\/>/);
});
test("connection-only page does not import NFTree ownership or payment modules",()=>{
  assert.match(page,/features\[StandardConnect\]\.connect\(\)/);
  assert.doesNotMatch(page,/nftree-access|tree-checkout|tree-payment|listOwnedObjects|transferObjects|signAndExecute/);
});
test("connection-only page does not expose account addresses",()=>{
  assert.doesNotMatch(page,/account\.address|wallet\.address|localStorage|sessionStorage/);
});
