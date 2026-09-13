import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { TYRANT, bossPhase, armorStage, bossPosition, planVolley, installTyrantCombat } from '../app/game/tyrant-combat.mjs';

function object() {
  const data = new Map();
  return { active: true, x: 240, y: 178, text: '', scaleX: 0.78,
    getData(k) { return data.get(k); }, setData(k,v) { data.set(k,v); return this; },
    setPosition(x,y) { this.x=x;this.y=y;return this; }, setText(t) {this.text=t;return this;},
    setVisible(v){this.visible=v;return this;},setOrigin(){return this;},setDepth(){return this;},
    setSize(w,h){this.width=w;this.height=h;return this;},setTintFill(){return this;},clearTint(){return this;},
    setTexture(key){this.textureKey=key;return this;},lineStyle(){return this;},lineBetween(){return this;},
    clear(){return this;},destroy(){this.active=false;this.destroyed=true;},
  };
}
function fixture({failBind=false, reversed=false, startWave=9}={}) {
  const enemies=[], bullets=[], launches=[], decorations=[], colliders=[], events=new EventEmitter();
  const factory={overlap(a,b,callback,...rest){const c={a,b,callback,rest};colliders.push(c);return c;}};
  const originalFactory=factory.overlap;
  const s={
    events:new EventEmitter(), player:object(), shots:{}, pickups:{}, time:{now:0},
    add:{graphics(){const o=object();decorations.push(o);return o;},text(){const o=object();decorations.push(o);return o;}},
    physics:{world:{isPaused:false},add:factory},
    bossHpFill:object(),bossHpText:object(),
    enemies:{getChildren:()=>enemies},bullets:{countActive:()=>bullets.length,clear(){bullets.length=0;}},
    create(){this.run={wave:startWave,score:9120,maxStage:0,practice:false};this.paused=false;this.waveClearing=false;this.weaponLevel=0;this.stage=0;},
    spawnCanopyTyrant(){const b=object();b.hp=TYRANT.maxHp;b.settled=false;b.setData('boss',true);enemies.push(b);},
    addBossDamage(b,stage){this.artCalls=(this.artCalls||0)+1;b.setTexture(`tyrant-armor-${stage}`);},
    hitEnemy(b,damage){
      b.hp-=damage;
      if(b.hp<=0){b.destroy();this.finale=(this.finale||0)+1;this.waveClearing=true;return;}
      // Reproduce the legacy campaign's fixed 24-HP damage-stage caller.
      const stage=b.hp<=6?3:b.hp<=12?2:b.hp<=18?1:0;
      if(stage!==(b.getData('bossDamageStage')||0))this.addBossDamage(b,stage);
      b.setData('bossDamageStage',stage).setData('armorHitUntil',this.time.now+85);
    },
    enemyFire(){this.originalFire=(this.originalFire||0)+1;},
    updateEnemies(){this.originalUpdate=(this.originalUpdate||0)+1;},
    launchHostile(x,y,texture,angle,speed,kind){launches.push({x,y,texture,angle,speed,kind});bullets.push({});},
    bindCollisions(){
      const callback=(a,b)=>{const e=a===this.player?b:a;e.destroy();this.damagePlayer();};
      this.physics.add.overlap(reversed?this.enemies:this.player,reversed?this.player:this.enemies,callback);
      this.physics.add.overlap(this.player,this.pickups,()=>{this.collected=true;});
      this.physics.add.overlap(this.shots,this.enemies,()=>{this.shotHit=true;});
      if(failBind)throw Error('bind error');
    },
    damagePlayer(){this.damageCalls=(this.damageCalls||0)+1;},isCloaked(){return !!this.cloaked;},
    applyStage(){this.applied=true;},updateHud(){},setLesson(t){this.lesson=t;},
  };
  s.player.y=570;
  const game={events,scene:{getScene:()=>s}};
  const originalCreate=s.create, dispose=installTyrantCombat(game);
  s.create();s.spawnCanopyTyrant();const boss=enemies[0];
  function tick(ms=100){s.time.now+=ms;s.updateEnemies(s.time.now,ms);}
  function stepFor(ms){for(let t=0;t<ms;t+=100)tick(Math.min(100,ms-t));}
  return {s,game,boss,enemies,bullets,launches,decorations,colliders,factory,originalFactory,originalCreate,dispose,tick,stepFor};
}

