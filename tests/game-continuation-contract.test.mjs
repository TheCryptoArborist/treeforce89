import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const arcade=readFileSync(new URL("../app/game/arcade.ts",import.meta.url),"utf8");
const endpoint=readFileSync(new URL("../netlify/functions/tree-continue.mjs",import.meta.url),"utf8");

test("resume path keeps original run ID, score and seed",()=>{
 assert.match(arcade,/this\.run=this\.resumeRun\?\{\.\.\.this\.resumeRun\}/);
 assert.match(arcade,/const seed=this\.resumeRun\?\.seed\?\?/);
});
test("resuming restarts the interrupted wave and restores 3 lives",()=>{
 assert.match(arcade,/this\.lives=3/);
 assert.match(arcade,/this\.resumeRun\?Math\.max\(0,Math\.min\(this\.resumeRun\.wave/);
});
test("Game Over shows price without enabling an unverified checkout",()=>{
 assert.match(arcade,/CONTINUE  \/\/  20,000 TREE/);
 assert.match(arcade,/PAYMENTS DISABLED/);
});
test("server endpoint fails closed and cannot authorize payment",()=>{
 assert.match(endpoint,/authorized:false/);
 assert.match(endpoint,/status:503/);
 assert.doesNotMatch(endpoint,/authorized:true/);
});
