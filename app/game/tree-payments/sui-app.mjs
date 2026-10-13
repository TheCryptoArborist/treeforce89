import { createDAppKit, getWalletUniqueIdentifier } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
let app;
/** One installed-wallet connection for both account verification and TREE payments. */
export function getSuiApp() {
  return app ||= createDAppKit({ networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false,
    slushWalletConfig: null,
    createClient: () => new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' }) });
}
export { getWalletUniqueIdentifier };
