/** Public-account dry-run only. No signer, wallet key, or execution method. */
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { ADMIN, SETUP_ORIGIN, createPublisher } from './checkout-publisher.mjs';
import { CHECKOUT_PACKAGE } from './checkout-package.mjs';
const client = new SuiGrpcClient({network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443'});
const kit = {
  stores: {$currentNetwork: {get: () => 'mainnet'}, $connection: {get: () => ({account: {address: ADMIN}})}, $wallets: {get: () => []}},
  connectWallet: async () => {},
  signAndExecuteTransaction: async () => {throw new Error('Signing is forbidden in readiness checks.');},
};
const p = createPublisher({origin: SETUP_ORIGIN, kit, client, storage: {getItem: () => null}});
const gas = await p.connect({});
console.log('CHECKOUT_MAINNET_READINESS', JSON.stringify({admin: ADMIN, sourceCommit: CHECKOUT_PACKAGE.sourceCommit, payloadSha256: CHECKOUT_PACKAGE.payloadSha256, ...gas, simulations: 1, transactionsSigned: 0, transactionsSubmitted: 0}));
