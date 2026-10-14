"use client";
import {useEffect,useState} from "react";
import {connectAndCheckNFTree,disconnectSuiWallet,listSuiWallets} from "./game/nftree-wallet";
import CanopyGame from "./CanopyGame";

type Wallet = ReturnType<typeof listSuiWallets>[number];

export default function NFTreeGateway() {
  const [wallets,setWallets]=useState<Wallet[]>([]);
  const [selected,setSelected]=useState("");
  const [connection,setConnection]=useState<Awaited<ReturnType<typeof connectAndCheckNFTree>>|null>(null);
  const [pending,setPending]=useState(false);
  const [sessionVersion,setSessionVersion]=useState(0);
  const [error,setError]=useState("");
  useEffect(()=>{
    const update=()=>setWallets(listSuiWallets());
    update();
    const timer=window.setInterval(update,1800);
    return()=>window.clearInterval(timer);
  },[]);
  const connect=async()=>{
    const wallet=wallets.find(w=>w.name===selected)??wallets[0];
    if(!wallet)return setError("Install or enable a Sui mainnet wallet.");
    setPending(true);setError("");
    try{setConnection(await connectAndCheckNFTree(wallet));setSessionVersion(v=>v+1)}
    catch(e){setConnection(null);setSessionVersion(v=>v+1);setError(e instanceof Error?e.message:"Wallet connection failed")}
    finally{setPending(false)}
  };
  const disconnect=async()=>{
    setConnection(null);setSessionVersion(v=>v+1);setError("");
    try{await disconnectSuiWallet(connection?.wallet)}catch{}
  };
  useEffect(()=>{
    if(!connection)return;
    const wallet=connection.wallet;
    const accountAddress=connection.account.address;
    const check=()=>{
      const active=Array.from(wallet.accounts||[]).some(account=>account.address===accountAddress&&account.chains?.includes("sui:mainnet"));
      if(!active){setConnection(null);setSessionVersion(v=>v+1);setError("Wallet account changed or disconnected. Reconnect to verify NFTree access.")}
    };
    check();
    const timer=window.setInterval(check,1500);
    return()=>window.clearInterval(timer);
  },[connection]);
  if(connection?.eligible) {
    return <div className="nftree-game-shell">
      <div className="nftree-wallet-bar"><span>NFTree verified · {connection.account.address.slice(0,6)}…{connection.account.address.slice(-4)}</span><button type="button" onClick={disconnect}>Disconnect</button></div>
      <CanopyGame key={sessionVersion} />
    </div>;
  }
  return <div className="nftree-gateway" aria-label="NFTree Gateway">
    <h2>NFTree Gateway</h2>
    <p>Connect your Sui wallet to verify ownership of an NFTree and enter TREE FORCE ’89.</p>
    <label htmlFor="nftree-wallet-select">Sui wallet</label>
    <select id="nftree-wallet-select" value={selected} onChange={e=>setSelected(e.target.value)} disabled={pending}>
      <option value="">Choose detected wallet</option>
      {wallets.map(wallet=><option key={wallet.name} value={wallet.name}>{wallet.name}</option>)}
    </select>
    <button type="button" disabled={pending||wallets.length===0} onClick={connect}>{pending?"Checking NFTree ownership…":"Connect & Verify NFTree"}</button>
    {connection&&!connection.eligible&&<p role="status">No directly owned NFTree was found in this wallet. NFTrees held in a Kiosk or custody contract may require additional verification. <a href="https://nftree.net/" target="_blank" rel="noreferrer">Visit NFTree.net</a>.</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
