/**
 * Reusable server-side HTTP adapter for NFTree-gated game session creation.
 * Caller must inject a trusted service (login DB + Sui mainnet ownership).
 * No user-supplied wallet/run state is forwarded to the service.
 *
 * IMPORTANT: This is not wired to the deployed Netlify endpoint until
 * wallet authentication, DB migrations and ownership checks are validated.
 */
export function createGameSessionHttpHandler({service}) {
  if(typeof service?.create!=="function")throw new Error("Trusted game session service required");
  return async function handle(request) {
    const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
    if(request.method!=="POST")
      return Response.json({error:"Method not allowed"},{status:405,headers:{...headers,Allow:"POST"}});
    const origin=request.headers.get("origin");
    const requestOrigin=new URL(request.url).origin;
    if(origin && origin!==requestOrigin)
      return Response.json({error:"Origin not permitted"},{status:403,headers});
    const authorization=request.headers.get("authorization")||"";
    const match=/^Bearer ([a-f0-9]{64})$/.exec(authorization);
    if(!match)
      return Response.json({error:"Wallet authentication required"},{status:401,headers});
    if(request.headers.get("content-length") && Number(request.headers.get("content-length"))>0)
      return Response.json({error:"No client game-state payload permitted"},{status:400,headers});
    try {
      const session=await service.create({loginToken:match[1]});
      // Only return fields needed for starting the run. No wallet address.
      return Response.json({
        sessionToken:session.sessionToken,
        runId:session.runId,
        expiresAt:session.expiresAt,
      },{status:201,headers});
    } catch {
      // Avoid disclosing NFT holdings, wallet login state or database errors.
      return Response.json({error:"Game session could not be created"},{status:403,headers});
    }
  };
}
