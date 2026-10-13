import '@mysten/dapp-kit-core/web';
import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiGrpcClient } from '@mysten/sui/grpc';
const kit = createDAppKit({
  networks: ['mainnet'], defaultNetwork: 'mainnet', autoConnect: false,
  slushWalletConfig: null,
  createClient: () => new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
});
const button = document.querySelector('mysten-dapp-kit-connect-button');
button.instance = kit;
button.modalOptions = { filterFn: wallet => wallet.chains.includes('sui:mainnet') };
kit.stores.$connection.subscribe(connection => {
  document.getElementById('status').textContent = connection.isConnected
    ? `Connected: ${connection.wallet.name} · ${connection.account.address}`
    : connection.isConnecting ? 'Waiting for wallet connection approval. No signature or payment requested.' : 'Not connected.';
});
