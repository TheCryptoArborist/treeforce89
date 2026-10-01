import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateCheckpoint} from '../app/game/flight-checkpoint.mjs';
function fixture(texture='tyrant-armor-0',kind='boss'){
 const boss=kind==='boss',runId=randomUUID();
 return {format:'treeforce89.checkpoint.v1',ruleset:'treeforce89.v1',runId,wave:boss?10:3,score:7500,lives:0,continuesUsed:0,
  scene:{codec:'formation-recovery.v1',run:{runId,wave:boss?9:2,score:7500},values:{waveSpawned:1},rngSeed:7,
  timing:{waveElapsed:3100,diveIn:1000,fireIn:1000,durationMs:3100},clearedRows:[],escortKills:[],escortTargets:[],pickups:[],
  enemies:[{texture,x:240,y:178,scaleX:.78,scaleY:.78,angle:0,depth:4,
  velocity:{x:0,y:0},body:{width:224,height:162,radius:0,offsetX:48,offsetY:39},
  props:{kind,hp:boss?59:1,homeX:240,homeY:178,phase:0,formationIndex:boss?-10:-1},data:{},mutateIn:0,fireAgo:10}]}};
}
for(const texture of ['tyrant-armor-0','tyrant-armor-1','tyrant-armor-2','tyrant-armor-3'])test('codec accepts campaign boss texture '+texture,()=>{
 const s=validateCheckpoint(fixture(texture));assert.equal(s.scene.enemies[0].props.hp,59);assert.equal(s.scene.enemies[0].texture,texture);
});
for(const texture of ['rootCaptor','leaderCracked','small'])test('codec accepts real encounter sprite '+texture,()=>{
 const kind=texture==='small'?'small':'borer',s=fixture(texture,kind);if(kind==='small')s.scene.enemies[0].velocity={x:75,y:90};
 assert.deepEqual(validateCheckpoint(s),s);
});
test('corrupted wing retains its numbered growth frame and tint marker',()=>{
 const s=fixture('playerSheet','borer');s.scene.enemies[0].frame=3;s.scene.enemies[0].data.corrupted=true;
 assert.equal(validateCheckpoint(s).scene.enemies[0].frame,3);
});
test('unrecognized textures remain rejected',()=>assert.throws(()=>validateCheckpoint(fixture('arbitrary-untrusted-texture')),/Invalid actor/));
test('corrupted frame must be a bounded integer from the player sheet',()=>{
 for(const frame of [-1,5,.5,'3',null]){const s=fixture('playerSheet','borer');s.scene.enemies[0].frame=frame;assert.throws(()=>validateCheckpoint(s),/frame/);}
});
test('non-player texture cannot carry an unexpected frame',()=>{const s=fixture();s.scene.enemies[0].frame=0;assert.throws(()=>validateCheckpoint(s),/frame/);});
test('boss still requires final wave and bounded health',()=>{
 const s=fixture();s.wave=3;s.scene.run.wave=2;assert.throws(()=>validateCheckpoint(s),/boss wave/);
 const t=fixture();t.scene.enemies[0].props.hp=181;assert.throws(()=>validateCheckpoint(t),/enemy/);
});
