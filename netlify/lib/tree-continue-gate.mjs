import { TREE_CONTINUE as product } from '../../app/game/tree-continue-policy.mjs';
/** Fail-closed deployment boundary. No mutation, payment or simulated success.
 * Activation must replace this gate with the reviewed authenticated service/BFF.
 * An environment variable or URL query cannot silently enable monetary execution.
 */
export function directContinueGate(request) {
  const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
  if (!['GET', 'POST'].includes(request.method)) return Response.json({ error: 'method-not-allowed' }, { status: 405, headers });
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'origin-mismatch' }, { status: 403, headers });
  return Response.json({ enabled: false, error: 'checkout-not-enabled', product,
    reason: 'Mainnet deployment and persistent receipt service are not configured.' }, { status: 503, headers });
}
