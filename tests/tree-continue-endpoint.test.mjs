import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/tree-continue.mjs";

const url="https://treeforce89.netlify.app/.netlify/functions/tree-continue";
test("endpoint never approves an unverified claim",async()=>{
 const res=await handler(new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({digest:"someDigest",runId:"grove-1"})}));
 assert.equal(res.status,503);
 assert.equal((await res.json()).authorized,false);
});
test("rejects malformed request",async()=>{
 const res=await handler(new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:"{"}));
 assert.equal(res.status,400);
});
test("rejects GET",async()=>{
 const res=await handler(new Request(url));
 assert.equal(res.status,405);
});
test("rejects non-JSON body",async()=>{
 const res=await handler(new Request(url,{method:"POST",headers:{"content-type":"text/plain"},body:"digest"}));
 assert.equal(res.status,415);
});
