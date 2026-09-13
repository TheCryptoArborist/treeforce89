import type Phaser from 'phaser';

type Sprite = Phaser.Physics.Arcade.Sprite;
type Drop = (x: number, y: number, kind: string) => void;
interface PickupScene extends Phaser.Scene {
  pickups: Phaser.Physics.Arcade.Group;
  maybeDropVictoryTurbo: Drop;
  maybeDropSovereignShield: Drop;
}
const pickups = [
  { source: 'victoryTurbo', target: 'victoryTurbo-circle-v1', method: 'maybeDropVictoryTurbo', rim: '#f2d28a' },
  { source: 'sovereignShield', target: 'sovereignShield-circle-v1', method: 'maybeDropSovereignShield', rim: '#8eefff' },
] as const;

/** Bake transparency into the texture itself; works with the game's Canvas renderer. */
export function drawRoundPickup(source: CanvasImageSource, width: number, height: number, rim: string): HTMLCanvasElement {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Cannot round a pickup without a valid source image.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable for circular pickups.');
  const x = width / 2, y = height / 2, radius = Math.min(width, height) * .46;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#081d24'; ctx.fillRect(0, 0, width, height);
  // Keep the original logo at its original size, not shrunk into a square inside a coin.
  ctx.drawImage(source, 0, 0, width, height);
  ctx.lineWidth = Math.max(2, Math.min(width, height) * .018);
  ctx.strokeStyle = rim;
  ctx.beginPath(); ctx.arc(x, y, radius - ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  return canvas;
}

export function installRoundedPickups(game: Phaser.Game): void {
  const attach = () => {
    if (game.registry.get('rounded-pickups-v1')) return;
    const scene = game.scene.getScene('game') as PickupScene | null;
    if (!scene) throw new Error('Game scene unavailable for circular pickups.');
    for (const spec of pickups) {
      const original = scene[spec.method];
      scene[spec.method] = function (...args) {
        original.apply(this, args);
        // The original drop code still controls rarity, velocity, halo and power-up effects.
        for (const child of this.pickups.getChildren()) {
          const token = child as Sprite;
          if (!token.active || token.texture.key !== spec.source) continue;
          const { width, height } = token;
          if (!this.textures.exists(spec.target)) {
            const source = this.textures.get(spec.source).getSourceImage() as CanvasImageSource;
            const canvas = drawRoundPickup(source, width, height, spec.rim);
            if (!this.textures.addCanvas(spec.target, canvas)) throw new Error(`Cannot register ${spec.target}`);
          }
          // Cache separately; never delete or repeatedly shrink the original on replay.
          const body = token.body as Phaser.Physics.Arcade.Body | null;
          const radius = Math.min(body?.radius || Math.min(width, height) * .46, Math.min(width, height) * .46);
          token.setTexture(spec.target);
          body?.setCircle(radius, width / 2 - radius, height / 2 - radius);
        }
      };
    }
    game.registry.set('rounded-pickups-v1', true);
  };
  if (game.scene.getScene('game')) attach();
  else game.events.once('ready', attach);
}
