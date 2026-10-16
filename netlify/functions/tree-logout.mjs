/**
 * TREE FORCE '89 logout endpoint is intentionally disabled.
 * Server-side revocation logic is tested independently, but the public
 * endpoint must not claim success until the isolated database, session
 * issuance and authentication lifecycle are deployed.
 */
export default async function handler(request) {
  const headers = {"Cache-Control":"no-store","Content-Type":"application/json"};
  if (request.method !== "POST") {
    return Response.json({error:"Method not allowed"},{status:405,headers:{...headers,Allow:"POST"}});
  }
  return Response.json({
    enabled:false,
    loggedOut:false,
    error:"Server-side game logout is not enabled on this deployment.",
  },{status:503,headers});
}
