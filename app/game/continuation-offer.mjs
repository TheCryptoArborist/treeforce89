import {TREE_COIN_TYPE,TREE_PAYMENT_RECIPIENT,treeBaseUnits} from './tree-payment.mjs';

// Read-only checkout review. There is deliberately no activation option.
// Wallet transfers and redemption must remain disabled until release approval.
export function createContinuationOfferService({sessionResolver,client}) {
  if(typeof sessionResolver!=='function' || client?.network!=='mainnet' ||
    typeof client?.core?.getCoinMetadata!=='function')throw Error('Trusted session and mainnet metadata required');
  return {
    async review({sessionToken,runId}) {
      const session=await sessionResolver({sessionToken});
      if(session.runId!==runId)throw Object.assign(Error('Run changed'),{code:'RUN_CHANGED'});
      const {coinMetadata}=await client.core.getCoinMetadata({coinType:TREE_COIN_TYPE,signal:AbortSignal.timeout(15000)});
      if(!coinMetadata || !Number.isInteger(coinMetadata.decimals) ||
        coinMetadata.decimals<0 || coinMetadata.decimals>18)throw Error('TREE metadata unavailable');
      return {enabled:false,runId,network:'sui:mainnet',coinType:TREE_COIN_TYPE,
        recipient:TREE_PAYMENT_RECIPIENT,recipientConfirmed:false,
        price:'20000',decimals:coinMetadata.decimals,
        amountBaseUnits:treeBaseUnits(coinMetadata.decimals).toString(),lives:3,
        message:'Paid continues are being tested. No TREE will be transferred.'};
    },
  };
}
