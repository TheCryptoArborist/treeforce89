import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const game=readFileSync(new URL("../app/game/arcade.ts",import.meta.url),"utf8");
const mount=readFileSync(new URL("../app/CanopyGame.tsx",import.meta.url),"utf8");

test("React forwards an optional server-issued run identifier to Phaser",()=>{
 assert.match(mount,/serverRunId\?:string/);
 assert.match(mount,/createCanopyGame\(mount\.current,\{\s*serverRunId,initialScene,/);
});
test("Phaser validates server run ID shape before accepting it",()=>{
 assert.match(game,/\^grove-\[a-f0-9\]\{32\}\$/);
 assert.match(game,/Invalid server run identifier/);
});
test("new runs prefer server ID but retain offline fallback",()=>{
 assert.match(game,/this\.game\.registry\.get\("serverRunId"\)/);
 assert.match(game,/\?\?`grove-\$\{seed\.toString\(16\)\}`/);
});
test("continued runs preserve original run state",()=>{
 assert.match(game,/this\.run=this\.resumeRun\?\{\.\.\.this\.resumeRun\}/);
});
