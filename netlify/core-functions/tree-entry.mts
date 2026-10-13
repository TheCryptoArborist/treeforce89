const service='https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-game-entry';
export default async (request:Request)=>{
 const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private'}});
 if(request.method!=='POST')return reply({error:'method-not-allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'origin-mismatch'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'json-required'},415);
 try{
  const reader=request.body?.getReader();if(!reader)return reply({error:'invalid-command'},400);
  const parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return reply({error:'request-too-large'},413);}parts.push(value);}
  const body=Buffer.concat(parts).toString('utf8');JSON.parse(body);
  const upstream=await fetch(service,{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json'},body});
  return reply(await upstream.json(),upstream.status);
 }catch{return reply({error:'payment-service-unavailable'},503);}
};
export const config={path:'/api/tree-entry'};
