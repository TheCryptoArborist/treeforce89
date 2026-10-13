export const GAME_ORIGIN='https://deploy-preview-3--treeforce89.netlify.app';
export const AUTH_ORIGIN='https://deploy-preview-48--tree-token.netlify.app';
export const RECOVERY_URL='https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-recovery-preview';
export function accountConfig(request,env){return new URL(request.url).origin===GAME_ORIGIN?{authOrigin:AUTH_ORIGIN,gameOrigin:GAME_ORIGIN}:{authOrigin:env.get('TREE_ACCOUNT_AUTH_ORIGIN'),gameOrigin:env.get('TREE_ACCOUNT_GAME_ORIGIN')};}
const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export async function recoveryProxy(request,fetcher=fetch){
 if(new URL(request.url).origin!==GAME_ORIGIN)return reply({error:'recovery-preview-only'},404);
 if(request.method==='GET')return reply({mode:'recovery-preview',paymentsEnabled:false},200);
 if(request.method!=='POST')return reply({error:'method-not-allowed'},405);
 if(request.headers.get('origin')!==GAME_ORIGIN)return reply({error:'origin-mismatch'},403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return reply({error:'json-required'},415);
 const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-tree-game-session='))?.slice('__Host-tree-game-session='.length);
 if(!/^[a-f0-9]{64}$/.test(token||''))return reply({error:'sign-in-required'},401);
 try{
  const reader=request.body?.getReader();if(!reader)return reply({error:'invalid-body'},400);let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>280000){await reader.cancel();return reply({error:'request-too-large'},413);}chunks.push(value);}
  const r=await fetcher(RECOVERY_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:Buffer.concat(chunks),redirect:'error',signal:AbortSignal.timeout(20000)});
  const p=await r.json();return reply(p,r.status);
 }catch{return reply({error:'recovery-service-unavailable',paymentsEnabled:false},503);}
}
