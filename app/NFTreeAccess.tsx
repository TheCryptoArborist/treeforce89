"use client";
import { useEffect, useState } from 'react';
import { useCurrentAccount, useCurrentClient, useCurrentNetwork, useWalletConnection } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { hasNFTree } from './game/nftree-access.mjs';
import { resetNFTreeGate, updateNFTreeGate } from './game/nftree-gate.mjs';

type Status = 'disconnected' | 'checking' | 'eligible' | 'ineligible' | 'error';
export default function NFTreeAccess() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const network = useCurrentNetwork();
  const connection = useWalletConnection();
  const [status, setStatus] = useState<Status>('disconnected');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    resetNFTreeGate();
    if (!account || network !== 'mainnet') {
      setStatus('disconnected');
      return () => { active = false; resetNFTreeGate(); };
    }
    setStatus('checking');
    hasNFTree({ core: client.core, address: account.address })
      .then(eligible => {
        if (!active) return;
        updateNFTreeGate({ address: account.address, eligible });
        setStatus(eligible ? 'eligible' : 'ineligible');
      })
      .catch(() => {
        if (!active) return;
        resetNFTreeGate();
        setStatus('error');
      });
    return () => { active = false; resetNFTreeGate(); };
  }, [account?.address, client, network, refresh]);
  const message = connection.status === 'reconnecting' ? 'Restoring wallet connection…'
    : !account ? 'Connect your Sui wallet to check NFTree access.'
    : network !== 'mainnet' ? 'Switch to Sui mainnet.'
    : status === 'checking' ? 'Checking NFTree ownership on Sui…'
    : status === 'eligible' ? 'NFTree verified — press START in the game.'
    : status === 'ineligible' ? 'No NFTree found in this wallet.'
    : status === 'error' ? 'Ownership check unavailable. Retry before playing.'
    : 'Connect your wallet to play.';
  return <section className="nftree-access" aria-label="NFTree holder access">
    <div className="nftree-access-row">
      <strong>NFTREE HOLDER ACCESS</strong>
      <ConnectButton />
      {account && <button type="button" onClick={() => setRefresh(v => v + 1)} disabled={status === 'checking'}>Recheck</button>}
    </div>
    <p role="status">{message}</p>
    {status === 'ineligible' && <a href="https://www.tradeport.xyz/sui/collection/0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT?tab=holders&bottomTab=trades" target="_blank" rel="noopener noreferrer">Find an NFTree on TradePort</a>}
  </section>;
}
