"use client";
import {useEffect,useRef} from "react";
import type Phaser from "phaser";
import "./game/records.css";
export default function CanopyGame(){
 const mount=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let game:Phaser.Game|undefined,cancelled=false;const disposers:Array<()=>void>=[];
  Promise.all([import('./game/arcade'),import('./game/campaign-polish'),import('./game/rounded-pickups'),import('./game/records-game.mjs'),import('./game/tyrant-combat.mjs'),import('./game/capture-animation.mjs'),import('./game/boss-background.mjs')]).then(([a,p,r,records,boss,capture,background])=>{
   if(cancelled||!mount.current)return;game=a.createCanopyGame(mount.current);p.installCampaignPolish(game);r.installRoundedPickups(game);
   disposers.push(boss.installTyrantCombat(game),capture.installCaptureAnimation(game),background.installBossBackground(game));
   const frame=mount.current.closest('.game-frame');disposers.push(records.installArcadeRecords(game,frame));
  });
  return()=>{cancelled=true;disposers.reverse().forEach(f=>f());game?.destroy(true);};
 },[]);
 return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game"/>;
}
