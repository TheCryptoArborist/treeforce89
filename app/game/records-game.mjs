import {createRecordStore,STORAGE_KEY,RULESET,integer} from './records-core.mjs';
import {createRecordsDesk} from './records-ui.mjs';
const uuid=()=>globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
/** Adapter over the existing scenes; combat and power-up behavior remain untouched. */
export function wireRecords(game,store) {
  let current=null,disposed=false,panelOpen=false;
  const cleanups=[],pausedScenes=[];
  function attach(){
    if(disposed)return;
    const s=game.scene.getScene('game');if(!s)throw new Error('Game scene missing for records');
    function taint(reason){if(!current)return;current.reasons.add(reason);s.run.practice=true;}
    function sample(){
      if(!current||!s.run)return;
      current.maxCombo=Math.max(current.maxCombo,integer(s.chain));
      current.maxGrowth=Math.max(current.maxGrowth,integer(s.run.maxStage)+1);
      current.maxWeapon=Math.max(current.maxWeapon,integer(s.weaponLevel)+1);
      if(s.debug||s.invincible)taint('Developer tools used');
      if(s.time.timeScale!==1 || (s.physics.world.timeScale??1)!==1)taint('Game speed modified');
    }
    function snapshot(cleared=false){
      sample();const c=current,r=s.run;if(!c)return null;
      return {id:c.id,ruleset:RULESET,callsign:store.get().state.pilot.callsign,title:store.get().state.pilot.title,
        kind:c.continued?'continued':c.reasons.size?'practice':'normal',reasons:[...c.reasons],
        score:Math.round(r.score),kills:integer(r.kills),shotsFired:integer(r.shotsFired),shotsHit:integer(r.shotsHit),
        startWave:c.startWave,waveReached:integer(r.wave)+1,wavesCleared:c.wavesCleared,cleared:!!cleared,
        endedAt:Date.now(),elapsedMs:integer(c.elapsed),maxCombo:c.maxCombo,maxGrowth:c.maxGrowth,maxWeapon:c.maxWeapon,
        rescues:c.rescues,boom:c.boom,ghost:c.ghost,perfect:integer(r.perfect)};
    }
    function save(cleared=false){const record=snapshot(cleared);if(record)store.save(record);}
    function wrap(name,decorate){const old=s[name];if(typeof old!=='function')return;const next=decorate(old);s[name]=next;cleanups.push(()=>{if(s[name]===next)s[name]=old;});}
    wrap('create',old=>function(...args){
      current=null;old.apply(this,args);
      current={id:uuid(),startWave:integer(this.run.wave)+1,reasons:new Set(),continued:false,elapsed:0,maxCombo:0,maxGrowth:1,maxWeapon:1,wavesCleared:0,rescues:0,boom:0,ghost:0};
      if(current.startWave!==1)taint('Wave-select practice');
      let lastHud=0;
      const tick=(time,delta)=>{sample();if(!this.paused&&!this.physics.world.isPaused)current.elapsed+=Math.max(0,Math.min(250,delta||0));if(high&&time-lastHud>=300){lastHud=time;high.setText(`BEST\n${String(Math.max(store.get().state.best[0]?.score||0,current.reasons.size?0:integer(this.run.score))).padStart(6,'0')}`);}};
      this.events.on('postupdate',tick);this.events.once('shutdown',()=>this.events.off('postupdate',tick));
      const high=this.children.list.find(o=>typeof o.text==='string'&&o.text.startsWith('HI\n'));
      if(high)high.setText(`BEST\n${String(store.get().state.best[0]?.score||0).padStart(6,'0')}`);
      // Taint immediately on opening the lab; turning it off cannot restore eligibility.
      const debugKey=()=>taint('Developer tools used');this.input.keyboard?.on('keydown-BACKTICK',debugKey);
      this.events.once('shutdown',()=>this.input.keyboard?.off('keydown-BACKTICK',debugKey));
      for(const object of this.debugPanel?.list||[])if(object.input)object.on('pointerdown',debugKey);
      sample();
    });
    wrap('roundSequence',old=>function(...args){if(current)current.wavesCleared=Math.max(current.wavesCleared,this.run.wave+2-current.startWave);return old.apply(this,args);});
    for(const name of ['hitEnemy','collectWeaponCore','grow'])wrap(name,old=>function(...args){const result=old.apply(this,args);sample();return result;});
    for(const [name,key] of [['collectBoom','boom'],['collectSovereignShield','ghost']])wrap(name,old=>function(token,...args){const active=!!token?.active;const result=old.call(this,token,...args);if(current&&active&&!token.active)current[key]++;return result;});
    wrap('rescueCapturedWing',old=>function(...args){const before=this.grafted;const result=old.apply(this,args);if(current&&!before&&this.grafted)current.rescues++;return result;});
    wrap('endRun',old=>function(cleared=false){save(cleared);if(current)this.run.elapsedMs=integer(current.elapsed);return old.call(this,cleared);});
    // Future payment adapter calls this only AFTER authorization and BEFORE restoring lives.
    // No payment or credit issuance is implemented by this local preview.
    const beforeContinue=()=>{
      if(!current||current.continued)return;
      save(false);current.continued=true;current.id=uuid();taint('Continued run');
    };
    game.events.on('arcade:continue-authorized',beforeContinue);
    cleanups.push(()=>game.events.off('arcade:continue-authorized',beforeContinue));
  }
  if(game.scene.getScene('game'))attach();else game.events.once('ready',attach);
  const controller={
    visibility(open){
      panelOpen=open;
      if(open){
        for(const s of game.scene.getScenes(true)){
          const key=s.sys.settings.key,keyboard=s.input?.keyboard;
          if(pausedScenes.some(p=>p.key===key))continue;
          pausedScenes.push({key,keyboard,enabled:keyboard?.enabled});
          if(keyboard)keyboard.enabled=false;game.scene.pause(key);
        }
      }else for(const item of pausedScenes.splice(0)){
        if(item.keyboard)item.keyboard.enabled=item.enabled;
        if(game.scene.isPaused(item.key))game.scene.resume(item.key);
      }
    },
    destroy(){disposed=true;game.events.off('ready',attach);game.events.off('poststep',enforcePause);this.visibility(false);cleanups.reverse().forEach(fn=>fn());},
  };
  const enforcePause=()=>{if(panelOpen)controller.visibility(true);};
  game.events.on('poststep',enforcePause);
  return controller;
}
export function installArcadeRecords(game,frame){
  if(!frame)return()=>{};
  let storage;try{storage=window.localStorage;}catch{}
  const store=createRecordStore(storage,`guest:${uuid()}`),bridge=wireRecords(game,store);
  const desk=createRecordsDesk(frame,store,open=>bridge.visibility(open));
  const onStorage=event=>{if(event.key===STORAGE_KEY)store.sync();};window.addEventListener('storage',onStorage);
  return()=>{window.removeEventListener('storage',onStorage);desk.destroy();bridge.destroy();};
}
