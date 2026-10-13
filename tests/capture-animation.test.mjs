import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { CAPTURE_FX, capturePose, drawTractorBeam, installCaptureAnimation } from '../app/game/capture-animation.mjs';

function object(name = '') {
  const data = new Map();
  const o = { name, active: true, visible: true, x: 240, y: 570, angle: 0, scaleX: 1.75, scaleY: 1.75,
    alpha: 1, texture: { key: 'playerSheet' }, frame: { name: 0 }, calls: [], body: { enable: true },
    displayWidth: 224, displayHeight: 280, height: 350,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; },
    setAngle(a) { this.angle = a; return this; }, setVisible(v) { this.visible = v; return this; },
    setDepth(v) { this.depth = v; return this; }, setName(v) { this.name = v; return this; },
    setAlpha(v) { this.alpha = v; return this; }, setTint(v) { this.tint = v; return this; },
    getData(k) { return data.get(k); }, setData(k, v) { data.set(k, v); return this; },
    clear() { this.calls = []; return this; }, destroy() { this.active = false; this.destroyed = true; },
  };
  for (const k of ['fillStyle', 'fillRect', 'fillTriangle', 'lineStyle', 'lineBetween', 'strokeEllipse', 'fillCircle', 'fillEllipse'])
    o[k] = function (...args) { this.calls.push({ op: k, args }); return this; };
  return o;
}
function fixture({ quiet = false } = {}) {
  const made = [], counters = { capture: 0, rescue: 0 }, timers = [], tweens = [];
  const events = new EventEmitter();
  const s = {
    events: new EventEmitter(), paused: false, waveClearing: false, physics: { world: { isPaused: false } },
    add: { graphics() { const o = object(); made.push(o); return o; }, image(x, y, key, frame) {
      const o = object(); o.setPosition(x, y); o.texture.key = key; o.frame.name = frame; made.push(o); return o;
    } },
    create() { this.player = object('player'); this.lives = 3; this.weaponLevel = 2; this.run = { score: 9120, wave: 2 };
      this.snareEnemy = object('captor').setPosition(240, 245); this.snareEnemy.hp = 6;
      this.snareBeam = object('beam').setPosition(240, 444); this.snareEnemy.setData('snareUntil', 4000);
      this.capturedWing = undefined; this.rescuedWing = undefined; this.grafted = false;
    },
    capturePlayer(e) {
      if (!this.player.active) return;
      counters.capture++; this.snareBeam.destroy(); this.snareBeam = undefined;
      this.capturedWing = object('captive').setPosition(e.x, e.y + 45);
      this.capturedWing.body.enable = true; this.lives--; this.weaponLevel--;
      this.player.active = false; this.player.visible = false; this.player.body.enable = false;
      e.setData('holding', true).setData('corruptionHits', 0);
      tweens.push({ duration: 600, y: -55 }); timers.push(this.lives <= 0 ? 750 : 900);
    },
    rescueCapturedWing(e) {
      if (e !== this.snareEnemy || !this.capturedWing?.active || !e.getData('rescueWindow')) return;
      counters.rescue++; this.capturedWing.destroy(); this.capturedWing = undefined;
      this.snareEnemy = undefined; this.rescuedWing = object('companion').setPosition(300, 570);
      this.grafted = true; this.run.score += 2500;
    },
  };
  const game = { events, scene: { getScene: () => s } }, originalCapture = s.capturePlayer;
  const dispose = installCaptureAnimation(game, { reducedMotion: () => quiet }); s.create();
  function tick(delta = 16) { s.events.emit('postupdate', 0, delta); }
  function step(ms) { for (let t = 0; t < ms; t += 20) tick(Math.min(20, ms - t)); }
  const named = name => made.find(o => o.active && o.name === name);
  return { game, s, made, counters, timers, tweens, tick, step, named, dispose, originalCapture };
}
const start = { x: 240, y: 570, scaleX: 1.75, scaleY: 1.75, angle: 0 };
const dock = { x: 160, y: 140, scaleX: 1.75, scaleY: 1.75, angle: 10 };

