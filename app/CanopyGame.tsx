"use client";
import {useEffect,useRef} from 'react';
import type Phaser from 'phaser';

type Destination='game'|'title';
type Props={serverRunId?:string;initialScene?:Destination;onNewRunRequested?:(destination:Destination)=>Promise<void>};

export default function CanopyGame({serverRunId,initialScene='title',onNewRunRequested}:Props={}) {
  const mount=useRef<HTMLDivElement>(null);
  const requestRef=useRef(onNewRunRequested);
  requestRef.current=onNewRunRequested;
  useEffect(()=>{
    let game:Phaser.Game|undefined;
    let cancelled=false;
    import('./game/arcade').then(({createCanopyGame})=>{
      if(!cancelled && mount.current)game=createCanopyGame(mount.current,{
        serverRunId,initialScene,
        requestNewRun:async destination=>{
          if(!requestRef.current)throw Error('Reconnect your wallet to start a new run.');
          await requestRef.current(destination);
        },
      });
    });
    return()=>{cancelled=true;game?.destroy(true);};
  },[serverRunId,initialScene]);
  return <div ref={mount} className="phaser-mount" aria-label="Playable TREE FORCE '89 game"/>;
}
