const uuid=()=>crypto.randomUUID();
export const requestId=uuid;
export function prepareArborwing(scene) {
  if(!scene.player?.body || !scene.run || !scene.physics?.world || typeof scene.applyStage!=='function' || typeof scene.updateHud!=='function') throw new Error('The Arborwing cannot be restored in this scene.');
}
export function restoreArborwing(scene,lives=3) {
  prepareArborwing(scene);
  // Keep the campaign, enemy positions, boss HP, score and extra-life awards intact.
  scene.shots.clear(true,true);scene.bullets.clear(true,true);scene.branches?.clear(true,true);
  for(const key of ['capturedWing','rescuedWing','snareBeam','cloakRing','cloakCore']){scene[key]?.destroy();scene[key]=undefined;}
  if(scene.snareEnemy?.active)scene.snareEnemy.setData('holding',false).setData('isCaptor',false).setData('rescueWindow',false);
  scene.snareEnemy=undefined;scene.grafted=false;scene.stage=0;scene.growth=0;scene.weaponLevel=0;scene.pruneCharge=0;
  scene.pruneReadyAnnounced=false;scene.chain=0;scene.chainUntil=0;scene.turboUntil=0;scene.cloakUntil=0;
  scene.lives=lives;scene.applyStage(false);
  scene.player.setPosition(240,570).setVelocity(0,0).setActive(true).setVisible(true).setAlpha(1).clearTint();
  scene.player.body.enable=true;scene.player.body.reset?.(240,570);
  scene.invulnUntil=scene.time.now+3000;
  scene.clearTouchState();scene.controllerFireHeld=false;scene.input.keyboard?.resetKeys?.();scene.updateHud();
}
/** A retry resumes the SAME operation IDs. Never restore while the commit is uncertain. */
export function createContinueAttempt({api,clientRunId=uuid(),prepare,apply,boundary,resume}) {
  const ids=Object.fromEntries(['open','reserve','commit','deliver','release','finish'].map(k=>[k,uuid()]));
  let runId=null,reservation=null,owner=null,restored=false,done=false,busy=false,boundarySet=false,closed=false;
  async function call(command){const p=await api(command);if(owner&&p.ledger.accountId!==owner)throw new Error('Account changed. This flight cannot use another account balance.');owner=p.ledger.accountId;return p.result;}
  const send=(action,fields={},idKey=action)=>call({action,requestId:ids[idKey],...fields});
  return {
    get state(){return {runId,reservation,restored,done,busy,closed,canDecline:!restored};},
    async continue({failPreparation=false}={}) {
      if(busy||done||closed)return false;busy=true;
      try {
        if(!runId)runId=(await send('open-run',{clientRunId},'open')).runId;
        if(!reservation)reservation=await send('reserve',{runId});
        if(!['reserved','committed','delivered'].includes(reservation.status))throw new Error('This test continue was released. Finish the run and try a new flight.');
        if(!restored) {
          try {if(failPreparation)throw new Error('Simulated game failure: no continue was delivered.');prepare();}
          catch(error){await send('release',{reservationId:reservation.reservationId});closed=true;throw error;}
        }
        reservation=await send('commit',{reservationId:reservation.reservationId});
        if(!['committed','delivered'].includes(reservation.status)){closed=true;restored=false;throw new Error('The unfinished test charge was returned. Finish this run.');}
        if(!restored) {
          try {if(!boundarySet){boundary();boundarySet=true;}apply(reservation.lives);restored=true;}
          catch(error){await send('release',{reservationId:reservation.reservationId});closed=true;throw error;}
        }
        // Local game is restored but remains paused until server delivery confirmation.
        reservation=await send('deliver',{reservationId:reservation.reservationId});
        if(reservation.status!=='delivered')throw new Error('Continue delivery was not confirmed.');
        done=true;resume();return true;
      }finally{busy=false;}
    },
    async cancel(){
      if(busy||done||restored) return false;
      busy=true;
      try {if(runId)await send('finish',{runId});closed=true;return true;}
      finally{busy=false;}
    },
    async finish(){if(runId)await send('finish',{runId});},
  };
}

/** Isolated wrapper over the existing preview. No wave or combat tuning is changed. */
export function wireContinueGame(game,api,ui) {
  let flight=null,disposed=false;const undo=[];
  function attach(){
    if(disposed)return;const s=game.scene.getScene('game');if(!s)throw new Error('Game scene unavailable');
    const oldCreate=s.create,oldEnd=s.endRun,oldPause=s.togglePause,oldDamage=s.damagePlayer;
    function unlock(f){if(s.input?.keyboard)s.input.keyboard.enabled=f.keyboardEnabled;s.input.enabled=f.inputEnabled;s.paused=false;s.physics.world.resume();if(game.scene.isPaused('game'))game.scene.resume('game');}
    function finalEnd(f,cleared=false){if(!f||f.ended)return;f.ended=true;ui.close();unlock(f);oldEnd.call(s,cleared);void f.attempt?.finish().catch(()=>{});}
    s.create=function(...args){oldCreate.apply(this,args);flight={id:uuid(),used:false,offered:false,ended:false,attempt:null,keyboardEnabled:this.input.keyboard?.enabled,inputEnabled:this.input.enabled};};
    s.togglePause=function(...args){if(!flight?.offered)return oldPause.apply(this,args);};
    s.damagePlayer=function(...args){if(!flight?.offered)return oldDamage.apply(this,args);};
    s.endRun=function(cleared=false){
      const f=flight;
      if(!f||cleared||f.used){if(f?.offered)finalEnd(f,cleared);else {oldEnd.call(this,cleared);void f?.attempt?.finish().catch(()=>{});}return;}
      if(f.ended||f.offered)return;
      f.offered=true;f.keyboardEnabled=this.input.keyboard?.enabled;f.inputEnabled=this.input.enabled;
      this.clearTouchState();this.player.setVelocity(0,0);this.paused=true;this.physics.world.pause();this.input.enabled=false;
      if(this.input.keyboard)this.input.keyboard.enabled=false;game.scene.pause('game');
      const valid=()=>{if(disposed||flight!==f||f.ended)throw new Error('This flight has ended.');prepareArborwing(s);};
      f.attempt=createContinueAttempt({api,clientRunId:f.id,prepare:valid,
        boundary:()=>{valid();game.events.emit('arcade:continue-authorized');s.run.continued=true;},
        apply:lives=>{valid();restoreArborwing(s,lives);},
        resume:()=>{valid();f.used=true;f.offered=false;ui.close();unlock(f);s.notice?.setVisible(false);s.banner('CONTINUED FLIGHT\nCASUAL SCORE ONLY','#f2d28a');},
      });
      ui.offer({score:this.run.score,wave:this.run.wave+1,attempt:f.attempt,decline:async()=>{if(await f.attempt.cancel())finalEnd(f);}});
    };
    undo.push(()=>{s.create=oldCreate;s.endRun=oldEnd;s.togglePause=oldPause;s.damagePlayer=oldDamage;});
  }
  if(game.scene.getScene('game'))attach();else game.events.once('ready',attach);
  return {
    testNow(){const s=game.scene.getScene('game');if(!s||!flight||flight.used||flight.ended||flight.offered||!game.scene.isActive('game'))return false;
      // The records adapter samples this permanent flag; test shortcuts cannot earn normal badges.
      s.run.practice=true;s.lives=0;s.endRun(false);return true;},
    destroy(){disposed=true;game.events.off('ready',attach);void flight?.attempt?.cancel().catch(()=>{});undo.reverse().forEach(fn=>fn());},
  };
}
