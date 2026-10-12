/** Local game-start gate. This is not proof of NFT ownership and must not
 * authorize purchases or paid-continue entitlements.
 * The wallet adapter must set eligibility after a fresh Sui ownership query.
 */
let state = { address: null, eligible: false };
const listeners = new Set();
export function getNFTreeGate() { return { ...state }; }
export function resetNFTreeGate() { state = { address: null, eligible: false }; for (const cb of listeners) cb(getNFTreeGate()); }
export function updateNFTreeGate({ address, eligible }) {
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(address) || typeof eligible !== 'boolean')
    throw new Error('invalid-gate-state');
  state = { address: address.toLowerCase(), eligible };
  for (const cb of listeners) cb(getNFTreeGate());
}
export function subscribeNFTreeGate(cb) {
  if (typeof cb !== 'function') throw new Error('invalid-gate-listener');
  listeners.add(cb);
  return () => listeners.delete(cb);
}
