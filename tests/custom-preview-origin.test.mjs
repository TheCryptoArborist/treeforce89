import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAccessAllowed} from '../app/game/preview-access.mjs';

const branch='feature/tree-paid-continue';
const siteId='35f5591a-5c7d-4bc6-ae9a-3e61e816b641';
const build={branch,context:'branch-deploy',deployId:'dev'};
const context={deploy:{context:'branch-deploy',id:'dev'},site:{id:siteId}};
const request=(url)=>new Request(url);

test('proposed custom preview hostname is accepted only for approved branch deployment',()=>{
 assert.equal(previewAccessAllowed(build,context,request('https://preview.tree-token.xyz/.netlify/functions/tree-session')),true);
});
test('existing Netlify branch hostname continues working',()=>{
 assert.equal(previewAccessAllowed(build,context,request('https://feature-tree-paid-continue--treeforce89.netlify.app/.netlify/functions/tree-session')),true);
});
test('custom preview origin is never authorized for production or other branches',()=>{
 assert.equal(previewAccessAllowed({...build,context:'production'}, {...context,deploy:{context:'production',id:'dev'}},request('https://preview.tree-token.xyz')),false);
 assert.equal(previewAccessAllowed({...build,branch:'main'},context,request('https://preview.tree-token.xyz')),false);
 assert.equal(previewAccessAllowed(build,{...context,site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'}},request('https://preview.tree-token.xyz')),false);
});
test('custom hostname is not an alias for a deploy-preview context',()=>{
 assert.equal(previewAccessAllowed({...build,context:'deploy-preview'}, {...context,deploy:{context:'deploy-preview',id:'dev'}},request('https://preview.tree-token.xyz')),false);
});
test('HTTP, production apex, www, and lookalike hosts remain rejected',()=>{
 for(const url of ['http://preview.tree-token.xyz','https://tree-token.xyz','https://www.tree-token.xyz','https://preview.tree-token.xyz.attacker.example']){
  assert.equal(previewAccessAllowed(build,context,request(url)),false);
 }
});
