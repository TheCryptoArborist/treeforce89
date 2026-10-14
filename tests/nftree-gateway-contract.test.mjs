import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../app/NFTreeGateway.tsx",import.meta.url),"utf8");
test("game is rendered only for NFTree-eligible wallet",()=>{
 assert.match(source,/if\(connection\?\.eligible\)/);
 assert.match(source,/<CanopyGame(?:\\s+[^>]*)?\\s*\\/>/);
});
test("wallet account switch invalidates gateway session",()=>{
 assert.match(source,/wallet\.accounts/);
 assert.match(source,/setConnection\(null\)/);
 assert.match(source,/Wallet account changed or disconnected/);
});
test("wallet connection failure clears eligibility",()=>{
 assert.match(source,/catch\(e\)\{setConnection\(null\)/);
});
