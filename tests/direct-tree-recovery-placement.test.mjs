import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installPurchaseRecovery} from '../app/game/purchase-recovery-ui.mjs';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.parentElement=null;this.textContent='';}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(){}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
 insertBefore(n,reference){if(reference===null){this.append(n);return;}const i=this.children.indexOf(reference);assert.ok(i>=0);n.remove();n.parentElement=this;this.children.splice(i,0,n);}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
 querySelector(selector){return this.children.find(n=>'.'+n.className===selector)||null;}
 remove(){if(this.parentElement){const list=this.parentElement.children;list.splice(list.indexOf(this),1);this.parentElement=null;}}
}
test('purchase recovery stays above the canvas, next to the account controls',()=>{
 const original=globalThis.document,body=new Element('body'),shell=new Element('main'),frame=new Element('section');
 const account=new Element('section'),bezel=new Element('div');account.className='tree-account-bar';bezel.className='screen-bezel';
 body.append(shell);shell.append(frame);frame.append(account,bezel);
 globalThis.document={body,createElement:tag=>new Element(tag),getElementById:()=>null};
 const game={events:new EventEmitter(),registry:{get:()=>null},scene:{getScene:()=>null}};
 let calls=0,dispose;
 try{
  dispose=installPurchaseRecovery(game,frame,{api:()=>{calls++;},loader:{},pending:{}});
  const open=frame.querySelector('.tree-purchase-recovery');assert.ok(open);
  assert.deepEqual(frame.children,[account,open,bezel]);assert.deepEqual(shell.children,[frame]);
  assert.equal(open.style.width,'100%');assert.equal(open.style.minHeight,'44px');assert.equal(open.type,'button');
  assert.equal(calls,0);assert.equal(game.events.listenerCount('tree-purchase-recovery:open'),1);
  dispose();dispose=null;assert.deepEqual(frame.children,[account,bezel]);assert.equal(game.events.listenerCount('tree-purchase-recovery:open'),0);
 }finally{dispose?.();globalThis.document=original;}
});
