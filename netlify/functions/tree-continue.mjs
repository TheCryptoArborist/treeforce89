/**
 * TREE FORCE '89 payment verification endpoint.
 *
 * Deliberately fail-closed until an authenticated session provider, trusted
 * Sui mainnet transaction lookup, and atomic redemption database are wired.
 * Never approve a claim using only browser-submitted data.
 */
export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({error:"Method not allowed"},{status:405,headers:{"Allow":"POST","Cache-Control":"no-store"}});
  }
  const contentType=request.headers.get("content-type")||"";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({error:"JSON required"},{status:415,headers:{"Cache-Control":"no-store"}});
  }
  let claim;
  try {
    const raw=await request.text();
    if (raw.length>2048) throw new Error("Payload too large");
    claim=JSON.parse(raw);
  } catch {
    return Response.json({error:"Invalid JSON request"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  if (!claim || typeof claim.digest!=="string" || typeof claim.runId!=="string") {
    return Response.json({error:"Missing transaction digest or run"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  // NEVER replace this with a client-side boolean, digest allowlist, or
  // non-atomic KV check. See docs/tree-continue-checkout.md.
  return Response.json({
    authorized:false,
    error:"Paid continuation is not enabled until trusted verification and durable redemption storage are deployed."
  },{status:503,headers:{"Cache-Control":"no-store"}});
}
