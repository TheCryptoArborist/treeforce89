import {Pool} from 'pg';
import {Buffer} from 'node:buffer';
import {connectMainnetReader} from './entry-mainnet-reader.mjs';
import {createEntryService} from './entry-service.mjs';
const url=new URL(Deno.env.get('SUPABASE_DB_URL'));
for(const n of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(n);
const pool=new Pool({connectionString:url.href,max:2,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,ssl:{rejectUnauthorized:true}});
const service=createEntryService({pool,reader:connectMainnetReader()});
Deno.serve(async request=>{
 const reply=(p,status=200)=>Response.json(p,{status,headers:{'Cache-Control':'no-store, private'}});
 if(request.method!=='POST'||request.headers.has('origin')||request.headers.has('sec-fetch-site'))return reply({error:'server-channel-required'},403);
 try{
  const reader=request.body?.getReader();if(!reader)throw Error('invalid-command');const parts=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('invalid-command');}parts.push(value);}
  const c=JSON.parse(Buffer.concat(parts).toString('utf8'));const result=await service(c);
  if(result.order)delete result.order.token_hash;
  return reply(result);
 }catch(e){
  const allowed=['invalid-command','invalid-payer','wallet-changed','checkout-busy','order-not-found','wrong-digest','invalid-digest','payment-not-verified','payment-already-used','payment-not-finalized','wrong-payer','payment-outside-window','wrong-payment-reference','wrong-payment-amount'];
  return reply({error:allowed.includes(e.message)?e.message:'payment-service-unavailable'},allowed.includes(e.message)?409:503);
 }
});
