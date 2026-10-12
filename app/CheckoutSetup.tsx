import { useEffect, useRef, useState } from 'react';
import { ADMIN, SETUP_ORIGIN, createPublisher, validatePackage } from './game/tree-payments/checkout-publisher.mjs';
import './checkout-setup.css';

export default function CheckoutSetup() {
  const publisher = useRef<any>(null);
  const [wallets, setWallets] = useState<any[]>([]), [status, setStatus] = useState('Checking the tested package…');
  const [busy, setBusy] = useState(false), [estimate, setEstimate] = useState<any>(null), [receipt, setReceipt] = useState<any>(null), [digest, setDigest] = useState('');
  useEffect(() => {
    if (location.origin !== SETUP_ORIGIN) {setStatus('Checkout setup is available on the approved preview only.'); return;}
    let active = true;
    validatePackage().then(() => {
      if (!active) return;
      publisher.current = createPublisher({origin: location.origin});
      const saved = publisher.current.saved();
      if (saved?.digest) {setDigest(saved.digest); setStatus('A publication digest is saved. Verify it below.');}
      else setStatus('Connect the approved admin wallet to check gas.');
      setWallets(publisher.current.wallets());
    }).catch(e => setStatus(e.message));
    const timer = setInterval(() => {if (publisher.current) setWallets(publisher.current.wallets());}, 1500);
    return () => {active = false; clearInterval(timer);};
  }, []);
  async function perform(work: () => Promise<any>, message: string) {
    if (busy) return; setBusy(true); setStatus(message);
    try {await work();} catch (e: any) {setStatus(e.message || 'The wallet action could not be completed.'); setEstimate(null); const saved = publisher.current?.saved(); if(saved?.digest) setDigest(saved.digest);}
    finally {setBusy(false);}
  }
  function complete(r: any) {setReceipt(r); setDigest(r.digest); setEstimate(null); setStatus('Published and verified. Checkout remains paused.');}
  return <main className="checkout-shell"><section className="checkout-card">
    <p className="checkout-kicker">CANOPY COMMAND · ADMIN SETUP</p>
    <h1>Publish TREE checkout</h1>
    <p>Publish the tested checkout on Sui mainnet. It starts paused. Both control capabilities stay in your admin wallet.</p>
    <dl><dt>Admin wallet</dt><dd className="checkout-address">{ADMIN}</dd><dt>Payment status</dt><dd>Disabled until checkout configuration is verified</dd><dt>Continue price after setup</dt><dd>20,000 TREE → 3 lives in the same flight</dd><dt>This wallet action</dt><dd>Package publication · SUI network gas</dd></dl>
    {!receipt && <div className="checkout-actions">{wallets.map(w => <button key={w.name} disabled={busy || !!digest} onClick={() => perform(async () => {setEstimate(null); const e = await publisher.current.connect(w); setEstimate(e); setStatus('Gas checked. Review the publication in your wallet.');}, 'Connecting wallet and checking gas…')}>Connect {w.name}</button>)}
      {!wallets.length && publisher.current && <p>Open this page in your Sui wallet browser or install a Sui wallet, then return here.</p>}
      {estimate && <><p>Estimated gas: {estimate.estimateSui.toFixed(6)} SUI. Maximum gas budget: {estimate.maximumSui.toFixed(6)} SUI.</p><button className="checkout-primary" disabled={busy || !!digest} onClick={() => perform(async () => complete(await publisher.current.publish()), 'Waiting for wallet approval and mainnet verification…')}>Publish paused checkout</button></>}
    </div>}
    <p className="checkout-status" role="status" aria-live="polite">{status}</p>
    {publisher.current && <details open={!!digest}><summary>Verify a publication receipt</summary><label htmlFor="publish-digest">Transaction digest</label><input id="publish-digest" value={digest} onChange={e => setDigest(e.target.value.trim())} placeholder="Sui transaction digest" spellCheck={false}/><button disabled={busy || !digest} onClick={() => perform(async () => complete(await publisher.current.recover(digest)), 'Checking the publication on Sui mainnet…')}>Verify publication</button></details>}
    {receipt && <><h2>Verified checkout</h2><dl>{Object.entries(receipt).map(([key, value]) => <div key={key}><dt>{key}</dt><dd className="checkout-address">{String(value)}</dd></div>)}</dl><button onClick={() => navigator.clipboard.writeText(JSON.stringify(receipt, null, 2)).then(() => setStatus('Checkout receipt copied.'))}>Copy checkout receipt</button></>}
    <p><a href="/">Return to the game</a></p>
  </section></main>;
}
