"use client";
import {useEffect,useRef,useState} from 'react';
import {useCurrentAccount,useDAppKit,useWalletConnection} from '@mysten/dapp-kit-react';
import {ConnectButton} from '@mysten/dapp-kit-react/ui';
import {authenticateGateway,revokeGatewaySession,isGatewaySessionCurrent} from './game/gateway-client.mjs';
import CanopyGame from './CanopyGame';

type Session={wallet:string;sessionToken:string;runId:string;expiresAt:number};

export default function NFTreeGateway() {
  const account=useCurrentAccount();
  const kit=useDAppKit();
  const connection=useWalletConnection();
  const [session,setSession]=useState<Session|null>(null);
  const sessionRef=useRef<Session|null>(null);
  const requestRef=useRef<AbortController|null>(null);
  const epoch=useRef(0);
  const [pending,setPending]=useState(false);
  const [stage,setStage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    // Account changes or disconnect immediately unmount the game. In-flight
    // signing responses cannot restore access for a previously selected wallet.
    epoch.current++;
    requestRef.current?.abort();
    const previous=sessionRef.current;
    sessionRef.current=null;setSession(null);setPending(false);setError('');
    if(previous)void revokeGatewaySession(previous).catch(()=>{});
    return()=>{epoch.current++;requestRef.current?.abort();};
  },[account?.address]);

  useEffect(()=>{
    if(!session)return;
    const timer=window.setTimeout(()=>{
      sessionRef.current=null;setSession(null);
      setError('Your game session expired. Verify your NFTree again to play.');
      void revokeGatewaySession(session).catch(()=>{});
    },Math.max(0,session.expiresAt-Date.now()));
    return()=>window.clearTimeout(timer);
  },[session]);

  useEffect(()=>{
    const leave=()=>{
      if(sessionRef.current)void revokeGatewaySession(sessionRef.current,{keepalive:true}).catch(()=>{});
    };
    window.addEventListener('pagehide',leave);
    return()=>{window.removeEventListener('pagehide',leave);leave();};
  },[]);

  const verify=async()=>{
    if(!account || pending)return;
    const version=++epoch.current;
    const controller=new AbortController();requestRef.current=controller;
    setPending(true);setError('');
    try {
      const verified=await authenticateGateway({wallet:account.address,origin:window.location.origin,
        signal:controller.signal,onStage:setStage,
        signMessage:message=>kit.signPersonalMessage({message,account,network:'mainnet'})});
      if(version!==epoch.current || kit.stores.$connection.get().account?.address!==account.address){
        void revokeGatewaySession(verified).catch(()=>{});return;
      }
      sessionRef.current=verified;setSession(verified);
    } catch(e) {
      if(version===epoch.current){setSession(null);setError(e instanceof Error?e.message:'Wallet sign-in failed. Please retry.');}
    } finally {
      if(version===epoch.current)setPending(false);
    }
  };
  const disconnect=async()=>{
    epoch.current++;requestRef.current?.abort();
    const previous=sessionRef.current;sessionRef.current=null;setSession(null);setPending(false);setError('');
    try {if(previous)await revokeGatewaySession(previous);}
    catch {setError('Game closed. Server sign-out could not be confirmed; the session will expire automatically.');}
    finally {await kit.disconnectWallet().catch(()=>{});}
  };
  if(session && isGatewaySessionCurrent(session,account?.address)) {
    return <div className="nftree-game-shell">
      <div className="nftree-wallet-bar"><span>NFTree verified · {session.wallet.slice(0,6)}…{session.wallet.slice(-4)}</span><button type="button" onClick={disconnect}>Disconnect</button></div>
      <CanopyGame key={session.runId} serverRunId={session.runId} />
    </div>;
  }
  return <div className="nftree-gateway" aria-label="NFTree Gateway">
    <h2>NFTree Gateway</h2>
    <p>Your NFTree is your arcade pass. Connect your Sui wallet, then verify access to play TREE FORCE ’89.</p>
    {!account ? <ConnectButton /> : <>
      <p className="nftree-connected">Wallet connected · {account.address.slice(0,6)}…{account.address.slice(-4)}</p>
      <button type="button" disabled={pending} onClick={verify}>{pending?stage:'Verify NFTree & Play'}</button>
      <button className="nftree-secondary" type="button" onClick={disconnect}>Disconnect</button>
    </>}
    {!account && connection.status==='connecting' && <p role="status">Waiting for your wallet…</p>}
    {pending && <p role="status" aria-live="polite">{stage}</p>}
    <p className="nftree-signin-note">Sign-in uses a message signature. It does not transfer tokens or charge a fee.</p>
    <p className="nftree-signin-note">Use a wallet holding an NFTree directly. Kiosk and custody holdings are not supported in this preview.</p>
    <a href="https://nftree.net/" target="_blank" rel="noreferrer">Explore NFTrees</a>
    <small>If your wallet shows a security warning, stop. Do not bypass it.</small>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
