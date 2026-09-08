"use client";
import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import "./game/records.css";

export default function CanopyGame() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let disposeRecords: (() => void) | undefined;
    let cancelled = false;
    Promise.all([
      import("./game/arcade"),
      import("./game/campaign-polish"),
      import("./game/rounded-pickups"),
      import("./game/records-game.mjs"),
    ]).then(
      ([{ createCanopyGame }, { installCampaignPolish }, { installRoundedPickups }, { installArcadeRecords }]) => {
        if (cancelled || !mount.current) return;
        game = createCanopyGame(mount.current);
        installCampaignPolish(game);
        installRoundedPickups(game);
        disposeRecords = installArcadeRecords(game, mount.current.closest(".game-frame"));
      },
    );
    return () => { cancelled = true; disposeRecords?.(); game?.destroy(true); };
  }, []);
  return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game" />;
}
