/** Recovery prompt unit tests. DOM, identity, and checkpoint codecs are fixtures;
 * no wallet, hosted service, payment, or database is used by these tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../app/game/flight-recovery-ui.mjs',import.meta.url),'utf8');
const origin='https://deploy-preview-3--treeforce89.netlify.app';
const sui={authenticated:true,accountId:'account-fixture',wallet:{family:'sui',address:'0x'+'1'.repeat(64)}};
const runId='12345678-1234-4234-8234-123456789abc';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.textContent='';this.className='';this.open=false;this.removed=false;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(){}
 querySelector(selector){return this.descendants().find(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector)||null;}
 descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
 replaceChildren(...children){this.children=[];this.append(...children);}
 showModal(){this.open=true;}
 close(){this.open=false;}
 remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function harness(initial=null,{url=origin,codecError=false,storageError=false}={}){
 const document={body:new Element('body'),createElement:tag=>new Element(tag),querySelector(selector){return this.body.querySelector(selector);}};
 const direct=new Element('dialog');direct.className='tree-continue-dialog';document.body.append(direct);
 const frame=new Element('div'),toolbar=new Element('div');toolbar.className='records-toolbar';frame.append(toolbar);
 const registry=new Map([['treeAccountIdentity',initial]]);registry.remove=key=>registry.delete(key);
 const events=new EventEmitter(),requests=[];let signIns=0,practiceResumes=0;
 events.on('tree-account:open',()=>{signIns++;});
 const scene={create(){},paused:true,lives:0,run:{score:17649,wave:2}};
 const game={registry,events,scene:{getScene:()=>scene,isActive:()=>false,isPaused:()=>false}};
 const install=runInNewContext(source.replace(/^import .*;\n/,'').replace('export function installFlightRecovery','function installFlightRecovery')+'\ninstallFlightRecovery;',{
  document,location:new URL(url),URLSearchParams,TextEncoder,AbortSignal,crypto:webcrypto,
  captureCheckpoint:(s,id)=>{if(codecError)throw Error('fixture codec error');return{runId:id,wave:s.run.wave+1,score:s.run.score,lives:s.lives};},
  validateCheckpoint:x=>x,rehydrateCheckpoint:()=>{throw Error('not part of these prompt tests');},
  fetch:async(url,options)=>{const command=JSON.parse(options.body);requests.push({url,command});return{ok:!storageError,json:async()=>storageError?{error:'storage-test-unavailable'}:{accountId:registry.get('treeAccountIdentity')?.accountId,paymentsEnabled:false,restoreAuthorized:false,result:{}}};},
 });
 const dispose=install(game,frame);
 const box=direct.querySelector('.flight-recovery-box'),prompt=box?.querySelector('.flight-recovery-signin');
 const buttons=box?.descendants().filter(n=>n.tagName==='button')||[];
 const save=buttons.find(n=>n.textContent==='SAVE FLIGHT FOR RELOAD TEST');
 const signIn=buttons.find(n=>n.textContent==='SIGN IN WITH SUI WALLET');
 const status=box?.children.find(n=>n.attributes.role==='status');
 return{game,scene,requests,dispose,box,prompt,save,signIn,status,
  get signIns(){return signIns;},get practiceResumes(){return practiceResumes;},
  exhaust:(recovered=false)=>events.emit('tree-flight:exhausted',{runId,recovered,scene,practiceResume:()=>{practiceResumes++;}}),
  identity:value=>{registry.set('treeAccountIdentity',value);events.emit('tree-account:identity',value);},
 };
}

test('recovery sign-in prompt remains unavailable on production',()=>{
 const h=harness(null,{url:'https://treeforce89.netlify.app/?recoveryTest=1'});
 assert.equal(h.box,null);assert.equal(h.game.registry.has('treeRecoveryPracticeAllowed'),false);assert.equal(h.requests.length,0);h.dispose();
});
test('title screen does not show or automatically open wallet sign-in',()=>{
 const h=harness();assert.equal(h.prompt.hidden,true);assert.equal(h.signIns,0);assert.equal(h.requests.length,0);h.dispose();
});
test('guest exhaustion explains unsaved flight, free message, and explicit save step',()=>{
 const h=harness();h.exhaust();assert.equal(h.prompt.hidden,false);assert.equal(h.save.disabled,true);assert.equal(h.signIn.disabled,false);
 assert.match(h.status.textContent,/not saved yet/);const copy=h.prompt.descendants().map(n=>n.textContent).join(' ');
 assert.match(copy,/SIGN IN TO SAVE YOUR FLIGHT/);assert.match(copy,/then save this wave and score/);assert.match(copy,/No TREE or SUI is spent/);
 assert.equal(h.signIns,0);assert.equal(h.requests.length,0);h.dispose();
});
test('new button only opens existing account flow; flight and payment state do not change',()=>{
 const h=harness();h.exhaust();h.signIn.onclick();
 assert.equal(h.signIns,1);assert.equal(h.requests.length,0);assert.equal(h.practiceResumes,0);
 assert.equal(h.scene.paused,true);assert.equal(h.scene.lives,0);assert.equal(h.scene.run.score,17649);assert.equal(h.scene.run.wave,2);h.dispose();
});
test('Sui sign-in hides the prompt and enables explicit save without charging or resuming',()=>{
 const h=harness();h.exhaust();h.identity(sui);
 assert.equal(h.prompt.hidden,true);assert.equal(h.save.disabled,false);assert.match(h.status.textContent,/Signed in\. Select SAVE/);
 assert.equal(h.requests.length,0);assert.equal(h.scene.paused,true);assert.equal(h.scene.lives,0);h.dispose();
});
test('explicit save after sign-in submits the same checkpoint only once',async()=>{
 const h=harness();h.exhaust();h.identity(sui);h.save.onclick();h.save.onclick();await flush();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'/api/tree-flight');assert.equal(h.requests[0].command.action,'save');
 assert.equal(h.requests[0].command.runId,runId);assert.equal(h.requests[0].command.snapshot.wave,3);assert.equal(h.requests[0].command.snapshot.score,17649);
 assert.equal(h.save.textContent,'SAVED — SAFE TO RELOAD FOR TEST');assert.equal(h.prompt.hidden,true);assert.equal(h.scene.lives,0);h.dispose();
});
test('EVM sign-in does not enable Sui recovery writes',()=>{
 const h=harness({...sui,wallet:{family:'evm',address:'0x'+'1'.repeat(40)}});h.exhaust();
 assert.equal(h.prompt.hidden,false);assert.equal(h.save.disabled,true);assert.match(h.prompt.descendants().map(n=>n.textContent).join(' '),/needs a Sui wallet/);
 h.save.onclick();assert.equal(h.requests.length,0);h.dispose();
});
test('unverified wallet connection does not count as a signed-in account',()=>{
 const h=harness({...sui,authenticated:false});h.exhaust();assert.equal(h.save.disabled,true);assert.equal(h.prompt.hidden,false);h.dispose();
});
test('signing out before saving restores the prompt and disables save',()=>{
 const h=harness();h.exhaust();h.identity(sui);h.identity(null);
 assert.equal(h.prompt.hidden,false);assert.equal(h.save.disabled,true);assert.equal(h.requests.length,0);assert.equal(h.scene.run.score,17649);h.dispose();
});
test('a failed checkpoint keeps its error and does not promise a save after sign-in',()=>{
 const h=harness(null,{codecError:true});h.exhaust();h.identity(sui);
 assert.match(h.status.textContent,/Cannot save this checkpoint: fixture codec error/);assert.equal(h.save.disabled,true);assert.equal(h.prompt.hidden,true);assert.equal(h.requests.length,0);h.dispose();
});
test('existing signed-in automatic save remains unchanged',async()=>{
 const h=harness(sui);h.exhaust();await flush();assert.equal(h.requests.length,1);assert.equal(h.save.textContent,'SAVED — SAFE TO RELOAD FOR TEST');assert.equal(h.prompt.hidden,true);h.dispose();
});
test('storage error does not claim saved or resume gameplay',async()=>{
 const h=harness(null,{storageError:true});h.exhaust();h.exhaust();h.identity(sui);h.save.onclick();await flush();
 assert.equal(h.save.textContent,'SAVE FLIGHT FOR RELOAD TEST');assert.match(h.status.textContent,/storage-test-unavailable/);assert.equal(h.save.disabled,false);assert.equal(h.scene.paused,true);h.dispose();
});
test('closing a flight removes its sign-in offer without a storage request',()=>{
 const h=harness();h.exhaust();h.game.events.emit('tree-flight:closed');h.signIn.onclick();
 assert.equal(h.prompt.hidden,true);assert.equal(h.save.disabled,true);assert.equal(h.signIns,0);assert.equal(h.requests.length,0);h.dispose();
});
test('disposing removes the new button callback and identity listener',()=>{
 const h=harness();h.exhaust();h.dispose();assert.equal(h.signIn.onclick,null);assert.equal(h.box.removed,true);assert.equal(h.game.events.listenerCount('tree-account:identity'),0);
});
