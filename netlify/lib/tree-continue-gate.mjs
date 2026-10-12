import { TREE_CONTINUE as product } from '../../app/game/tree-continue-policy.mjs';
import { createContinueProxy } from './tree-continue-proxy.mjs';
/** Protected standard server runtime for the existing recovery preview.
 * The hosted service has no active checkout deployment or quote signer, and
 * the database policy keeps new payments disabled. Other origins stay closed.
 */
export const HOSTED_CONTINUE_PREVIEW = Object.freeze({
  gameOrigin: 'https://deploy-preview-3--treeforce89.netlify.app',
  serviceUrl: 'https://lehswszuekjqottolmsf.supabase.co/functions/v1/tree-continue-standard',
});
export function directContinueGate(request) {
  const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
  if (!['GET', 'POST'].includes(request.method)) return Response.json({ error: 'method-not-allowed' }, { status: 405, headers });
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'origin-mismatch' }, { status: 403, headers });
  if (new URL(request.url).origin === HOSTED_CONTINUE_PREVIEW.gameOrigin) {
    if (request.method === 'POST') return createContinueProxy(HOSTED_CONTINUE_PREVIEW)(request);
    return Response.json({ mode: 'hosted-checkout-disabled', enabled: false, paymentsEnabled: false,
      restoreAuthorized: false, requiresPayment: false, product, deliveryProtocol: 'tree-paid-delivery.v1' }, { headers });
  }
  return Response.json({ enabled: false, error: 'checkout-not-enabled', product, requiresPayment: false,
    reason: 'Mainnet deployment and persistent receipt service are not configured.' }, { status: 503, headers });
}
