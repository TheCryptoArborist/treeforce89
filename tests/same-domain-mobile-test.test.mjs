import {test} from 'node:test';import assert from 'node:assert/strict';import {previewAccessAllowed} from '../app/game/preview-access.mjs';
const build={branch:'same-domain-mobile-test',context:'production'};
const context={site:{id:'aa62f324-b880-47d6-85b8-4ba0700ff5bf'},deploy:{id:'test-deploy',context:'production'}};
test('same-domain mobile endpoints require trusted site/context, HTTPS and an exact test endpoint',()=>{
const allowed=(url,ctx=context,b=build)=>previewAccessAllowed(b,ctx,new Request(url));
assert(allowed('https://tree-token.xyz/.netlify/functions/treeforce-test-challenge'));
for(const url of ['http://tree-token.xyz/.netlify/functions/treeforce-test-challenge','https://other.example/.netlify/functions/treeforce-test-session','https://tree-token.xyz/.netlify/functions/tree-session','https://tree-token.xyz/.netlify/functions/treeforce-test-continue','https://tree-token.xyz/.netlify/functions/treeforce-test-run/extra'])assert.equal(allowed(url),false);
assert.equal(allowed('https://tree-token.xyz/.netlify/functions/treeforce-test-session',{...context,site:{id:'wrong-site'}}),false);
assert.equal(allowed('https://tree-token.xyz/.netlify/functions/treeforce-test-session',{...context,deploy:{id:'test',context:'deploy-preview'}}),false);
});
