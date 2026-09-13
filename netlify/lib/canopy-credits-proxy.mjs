const cookieName='__Host-tree-game-session';
const cookie = r => (r.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)||'';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export function createCreditsProxy({authOrigin,gameOrigin,enabled,fetcher=fetch}) {
  return async request => {
    try {
      if(enabled!=='true'||!authOrigin||!gameOrigin||new URL(request.url).origin!==gameOrigin||new URL(authOrigin).protocol!=='https:'||!new URL(gameOrigin).hostname.startsWith('deploy-preview-'))return json({error:'simulation-disabled'},503);
      if(request.method!=='POST')return json({error:'method-not-allowed'},405);
      if(request.headers.get('origin')!==gameOrigin)return json({error:'origin-mismatch'},403);
      const token=cookie(request);if(!/^[a-f0-9]{64}$/.test(token))return json({error:'sign-in-required'},401);
      if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'json-required'},415);
      const reader=request.body?.getReader();if(!reader)return json({error:'invalid-json'},400);
      const chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return json({error:'request-too-large'},413);}chunks.push(value);}
      let command;try{command=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json({error:'invalid-json'},400);}
      const upstream=await fetcher(`${authOrigin}/api/canopy-credits-preview`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,command}),redirect:'error',signal:AbortSignal.timeout(20000)});
      const payload=await upstream.json();
      if(!upstream.ok)return json({error:payload.error||'simulation-unavailable'},upstream.status);
      if(payload.status!=='ok'||payload.ledger?.mode!=='simulation')return json({error:'invalid-simulation-response'},503);
      return json(payload);
    }catch{return json({error:'simulation-unavailable'},503);}
  };
}
