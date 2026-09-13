/** Preview boss revision. Fixed difficulty; never reads account or payment state. */
export const TYRANT = Object.freeze({ maxHp: 180, maxBullets: 30, initialRestMs: 800 });
export function bossPhase(hp, maxHp = TYRANT.maxHp) {
  return hp > maxHp * 2 / 3 ? 1 : hp > maxHp / 3 ? 2 : 3;
}
export function armorStage(hp, maxHp = TYRANT.maxHp) {
  return hp <= maxHp / 4 ? 3 : hp <= maxHp / 2 ? 2 : hp <= maxHp * 3 / 4 ? 1 : 0;
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function bossPosition(elapsed, phase) {
  return { x: 240 + Math.sin(elapsed * (0.0011 + (phase - 1) * 0.00018)) * (88 + phase * 5),
    y: 178 + Math.sin(elapsed * 0.0014) * (8 + phase * 2) };
}
/** Aim is captured when the warning appears; projectiles never home afterward. */
export function planVolley(phase, serial, boss, player) {
  const speed = [270, 290, 310][phase - 1];
  const x = boss.x, y = boss.y + 64, targetX = clamp(player.x, 70, 410);
  const targetY = Math.max(y + 170, player.y);
  const shot = (ox, angle) => ({ x: ox, y, angle: clamp(angle, 0.3, Math.PI - 0.3), speed });
  const aim = Math.atan2(targetY - y, targetX - x);
  let shots, label;
  if (phase === 3 && serial % 2 === 0) {
    // A broad fan with a deliberately missing center. The opening is at least
    // 90px wide at the minimum target distance, before expanding toward the pilot.
    shots = [-0.84,-0.60,-0.40,-0.28,0.28,0.40,0.60,0.84].map(offset => shot(x, aim + offset));
    label = 'CROWN STORM // OPEN CENTER';
  } else if (phase > 1 && serial % 2 === 1) {
    shots = [-1, 1].flatMap(side => {
      const ox = x + side * 46;
      const a = Math.atan2(targetY - y, targetX + side * 84 - ox);
      // Outside rails leave a central route rather than crossing on the pilot.
      return [0, -side * 0.18, -side * 0.36].map(offset => shot(ox, a + offset));
    });
    label = 'TWIN VOLLEY // WATCH BOTH SIDES';
  } else {
    const offsets = phase === 1 ? [-0.4,-0.2,0,0.2,0.4] : [-0.72,-0.48,-0.24,0,0.24,0.48,0.72];
    shots = offsets.map(offset => shot(x, aim + offset));
    label = 'AIM LOCKED // KEEP MOVING';
  }
  return { shots, label, warningMs: phase === 3 ? 600 : 700,
    restMs: [850, 650, 450][phase - 1] };
}

/** Install AFTER campaign polish, BEFORE record and continue wrappers. */
const installedGames = new WeakSet();
export function installTyrantCombat(game) {
  if (installedGames.has(game)) return () => {};
  installedGames.add(game);
  let disposed = false, encounter = null;
  const undo = [];
  function clearWarning() {
    if (!encounter) return;
    encounter.guides?.clear(); encounter.caption?.setVisible(false);
    encounter.pending = null;
  }
  function reset() {
    if (encounter) { encounter.guides?.destroy(); encounter.caption?.destroy(); }
    encounter = null;
  }
  function attach() {
    if (disposed) return;
    const s = game.scene.getScene('game');
    if (!s) throw new Error('Game scene unavailable for Canopy Tyrant combat');
    function wrap(name, decorate) {
      const previous = s[name];
      if (typeof previous !== 'function') throw new Error(`Missing boss integration: ${name}`);
      const next = decorate(previous); s[name] = next;
      undo.push(() => { if (s[name] === next) s[name] = previous; });
    }
    function hud(boss) {
      s.bossHpFill.setSize(212 * clamp(boss.hp / TYRANT.maxHp, 0, 1), 7);
      s.bossHpText.setText(`CANOPY TYRANT  ${Math.max(0, boss.hp)} / ${TYRANT.maxHp}`);
    }
    function caption(value) {
      encounter.caption.setText(value).setVisible(true);
    }
    function warning(plan) {
      encounter.guides.clear().lineStyle(2, 0xf2d28a, 0.55);
      for (const p of plan.shots) {
        encounter.guides.lineBetween(p.x, p.y, p.x + Math.cos(p.angle) * 72, p.y + Math.sin(p.angle) * 72);
      }
      caption(`PHASE ${encounter.phase} // ${plan.label}`);
    }
    wrap('create', previous => function (...args) {
      reset(); previous.apply(this, args);
      // An explicit boss-only practice entry starts with an earned endgame loadout.
      // It never applies to the normal campaign or creates an eligible score.
      const params = typeof location === 'undefined' ? null : new URLSearchParams(location.search);
      if (this.run.wave === 9 && params?.get('bossPractice') === 'cannon') {
        this.run.practice = true; this.stage = 4; this.weaponLevel = 4;
        this.run.maxStage = 4; this.applyStage(false); this.updateHud();
        this.setLesson('BOSS PRACTICE // ANCIENT + CANOPY CANNON // UNRANKED', 3200);
      }
      this.events.once('shutdown', reset);
    });
    wrap('spawnCanopyTyrant', previous => function (...args) {
      reset(); previous.apply(this, args);
      const boss = this.enemies.getChildren().find(e => e.active && e.getData('boss'));
      if (!boss) return;
      boss.hp = TYRANT.maxHp;
      boss.setData('tyrantCombatV2', true).setData('maxHp', TYRANT.maxHp).setData('tyrantArmorStage', 0);
      encounter = { boss, elapsed: 0, motion: 0, phase: 1, serial: 0, pending: null,
        nextAt: TYRANT.initialRestMs, wasSettled: false,
        guides: this.add.graphics().setDepth(2),
        caption: this.add.text(240, 307, '', { fontFamily: 'Verdana, Arial, sans-serif', fontSize: '11px',
          fontStyle: 'bold', color: '#f2d28a', align: 'center', wordWrap: { width: 414 },
          backgroundColor: '#07170f', padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(9),
      };
      caption('CANOPY TYRANT // ARRIVING — ARMOR CLOSED'); hud(boss);
    });
    wrap('addBossDamage', previous => function (boss, legacyStage) {
      if (!boss.getData('tyrantCombatV2')) return previous.call(this, boss, legacyStage);
      // The original collision and campaign adapters pass fixed 24-HP stages.
      // Derive the actual stage here so neither legacy caller can revert the art.
      const stage = armorStage(boss.hp);
      if (boss.getData('tyrantArmorStage') !== stage) {
        boss.setData('tyrantArmorStage', stage); previous.call(this, boss, stage);
      }
      boss.setData('bossDamageStage', stage);
    });
    wrap('hitEnemy', previous => function (enemy, damage, prune) {
      if (!enemy?.getData('tyrantCombatV2')) return previous.call(this, enemy, damage, prune);
      if (!enemy.active || !enemy.settled || this.waveClearing || this.paused) return;
      const result = previous.call(this, enemy, damage, prune);
      if (!enemy.active) { clearWarning(); return result; }
      this.addBossDamage(enemy, armorStage(enemy.hp)); hud(enemy);
      return result;
    });
    wrap('enemyFire', previous => function (enemy) {
      if (enemy?.getData('tyrantCombatV2')) return; // Only the telegraphed scheduler fires the boss.
      return previous.call(this, enemy);
    });
    wrap('updateEnemies', previous => function (time, delta) {
      if (this.run.wave !== 9 || !encounter) return previous.call(this, time, delta);
      const e = encounter, boss = e.boss;
      if (!boss.active || this.waveClearing) { clearWarning(); return; }
      if (this.paused || this.physics.world.isPaused) return;
      if (!boss.settled) return;
      // Only accumulate active simulation steps, not wall time spent in a menu.
      const step = clamp(Number.isFinite(delta) ? delta : 0, 0, 100);
      e.elapsed += step;
      if (!e.wasSettled) { e.wasSettled = true; caption('PHASE 1 // ROOT ARMOR'); }
      const phase = bossPhase(boss.hp);
      if (phase !== e.phase) {
        e.phase = phase; clearWarning(); this.bullets.clear(true, true);
        e.nextAt = e.elapsed + 900;
        caption(phase === 2 ? 'PHASE 2 // THORN BARRAGE' : 'PHASE 3 // CORE FRENZY');
      }
      if (time < (boss.getData('armorHitUntil') || 0)) boss.setTintFill(0xffecc5);
      else boss.clearTint();
      if (time < (boss.getData('shieldStunUntil') || 0)) {
        clearWarning(); e.nextAt = e.elapsed + 700; return;
      }
      if (e.pending) {
        // Freeze at the warned firing position. No last-millisecond re-aim.
        if (e.elapsed >= e.pending.fireAt) {
          const plan = e.pending;
          if (this.bullets.countActive(true) + plan.shots.length <= TYRANT.maxBullets) {
            for (const p of plan.shots) this.launchHostile(p.x, p.y, 'barkDrill', p.angle, p.speed, 'drill');
          }
          clearWarning(); e.nextAt = e.elapsed + plan.restMs;
        }
        return;
      }
      e.motion += step;
      const p = bossPosition(e.motion, e.phase), travel = (125 + e.phase * 20) * step / 1000;
      boss.setPosition(boss.x + clamp(p.x - boss.x, -travel, travel),
        boss.y + clamp(p.y - boss.y, -70 * step / 1000, 70 * step / 1000));
      if (e.elapsed < e.nextAt) return;
      const plan = planVolley(e.phase, e.serial++, boss, this.player);
      e.pending = { ...plan, fireAt: e.elapsed + plan.warningMs }; warning(plan);
    });
    wrap('bindCollisions', previous => function (...args) {
      const scene = this, factory = this.physics.add, overlap = factory.overlap;
      factory.overlap = function (a, b, callback, ...rest) {
        const contact = (a === scene.player && b === scene.enemies) || (b === scene.player && a === scene.enemies);
        const safeCallback = contact ? function (one, two) {
          const enemy = one === scene.player ? two : one;
          if (enemy?.getData('tyrantCombatV2')) {
            if (!scene.isCloaked()) scene.damagePlayer();
            return; // Ramming never deletes the boss or bypasses its remaining HP.
          }
          return callback?.call(this, one, two);
        } : callback;
        return overlap.call(this, a, b, safeCallback, ...rest);
      };
      try { return previous.apply(this, args); } finally { factory.overlap = overlap; }
    });
    const onContinue = () => {
      if (!encounter || !encounter.boss.active) return;
      clearWarning(); encounter.nextAt = encounter.elapsed + 1000;
      // Boss HP and phase are deliberately preserved; no repeat entrance or healing.
    };
    game.events.on('arcade:continue-authorized', onContinue);
    undo.push(() => game.events.off('arcade:continue-authorized', onContinue));
  }
  if (game.scene.getScene('game')) attach(); else game.events.once('ready', attach);
  return () => { disposed = true; installedGames.delete(game); game.events.off('ready', attach); reset(); undo.reverse().forEach(fn => fn()); };
}
