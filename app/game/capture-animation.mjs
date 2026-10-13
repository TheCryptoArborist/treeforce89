/** Visual-only Root Captor polish. The existing capture/rescue rules remain authoritative. */
export const CAPTURE_FX = Object.freeze({ liftMs: 520, rescueMs: 650, trails: 3 });
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const quietMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Moving endpoint lets the visible wing follow the captor's existing departure. */
export function capturePose(start, dock, elapsed, quiet = false) {
  const u = clamp(elapsed / CAPTURE_FX.liftMs);
  const travel = smooth(clamp((u - 0.12) / 0.88));
  const struggle = quiet ? 0 : Math.sin(u * Math.PI * 7) * (1 - u);
  return { x: mix(start.x, dock.x, travel) + struggle * 7,
    y: mix(start.y, dock.y, travel),
    angle: mix(start.angle || 0, dock.angle || 0, travel) + struggle * 14,
    scaleX: mix(start.scaleX, dock.scaleX, travel) * (quiet ? 1 : 1 - Math.sin(u * Math.PI) * 0.09),
    scaleY: mix(start.scaleY, dock.scaleY, travel) * (quiet ? 1 : 1 + Math.sin(u * Math.PI) * 0.04),
    progress: u };
}

/** Fixed-width gold boundary matches the existing 72px capture lane. */
export function drawTractorBeam(g, x, y, bottom, elapsed, quiet = false, pulling = false) {
  const height = Math.max(0, bottom - y); if (!height) return;
  const pulse = quiet ? 0.5 : 0.5 + Math.sin(elapsed * 0.004) * 0.5;
  const tint = pulling ? 0xbd83ff : 0x6cf5bb;
  g.fillStyle(tint, pulling ? 0.14 : 0.09).fillRect(x - 36, y, 72, height);
  g.fillStyle(tint, 0.1).fillTriangle(x - 11, y, x - 36, bottom, x + 36, bottom);
  g.fillTriangle(x - 11, y, x + 36, bottom, x + 11, y);
  g.lineStyle(2, 0xf2d28a, 0.85).lineBetween(x - 36, y, x - 36, bottom).lineBetween(x + 36, y, x + 36, bottom);
  g.lineStyle(1, tint, 0.75).lineBetween(x - 11, y, x - 34, bottom).lineBetween(x + 11, y, x + 34, bottom);
  const count = quiet ? 3 : 7;
  for (let i = 0; i < count; i++) {
    const p = quiet ? (i + 1) / (count + 1) : (i / count + 1 - (elapsed / 850) % 1) % 1;
    const width = 22 + p * 46;
    g.lineStyle(1.5, tint, 0.28 + (1 - p) * 0.42).strokeEllipse(x, y + p * height, width, 6 + p * 9);
  }
  if (!quiet) for (let i = 0; i < 12; i++) {
    const p = (i / 12 + 1 - (elapsed / 650) % 1) % 1;
    const px = x + Math.sin(i * 2.4 + elapsed * 0.005) * (9 + p * 22);
    g.fillStyle(i % 3 ? tint : 0xffecbc, 0.5).fillCircle(px, y + p * height, i % 3 ? 1.5 : 2.2);
  }
  g.fillStyle(tint, 0.12 + pulse * 0.05).fillEllipse(x, y, 46, 24);
  g.lineStyle(2, 0xffdf96, 0.85).strokeEllipse(x, y, 28 + pulse * 5, 10);
  g.fillStyle(0xe8ffe1, 0.9).fillEllipse(x, y, 14, 6);
}

