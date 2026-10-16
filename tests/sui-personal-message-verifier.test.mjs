import test from "node:test";
import assert from "node:assert/strict";
import {Ed25519Keypair} from "@mysten/sui/keypairs/ed25519";
import {createSuiPersonalMessageVerifier} from "../app/game/sui-personal-message-verifier.mjs";

test("real Ed25519 personal-message signature authenticates the signing wallet",async()=>{
 const keypair=new Ed25519Keypair();
 const message="TREE FORCE '89 wallet login\nOrigin: https://example.com\nNonce: abc";
 const signed=await keypair.signPersonalMessage(new TextEncoder().encode(message));
 const verify=createSuiPersonalMessageVerifier();
 assert.equal(await verify({message,signature:signed.signature,wallet:keypair.getPublicKey().toSuiAddress()}),true);
});
test("real signature cannot authenticate another wallet",async()=>{
 const signer=new Ed25519Keypair();
 const other=new Ed25519Keypair();
 const message="TREE FORCE '89 wallet login";
 const signed=await signer.signPersonalMessage(new TextEncoder().encode(message));
 const verify=createSuiPersonalMessageVerifier();
 assert.equal(await verify({message,signature:signed.signature,wallet:other.getPublicKey().toSuiAddress()}),false);
});
test("real signature cannot authenticate modified challenge",async()=>{
 const signer=new Ed25519Keypair();
 const signed=await signer.signPersonalMessage(new TextEncoder().encode("original"));
 const verify=createSuiPersonalMessageVerifier();
 assert.equal(await verify({message:"modified",signature:signed.signature,wallet:signer.getPublicKey().toSuiAddress()}),false);
});
test("malformed signature fails closed",async()=>{
 const verify=createSuiPersonalMessageVerifier();
 assert.equal(await verify({message:"challenge",signature:"not-a-signature",wallet:"0x1234"}),false);
});
test("passes address and bytes to verifier",async()=>{
 let args;
 const verify=createSuiPersonalMessageVerifier({verify:async(...input)=>{args=input;return true}});
 assert.equal(await verify({message:"challenge",signature:"abcdefgh",wallet:"0x1234"}),true);
 assert.deepEqual(Array.from(args[0]),Array.from(new TextEncoder().encode("challenge")));
 assert.equal(args[2].address.length,66);
});
test("rejects invalid inputs before verification",async()=>{
 const verify=createSuiPersonalMessageVerifier();
 await assert.rejects(verify({message:"",signature:"abcdefgh",wallet:"0x1234"}),/challenge message/);
 await assert.rejects(verify({message:"challenge",signature:"bad",wallet:"0x1234"}),/wallet signature/);
});
