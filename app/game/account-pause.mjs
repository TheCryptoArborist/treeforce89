/** Own only the pauses introduced by this dialog. Never restart a scene. */
export function holdGameForAccount(game) {
  const held = new Map(); let closed = false;
  const manager = game.input?.keyboard, managerEnabled = manager?.enabled;
  if (manager) manager.enabled = false;
  function capture() {
    if (closed) return;
    for (const s of game.scene.getScenes(false)) {
      const key = s.sys.settings.key;
      const active = game.scene.isActive(key), paused = game.scene.isPaused(key);
      if ((!active && !paused) || held.has(s)) continue;
      const world = s.physics?.world, keyboard = s.input?.keyboard;
      const state = { s, key, run: s.run, alive: true, owned: active && !paused, paused: s.paused, world, physicsPaused: world?.isPaused, inputEnabled: s.input?.enabled, keyboard, keyboardEnabled: keyboard?.enabled };
      state.shutdown = () => { state.alive = false; };
      s.events.once('shutdown', state.shutdown); held.set(s, state);
      s.clearTouchState?.(); s.controllerFireHeld = false; keyboard?.resetKeys?.();
      // Also prevent blur/hidden handlers from introducing a second pause.
      s.paused = true;
      if (world && !world.isPaused) world.pause();
      if (s.input) s.input.enabled = false;
      if (keyboard) keyboard.enabled = false;
      if (state.owned) game.scene.pause(key);
    }
  }
  capture(); game.events.on('poststep', capture);
  return () => {
    if (closed) return; closed = true; game.events.off('poststep', capture);
    for (const p of held.values()) {
      p.s.events.off('shutdown', p.shutdown);
      if (!p.alive || p.s.run !== p.run) continue;
      p.s.clearTouchState?.(); p.keyboard?.resetKeys?.(); p.s.controllerFireHeld = false;
      p.s.paused = p.paused;
      if (p.world) { if (p.physicsPaused) p.world.pause(); else p.world.resume(); }
      if (p.s.input) p.s.input.enabled = p.inputEnabled;
      if (p.keyboard) p.keyboard.enabled = p.keyboardEnabled;
      if (p.owned && game.scene.isPaused(p.key)) game.scene.resume(p.key);
    }
    if (manager) manager.enabled = managerEnabled;
    held.clear();
  };
}
