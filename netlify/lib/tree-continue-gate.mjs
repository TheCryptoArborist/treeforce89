import { TREE_CONTINUE as product } from '../../app/game/tree-continue-policy.mjs';
import { createContinueProxy } from './tree-continue-proxy.mjs';
/** Deployment manifest intentionally absent. A reviewed gateway/credential install
 * must pin both origins here; env flags and URL/body inputs cannot activate it.
 * The standalone proxy is exercised through real HTTP in integration tests.
 */
const REVIEWED_CONTINUE_DEPLOYMENT = null;
export function directContinueGate(request) {
  if(REVIEWED_CONTINUE_DEPLOYMENT)return createContinueProxy(REVIEWED_CONTINUE_DEPLOYMENT)(request);
  const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
  if (!['GET', 'POST'].includes(request.method)) return Response.json({ error: 'method-not-allowed' }, { status: 405, headers });
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'origin-mismatch' }, { status: 403, headers });
  return Response.json({ enabled: false, error: 'checkout-not-enabled', product, requiresPayment:false,
    reason: 'Mainnet deployment and persistent receipt service are not configured.' }, { status: 503, headers });
}
