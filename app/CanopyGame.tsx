"use client";
import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import "./game/records.css";
import "./game/tree-account.css";
import "./game/continues.css";

export default function CanopyGame() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let disposeRecords: (() => void) | undefined;
    let disposeAccount: (() => void) | undefined;
    let disposeContinues: (() => void) | undefined;
    let cancelled = false;
    Promise.all([
      import("./game/arcade"), import("./game/campaign-polish"),
      import("./game/rounded-pickups"), import("./game/records-game.mjs"),
      import("./game/tree-account.mjs"), import("./game/continue-ui.mjs"),
    ]).then(([{ createCanopyGame }, { installCampaignPolish }, { installRoundedPickups }, { installArcadeRecords }, { installTreeAccount }, { installTreeContinues }]) => {
      if (cancelled || !mount.current) return;
      game = createCanopyGame(mount.current);
      installCampaignPolish(game); installRoundedPickups(game);
      const frame = mount.current.closest(".game-frame");
      disposeRecords = installArcadeRecords(game, frame);
      disposeAccount = installTreeAccount(game, frame);
      disposeContinues = installTreeContinues(game, frame);
    });
    return () => { cancelled = true; disposeContinues?.(); disposeAccount?.(); disposeRecords?.(); game?.destroy(true); };
  }, []);
  return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game" />;
}
