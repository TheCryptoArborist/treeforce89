import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { wireDirectContinueGame } from '../app/game/tree-continue-game.mjs';
function fixture(){
 let paused=false,offers=0,oldEnds=0,offer,callbacks;const events=new EventEmitter();
 const player={body:{enable:true,reset(){}},setVelocity(){return this},setPosition(){return this},setActive(){return this},setVisible(){return this},setAlpha(){return this},clearTint(){return this}};
 const s={create(){this.run={wave:2,score:9120};this.lives=3;},endRun(){oldEnds++},togglePause(){},damagePlayer(){this.lives--;},player,
 physics:{world:{pause(){this.isPaused=true},resume(){this.isPaused=false}}},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}}},clearTouchState(){},applyStage(){},updateHud(){},
 shots:{clear(){}},bullets:{clear(){}},time:{now:500},banner(){}};
 const game={events,scene:{getScene:()=>s,pause(){paused=true},resume(){paused=false},isPaused:()=>paused,stop(){},start(key){if(key==='game')s.create()}}};
 const bridge=wireDirectContinueGame(game,hooks=>{callbacks=hooks;return{async cancel(){return true;}}},{offer(o){offers++;offer=o},close(){}});s.create();
 return{game,s,bridge,get offer(){return offer},get callbacks(){return callbacks},get offers(){return offers},get oldEnds(){return oldEnds},get paused(){return paused}};
}
test('zero-life death pauses once and does not open payment automatically',()=>{
 const f=fixture();f.s.lives=0;f.s.endRun();f.s.endRun();assert.equal(f.offers,1);assert.equal(f.oldEnds,0);assert.equal(f.paused,true);assert.equal(f.s.input.enabled,false);assert.equal(f.offer.wave,3);
});
test('victory and nonzero-life exits never offer paid continue',()=>{
 for(const cleared of [true,false]){const f=fixture();f.s.endRun(cleared);assert.equal(f.offers,0);assert.equal(f.oldEnds,1);}
});
test('same-flight restoration preserves campaign and returns controls after approval',()=>{
 const f=fixture();f.s.lives=0;f.s.endRun();const run=f.s.run;f.callbacks.boundary();f.callbacks.apply(3);assert.equal(f.paused,true);f.callbacks.resume();
 assert.equal(f.s.run,run);assert.equal(f.s.run.score,9120);assert.equal(f.s.run.wave,2);assert.equal(f.s.lives,3);assert.equal(f.s.run.continued,true);assert.equal(f.s.invulnUntil,3500);assert.equal(f.s.input.enabled,true);assert.equal(f.paused,false);
 f.s.lives=0;f.s.endRun();assert.equal(f.offers,1);assert.equal(f.oldEnds,1);
});
test('free restart records the old run and begins a new flight without using a continue',async()=>{
 const f=fixture();f.s.lives=0;f.s.endRun();const old=f.s.run;await f.offer.startNew();assert.equal(f.oldEnds,1);f.game.events.emit('poststep');assert.notEqual(f.s.run,old);assert.equal(f.s.lives,3);
});
test('scene replacement rejects a late purchased-flight restoration',()=>{
 const f=fixture();f.s.lives=0;f.s.endRun();const callbacks=f.callbacks;f.s.create();assert.throws(()=>callbacks.apply(3),/ended/);
});
test('dispose restores original scene handling',()=>{
 const f=fixture();f.bridge.destroy();f.s.lives=0;f.s.endRun();assert.equal(f.offers,0);assert.equal(f.oldEnds,1);
});
