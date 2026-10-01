import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BOSS_BACKGROUND as BG, installBossBackground } from '../app/game/boss-background.mjs';

function fixture({ ready = true, loaded = true, initialWave = 0, failDrawing = false } = {}) {
  const assets = new Set(loaded ? [BG.key] : []), loads = [], made = [], backdropCalls = [];
  let available = ready;
  const s = { events: new EventEmitter(), run: { wave: initialWave, score: 9120 }, lives: 3,
    physics: { world: { isPaused: false } }, paused: false,
    textures: { exists: key => assets.has(key) },
    load: { image: (key, url) => loads.push({ key, url }) },
  };
  function item(properties = {}) {
    return { scene: s, active: true, visible: true, ...properties,
      setVisible(v) { this.visible = v; return this; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
      setDepth(n) { this.depth = n; return this; }, setName(n) { this.name = n; return this; },
      destroy() { this.active = false; this.scene = undefined; this.destroyCount = (this.destroyCount || 0) + 1; },
    };
  }
  s.add = {
    image(x, y, key) { const o = item({ x, y, key }); made.push(o); return o; },
    rectangle(x, y, w, h, color, alpha) {
      if (failDrawing) throw new Error('draw failure');
      const o = item({ x, y, displayWidth: w, displayHeight: h, color, alpha }); made.push(o); return o;
    },
  };
  s.setWaveBackdrop = function (index) { backdropCalls.push(index); return `original-${index}`; };
  s.create = function () {
    this.backgroundLayers = [item({ name: 'forest-back' }), item({ name: 'forest-mid' }), item({ name: 'forest-front' })];
    this.backgroundMood = item({ name: 'mood', alpha: 0.4 });
    this.setWaveBackdrop(this.run.wave); return 'created';
  };
  const title = { name: 'title' }, ending = { name: 'gameover' };
  const game = { events: new EventEmitter(), scene: { getScene: key => key === 'game' ? available ? s : null : key === 'title' ? title : ending } };
  const originals = { create: s.create, backdrop: s.setWaveBackdrop };
  const dispose = installBossBackground(game);
  const start = () => { s.preload(); s.create(); };
  const show = index => { s.run.wave = index; return s.setWaveBackdrop(index); };
  return { s, game, made, loads, assets, backdropCalls, originals, dispose, start, show, title, ending,
    ready() { available = true; game.events.emit('ready'); },
    layers: () => [...s.backgroundLayers, s.backgroundMood],
    active: () => made.filter(x => x.active),
  };
}
function withoutWarnings(fn) {
  const old = console.warn; console.warn = () => {};
  try { return fn(); } finally { console.warn = old; }
}

test('uploaded AVIF matches the locally prepared image byte for byte', () => {
  const bytes = readFileSync(new URL('../public' + BG.url, import.meta.url));
  assert.equal(bytes.length, 17413);
  assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '1abef6c2beb70a91cfd58fe7edf453238437c3eea75ec77d4610925547cf8043');
});
test('uncached image is queued during game preload', () => {
  const f = fixture({ loaded: false }); f.s.preload();
  assert.deepEqual(f.loads, [{ key: BG.key, url: BG.url }]);
});
test('replay does not request an already cached image', () => {
  const f = fixture(); f.start(); f.s.preload(); assert.equal(f.loads.length, 0);
});
test('all nine earlier waves delegate normally with no city layers', () => {
  const f = fixture(); f.start();
  for (let i = 0; i < 9; i++) assert.equal(f.show(i), `original-${i}`);
  assert.equal(f.made.length, 0); assert.ok(f.layers().every(x => x.visible));
});
test('direct Wave 10 entry shows the city at create time', () => {
  const f = fixture({ initialWave: 9 }); f.start();
  assert.equal(f.active().length, 2); assert.equal(f.active()[0].key, BG.key);
  assert.ok(f.layers().every(x => !x.visible));
});
test('normal Wave 9 to Wave 10 transition switches backgrounds', () => {
  const f = fixture({ initialWave: 8 }); f.start(); assert.equal(f.active().length, 0);
  f.show(9); assert.equal(f.active().length, 2); assert.ok(f.layers().every(x => !x.visible));
});
test('city and overlay stay behind gameplay with matching non-stretched overscan', () => {
  const f = fixture({ initialWave: 9 }); f.start(); const [city, shade] = f.active();
  assert.equal(city.displayWidth / city.displayHeight, 480 / 720);
  assert.ok(city.displayWidth > 480 && city.displayHeight > 720);
  assert.equal(city.x, 240); assert.equal(city.y, 360);
  assert.ok(city.depth < shade.depth && shade.depth < 0);
  assert.equal(shade.alpha, 0.30); assert.equal(shade.displayWidth, city.displayWidth);
});
test('restarting final wave does not allocate duplicate layers', () => {
  const f = fixture({ initialWave: 9 }); f.start(); for (let i = 0; i < 20; i++) f.show(9);
  assert.equal(f.made.length, 2); assert.equal(f.active().length, 2);
});
test('leaving final wave restores original visibility including an intentionally hidden layer', () => {
  const f = fixture(); f.start(); f.s.backgroundLayers[1].setVisible(false);
  f.show(9); f.show(0); assert.equal(f.active().length, 0);
  assert.deepEqual(f.layers().map(x => x.visible), [true, false, true, true]);
});
test('ending the game scene removes the city and leaves title/end scene objects untouched', () => {
  const f = fixture({ initialWave: 9 }); f.start(); f.s.events.emit('shutdown');
  assert.equal(f.active().length, 0);
  assert.deepEqual(f.title, { name: 'title' }); assert.deepEqual(f.ending, { name: 'gameover' });
});
test('replay has one shutdown listener and no old background objects', () => {
  const f = fixture({ initialWave: 9 });
  for (let i = 0; i < 10; i++) { f.start(); assert.equal(f.s.events.listenerCount('shutdown'), 1); f.s.events.emit('shutdown'); }
  assert.equal(f.active().length, 0); f.s.run.wave = 0; f.start(); assert.equal(f.active().length, 0);
});
test('missing or undecodable image retains the forest rather than hiding it', () => {
  const f = fixture({ initialWave: 9, loaded: false }); withoutWarnings(() => f.start());
  assert.equal(f.active().length, 0); assert.ok(f.layers().every(x => x.visible));
});
test('partial drawing failure cleans the image and preserves the forest', () => {
  const f = fixture({ initialWave: 9, failDrawing: true }); withoutWarnings(() => f.start());
  assert.equal(f.made.length, 1); assert.equal(f.active().length, 0); assert.ok(f.layers().every(x => x.visible));
});
test('continues and pauses do not remove or recreate the arena', () => {
  const f = fixture({ initialWave: 9 }); f.start(); const originalCity = f.active()[0];
  f.s.paused = true; f.s.physics.world.isPaused = true; f.game.events.emit('arcade:continue-authorized');
  assert.equal(f.active()[0], originalCity); assert.equal(f.s.paused, true); assert.equal(f.s.physics.world.isPaused, true);
});
test('background changes do not change score, lives, or boss data', () => {
  const f = fixture(); f.start(); f.s.boss = { hp: 78, phase: 2 }; const before = structuredClone({ run: f.s.run, lives: f.s.lives, boss: f.s.boss });
  f.s.setWaveBackdrop(9); f.s.setWaveBackdrop(0);
  assert.deepEqual({ run: f.s.run, lives: f.s.lives, boss: f.s.boss }, before);
});
test('dispose restores scene methods and removes added lifecycle hooks', () => {
  const f = fixture({ initialWave: 9 }); f.start(); f.dispose();
  assert.equal(f.s.create, f.originals.create); assert.equal(f.s.setWaveBackdrop, f.originals.backdrop);
  assert.equal(Object.hasOwn(f.s, 'preload'), false); assert.equal(f.s.events.listenerCount('shutdown'), 0);
  assert.equal(f.active().length, 0); assert.ok(f.layers().every(x => x.visible));
});
test('installation waits for ready when scene has not been added yet', () => {
  const f = fixture({ ready: false }); assert.equal(f.s.create, f.originals.create);
  f.ready(); f.start(); f.show(9); assert.equal(f.active().length, 2);
});
test('dispose before ready cancels installation', () => {
  const f = fixture({ ready: false }); f.dispose(); f.ready();
  assert.equal(f.s.create, f.originals.create); assert.equal(f.game.events.listenerCount('ready'), 0);
});
test('duplicate installation does not wrap methods twice', () => {
  const f = fixture(); const create = f.s.create; const noop = installBossBackground(f.game); noop();
  assert.equal(f.s.create, create); f.start(); f.show(9); assert.equal(f.active().length, 2);
});
test('an existing preload hook is preserved and restored', () => {
  const f = fixture(); f.dispose(); let count = 0;
  const preload = function () { count++; return 'preloaded'; }; f.s.preload = preload;
  const dispose = installBossBackground(f.game); assert.equal(f.s.preload(), 'preloaded'); assert.equal(count, 1);
  dispose(); assert.equal(f.s.preload, preload);
});
