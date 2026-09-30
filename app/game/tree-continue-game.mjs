import { prepareArborwing, restoreArborwing } from './continue-flow.mjs';
/** Separate integration: the approved CC simulation adapter is left untouched. */
export function wireDirectContinueGame(game, makeAttempt, ui) {
  let flight = null, disposed = false; const undo = [];
  function attach() {
    if (disposed) return;
    const s = game.scene.getScene('game'); if (!s) throw Error('Game scene unavailable');
    const original = Object.fromEntries(['create', 'endRun', 'togglePause', 'damagePlayer'].map(k => [k, s[k]]));
    const current = f => { if (disposed || flight !== f || f.ended) throw Error('This flight has ended.'); prepareArborwing(s); };
    function unlock(f) {
      s.clearTouchState(); s.input.keyboard?.resetKeys?.(); s.controllerFireHeld = false;
      if (s.input.keyboard) s.input.keyboard.enabled = f.keyboard;
      s.input.enabled = f.input; s.paused = false; s.physics.world.resume();
      if (game.scene.isPaused('game')) game.scene.resume('game');
    }
    s.create = function (...args) {
      original.create.apply(this, args);
      flight = { id: crypto.randomUUID(), used: false, offered: false, ended: false };
    };
    s.togglePause = function (...args) { if (!flight?.offered) return original.togglePause.apply(this, args); };
    s.damagePlayer = function (...args) { if (!flight?.offered) return original.damagePlayer.apply(this, args); };
    s.endRun = function (cleared = false) {
      const f = flight;
      if (!f || cleared || f.used || this.lives > 0) {
        if (f) { f.ended = true; if (f.offered) { ui.close(); unlock(f); } }
        return original.endRun.call(this, cleared);
      }
      if (f.offered || f.ended) return;
      f.offered = true; f.keyboard = s.input.keyboard?.enabled; f.input = s.input.enabled;
      s.clearTouchState(); s.player.setVelocity(0, 0); s.paused = true; s.physics.world.pause();
      s.input.enabled = false; if (s.input.keyboard) s.input.keyboard.enabled = false;
      game.scene.pause('game');
      f.attempt = makeAttempt({ clientRunId: f.id,
        prepare: () => current(f),
        boundary: () => { current(f); game.events.emit('arcade:continue-authorized'); s.run.continued = true; },
        apply: lives => { current(f); restoreArborwing(s, lives); },
        resume: () => { current(f); f.used = true; f.offered = false; ui.close(); unlock(f);
          s.notice?.setVisible(false); s.banner('CONTINUED FLIGHT\nCASUAL SCORE ONLY', '#f2d28a'); },
      });
      ui.offer({ runId: f.id, wave: this.run.wave + 1, score: this.run.score, attempt: f.attempt,
        startNew: async () => {
          if (!await f.attempt.cancel()) return false;
          current(f); f.ended = true; ui.close(); unlock(f); original.endRun.call(s, false);
          game.events.once('poststep', () => { if (!disposed && flight === f) {
            game.scene.stop('gameover'); game.scene.start('game');
          } });
          return true;
        },
      });
    };
    undo.push(() => { for (const [k, v] of Object.entries(original)) s[k] = v; });
  }
  if (game.scene.getScene('game')) attach(); else game.events.once('ready', attach);
  return { destroy() { disposed = true; game.events.off('ready', attach); ui.close(); undo.reverse().forEach(f => f()); } };
}
