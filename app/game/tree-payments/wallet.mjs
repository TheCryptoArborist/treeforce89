import { getSuiApp } from './sui-app.mjs';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { TREE_CONTINUE as P, requireContinue as need, sameAddress, validateOrder } from '../tree-continue-policy.mjs';

export const APPROVED_DEPLOYMENT = Object.freeze({network: P.network, paymentMethod: 'tree-transfer-v1'});
const Quote = bcs.struct('Quote', {
  domain: bcs.vector(bcs.u8()), checkout_id: bcs.Address, key_epoch: bcs.u64(),
  order_id: bcs.vector(bcs.u8()), account_id: bcs.vector(bcs.u8()), payer: bcs.Address,
  recipient: bcs.Address, coin_type: bcs.string(), amount_raw: bcs.u64(),
  issued_at_ms: bcs.u64(), expires_at_ms: bcs.u64(), quote_hash: bcs.vector(bcs.u8()),
});
const hex = value => [...value].map(v => v.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g).map(v => parseInt(v, 16)));
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' :
  v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
function base64(text, maximum) {
  need(typeof text === 'string' && text.length <= Math.ceil(maximum / 3) * 4 && /^[A-Za-z0-9+/]*={0,2}$/.test(text), 'invalid-quote-encoding');
  const raw = atob(text); need(raw.length <= maximum && btoa(raw) === text, 'noncanonical-quote');
  return Uint8Array.from(raw, v => v.charCodeAt(0));
}
async function contractPaymentTransaction(order, deployment, now = Date.now()) {
  const o = structuredClone(order), d = deployment && structuredClone(deployment);
  need(d?.network === P.network && /^0x[a-f0-9]{64}$/.test(d.packageId || '') &&
    /^0x[a-f0-9]{64}$/.test(d.checkoutId || '') && /^[a-f0-9]{64}$/.test(d.quotePublicKey || '') &&
    /^[1-9][0-9]*$/.test(d.initialSharedVersion || '') && /^[1-9][0-9]*$/.test(d.keyEpoch || ''), 'checkout-not-enabled');
  validateOrder(o, o.runId, o.accountId, o.payer);
  need(o.payable === true, 'checkout-not-enabled');
  const t = o.terms;
  need(t?.kind === 'direct-continue' && t.runId === o.runId && t.orderId === o.orderId && t.accountId === o.accountId &&
    sameAddress(t.payer, o.payer) && t.recipient === P.recipient && t.requiredRaw === P.amountRaw &&
    t.product === P.product && t.quantity === 1 && t.restoreLives === 3 && t.decimals === 6 &&
    t.network === P.network && t.chainIdentifier === '35834a8a' && t.coinType === P.coinType &&
    t.checkoutPackage === d.packageId && t.checkoutId === d.checkoutId && t.keyEpoch === d.keyEpoch &&
    t.eventType === `${d.packageId}::checkout::Purchase` && /^[a-f0-9]{64}$/.test(t.flightHash || ''), 'wrong-checkout-terms');
  const { quoteHash, ...committed } = t;
  const calculated = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(committed)))));
  need(calculated === quoteHash, 'order-commitment-mismatch');
  const bytes = base64(o.quoteBase64, 512), signature = base64(o.signatureBase64, 64);
  const q = Quote.parse(bytes);
  need(hex(Quote.serialize(q).toBytes()) === hex(bytes), 'noncanonical-quote');
  need(new TextDecoder().decode(Uint8Array.from(q.domain)) === 'TREE_CC_CHECKOUT_V1:sui:mainnet' &&
    q.checkout_id === d.checkoutId && q.key_epoch === d.keyEpoch &&
    hex(q.order_id) === o.orderId.replaceAll('-', '') && hex(q.account_id) === o.accountId.replaceAll('-', '') &&
    sameAddress(q.payer, o.payer) && q.recipient === P.recipient && q.coin_type === P.coinType &&
    q.amount_raw === P.amountRaw && hex(q.quote_hash) === quoteHash &&
    q.issued_at_ms === String(t.issuedAtMs) && q.expires_at_ms === String(t.expiresAtMs), 'quote-terms-mismatch');
  need(Number.isSafeInteger(now) && Number.isSafeInteger(t.issuedAtMs) && Number.isSafeInteger(t.expiresAtMs) &&
    now >= t.issuedAtMs && now <= t.expiresAtMs && t.expiresAtMs - t.issuedAtMs > 0 && t.expiresAtMs - t.issuedAtMs <= 45000, 'quote-expired');
  const key = await crypto.subtle.importKey('raw', unhex(d.quotePublicKey), 'Ed25519', false, ['verify']);
  need(signature.length === 64 && await crypto.subtle.verify('Ed25519', key, signature, bytes), 'invalid-quote-signature');
  const tx = new Transaction(); tx.setSender(o.payer);
  tx.moveCall({ target: `${d.packageId}::checkout::pay`, typeArguments: [P.coinType], arguments: [
    tx.sharedObjectRef({ objectId: d.checkoutId, initialSharedVersion: d.initialSharedVersion, mutable: true }),
    tx.coin({ balance: BigInt(P.amountRaw), type: P.coinType }),
    tx.pure.vector('u8', [...bytes]), tx.pure.vector('u8', [...signature]), tx.object.clock(),
  ] });
  return tx;
}
export async function paymentTransaction(order, deployment=APPROVED_DEPLOYMENT, now=Date.now()) {
  if(order?.terms?.paymentMethod!=='tree-transfer-v1')return contractPaymentTransaction(order,deployment,now);
  const o=structuredClone(order),t=o.terms;
  need(deployment?.paymentMethod==='tree-transfer-v1'&&deployment.network===P.network,'checkout-not-enabled');
  validateOrder(o,o.runId,o.accountId,o.payer);need(o.payable===true,'checkout-not-enabled');
  need(t.kind==='direct-continue'&&t.orderId===o.orderId&&t.runId===o.runId&&t.accountId===o.accountId&&
    sameAddress(t.payer,o.payer)&&t.product===P.product&&t.policyVersion==='treeforce89-20000-tree-v1'&&
    t.network===P.network&&t.chainIdentifier==='35834a8a'&&t.coinType===P.coinType&&t.recipient===P.recipient&&
    t.requiredRaw===P.amountRaw&&t.decimals===6&&t.quantity===1&&t.restoreLives===3&&/^[a-f0-9]{64}$/.test(t.flightHash||''), 'wrong-checkout-terms');
  const fields=['kind','product','policyVersion','network','chainIdentifier','decimals','coinType','recipient','requiredRaw','quantity','restoreLives','orderId','accountId','runId','payer','paymentMethod','flightHash','issuedAtMs','expiresAtMs','quoteHash'];
  need(Object.keys(t).length===fields.length&&Object.keys(t).every(k=>fields.includes(k)),'wrong-checkout-terms');
  const {quoteHash,...committed}=t;
  const calculated=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(committed)))));
  need(calculated===quoteHash,'order-commitment-mismatch');
  need(Number.isSafeInteger(now)&&Number.isSafeInteger(t.issuedAtMs)&&Number.isSafeInteger(t.expiresAtMs)&&
    now>=t.issuedAtMs&&t.expiresAtMs-t.issuedAtMs===900000,'quote-expired');
  const tx=new Transaction();tx.setSender(o.payer);
  // An ordinary standard-library string binds the wallet-signed transfer to its
  // saved-flight order. It creates no object and requires no new Move package.
  tx.moveCall({target:'0x1::string::utf8',arguments:[tx.pure.string('TREE_FORCE_CONTINUE_V1:'+quoteHash)]});
  tx.transferObjects([tx.coin({balance:BigInt(P.amountRaw),type:P.coinType})],P.recipient);
  return tx;
}
export function createPaymentWallet({ deployment = APPROVED_DEPLOYMENT, kit, selectWallet, connectTimeoutMs=45000 } = {}) {
  const d = deployment && Object.freeze({ ...deployment });
  const app = kit || getSuiApp();
  let connecting=null;
  return {
    async connect(payer) {
      need(d, 'checkout-not-enabled');
      const current = app.stores.$connection.get();
      if (!current.account || !sameAddress(current.account.address, payer)) {
        const wallets = app.stores.$wallets.get(); need(wallets.length > 0, 'no-sui-wallet');
        const wallet = await selectWallet(wallets); need(wallet, 'wallet-not-selected');
        need(!connecting,'wallet-connection-pending');
        const account=wallet.accounts?.find(a=>sameAddress(a.address,payer));
        const request=app.connectWallet({wallet,...(account?{account}:{})});connecting=request;
        const finished=()=>{if(connecting===request)connecting=null;};request.then(finished,finished);
        let timer;
        try{await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('wallet-connection-timeout'),{code:'wallet-connection-timeout'})),connectTimeoutMs);})]);}
        finally{clearTimeout(timer);}
      }
      need(sameAddress(app.stores.$connection.get().account?.address, payer), 'wrong-payer');
      need(app.stores.$currentNetwork.get() === 'mainnet', 'wrong-network');
    },
    prepare: order => paymentTransaction(order, d),
    async pay(transaction, order) {
      need(sameAddress(app.stores.$connection.get().account?.address, order.payer) && app.stores.$currentNetwork.get() === 'mainnet', 'wallet-changed');
      return app.signAndExecuteTransaction({ transaction });
    },
    wait: digest => app.getClient('mainnet').core.waitForTransaction({ digest }),
  };
}
