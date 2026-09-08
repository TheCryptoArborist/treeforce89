import type Phaser from 'phaser';
export function installArcadeRecords(game: Phaser.Game, frame: Element | null): () => void;
export function wireRecords(game: Phaser.Game, store: unknown): {visibility(open: boolean): void; destroy(): void};
