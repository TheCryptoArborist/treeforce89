import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('build metadata records the source branch when Netlify checks out a PR ref',()=>{
  const root=mkdtempSync(join(tmpdir(),'tree-build-context-'));
  try {
    mkdirSync(join(root,'scripts'));
    const script=join(root,'scripts/write-tree-deploy-context.mjs');
    copyFileSync(new URL('../scripts/write-tree-deploy-context.mjs',import.meta.url),script);
    for(const [context,head,branch,expected] of [
      ['deploy-preview','feature/tree-paid-continue','pull/7/head','feature/tree-paid-continue'],
      ['branch-deploy','','feature/tree-paid-continue','feature/tree-paid-continue'],
      ['production','main','main','main'],
    ]) {
      execFileSync(process.execPath,[script],{env:{...process.env,CONTEXT:context,HEAD:head,BRANCH:branch,DEPLOY_ID:'test-deploy'}});
      const result=JSON.parse(readFileSync(join(root,'netlify/generated/tree-deploy-context.json'),'utf8'));
      assert.deepEqual(result,{context,branch:expected,deployId:'test-deploy'});
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});
