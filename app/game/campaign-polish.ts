import type Phaser from 'phaser';
import { waves } from './config';
import { drawTyrant, drawVictoryMedal } from './campaign-art';

/** Isolated preview adapter: preserves the original campaign and all other pickups. */
type Sprite = Phaser.Physics.Arcade.Sprite;
type Boss = Sprite & { hp: number; kind: string; homeY: number; settled: boolean; phase: number; lastFire: number };
interface Run {
  score: number; wave: number; kills: number; perfect: number; maxStage: number;
  shotsFired: number; shotsHit: number; start: number; runId: string;
  elapsedMs?: number; livesRemaining?: number; startWave?: number; practice?: boolean;
  newBest?: boolean; localBest?: number;
}
interface GamePort extends Phaser.Scene {
  create(): void; run: Run; lives: number; stage: number; invincible: boolean;
  waveStart: number; waveClearing: boolean; paused: boolean;
  player: Sprite; shots: Phaser.Physics.Arcade.Group; pickups: Phaser.Physics.Arcade.Group;
  enemies: Phaser.Physics.Arcade.Group; bullets: Phaser.Physics.Arcade.Group;
  notice: Phaser.GameObjects.Text; lessonText: Phaser.GameObjects.Text;
  pickupText: Phaser.GameObjects.Text; sfxText: Phaser.GameObjects.Text;
  bossDamageFx: Phaser.GameObjects.Rectangle[];
  bindCollisions(): void; airburstBoom(token: Sprite): void;
  setLesson(message: string, duration?: number): void;
  spawnCanopyTyrant(): void; addBossDamage(boss: Boss, stage: number): void;
  hitEnemy(boss: Boss, damage: number, prune: boolean): void;
  updateEnemies(time: number, delta: number): void; enemyFire(boss: Boss): void;
  roundSequence(): void; endRun(cleared?: boolean): void;
  clearTouchState(): void; togglePause(): void; autoPause(): void; damagePlayer(): void;
}
interface EndData { run: Run; cleared: boolean }
type EndPort = Phaser.Scene & { create(data: EndData): void };
const GOLD = '#f2d28a', GREEN = '#a0efb7', WHITE = '#fff7e6', MUTED = '#a7bcae';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
export const accuracyLabel = (hits: number, shots: number) => shots > 0 ? `${Math.round(Math.min(1, safeNumber(hits) / shots) * 100)}%` : '—';
export const timeLabel = (ms: number) => { const s = Math.floor(safeNumber(ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function blocksBoomGunfire(a: unknown, b: unknown, shots: unknown, pickups: unknown): boolean {
  return (a === shots && b === pickups) || (a === pickups && b === shots);
}
function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error(`Canvas unavailable for ${key}`);
  draw(ctx); scene.textures.addCanvas(key, canvas);
}
function art(scene: Phaser.Scene) {
  for (let i = 0; i < 4; i++) texture(scene, `tyrant-armor-${i}`, 320, 240, c => drawTyrant(c, i));
  texture(scene, 'campaign-victory-medal', 240, 200, drawVictoryMedal);
}
function text(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = WHITE, maxWidth = 420) {
  const item = scene.add.text(x, y, value, { fontFamily: 'Verdana, Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center', wordWrap: { width: maxWidth } }).setOrigin(.5);
  if (item.width > maxWidth) item.setScale(maxWidth / item.width);
  return item;
}
function sparks(scene: Phaser.Scene, x: number, y: number, count: number, spread = 70) {
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count, distance = spread * (.45 + (i % 4) * .17);
    const bit = scene.add.rectangle(x, y, 3 + i % 3, 7, i % 3 ? 0xf2d28a : 0x94ebb2).setDepth(105).setAngle(i * 31);
    scene.tweens.add({ targets: bit, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, angle: i * 65, alpha: 0, duration: 450 + (i % 4) * 85, onComplete: () => bit.destroy() });
  }
}
const resetKeys = 'stage weaponLevel growth pruneCharge lives extraLivesAwarded chain chainUntil lastShot lastAutoShot turboUntil cloakUntil invulnUntil pruneKills waveSpawned waveStart waveKillsStart waveClearing waveDamage nextDiveAt nextEnemyFireAt captureUsed capturedStage grafted paused dragging dragLast dragPointerId firePointerId fireHeld controllerFireHeld gamepadFireWasDown gamepadSelectWasDown gamepadStartWasDown gamepadTaught autoFire invincible hitboxes debug coords showFps pruneTaught pruneReadyAnnounced seedTaught coreTaught turboTaught boomTaught cloakTaught killsSinceSeed killsSinceCore killsSinceTurbo killsSinceBoom killsSinceCloak volley attackSerial rushTargets rushDestroyed rushShotsFired rushShotsHit wingSide'.split(' ');

export function installCampaignPolish(game: Phaser.Game): void {
  const attach = () => {
    const play = game.scene.getScene('game') as GamePort | null;
    const end = game.scene.getScene('gameover') as EndPort | null;
    if (!play || !end) throw new Error('Campaign scenes unavailable; preview polish was not installed.');
    if (game.registry.get('campaign-polish-installed')) return;
    game.registry.set('campaign-polish-installed', true);
    decorateGame(play);
    const previousEnd = end.create;
    end.create = function (data) { if (data.cleared) victory(this, data.run); else previousEnd.call(this, data); };
  };
  if (game.scene.getScene('game') && game.scene.getScene('gameover')) attach();
  else game.events.once('ready', attach);
}

function decorateGame(scene: GamePort): void {
  let finale = false;
  let death = { x: 240, y: 178, scale: .78, texture: 'tyrant-armor-3' };
  const state = scene as unknown as Record<string, unknown>;
  const defaults = Object.fromEntries(resetKeys.map(key => [key, state[key]]));
  const create = scene.create;
  scene.create = function () {
    finale = false;
    Object.assign(this, defaults);
    for (const key of ['snareEnemy', 'snareBeam', 'capturedWing', 'rescuedWing', 'cloakRing', 'cloakCore']) (this as unknown as Record<string, unknown>)[key] = undefined;
    Object.assign(this, { bossDamageFx: [], clearedRows: new Set(), escortKills: new Map(), escortTargets: new Map() });
    art(this); create.call(this); this.physics.world.resume();
    // Original run initialization omitted shotsHit, producing NaN in the results.
    this.run.shotsHit = 0; this.run.startWave = this.run.wave;
    this.run.practice = this.run.wave > 0;
    this.events.once('shutdown', () => {
      this.game.events.off('blur', this.autoPause, this);
      this.game.events.off('hidden', this.autoPause, this);
    });
  };

  // Disable only the shot/pickup collider, at creation, before its first physics step.
  // The player/pickup collider and every existing combat collider remain unchanged.
  const bind = scene.bindCollisions;
  scene.bindCollisions = function () {
    const factory = this.physics.add, overlap = factory.overlap, shots = this.shots, pickups = this.pickups;
    factory.overlap = function (...args: Parameters<typeof overlap>) {
      const collider = overlap.apply(this, args);
      if (blocksBoomGunfire(args[0], args[1], shots, pickups)) collider.active = false;
      return collider;
    };
    try { bind.call(this); } finally { factory.overlap = overlap; }
  };
  scene.airburstBoom = function () { /* Contact collection is now the only BOOM trigger. */ };
  const lesson = scene.setLesson;
  scene.setLesson = function (message, duration) {
    const copy = message.includes('$BOOM') && /SHOOT|AIRBURST|CATCH FOR DEFENSE/.test(message)
      ? '$BOOM // TOUCH WITH ARBORWING TO CLEAR ENEMY FIRE' : message;
    lesson.call(this, copy, duration);
  };

  const spawn = scene.spawnCanopyTyrant;
  scene.spawnCanopyTyrant = function () {
    spawn.call(this);
    const boss = this.enemies.getChildren().find(o => o.active && o.getData('boss')) as Boss | undefined;
    if (!boss) return;
    this.tweens.killTweensOf(boss);
    boss.setTexture('tyrant-armor-0').setScale(.78).setAngle(0).setPosition(240, -120);
    boss.homeY = 178; boss.settled = false;
    boss.body?.setSize(224, 162, true);
    this.tweens.add({ targets: boss, y: 178, duration: 2100, ease: 'Sine.out', onComplete: () => { if (boss.active) { boss.settled = true; boss.setData('motionDeadline', 0); } } });
  };
  scene.addBossDamage = function (boss, stage) {
    boss.setTexture(`tyrant-armor-${Math.max(0, Math.min(3, stage))}`);
    if (!reducedMotion()) sparks(this, boss.x, boss.y + 25, 8, 35);
  };
  const updateEnemies = scene.updateEnemies;
  scene.updateEnemies = function (time, delta) {
    if (finale) return;
    if (this.run.wave !== waves.length - 1) { updateEnemies.call(this, time, delta); return; }
    const boss = this.enemies.getChildren().find(o => o.active && o.getData('boss')) as Boss | undefined;
    if (!boss) return;
    if (boss.settled) {
      const elapsed = time - this.waveStart;
      boss.setPosition(240 + Math.sin(elapsed * .0011) * 90, 178 + Math.sin(elapsed * .0014) * 12);
      // Keep the full rigid silhouette inside the playfield, below the top HUD.
      if (time >= (boss.getData('shieldStunUntil') || 0) && time - boss.lastFire > 1150) { this.enemyFire(boss); boss.lastFire = time; }
    }
    if (time < (boss.getData('armorHitUntil') || 0)) boss.setTintFill(0xffecc5);
    else boss.clearTint();
  };
  const hitEnemy = scene.hitEnemy;
  scene.hitEnemy = function (enemy, damage, prune) {
    if (finale) return;
    const isBoss = enemy.active && !!enemy.getData('boss');
    if (isBoss) death = { x: enemy.x, y: enemy.y, scale: enemy.scaleX, texture: enemy.texture.key };
    hitEnemy.call(this, enemy, damage, prune);
    if (!isBoss) return;
    if (enemy.active) {
      const stage = enemy.hp <= 6 ? 3 : enemy.hp <= 12 ? 2 : enemy.hp <= 18 ? 1 : 0;
      if (stage !== (enemy.getData('bossDamageStage') || 0)) this.addBossDamage(enemy, stage);
      enemy.setData('bossDamageStage', stage).setData('armorHitUntil', this.time.now + 85);
    } else this.roundSequence();
  };
  const damagePlayer = scene.damagePlayer, togglePause = scene.togglePause;
  scene.damagePlayer = function () { if (!finale) damagePlayer.call(this); };
  scene.togglePause = function () { if (!finale) togglePause.call(this); };
  const round = scene.roundSequence;
  scene.roundSequence = function () {
    if (this.run.wave !== waves.length - 1) { round.call(this); return; }
    if (finale) return;
    finale = true; this.waveClearing = true; this.paused = true;
    this.clearTouchState(); this.physics.world.pause(); this.player.setVelocity(0, 0);
    this.run.elapsedMs = Date.now() - this.run.start; this.run.livesRemaining = this.lives;
    this.run.practice = !!this.run.practice || this.invincible;
    this.shots.clear(true, true); this.bullets.clear(true, true);
    this.pickups.getChildren().forEach(p => p.getData('halo')?.destroy()); this.pickups.clear(true, true);
    for (const label of [this.notice, this.lessonText, this.pickupText]) { this.tweens.killTweensOf(label); label.setVisible(false); }
    this.bossDamageFx.forEach(o => o.destroy());
    const quiet = reducedMotion();
    this.add.rectangle(240, 360, 480, 720, 0x04100e, .55).setDepth(100);
    const wreck = this.add.sprite(death.x, death.y, death.texture).setScale(death.scale).setDepth(101);
    if (!quiet) {
      [0, 200, 430, 690].forEach((delay, i) => this.time.delayedCall(delay, () => sparks(this, wreck.x + (i % 2 ? 32 : -32), wreck.y + (i - 2) * 13, 14, 95)));
      this.tweens.add({ targets: wreck, y: death.y + 45, angle: 8, alpha: 0, duration: 1050, onComplete: () => wreck.destroy() });
    } else this.tweens.add({ targets: wreck, alpha: 0, duration: 450, onComplete: () => wreck.destroy() });
    text(this, 240, 336, 'TYRANT DEFEATED', 30, GOLD).setDepth(106);
    text(this, 240, 377, 'THE CANOPY IS YOURS.', 15, GREEN).setDepth(106);
    if (!quiet) {
      const flyby = this.add.sprite(this.player.x, this.player.y, 'playerSheet', Math.min(4, this.run.maxStage)).setScale(.95).setDepth(108);
      this.time.delayedCall(1150, () => this.tweens.add({ targets: flyby, x: 240, y: -140, duration: 1150, ease: 'Cubic.in', onComplete: () => flyby.destroy() }));
    }
    this.time.delayedCall(quiet ? 1200 : 2600, () => this.endRun(true));
  };
}

function victory(scene: Phaser.Scene, run: Run): void {
  art(scene);
  const quiet = reducedMotion(), score = Math.round(safeNumber(run.score));
  if (!run.practice) {
    try {
      const previous = safeNumber(Number(localStorage.getItem('treeforce89-campaign-best-v1')));
      run.newBest = score > previous; run.localBest = Math.max(previous, score);
      localStorage.setItem('treeforce89-campaign-best-v1', String(run.localBest));
    } catch { run.newBest = false; }
  }
  if (scene.textures.exists('forest-back')) scene.add.image(240, 360, 'forest-back').setDisplaySize(480, 720);
  scene.add.rectangle(240, 360, 480, 720, 0x04110f, .91);
  scene.add.rectangle(240, 360, 448, 690, 0x0b1d19, .4).setStrokeStyle(1, 0x607854, .7);
  // Restrained rays, laurels and leaves replace the old small debrief popup.
  const rays = scene.add.graphics();
  rays.lineStyle(1, 0xd8c080, .11);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    rays.lineBetween(240 + Math.cos(a) * 94, 261 + Math.sin(a) * 94, 240 + Math.cos(a) * 208, 261 + Math.sin(a) * 208);
  }
  text(scene, 240, 33, run.practice ? 'TREE FORCE ’89 // PRACTICE CLEAR' : 'TREE FORCE ’89 // CAMPAIGN COMPLETE', 11, GOLD);
  text(scene, 240, 86, 'CANOPY', 44, GREEN);
  text(scene, 240, 137, 'SECURED', 53, WHITE);
  text(scene, 240, 180, 'THE TYRANT HAS FALLEN. THE GROVE ENDURES.', 11, MUTED);
  scene.add.image(240, 260, 'campaign-victory-medal').setScale(.88);
  const hero = scene.add.sprite(240, 254, 'playerSheet', Math.max(0, Math.min(4, run.maxStage))).setScale(.8);
  if (!quiet) scene.tweens.add({ targets: hero, y: 249, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  text(scene, 240, 352, 'C A N O P Y   D E F E N D E R', 13, GOLD);
  scene.add.rectangle(240, 414, 414, 82, 0x071713, .97).setStrokeStyle(1, 0xb99b57, .9);
  text(scene, 240, 391, run.newBest ? 'NEW PERSONAL BEST · THIS DEVICE' : 'FINAL SCORE', 11, GOLD);
  const scoreText = text(scene, 240, 427, quiet ? score.toLocaleString() : '0', 37, WHITE);
  if (!quiet) scene.tweens.addCounter({ from: 0, to: score, duration: 1650, ease: 'Cubic.out', onUpdate: t => scoreText.setText(Math.round(t.getValue() || 0).toLocaleString()) });
  const count = Math.max(1, Math.min(waves.length, run.wave + 1 - (run.startWave || 0)));
  const stats = [
    ['INVADERS CLEARED', String(safeNumber(run.kills))],
    [run.practice ? 'WAVES THIS RUN' : 'WAVES SECURED', `${count} / ${waves.length}`],
    ['ACCURACY', accuracyLabel(run.shotsHit, run.shotsFired)],
    ['RUN TIME', timeLabel(run.elapsedMs || 0)],
    ['LIVES REMAINING', String(safeNumber(run.livesRemaining))],
    ['PERFECT SHIELDS', String(safeNumber(run.perfect))],
  ];
  stats.forEach(([label, value], i) => {
    const x = 98 + (i % 3) * 142, y = i < 3 ? 480 : 536;
    text(scene, x, y, label, 11, MUTED, 132); text(scene, x, y + 22, value, 22, i === 1 ? GREEN : WHITE, 130);
  });
  let leaving = false, selected = 0;
  const readyAt = scene.time.now + 900;
  const go = (key: string) => { if (leaving || scene.time.now < readyAt) return; leaving = true; scene.scene.start(key); };
  const replay = scene.add.rectangle(240, 613, 414, 48, 0x9eeab5, 1).setStrokeStyle(2, 0xdcf6ca).setInteractive({ useHandCursor: true });
  const title = scene.add.rectangle(240, 670, 414, 38, 0x102c23, 1).setStrokeStyle(1, 0x627e6b).setInteractive({ useHandCursor: true });
  text(scene, 240, 613, 'PLAY AGAIN', 17, '#09261b');
  text(scene, 240, 670, 'RETURN TO TITLE', 12, WHITE);
  const focus = () => { replay.setStrokeStyle(selected === 0 ? 3 : 1, selected === 0 ? 0xf2d28a : 0x729383); title.setStrokeStyle(selected === 1 ? 3 : 1, selected === 1 ? 0xf2d28a : 0x627e6b); };
  replay.on('pointerover', () => { selected = 0; focus(); }); title.on('pointerover', () => { selected = 1; focus(); });
  replay.on('pointerdown', () => go('game')); title.on('pointerdown', () => go('title'));
  const key = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') { selected = 1 - selected; focus(); event.preventDefault(); }
    if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); go(selected ? 'title' : 'game'); }
    if (event.code === 'Escape') go('title');
  };
  scene.input.keyboard?.on('keydown', key);
  let released = false, wasDirection = false;
  const padInput = () => {
    const pad = Array.from(navigator.getGamepads?.() || []).find(p => !!p); if (!pad) return;
    const confirm = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || pad.buttons[9]?.pressed);
    const direction = !!(pad.buttons[12]?.pressed || pad.buttons[13]?.pressed || Math.abs(pad.axes[1] || 0) > .6);
    if (!confirm) released = true;
    if (direction && !wasDirection) { selected = 1 - selected; focus(); }
    if (confirm && released) { released = false; go(selected ? 'title' : 'game'); }
    wasDirection = direction;
  };
  scene.events.on('update', padInput);
  scene.events.once('shutdown', () => { scene.events.off('update', padInput); scene.input.keyboard?.off('keydown', key); });
  text(scene, 240, 705, 'ENTER / SPACE / CONTROLLER A · ARROWS TO SELECT', 9, MUTED);
  focus();
  if (!quiet) {
    for (let i = 0; i < 18; i++) {
      const leaf = scene.add.rectangle(26 + (i * 71) % 430, -30 - i * 19, 3, 7, i % 3 ? 0x94dcae : 0xe8c678).setAlpha(.45).setAngle(i * 27);
      scene.tweens.add({ targets: leaf, y: 730, angle: i * 27 + 190, duration: 6500 + i * 113, delay: i * 180, repeat: -1 });
    }
  }
}
