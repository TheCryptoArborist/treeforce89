/** Hosted candidate connectivity only. Generates an in-memory test identity for MESSAGE
 * signing, never a transaction. Saves no flight/order/receipt and logs no credentials.
 * Only the fixed candidate origins are reachable. Revoke the session afterward.
 */
import assert from 'node:assert/strict';
import {Ed25519Keypair} from '@mysten/sui/keypairs/ed25519';
const GAME='https://deploy-preview-3--treeforce89.netlify.app';
const EDGE='https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-recovery-preview';
const cookies=new Map();let signedIn=false,accountId=null;
async function call(path,body,expected=200,{sendCookie=true,origin=GAME}={}){
 const r=await fetch(GAME+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(sendCookie&&cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(25000)});
 for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}
 assert.equal(r.status,expected,'Unexpected HTTP status for '+path);
 assert.match(r.headers.get('cache-control')||'',/no-store/,'Candidate APIs must not cache sessions or recovery');
 return r.json();
}
try{
 const status=await call('/api/tree-account');assert.equal(status.configured,true);assert.equal(status.identity,null);
 const health=await fetch(EDGE,{signal:AbortSignal.timeout(25000)});assert.equal(health.status,200);const h=await health.json();assert.equal(h.paymentsEnabled,false);assert.equal(h.restoreAuthorized,false);
 await call('/api/tree-flight',{action:'list'},401,{sendCookie:false});
 await call('/api/tree-flight',{action:'list'},403,{sendCookie:false,origin:'https://example.invalid'});
 await call('/api/tree-continue',{action:'status'},503);
 const key=new Ed25519Keypair(),payer=key.toSuiAddress();
 const challenge=await call('/api/tree-account-inline',{action:'challenge',family:'sui',address:payer,chainId:'sui:mainnet'});
 assert.equal(typeof challenge.message,'string');assert.equal(challenge.binding,undefined);
 const {signature}=await key.signPersonalMessage(new TextEncoder().encode(challenge.message));
 const login=await call('/api/tree-account-inline',{action:'verify',signature});signedIn=true;accountId=login.identity.accountId;
 assert.equal(login.identity.wallet.address,payer);assert.equal(login.accessToken,undefined);
 const list=await call('/api/tree-flight',{action:'list'});assert.equal(list.accountId,accountId);assert.equal(list.paymentsEnabled,false);assert.equal(list.restoreAuthorized,false);assert.deepEqual(list.result.flights,[]);
 await call('/api/tree-flight',{action:'list',accountId},400);
 await call('/api/tree-account',{action:'logout'});signedIn=false;
 const denied=await call('/api/tree-flight',{action:'list'},401);assert.equal(denied.error,'sign-in-required');
 console.log('HOSTED_RECOVERY_SMOKE',JSON.stringify({passed:true,game:GAME,edgeActive:true,realMessageSignature:true,realSessionVerification:true,realDatabaseList:true,logoutVerified:true,ephemeralAccountId:accountId,payer,flightWrites:0,purchaseRequests:0,paidReceipts:0,credentialsLogged:false}));
}finally{
 if(signedIn)await call('/api/tree-account',{action:'logout'}).catch(()=>{});
 cookies.clear();
}
