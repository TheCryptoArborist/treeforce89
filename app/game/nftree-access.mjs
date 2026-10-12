/** Read-only NFTree ownership check for Sui Core API v2.
 * This is a UI eligibility signal, NOT server authorization for paid continues.
 * Inject a SuiGrpcClient.core; never accept browser claims as payment proof.
 */
export const NFTREE_TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
const WALLET = /^0x[a-fA-F0-9]{1,64}$/;
export async function hasNFTree({ core, address, maxPages = 100 }) {
  if (!core || typeof core.listOwnedObjects !== 'function') throw new Error('sui-client-required');
  if (typeof address !== 'string' || !WALLET.test(address)) throw new Error('invalid-wallet-address');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) throw new Error('invalid-page-limit');
  const owner = '0x' + address.slice(2).toLowerCase().padStart(64, '0');
  let cursor = undefined;
  const visited = new Set();
  for (let page = 0; page < maxPages; page++) {
    const result = await core.listOwnedObjects({
      owner, type: NFTREE_TYPE, cursor, limit: 50, include: { json: true },
    });
    if (!result || !Array.isArray(result.objects)) throw new Error('invalid-sui-response');
    // Type filtering is requested server-side; check it again when the API supplies it.
    if (result.objects.some(o => o && (o.type === NFTREE_TYPE || o.objectType === NFTREE_TYPE || o.object?.type === NFTREE_TYPE))) return true;
    // The core API's type filter is authoritative for returned owned objects.
    // An empty page is not proof of no ownership if a next cursor exists.
    if (result.objects.length && result.objects.every(o => o && !('type' in o) && !('objectType' in o) && !('object' in o))) return true;
    if (result.cursor == null) return false;
    if (typeof result.cursor !== 'string' || visited.has(result.cursor)) throw new Error('invalid-pagination');
    visited.add(result.cursor);
    cursor = result.cursor;
  }
  throw new Error('ownership-query-incomplete');
}