test('fixed boss health is 180 in config and combat; no player weapons or other enemies retuned',()=>{
  const c=readFileSync(new URL('../app/game/config.ts',import.meta.url),'utf8');
  assert.match(c,new RegExp(`boss:\\{hp:${TYRANT.maxHp},`));
  assert.match(c,/CANOPY CANNON.*damage:2/);assert.match(c,/borer:\{hp:2,/);
});
test('combat phases change at two-thirds and one-third health',()=>{
  assert.deepEqual([180,121,120,61,60,1].map(hp=>bossPhase(hp)),[1,1,2,2,3,3]);
});
test('armor stages track percentages rather than old 24-HP thresholds',()=>{
  assert.deepEqual([180,136,135,91,90,46,45,18].map(hp=>armorStage(hp)),[0,0,1,1,2,2,3,3]);
});
test('settled boss stays on screen and below the HUD at every phase',()=>{
  for(let phase=1;phase<=3;phase++)for(let t=0;t<120000;t+=137){const p=bossPosition(t,phase);assert.ok(p.x-160*.78>=0);assert.ok(p.x+160*.78<=480);assert.ok(p.y-120*.78>=68);}
});
test('all phases have visible warning time, bounded volleys and downward non-homing shots',()=>{
  for(let phase=1;phase<=3;phase++)for(let serial=0;serial<6;serial++)for(const x of [35,240,445]){
    const p=planVolley(phase,serial,{x:240,y:178},{x,y:570});
    assert.ok(p.warningMs>=600);assert.ok(p.shots.length>=5&&p.shots.length<=8);
    assert.ok(p.shots.every(s=>s.speed>=270&&s.speed<=310&&Math.sin(s.angle)>0));
  }
});
test('core storm deliberately leaves a central opening and twin volley shoots outside center',()=>{
  for(const [phase,serial] of [[3,0],[2,1]]){
    const plan=planVolley(phase,serial,{x:240,y:178},{x:240,y:570});
    const hits=plan.shots.map(s=>s.x+(570-s.y)*Math.cos(s.angle)/Math.sin(s.angle));
    assert.ok(hits.every(x=>Math.abs(x-240)>=80));
  }
});
test('cannot damage the boss during its arrival; normal damage works after settling',()=>{
  const f=fixture();f.s.hitEnemy(f.boss,20,false);assert.equal(f.boss.hp,180);
  f.boss.settled=true;f.s.hitEnemy(f.boss,2,false);assert.equal(f.boss.hp,178);
});
test('boss shows correct full health and scaled health bar',()=>{
  const f=fixture();assert.equal(f.s.bossHpFill.width,212);f.boss.settled=true;f.s.hitEnemy(f.boss,90,false);
  assert.equal(f.s.bossHpFill.width,106);assert.match(f.s.bossHpText.text,/90 \/ 180/);
});
test('legacy stage callbacks cannot revert the newer cracked armor or replay effects on every hit',()=>{
  const f=fixture();f.boss.settled=true;f.s.hitEnemy(f.boss,50,false);
  assert.equal(f.boss.textureKey,'tyrant-armor-1');const count=f.s.artCalls;
  f.s.hitEnemy(f.boss,2,false);assert.equal(f.s.artCalls,count);assert.equal(f.boss.getData('bossDamageStage'),1);
  f.s.hitEnemy(f.boss,85,false);assert.equal(f.boss.textureKey,'tyrant-armor-3');
  f.s.addBossDamage(f.boss,0);assert.equal(f.boss.textureKey,'tyrant-armor-3');
});
test('first volley cannot fire until its warning finishes',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);assert.equal(f.launches.length,0);
  assert.ok(f.decorations[1].text.includes('AIM LOCKED'));
  f.stepFor(600);assert.equal(f.launches.length,0);f.tick();assert.equal(f.launches.length,5);
});
test('warned aim and firing position do not follow last-second player movement',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);
  const x=f.boss.x,y=f.boss.y,plan=planVolley(1,0,{x,y},f.s.player);
  f.s.player.x=440;f.stepFor(700);
  assert.deepEqual(f.launches.map(s=>s.angle),plan.shots.map(s=>s.angle));assert.equal(f.boss.x,x);
});
test('movement resumes smoothly after a warning instead of jumping ahead',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);const x=f.boss.x;f.stepFor(700);f.tick(16);
  assert.ok(Math.abs(f.boss.x-x)<3);
});
test('pause freezes pending volley and does not produce catch-up attacks',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);f.s.paused=true;f.tick(30000);assert.equal(f.launches.length,0);
  f.s.paused=false;f.tick(16);assert.equal(f.launches.length,0);f.stepFor(700);assert.equal(f.launches.length,5);
});
test('physics pause also prevents boss scheduling',()=>{
  const f=fixture();f.boss.settled=true;f.s.physics.world.isPaused=true;f.stepFor(5000);assert.equal(f.launches.length,0);
});
test('phase transition cancels warned attack and clears previous bullets without healing',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);f.bullets.push({});f.s.hitEnemy(f.boss,60,false);f.tick();
  assert.equal(f.boss.hp,120);assert.equal(f.bullets.length,0);assert.match(f.decorations[1].text,/PHASE 2/);
  f.stepFor(800);assert.equal(f.launches.length,0);
});
test('shield stun cancels an attack rather than emitting it late without warning',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);f.boss.setData('shieldStunUntil',f.s.time.now+1000);
  f.stepFor(1000);assert.equal(f.launches.length,0);f.stepFor(600);assert.equal(f.launches.length,0);
});
test('boss respects projectile cap',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);for(let i=0;i<30;i++)f.bullets.push({});f.stepFor(700);
  assert.equal(f.launches.length,0);assert.equal(f.bullets.length,30);
});
test('original five-shot boss fire cannot bypass the telegraph scheduler',()=>{
  const f=fixture();f.s.enemyFire(f.boss);assert.equal(f.s.originalFire,undefined);
  f.s.enemyFire(object());assert.equal(f.s.originalFire,1);
});
test('earlier campaign enemies still use their existing update and hit logic',()=>{
  const f=fixture();f.s.run.wave=2;f.tick();assert.equal(f.s.originalUpdate,1);
  const e=object();e.hp=10;f.s.hitEnemy(e,2,false);assert.equal(e.hp,8);
});
test('ramming cannot delete boss; ordinary enemy and pickup collisions are preserved',()=>{
  for(const reversed of [false,true]){
    const f=fixture({reversed});f.s.bindCollisions();assert.equal(f.factory.overlap,f.originalFactory);
    f.colliders[0].callback(...(reversed?[f.boss,f.s.player]:[f.s.player,f.boss]));
    assert.equal(f.boss.active,true);assert.equal(f.boss.hp,180);assert.equal(f.s.damageCalls,1);
    const enemy=object();f.colliders[0].callback(f.s.player,enemy);assert.equal(enemy.active,false);
    f.colliders[1].callback();assert.equal(f.s.collected,true);f.colliders[2].callback();assert.equal(f.s.shotHit,true);
  }
});
test('cloaked contact does not damage either player or boss',()=>{
  const f=fixture();f.s.cloaked=true;f.s.bindCollisions();f.colliders[0].callback(f.s.player,f.boss);
  assert.equal(f.s.damageCalls,undefined);assert.equal(f.boss.active,true);
});
test('physics overlap factory restored after binding failure',()=>{
  const f=fixture({failBind:true});assert.throws(()=>f.s.bindCollisions(),/bind error/);assert.equal(f.factory.overlap,f.originalFactory);
});
test('continue preserves boss HP/phase and cancels an imminent volley',()=>{
  const f=fixture();f.boss.settled=true;f.s.hitEnemy(f.boss,120,false);f.stepFor(1000);const hp=f.boss.hp;
  f.game.events.emit('arcade:continue-authorized');f.stepFor(900);
  assert.equal(f.boss.hp,hp);assert.equal(bossPhase(f.boss.hp),3);assert.equal(f.launches.length,0);
});
test('boss defeat still triggers existing finale exactly once and removes attack warning',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);f.s.hitEnemy(f.boss,180,false);f.stepFor(2000);f.s.hitEnemy(f.boss,2,false);
  assert.equal(f.s.finale,1);assert.equal(f.launches.length,0);assert.equal(f.decorations[1].visible,false);
});
test('shutdown/replay clears pending warnings and starts fresh boss health',()=>{
  const f=fixture();f.boss.settled=true;f.stepFor(800);f.s.events.emit('shutdown');
  assert.ok(f.decorations.every(o=>o.destroyed));f.enemies.length=0;f.s.create();f.s.spawnCanopyTyrant();
  assert.equal(f.enemies[0].hp,180);assert.equal(f.s.events.listenerCount('shutdown'),1);
});
test('dispose removes continue listener and restores original scene methods',()=>{
  const f=fixture();f.dispose();assert.equal(f.game.events.listenerCount('arcade:continue-authorized'),0);assert.equal(f.s.create,f.originalCreate);
});
test('boss practice cannon loadout is explicitly unranked and restricted to Wave 10',()=>{
  const old=globalThis.location;globalThis.location={search:'?wave=10&bossPractice=cannon'};
  try {const f=fixture();assert.equal(f.s.run.practice,true);assert.equal(f.s.weaponLevel,4);assert.equal(f.s.stage,4);f.dispose();
    const normal=fixture({startWave:0});assert.equal(normal.s.stage,0);assert.equal(normal.s.weaponLevel,0);assert.equal(normal.s.run.practice,false);normal.dispose();}
  finally {if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});

test('installation is idempotent and disposable',()=>{const f=fixture();const before=f.s.hitEnemy;const second=installTyrantCombat(f.game);assert.equal(f.s.hitEnemy,before);second();assert.equal(f.game.events.listenerCount('arcade:continue-authorized'),1);f.dispose();});
