import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {wireRecords} from '../app/game/records-game.mjs';
function fixture(){const saved=[];const s={events:new EventEmitter(),input:{keyboard:new EventEmitter()},children:{list:[]},debugPanel:{list:[]},time:{timeScale:1},physics:{world:{timeScale:1}},create(){this.run={wave:0,score:5000,kills:5,shotsFired:50,shotsHit:40,maxStage:1,perfect:0};},endRun(){}};const game={events:new EventEmitter(),scene:{getScene:()=>s}};wireRecords(game,{get:()=>({state:{pilot:{callsign:'TEST',title:''},best:[]}}),save:r=>saved.push(r)});s.create();return {s,game,saved};}
test('continue test shortcut is excluded from normal records',()=>{const {s,saved}=fixture();s.run.practice=true;s.endRun();assert.equal(saved[0].kind,'practice');assert.ok(saved[0].reasons.includes('Practice/test run'));});
test('first credit saves normal score and additional continued points remain casual',()=>{const {s,game,saved}=fixture();game.events.emit('arcade:continue-authorized');s.run.score=90000;s.endRun();assert.equal(saved[0].kind,'normal');assert.equal(saved[0].score,5000);assert.equal(saved[1].kind,'continued');assert.equal(saved[1].score,90000);});
