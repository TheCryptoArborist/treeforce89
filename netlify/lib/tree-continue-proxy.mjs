const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const safeOrigin=v=>{try{const u=new URL(v);return u.origin===v&&u.protocol==='https:';}catch{return false;}};
/** BFF factory. Only the HttpOnly session is forwarded to a pinned server URL.
 * The gateway independently verifies it. No browser-supplied identity or receipt.
 * serviceUrl is deployment configuration, never a query/body/environment switch
 * in directContinueGate. A missing reviewed service fails closed.
 */
export function createContinueProxy({gameOrigin,serviceUrl=null,fetcher=fetch}){
 if(!safeOrigin(gameOrigin))throw Error('invalid-game-origin');
 if(serviceUrl){const u=new URL(serviceUrl);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('invalid-continue-service');}
 return async request=>{
  if(new URL(request.url).origin!==gameOrigin||request.headers.get('origin')!==gameOrigin)return json({error:'origin-mismatch'},403);
  if(request.method!=='POST')return json({error:'method-not-allowed'},405);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'json-required'},415);
  if(!serviceUrl)return json({enabled:false,error:'checkout-not-enabled',requiresPayment:false},503);
  const cookies=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-tree-game-session='));
  if(cookies.length!==1||!/^__Host-tree-game-session=[a-f0-9]{64}$/.test(cookies[0]))return json({error:'sui-sign-in-required',requiresPayment:false},401);
  const token=cookies[0].split('=')[1];
  try{
   const reader=request.body?.getReader();if(!reader)return json({error:'invalid-command'},400);let bytes=0;const chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return json({error:'request-too-large'},413);}chunks.push(value);}
   let command;try{command=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json({error:'invalid-command'},400);}
   const actions=['status','order','reconcile','cancel','list_purchases','recover_purchase','delivery_status','prepare_delivery','activate_delivery'];
   if(!command||Array.isArray(command)||!actions.includes(command.action)||Object.keys(command).some(k=>['accountId','payer','actor','evidence','verified','restoreAuthorized','clientHash','token','serviceUrl'].includes(k)))return json({error:'invalid-command'},400);
   const upstream=await fetcher(serviceUrl,{method:'POST',redirect:'error',signal:AbortSignal.timeout(18000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(command)});
   const reader2=upstream.body?.getReader();if(!reader2)throw Error('missing-service-response');const parts=[];let size=0;
   while(true){const {done,value}=await reader2.read();if(done)break;size+=value.length;if(size>300000){await reader2.cancel();throw Error('oversized-service-response');}parts.push(value);}
   const payload=JSON.parse(Buffer.concat(parts).toString('utf8'));
   if(!payload||typeof payload!=='object'||['accessToken','token','signature','secret'].some(k=>Object.hasOwn(payload,k)))throw Error('unsafe-service-response');
   if(!upstream.ok){const allowed=new Set(['sui-sign-in-required','checkout-not-enabled','delivery_lease_expired','delivery_lease_mismatch','delivery_checkpoint_mismatch','paid_order_not_found','invalid-command','invalid-delivery-command','invalid-recovery-command','delivery-protocol-required']);return json({error:allowed.has(payload.error)?payload.error:'delivery-unavailable',requiresPayment:false},[400,401,403,409,413,429,503].includes(upstream.status)?upstream.status:503);}
   return json(payload);
  }catch{return json({error:'delivery-unavailable',requiresPayment:false},503);}
 };
}