test('lift starts at the actual player, not at the captive socket', () => {
  assert.deepEqual(capturePose(start, dock, 0), { ...start, progress: 0 });
});
test('lift finishes at the moving socket inside the original 600ms departure', () => {
  const p = capturePose(start, dock, CAPTURE_FX.liftMs);
  assert.ok(CAPTURE_FX.liftMs < 600); assert.equal(p.x, dock.x); assert.equal(p.y, dock.y); assert.equal(p.angle, dock.angle);
});
test('mid-lift includes visible bank and compression, with no off-path vertical overshoot', () => {
  const p = capturePose(start, dock, 230); assert.notEqual(p.angle, 0); assert.ok(p.scaleX < start.scaleX);
  assert.ok(p.y > dock.y && p.y < start.y);
});
test('reduced motion suppresses roll and stretch and keeps the same timing', () => {
  const d = { ...dock, angle: 0 }, p = capturePose(start, d, 230, true);
  assert.equal(p.angle, 0); assert.equal(p.scaleX, start.scaleX); assert.equal(p.scaleY, start.scaleY);
  assert.equal(capturePose(start, d, 520, true).y, d.y);
});
test('capture lane stays 72px wide, with a projector at the underside of the captor', () => {
  const g = object(); drawTractorBeam(g, 240, 269, 619, 100);
  assert.ok(g.calls.some(c => c.op === 'fillRect' && c.args.join() === '204,269,72,350'));
  assert.ok(g.calls.some(c => c.op === 'lineBetween' && c.args.join() === '204,269,204,619'));
  assert.ok(g.calls.some(c => c.op === 'fillEllipse' && c.args.join() === '240,269,14,6'));
});
test('reduced beam uses fewer drawing operations without removing boundaries', () => {
  const a = object(), b = object(); drawTractorBeam(a, 240, 269, 619, 100); drawTractorBeam(b, 240, 269, 619, 100, true);
  assert.ok(b.calls.length < a.calls.length); assert.equal(b.calls.filter(c => c.op === 'fillCircle').length, 0);
});
test('beam replacement does not alter the real lane, expiry or life count', () => {
  const f = fixture(), beam = f.s.snareBeam; f.tick();
  assert.equal(beam.visible, false); assert.equal(beam.active, true); assert.equal(beam.x, 240); assert.equal(beam.height, 350);
  assert.equal(f.s.snareEnemy.getData('snareUntil'), 4000); assert.equal(f.s.lives, 3); f.dispose(); assert.equal(beam.visible, true);
});
test('capture decrements life and weapon exactly once and preserves existing game timers', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.s.capturePlayer(f.s.snareEnemy);
  assert.equal(f.counters.capture, 1); assert.equal(f.s.lives, 2); assert.equal(f.s.weaponLevel, 1);
  assert.deepEqual(f.timers, [900]); assert.deepEqual(f.tweens, [{ duration: 600, y: -55 }]);
});
test('lift is display-only: physical captive remains active at its logical location', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); const captive = f.s.capturedWing;
  assert.equal(captive.visible, false); assert.equal(captive.active, true); assert.equal(captive.body.enable, true); assert.equal(captive.y, 290);
  assert.equal(f.named('root-capture-lift').y, 570); f.step(240);
  assert.ok(f.named('root-capture-lift').y < 570); assert.equal(captive.y, 290); assert.equal(f.s.run.score, 9120);
});
test('uses the correct original texture, growth frame and size', () => {
  const f = fixture(); f.s.player.frame.name = 4; f.s.player.setScale(1.35); f.s.capturePlayer(f.s.snareEnemy);
  const image = f.named('root-capture-lift'); assert.equal(image.texture.key, 'playerSheet'); assert.equal(image.frame.name, 4); assert.equal(image.scaleX, 1.35);
});
test('docking reveals the real captive and removes all temporary wing images', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.step(520);
  assert.equal(f.s.capturedWing.visible, true); assert.equal(f.named('root-capture-lift'), undefined);
  assert.equal(f.made.filter(o => o.active && o.name.startsWith('root-capture-trail')).length, 0);
});
test('pause and physics pause freeze the added visual animation', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.step(200);
  const before = f.named('root-capture-lift').y; f.s.paused = true; f.tick(3000);
  assert.equal(f.named('root-capture-lift').y, before); f.s.paused = false; f.s.physics.world.isPaused = true; f.tick(3000);
  assert.equal(f.named('root-capture-lift').y, before); f.s.physics.world.isPaused = false; f.step(320); assert.equal(f.s.capturedWing.visible, true);
});
test('last-life capture still schedules game over once at the original delay', () => {
  const f = fixture(); f.s.lives = 1; f.s.capturePlayer(f.s.snareEnemy); f.step(520);
  assert.deepEqual(f.timers, [750]); assert.equal(f.s.lives, 0); assert.equal(f.counters.capture, 1);
});
test('destroying or corrupting the captive mid-lift clears the visual clone', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.s.capturedWing.destroy(); f.s.capturedWing = undefined; f.tick();
  assert.equal(f.named('root-capture-lift'), undefined);
});
test('removing the captor never leaves a floating ghost wing', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.s.snareEnemy.destroy(); f.tick();
  assert.equal(f.named('root-capture-lift'), undefined);
});
test('closed rescue window does not create a companion or add a rescue effect', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.s.rescueCapturedWing(f.s.snareEnemy);
  assert.equal(f.counters.rescue, 0); assert.equal(f.s.grafted, false); assert.equal(f.s.run.score, 9120);
});
test('rescue retains score reward and companion fire origin while adding only light trails', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.step(520); f.s.snareEnemy.setData('rescueWindow', true);
  f.s.rescueCapturedWing(f.s.snareEnemy); f.tick();
  assert.equal(f.counters.rescue, 1); assert.equal(f.s.grafted, true); assert.equal(f.s.run.score, 11620);
  assert.equal(f.s.rescuedWing.x, 300); assert.equal(f.s.rescuedWing.y, 570); assert.equal(f.s.rescuedWing.visible, true);
  assert.ok(f.named('root-capture-lock-fx').calls.some(c => c.op === 'fillCircle'));
});
test('continue and scene shutdown clean effects without changing credits or lives', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.game.events.emit('arcade:continue-authorized');
  assert.equal(f.s.lives, 2); assert.equal(f.s.capturedWing.visible, true); assert.ok(f.made.every(o => !o.active));
  f.s.events.emit('shutdown'); assert.equal(f.s.events.listenerCount('postupdate'), 0);
});
test('replay uses exactly one frame listener and one shutdown listener', () => {
  const f = fixture(); for (let i = 0; i < 10; i++) { f.s.events.emit('shutdown'); f.s.create(); }
  assert.equal(f.s.events.listenerCount('postupdate'), 1); assert.equal(f.s.events.listenerCount('shutdown'), 1);
});
test('no per-frame sprite allocation and no overlays outside the capture sequence', () => {
  const f = fixture(); f.s.snareEnemy = undefined; f.s.snareBeam = undefined; f.step(1000); assert.equal(f.made.length, 0);
  f.s.create(); f.step(2000); const count = f.made.length; f.step(2000); assert.equal(f.made.length, count);
});
test('wave transition clears effects', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.s.waveClearing = true; f.tick(); assert.ok(f.made.every(o => !o.active));
});
test('dispose restores methods, visibility, and removes all listeners', () => {
  const f = fixture(); f.s.capturePlayer(f.s.snareEnemy); f.dispose();
  assert.equal(f.s.capturePlayer, f.originalCapture); assert.equal(f.s.capturedWing.visible, true);
  assert.equal(f.s.events.listenerCount('postupdate'), 0); assert.equal(f.s.events.listenerCount('shutdown'), 0);
  assert.equal(f.game.events.listenerCount('arcade:continue-authorized'), 0);
});
test('duplicate installation is a no-op', () => {
  const f = fixture(), method = f.s.capturePlayer, second = installCaptureAnimation(f.game); second();
  assert.equal(f.s.capturePlayer, method); f.dispose();
});
