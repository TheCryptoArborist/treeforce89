"use client";
import {useEffect,useRef} from "react";
import type Phaser from "phaser";
export default function CanopyGame(){const mount=useRef<HTMLDivElement>(null);useEffect(()=>{let game:Phaser.Game|undefined;let cancelled=false;import("./game/arcade").then(({createCanopyGame})=>{if(!cancelled&&mount.current)game=createCanopyGame(mount.current)});return()=>{cancelled=true;game?.destroy(true)}},[]);return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game"/>}
