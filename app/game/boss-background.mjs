/** Wave-10 scenery only. No combat, scoring, account, or credit changes. */
export const BOSS_BACKGROUND = Object.freeze({
  key: 'tyrantNeonCity',
  url: '/assets/backgrounds/tyrant-neon-city.avif',
  waveIndex: 9,
  width: 496,
  height: 744,
  shadeAlpha: 0.30,
});
const installed = new WeakSet();

export function installBossBackground(game) {
  if (installed.has(game)) return () => {};
  installed.add(game);
  let disposed = false, scene = null, city = null, shade = null;
  const savedVisibility = new Map(), undo = [];

  function restoreForest() {
    for (const [layer, visible] of savedVisibility) {
      if (layer.scene && layer.active !== false) layer.setVisible(visible);
    }
    savedVisibility.clear();
  }
  function clearArena() {
    city?.destroy(); shade?.destroy();
    city = shade = null;
    restoreForest();
  }
  function hideForest() {
    for (const layer of [...(scene.backgroundLayers || []), scene.backgroundMood]) {
      if (!layer?.scene) continue;
      if (!savedVisibility.has(layer)) savedVisibility.set(layer, layer.visible);
      layer.setVisible(false);
    }
  }
  function showArena() {
    if (!scene.textures.exists(BOSS_BACKGROUND.key)) {
      // Loading or decoding errors leave the existing playable forest in place.
      clearArena();
      console.warn('Canopy Tyrant city background unavailable; keeping the forest.');
      return;
    }
    if (!city?.active || !shade?.active) {
      clearArena();
      try {
        // Separate opaque image: never replace a shared forest texture in place.
        // A small same-aspect overscan covers normal boss-hit camera shakes.
        city = scene.add.image(240, 360, BOSS_BACKGROUND.key)
          .setDisplaySize(BOSS_BACKGROUND.width, BOSS_BACKGROUND.height)
          .setDepth(-6).setName('tyrant-city-background');
        shade = scene.add.rectangle(240, 360, BOSS_BACKGROUND.width,
          BOSS_BACKGROUND.height, 0x020610, BOSS_BACKGROUND.shadeAlpha)
          .setDepth(-5).setName('tyrant-city-readability');
      } catch (error) {
        clearArena();
        console.warn('Canopy Tyrant city rendering failed; keeping the forest.', error);
        return;
      }
    }
    hideForest();
  }
  function attach() {
    if (disposed) return;
    scene = game.scene.getScene('game');
    if (!scene) throw new Error('Game scene unavailable for boss background');
    const s = scene;
    const ownedPreload = Object.hasOwn(s, 'preload');
    const previousPreload = s.preload;
    const previousCreate = s.create;
    const previousBackdrop = s.setWaveBackdrop;
    if (typeof previousCreate !== 'function' || typeof previousBackdrop !== 'function') {
      throw new Error('Missing game background lifecycle');
    }
    // GameScene preload runs before its create/startWave, including direct Wave 10.
    // A cached texture is reused on subsequent runs, without duplicate requests.
    const preload = function (...args) {
      const result = previousPreload?.apply(this, args);
      if (!this.textures.exists(BOSS_BACKGROUND.key)) {
        this.load.image(BOSS_BACKGROUND.key, BOSS_BACKGROUND.url);
      }
      return result;
    };
    const create = function (...args) {
      clearArena();
      this.events.off('shutdown', clearArena);
      this.events.once('shutdown', clearArena);
      return previousCreate.apply(this, args);
    };
    const backdrop = function (index, ...args) {
      if (index !== BOSS_BACKGROUND.waveIndex) clearArena();
      const result = previousBackdrop.call(this, index, ...args);
      if (index === BOSS_BACKGROUND.waveIndex) showArena();
      return result;
    };
    s.preload = preload; s.create = create; s.setWaveBackdrop = backdrop;
    undo.push(() => {
      s.events.off('shutdown', clearArena);
      if (s.preload === preload) {
        if (ownedPreload) s.preload = previousPreload;
        else delete s.preload;
      }
      if (s.create === create) s.create = previousCreate;
      if (s.setWaveBackdrop === backdrop) s.setWaveBackdrop = previousBackdrop;
    });
  }
  if (game.scene.getScene('game')) attach();
  else game.events.once('ready', attach);
  return () => {
    disposed = true;
    game.events.off('ready', attach);
    clearArena();
    undo.reverse().forEach(fn => fn());
    installed.delete(game);
  };
}
