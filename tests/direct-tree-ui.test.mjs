/** UI orchestration only: wallet/session, storage and game adapters are fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
class Element {
  constructor(tag) { this.tagName=tag;this.children=[];this.hidden=false;this.attributes={};this.disabled=false;this.textContent='';this.className=''; }
  append(...rows) { for(const r of rows){r.parent=this;this.children.push(r);} }
  insertBefore(row,before) { row.parent=this;const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,row); }
  setAttribute(k,v) { this.attributes[k]=v; }
  addEventListener() {}
  querySelector(s) { return this.all().find(e=>s.startsWith('.')?e.className.split(' ').includes(s.slice(1)):e.tagName===s)||null; }
  all() { return this.children.flatMap(e=>[e,...e.all()]); }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this); }
  scrollIntoView() {} focus() {}
}
function fixture({signedIn=false,rejected=false,saveFails=false}={}) {
  const frame=new Element('div'),bezel=new Element('div');bezel.className='screen-bezel';frame.append(bezel);
  const calls=[],registry=new Map(),events=new EventEmitter();let ui;
  const identity={authenticated:true,wallet:{family:'sui',address:'0x'+'1'.repeat(64)}};
  if(signedIn)registry.set('treeAccountIdentity',identity);
  registry.set('treeAccountConnect',async()=>{calls.push('connect');if(rejected)return null;registry.set('treeAccountIdentity',identity);return identity;});
  registry.set('treeFlightSave',async()=>{calls.push('save');if(saveFails)throw Error('storage failed');});
  const game={registry,events};
  const source=readFileSync(new URL('../app/game/tree-continue-ui.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function installDirectTreeContinues','function installDirectTreeContinues');
  const install=runInNewContext(source+'\ninstallDirectTreeContinues;',{
    document:{createElement:t=>new Element(t)},localStorage:{},
    createPaidFlightSceneLoader:()=>({dispose(){}}),installPurchaseRecovery:()=>()=>{},pendingPurchase:()=>({read:()=>null}),
    wireDirectContinueGame:(_g,_factory,handlers)=>{ui=handlers;return{destroy(){}}},createTreeContinueAttempt:()=>{},getWalletUniqueIdentifier:r=>r.id,
  });
  const dispose=install(game,frame,{api:async()=>{},wallet:{},storage:{}});
  const attempt={state:{},continue:async()=>{calls.push('continue');return true;}};
  ui.offer({runId:'flight-fixture',wave:3,score:9000,attempt,startNew:async()=>calls.push('free')});
  const panel=frame.querySelector('.tree-continue-panel'),pay=panel.all().find(e=>e.textContent==='CONTINUE — 20,000 TREE');
  return{calls,registry,panel,pay,dispose,ui};
}
test('guest continue connects and saves the same flight before any checkout',async()=>{const f=fixture();assert.equal(f.panel.tagName,'section');await f.pay.onclick();assert.deepEqual(f.calls,['connect','save','continue']);f.dispose();});
test('verified wallet goes directly through flight save and checkout',async()=>{const f=fixture({signedIn:true});await f.pay.onclick();assert.deepEqual(f.calls,['save','continue']);f.dispose();});
test('declining wallet verification never saves or requests checkout',async()=>{const f=fixture({rejected:true});await f.pay.onclick();assert.deepEqual(f.calls,['connect']);f.dispose();});
test('failed private flight save cannot request checkout',async()=>{const f=fixture({signedIn:true,saveFails:true});await f.pay.onclick();assert.deepEqual(f.calls,['save']);f.dispose();});
test('late connection cannot check out a flight that has ended',async()=>{const f=fixture();let release;f.registry.set('treeAccountConnect',()=>new Promise(r=>release=r));const pending=f.pay.onclick();f.ui.close();release({authenticated:true});await pending;assert.deepEqual(f.calls,[]);f.dispose();});
