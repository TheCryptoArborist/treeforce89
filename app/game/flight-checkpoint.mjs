/** Versioned, data-only game-over checkpoint. Recovery normalizes unfinished attack motion
 * into a safe formation, preserving surviving enemies/HP, pending spawns, score and RNG.
 * This codec is NOT an anti-cheat validator or payment authorization.
 */
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const scalarKeys=['waveSpawned','waveKillsStart','waveDamage','captureUsed','capturedStage','extraLivesAwarded','killsSinceSeed','killsSinceCore','killsSinceTurbo','killsSinceBoom','killsSinceCloak','attackSerial','rushTargets','rushDestroyed','rushShotsFired','rushShotsHit','pruneTaught','seedTaught','coreTaught','turboTaught','boomTaught','cloakTaught'];
const runKeys=['runId','seed','score','wave','kills','perfect','maxStage','shotsFired','shotsHit','mode'];
const enemyKeys=['kind','hp','homeX','homeY','phase','formationIndex'];
const dataKeys=['leader','family','baseScale','formationRow','transformed','escortAttack','boss','bossDamageStage','tyrantCombatV2','maxHp','tyrantArmorStage','pickupType','growthValue','spin'];
const textures=['nightwing','emberWasp','thornBeetle','duskMoth','blightSpore','barkDriller','stormShrike','riptailRaptor','rootguardSentinel','canopyTyrantV2','small','bat','borer','spore','growthSeed','weaponCore','victoryTurbo','boomLogo','sovereignShield','boomToken'];
const kinds=['bat','borer','spore','small','boss'];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
function clean(v,depth=0){
 assert(depth<=16,'Checkpoint too deep');
 if(v===null||typeof v==='boolean')return v;
 if(typeof v==='number'){assert(number(v,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),'Invalid checkpoint number');return v;}
 if(typeof v==='string'){assert(v.length<=1000,'Checkpoint string too long');return v;}
 assert(v&&typeof v==='object'&&(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null),'Invalid checkpoint value');
 if(Array.isArray(v)){assert(v.length<=512,'Too many checkpoint items');return v.map(x=>clean(x,depth+1));}
 const keys=Object.keys(v);assert(keys.length<=128&&!keys.some(k=>['__proto__','constructor','prototype'].includes(k)),'Invalid checkpoint keys');
 return Object.fromEntries(keys.map(k=>[k,clean(v[k],depth+1)]));
}
function sprite(o,now){
 const body=o.body;assert(body,'Missing physical actor');
 const record={texture:o.texture.key,x:o.x,y:o.y,scaleX:o.scaleX,scaleY:o.scaleY,angle:o.angle,depth:o.depth,
  velocity:{x:body.velocity.x,y:body.velocity.y},body:{width:body.sourceWidth,height:body.sourceHeight,radius:body.isCircle?body.radius:0,offsetX:body.offset.x,offsetY:body.offset.y},
  data:Object.fromEntries(dataKeys.filter(k=>o.getData(k)!==undefined).map(k=>[k,o.getData(k)])),props:pick(o,enemyKeys),
  mutateIn:Math.max(0,(o.getData('mutateAt')||0)-now),fireAgo:Math.max(0,now-(o.lastFire||0))};
 return record;
}
export function validateCheckpoint(input){
 const s=clean(input);assert(new TextEncoder().encode(JSON.stringify(s)).length<=262144,'Checkpoint too large');
 assert(s.format==='treeforce89.checkpoint.v1'&&s.ruleset==='treeforce89.v1'&&ID.test(s.runId),'Wrong checkpoint format');
 assert(s.lives===0&&s.continuesUsed===0&&Number.isInteger(s.wave)&&s.wave>=1&&s.wave<=10&&Number.isInteger(s.score)&&number(s.score,0,9999999999),'Not an exhausted flight');
 const c=s.scene;assert(c?.codec==='formation-recovery.v1'&&c.run&&c.values&&c.timing,'Unsupported scene checkpoint');
 assert(c.run.wave===s.wave-1&&c.run.score===s.score&&typeof c.run.runId==='string'&&Number.isSafeInteger(c.rngSeed),'Run mismatch');
 for(const [k,v] of Object.entries(c.values))assert(scalarKeys.includes(k)&&(typeof v==='boolean'||Number.isSafeInteger(v)&&v>=0&&v<=10000000),'Invalid scene counter');
 assert(Number.isInteger(c.values.waveSpawned)&&c.values.waveSpawned>=0,'Missing spawn progress');
 for(const k of ['waveElapsed','diveIn','fireIn','durationMs'])assert(number(c.timing[k],0,86400000),'Invalid checkpoint timing');
 for(const key of ['clearedRows','escortKills','escortTargets'])assert(Array.isArray(c[key])&&c[key].length<=256,'Invalid formation accounting');
 assert(c.clearedRows.every(n=>Number.isInteger(n)&&n>=0&&n<=128),'Invalid cleared rows');
 for(const key of ['escortKills','escortTargets'])assert(c[key].every(v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=10000000)),'Invalid escort map');
 assert(Array.isArray(c.enemies)&&c.enemies.length<=256&&Array.isArray(c.pickups)&&c.pickups.length<=256,'Too many actors');
 for(const o of [...c.enemies,...c.pickups]){
  assert(textures.includes(o.texture)&&number(o.x,-2500,2500)&&number(o.y,-2500,2500)&&number(o.scaleX,.001,10)&&number(o.scaleY,.001,10)&&number(o.angle,-100000,100000)&&number(o.depth,-10,20),'Invalid actor');
  assert(number(o.velocity?.x,-2500,2500)&&number(o.velocity?.y,-2500,2500)&&number(o.body?.width,1,2048)&&number(o.body?.height,1,2048)&&number(o.body?.radius,0,1024)&&number(o.body?.offsetX,-2048,2048)&&number(o.body?.offsetY,-2048,2048),'Invalid actor body');
  assert(o.data&&Object.keys(o.data).every(k=>dataKeys.includes(k))&&o.props&&Object.keys(o.props).every(k=>enemyKeys.includes(k)),'Invalid actor fields');
  assert(number(o.mutateIn,0,86400000)&&number(o.fireAgo,0,86400000),'Invalid actor timing');
 }
 for(const o of c.enemies)assert(kinds.includes(o.props.kind)&&Number.isInteger(o.props.hp)&&number(o.props.hp,1,180)&&number(o.props.homeX,-2500,2500)&&number(o.props.homeY,-2500,2500)&&number(o.props.phase,-100000,100000)&&Number.isInteger(o.props.formationIndex),'Invalid enemy');
 assert(c.enemies.filter(e=>e.props.kind==='boss').length<=1&&(!c.enemies.some(e=>e.props.kind==='boss')||s.wave===10),'Invalid boss wave');
 for(const o of c.pickups)assert(['growth','weapon','turbo','boom','cloak'].includes(o.data.pickupType),'Invalid pickup');
 return s;
}
export function captureCheckpoint(scene,runId){
 assert(ID.test(runId)&&scene.lives===0&&scene.paused&&!scene.waveClearing,'Pause an exhausted flight first');
 const now=scene.time.now,run=pick(scene.run,runKeys);run.score=Math.round(scene.run.score);run.shotsHit=run.shotsHit||0;
 const snap={format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:run.wave+1,score:run.score,lives:0,continuesUsed:0,
  scene:{codec:'formation-recovery.v1',run,values:pick(scene,scalarKeys),rngSeed:scene.rng.seed,
   timing:{waveElapsed:Math.max(0,now-scene.waveStart),diveIn:Math.max(0,scene.nextDiveAt-now),fireIn:Math.max(0,scene.nextEnemyFireAt-now),durationMs:Math.min(86400000,Math.max(0,Date.now()-scene.run.start))},
   clearedRows:[...scene.clearedRows],escortKills:[...scene.escortKills],escortTargets:[...scene.escortTargets],
   enemies:scene.enemies.getChildren().filter(o=>o.active).map(o=>sprite(o,now)),pickups:scene.pickups.getChildren().filter(o=>o.active).map(o=>sprite(o,now))}};
 return validateCheckpoint(snap);
}
/** Load ONLY into a fresh game scene, remaining paused with zero lives.
 * Any free practice restore is separate from this data load. Real purchases need receipt/lease authority.
 */