const installations = new WeakSet();
export function installCaptureAnimation(game, { reducedMotion = quietMotion } = {}) {
  if (installations.has(game)) return () => {};
  installations.add(game);
  let disposed = false, scene = null, beamFx = null, lockFx = null;
  let lift = null, release = null, elapsed = 0;
  const undo = [], hidden = new Map();
  function hide(object) {
    if (!object?.active) return;
    if (!hidden.has(object)) hidden.set(object, object.visible);
    object.setVisible(false);
  }
  function reveal(object) {
    if (!hidden.has(object)) return;
    if (object.active) object.setVisible(hidden.get(object));
    hidden.delete(object);
  }
  function finishLift() {
    if (!lift) return;
    reveal(lift.captive); lift.image.destroy(); lift.trails.forEach(t => t.destroy()); lift = null;
  }
  function reset() {
    finishLift(); release = null;
    for (const object of [...hidden.keys()]) reveal(object);
    beamFx?.destroy(); lockFx?.destroy(); beamFx = lockFx = null; elapsed = 0;
  }
  function graphics() {
    if (!beamFx?.active) beamFx = scene.add.graphics().setDepth(2).setName('root-capture-beam-fx');
    if (!lockFx?.active) lockFx = scene.add.graphics().setDepth(6).setName('root-capture-lock-fx');
    beamFx.clear().setVisible(true); lockFx.clear().setVisible(true);
  }
  const poseOf = object => ({ x: object.x, y: object.y, angle: object.angle || 0, scaleX: object.scaleX, scaleY: object.scaleY });
  const applyPose = (image, p) => image.setPosition(p.x, p.y).setAngle(p.angle).setScale(p.scaleX, p.scaleY);
  function ring(wing, color, pulse = 0.5) {
    const width = Math.max(42, (wing.displayWidth || 90) * 0.78);
    const height = Math.max(50, (wing.displayHeight || 115) * 0.78);
    lockFx.lineStyle(2, color, 0.6).strokeEllipse(wing.x, wing.y, width, height);
    lockFx.lineStyle(1, color, 0.25).strokeEllipse(wing.x, wing.y, width + 6 + pulse * 6, height + 6 + pulse * 6);
  }
  function tick(_time, delta) {
    if (disposed || !scene || scene.paused || scene.physics?.world.isPaused) return;
    if (scene.waveClearing) { reset(); return; }
    const step = clamp(Number.isFinite(delta) ? delta : 0, 0, 100);
    elapsed += step;
    const captor = scene.snareEnemy, beam = scene.snareBeam, captive = scene.capturedWing;
    for (const object of [...hidden.keys()]) if (object !== beam && object !== lift?.captive) reveal(object);
    if (lift && (!lift.captive.active || !lift.captor.active || captive !== lift.captive || captor !== lift.captor)) finishLift();
    if (!captor?.active && !lift && !release) { beamFx?.clear(); lockFx?.clear(); return; }
    graphics();
    const quiet = !!reducedMotion(), pulse = quiet ? 0.5 : 0.5 + Math.sin(elapsed * 0.004) * 0.5;
    if (captor?.active && beam?.active) {
      // Only replace the rectangle's appearance. Its position, lifetime and capture test are untouched.
      hide(beam);
      drawTractorBeam(beamFx, captor.x, captor.y + 24, beam.y + beam.height / 2, elapsed, quiet);
    } else if (captor?.active && !captive?.active && !captor.getData('holding')) {
      lockFx.fillStyle(0x9debc0, 0.1).fillEllipse(captor.x, captor.y + 24, 42, 22);
      lockFx.lineStyle(2, 0xf2d28a, 0.8).strokeEllipse(captor.x, captor.y + 24, 18 + pulse * 10, 8);
    }
    if (lift) {
      lift.elapsed += step;
      const dock = { ...poseOf(lift.captive), x: lift.captor.x, y: lift.captor.y + 45, angle: lift.captor.angle || 0 };
      const p = capturePose(lift.start, dock, lift.elapsed, quiet);
      applyPose(lift.image, p);
      lift.trails.forEach((trail, i) => {
        const lag = Math.max(0, lift.elapsed - (i + 1) * 36);
        applyPose(trail, capturePose(lift.start, dock, lag, quiet));
        trail.setVisible(!quiet).setAlpha((0.17 - i * 0.035) * Math.sin(p.progress * Math.PI));
      });
      drawTractorBeam(beamFx, lift.captor.x, lift.captor.y + 24, Math.max(p.y + 35, lift.captor.y + 80), elapsed, quiet, true);
      ring(lift.image, 0xd0a4ff, pulse);
      if (lift.elapsed >= CAPTURE_FX.liftMs) finishLift();
    } else if (captor?.active && captive?.active) {
      const rescueOpen = captor.getData('rescueWindow');
      ring(captive, rescueOpen ? 0xffdf87 : 0xba89ff, pulse);
      lockFx.lineStyle(2, rescueOpen ? 0xffdf87 : 0xba89ff, 0.65)
        .lineBetween(captor.x - 9, captor.y + 24, captive.x - 14, captive.y - 20)
        .lineBetween(captor.x + 9, captor.y + 24, captive.x + 14, captive.y - 20);
    }
    if (release) {
      release.elapsed += step;
      if (!release.wing.active || release.elapsed >= CAPTURE_FX.rescueMs) { release = null; return; }
      const u = release.elapsed / CAPTURE_FX.rescueMs, to = release.wing;
      lockFx.lineStyle(2, 0xffdf87, (1 - u) * 0.8).strokeEllipse(release.x, release.y, 35 + u * 95, 45 + u * 95);
      if (!quiet) for (let i = 0; i < 8; i++) {
        const t = clamp(u * 1.6 - i * 0.035);
        lockFx.fillStyle(i % 2 ? 0xffdf87 : 0xa9efb8, (1 - u) * 0.75)
          .fillCircle(mix(release.x, to.x, t) + Math.sin(t * Math.PI) * 22, mix(release.y, to.y, t), 2 + (i % 2));
      }
      ring(to, 0xffdf87, pulse);
    }
  }
  function shutdown() { scene?.events.off('postupdate', tick); reset(); }
  function attach() {
    if (disposed) return;
    scene = game.scene.getScene('game');
    if (!scene) throw new Error('Game scene unavailable for capture animation');
    function wrap(name, decorate) {
      const original = scene[name];
      if (typeof original !== 'function') throw new Error(`Missing capture integration: ${name}`);
      const next = decorate(original); scene[name] = next;
      undo.push(() => { if (scene[name] === next) scene[name] = original; });
    }
    wrap('create', original => function (...args) {
      reset(); original.apply(this, args);
      this.events.off('postupdate', tick); this.events.on('postupdate', tick);
      this.events.off('shutdown', shutdown); this.events.once('shutdown', shutdown);
    });
    wrap('capturePlayer', original => function (captor, ...args) {
      const canCapture = this.player.active, oldCaptive = this.capturedWing;
      const start = poseOf(this.player), key = this.player.texture.key, frame = this.player.frame.name;
      const result = original.call(this, captor, ...args);
      if (!canCapture || !this.capturedWing?.active || this.capturedWing === oldCaptive) return result;
      finishLift(); reveal(this.snareBeam);
      const image = this.add.image(start.x, start.y, key, frame).setDepth(5).setTint(0xcda4ff).setName('root-capture-lift');
      applyPose(image, start);
      const trails = Array.from({ length: CAPTURE_FX.trails }, (_, i) =>
        this.add.image(start.x, start.y, key, frame).setDepth(3).setTint(0x9f70ef).setAlpha(0).setName(`root-capture-trail-${i}`));
      lift = { image, trails, captive: this.capturedWing, captor, start, elapsed: 0 };
      hide(lift.captive); tick(0, 0);
      return result;
    });
    wrap('rescueCapturedWing', original => function (...args) {
      const captive = this.capturedWing, oldWing = this.rescuedWing;
      const from = lift ? poseOf(lift.image) : captive?.active ? poseOf(captive) : null;
      const result = original.apply(this, args);
      if (from && this.rescuedWing?.active && this.rescuedWing !== oldWing && !captive.active) {
        finishLift(); release = { ...from, wing: this.rescuedWing, elapsed: 0 };
      }
      return result;
    });
    game.events.on('arcade:continue-authorized', reset);
    undo.push(() => game.events.off('arcade:continue-authorized', reset));
  }
  if (game.scene.getScene('game')) attach(); else game.events.once('ready', attach);
  return () => {
    disposed = true; game.events.off('ready', attach); scene?.events.off('shutdown', shutdown); scene?.events.off('postupdate', tick);
    reset(); undo.reverse().forEach(fn => fn()); installations.delete(game);
  };
}
