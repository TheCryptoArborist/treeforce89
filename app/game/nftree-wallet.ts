import { SuiGrpcClient } from "@mysten/sui/grpc";
import { StandardConnect, StandardDisconnect, getWallets } from "@mysten/wallet-standard";
import { checkDirectNFTreeOwnership } from "./nftree-access.mjs";

const MAINNET = "sui:mainnet";
const client = new SuiGrpcClient({network:"mainnet",baseUrl:"https://fullnode.mainnet.sui.io:443"});

export function listSuiWallets() {
  return getWallets().get().filter(wallet =>
    wallet?.features?.[StandardConnect] &&
    (wallet.chains?.includes(MAINNET) || wallet.accounts?.some(account => account.chains?.includes(MAINNET)))
  );
}

export async function connectAndCheckNFTree(wallet, onStage = () => {}) {
  onStage("wallet-connection-requested");
  if (!wallet?.features?.[StandardConnect]) throw new Error("Select a supported Sui wallet");
  const result = await wallet.features[StandardConnect].connect();
  onStage("wallet-connected");
  const account = Array.from(result.accounts || wallet.accounts || []).find(account => account.chains?.includes(MAINNET));
  if (!account?.address) throw new Error("Wallet did not provide a Sui mainnet account");
  onStage("ownership-query-started");
  const eligible = await checkDirectNFTreeOwnership({client,wallet:account.address});
  onStage(eligible ? "ownership-confirmed" : "ownership-not-found");
  return {wallet,account,eligible};
}

export async function disconnectSuiWallet(wallet) {
  if (wallet?.features?.[StandardDisconnect]) await wallet.features[StandardDisconnect].disconnect();
}
