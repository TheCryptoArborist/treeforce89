/** Fixed product terms. This is not a Canopy Credits exchange rate. */
export const TREE_CONTINUE = Object.freeze({
  product: 'treeforce89.continue.v1', network: 'sui:mainnet',
  coinType: '0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE',
  recipient: '0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f',
  decimals: 6, amountRaw: '20000000000', displayPrice: '20,000 TREE',
  lives: 3, maxPerFlight: 1,
});
export function requireContinue(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}
export function sameAddress(a, b) {
  const valid = v => typeof v === 'string' && /^0x[0-9a-f]{1,64}$/i.test(v);
  return valid(a) && valid(b) && a.slice(2).toLowerCase().padStart(64, '0') === b.slice(2).toLowerCase().padStart(64, '0');
}
export function validUUID(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
}
export function validateOrder(order, runId, accountId, payer) {
  requireContinue(order && validUUID(order.orderId) && order.runId === runId && order.accountId === accountId, 'wrong-flight-order');
  requireContinue(order.product === TREE_CONTINUE.product && order.network === TREE_CONTINUE.network &&
    order.coinType === TREE_CONTINUE.coinType && order.recipient === TREE_CONTINUE.recipient &&
    order.amountRaw === TREE_CONTINUE.amountRaw && order.decimals === 6 && order.lives === 3,
  'wrong-continue-terms');
  requireContinue(sameAddress(order.payer, payer), 'wrong-payer');
  return order;
}
