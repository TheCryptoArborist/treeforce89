import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'treeforce-campaign-test-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
for (const name of ['config', 'campaign-art', 'campaign-polish']) {
  const source = fs.readFileSync(path.join(root, 'app/game', `${name}.ts`), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true, fileName: `${name}.ts`,
  });
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
}
const require = createRequire(import.meta.url);
const { installCampaignPolish, blocksBoomGunfire, accuracyLabel, timeLabel } = require(path.join(temp, 'campaign-polish.js'));
const bus = () => ({ once() {}, on() {}, off() {} });
function fixture(failBind = false) {
  const shots = {}, pickups = {}, player = {}, enemies = {}, colliders = [];
  const factory = { overlap(a, b) { const c = { object1: a, object2: b, active: true }; colliders.push(c); return c; } };
  const originalOverlap = factory.overlap;
  const play = {
    stage: 0, lives: 3, paused: false, run: { wave: 0 }, shots, pickups,
    create() { this.run = { wave: 0, score: 0, shotsFired: 0 }; },
    bindCollisions() {
      this.physics.add.overlap(shots, enemies); this.physics.add.overlap(player, pickups); this.physics.add.overlap(shots, pickups);
      if (failBind) throw new Error('binding failed');
    },
    physics: { add: factory, world: { resume() {} } }, textures: { exists() { return true; } }, events: bus(),
    setLesson(message) { this.lastLesson = message; }, spawnCanopyTyrant() {}, addBossDamage() {}, hitEnemy() {}, updateEnemies() {}, roundSequence() {}, endRun() {}, damagePlayer() {}, togglePause() {},
  };
  const end = { create() { this.originalEndCalled = true; } };
  const registered = new Map();
  const game = {
    scene: { getScene(key) { return key === 'game' ? play : end; } }, events: bus(),
    registry: { get: k => registered.get(k), set: (k, v) => registered.set(k, v) },
  };
  play.game = game;
  installCampaignPolish(game);
  return { play, end, game, shots, pickups, player, enemies, colliders, factory, originalOverlap };
}
test('only shot/pickup pairs are disabled; both argument orders work', () => {
  const { shots, pickups, player, enemies } = fixture();
  assert.equal(blocksBoomGunfire(shots, pickups, shots, pickups), true);
  assert.equal(blocksBoomGunfire(pickups, shots, shots, pickups), true);
  assert.equal(blocksBoomGunfire(player, pickups, shots, pickups), false);
  assert.equal(blocksBoomGunfire(shots, enemies, shots, pickups), false);
});
test('BOOM shots do not consume projectiles or tokens; player contact stays enabled', () => {
  const f = fixture(); f.play.bindCollisions();
  assert.deepEqual(f.colliders.map(c => c.active), [true, true, false]);
  assert.equal(f.factory.overlap, f.originalOverlap);
  let destroyed = false; f.play.airburstBoom({ destroy() { destroyed = true; } }); assert.equal(destroyed, false);
});
test('collision factory is restored even when existing binding fails', () => {
  const f = fixture(true); assert.throws(() => f.play.bindCollisions(), /binding failed/);
  assert.equal(f.factory.overlap, f.originalOverlap);
});
test('only outdated BOOM instructions change', () => {
  const { play } = fixture();
  play.setLesson('$BOOM // CATCH FOR DEFENSE OR SHOOT HIGH FOR A SCREEN CLEAR', 3600);
  assert.equal(play.lastLesson, '$BOOM // TOUCH WITH ARBORWING TO CLEAR ENEMY FIRE');
  play.setLesson('SOVEREIGN CITY // CATCH FOR A 3 SECOND GHOST SHIELD');
  assert.equal(play.lastLesson, 'SOVEREIGN CITY // CATCH FOR A 3 SECOND GHOST SHIELD');
});
test('replay resets lives, growth, pause state and the formerly uninitialized hit counter', () => {
  const { play } = fixture(); play.stage = 4; play.lives = 0; play.paused = true; play.create();
  assert.equal(play.stage, 0); assert.equal(play.lives, 3); assert.equal(play.paused, false); assert.equal(play.run.shotsHit, 0);
  play.clearedRows.add(3); play.stage = 2; play.create(); assert.equal(play.stage, 0); assert.equal(play.clearedRows.size, 0);
});
test('original defeat screen is retained', () => { const { end } = fixture(); end.create({ cleared: false, run: {} }); assert.equal(end.originalEndCalled, true); });
test('installation is idempotent', () => { const { game, play } = fixture(); const before = play.bindCollisions; installCampaignPolish(game); assert.equal(play.bindCollisions, before); });
test('accuracy and duration cannot display NaN or Infinity', () => {
  assert.equal(accuracyLabel(8, 10), '80%'); assert.equal(accuracyLabel(NaN, 10), '0%');
  assert.equal(accuracyLabel(0, 0), '—'); assert.equal(accuracyLabel(11, 10), '100%');
  assert.equal(timeLabel(185999), '3:05'); assert.equal(timeLabel(NaN), '0:00');
});
