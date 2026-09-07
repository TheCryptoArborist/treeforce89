"use client";
import { useEffect, useRef } from "react";
import type Phaser from "phaser";

export default function CanopyGame() {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;
    Promise.all([
      import("./game/arcade"),
      import("./game/campaign-polish"),
      import("./game/rounded-pickups"),
    ]).then(
      ([{ createCanopyGame }, { installCampaignPolish }, { installRoundedPickups }]) => {
        if (cancelled || !mount.current) return;
        game = createCanopyGame(mount.current);
        installCampaignPolish(game);
        installRoundedPickups(game);
      },
    );
    return () => { cancelled = true; game?.destroy(true); };
  }, []);
  return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game" />;
}
