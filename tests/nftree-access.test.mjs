import test from "node:test";
import assert from "node:assert/strict";
import { NFTREE_TYPE, checkDirectNFTreeOwnership } from "../app/game/nftree-access.mjs";

const wallet = "0x1234";
function fakeClient(pages) {
  const calls = [];
  return {
    calls,
    core: { listOwnedObjects: async (args) => {
      calls.push(args);
      const result = pages[calls.length - 1];
      if (result instanceof Error) throw result;
      return result;
    }},
  };
}
test("direct NFTree holder qualifies", async () => {
  const client = fakeClient([{objects:[{type:NFTREE_TYPE}],cursor:null}]);
  assert.equal(await checkDirectNFTreeOwnership({client,wallet}),true);
  assert.equal(client.calls[0].type,NFTREE_TYPE);
  assert.equal(client.calls[0].owner.length,66);
});
test("non-holder does not qualify",async()=>{
  const client=fakeClient([{objects:[],cursor:null}]);
  assert.equal(await checkDirectNFTreeOwnership({client,wallet}),false);
});
test("checks every page instead of treating first empty page as final",async()=>{
  const client=fakeClient([{objects:[],cursor:"next"},{objects:[{type:NFTREE_TYPE}],cursor:null}]);
  assert.equal(await checkDirectNFTreeOwnership({client,wallet}),true);
  assert.equal(client.calls[1].cursor,"next");
});
test("wrong collection cannot qualify",async()=>{
  const client=fakeClient([{objects:[{type:"0x2::fake::NFT"}],cursor:null}]);
  assert.equal(await checkDirectNFTreeOwnership({client,wallet}),false);
});
test("does not silently bypass network errors",async()=>{
  const client=fakeClient([new Error("RPC unavailable")]);
  await assert.rejects(checkDirectNFTreeOwnership({client,wallet}),/RPC unavailable/);
});
test("rejects non-mainnet",async()=>{
  const client=fakeClient([]);
  await assert.rejects(checkDirectNFTreeOwnership({client,wallet,network:"testnet"}),/mainnet/);
  assert.equal(client.calls.length,0);
});
test("rejects repeated pagination cursors",async()=>{
  const client=fakeClient([{objects:[],cursor:"repeat"},{objects:[],cursor:"repeat"}]);
  await assert.rejects(checkDirectNFTreeOwnership({client,wallet}),/Repeated/);
});
test("rejects malformed provider responses",async()=>{
  const client=fakeClient([{cursor:null}]);
  await assert.rejects(checkDirectNFTreeOwnership({client,wallet}),/Invalid/);
});