export function rehydrateCheckpoint(scene,input){
 const s=validateCheckpoint(input),c=s.scene;
 assert(c.values.waveSpawned<=scene.waveData(s.wave-1).spawns.length,'Invalid pending spawns');
 for(const o of [...c.enemies,...c.pickups])assert(scene.textures.exists(o.texture),'Missing checkpoint texture');
 scene.paused=true;scene.physics.world.pause();scene.clearTouchState();
 scene.time.removeAllEvents();scene.tweens.killAll();
 for(const key of ['shots','bullets','branches','enemies','pickups'])scene[key].clear(true,true);
 for(const key of ['capturedWing','rescuedWing','snareBeam','cloakRing','cloakCore']){scene[key]?.destroy();scene[key]=undefined;}
 scene.snareEnemy=undefined;scene.grafted=false;
 scene.run={...c.run,start:Date.now()-c.timing.durationMs,practice:true,continued:true};
 scene.startWave(s.wave-1);Object.assign(scene,c.values);
 scene.waveStart=scene.time.now-c.timing.waveElapsed;scene.nextDiveAt=scene.time.now+Math.max(1000,c.timing.diveIn);scene.nextEnemyFireAt=scene.time.now+Math.max(1000,c.timing.fireIn);
 scene.clearedRows=new Set(c.clearedRows);scene.escortKills=new Map(c.escortKills);scene.escortTargets=new Map(c.escortTargets);
 function restore(o,group){
  let actor;
  if(o.props.kind==='boss'){scene.spawnCanopyTyrant();actor=scene.enemies.getChildren().find(e=>e.active&&e.kind==='boss');scene.tweens.killTweensOf(actor);}
  else actor=group.create(o.x,o.y,o.texture);
  actor.setPosition(o.x,o.y).setScale(o.scaleX,o.scaleY).setAngle(0).setDepth(o.depth).setActive(true).setVisible(true);
  Object.assign(actor,o.props);for(const [key,value]of Object.entries(o.data))actor.setData(key,value);
  if(o.body.radius)actor.body.setCircle(o.body.radius,o.body.offsetX,o.body.offsetY);else actor.body.setSize(o.body.width,o.body.height,false).setOffset(o.body.offsetX,o.body.offsetY);
  actor.body.reset(o.x,o.y);actor.setVelocity(o.velocity.x,o.velocity.y);
  if(group===scene.enemies){actor.settled=true;actor.diving=false;actor.returning=false;actor.lastFire=scene.time.now-o.fireAgo;
   actor.setData('holding',false).setData('isCaptor',false).setData('rescueWindow',false).setData('motionDeadline',0).setData('mutateAt',o.mutateIn?scene.time.now+o.mutateIn:0);
   if(actor.kind!=='small')actor.setVelocity(0,0);
   if(actor.kind==='boss'){scene.bossHpText.setText(`CANOPY TYRANT  ${actor.hp} / 180`);scene.bossHpFill.setSize(212*actor.hp/180,7);scene.addBossDamage(actor,0);}
   else if(o.data.family&&o.data.baseScale)scene.animateEnemy(actor);
  }
  return actor;
 }
 c.enemies.forEach(o=>restore(o,scene.enemies));c.pickups.forEach(o=>restore(o,scene.pickups));scene.rng.seed=c.rngSeed;
 scene.lives=0;scene.stage=0;scene.weaponLevel=0;scene.growth=0;scene.pruneCharge=0;scene.turboUntil=0;scene.cloakUntil=0;scene.chain=0;scene.chainUntil=0;scene.waveClearing=false;
 scene.player.setActive(true).setVisible(true).setPosition(240,570).setVelocity(0,0);scene.player.body.reset(240,570);scene.applyStage(false);scene.updateHud();
 // A valid exhausted snapshot must have already consumed its score milestones.
 assert(scene.lives===0,'Inconsistent extra-life accounting');
 scene.paused=true;scene.physics.world.pause();return s;
}
