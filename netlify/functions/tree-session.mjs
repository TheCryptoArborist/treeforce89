/**
 * Deliberately disabled public session endpoint.
 *
 * The injectable game-session-http module is covered by unit tests, but
 * real session issuance MUST remain unavailable until wallet authentication,
 * database migrations, mainnet NFTree ownership and Slush review are ready.
 */
export default async function handler(request) {
  const headers={"Cache-Control":"no-store","Content-Type":"application/json"};
  if(request.method!=="POST")
    return Response.json({error:"Method not allowed"},{status:405,headers:{...headers,Allow:"POST"}});
  return Response.json({
    enabled:false,
    error:"NFTree game-session issuance is not enabled on this deployment."
  },{status:503,headers});
}
