"use client";
import {useEffect,useRef,useState} from 'react';
import {reviewContinuation} from './game/continuation-review-client.mjs';

type Session={sessionToken:string;runId:string};
type Offer=Awaited<ReturnType<typeof reviewContinuation>>;
export default function ContinuationReview({session,onClose}:{session:Session;onClose:()=>void}) {
  const [offer,setOffer]=useState<Offer|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    closeButton.current?.focus();
    const controller=new AbortController();setError('');setOffer(null);
    reviewContinuation(session,{signal:controller.signal}).then(value=>{
      if(!controller.signal.aborted)setOffer(value);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Checkout is unavailable.');});
    return()=>controller.abort();
  },[session.sessionToken,session.runId,attempt]);
  return <div className="continuation-backdrop" onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onClose();}
    if(event.key==='Tab'){
      const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;
      event.preventDefault();buttons[next]?.focus();
    }
    event.stopPropagation();
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="continue-title" className="continuation-review">
      <h2 id="continue-title">Continue your run</h2>
      <p>Restore 3 lives and replay your current wave, keeping your score.</p>
      <p className="continuation-price">20,000 TREE</p>
      <p className="continuation-note">Sui mainnet · SUI gas is separate</p>
      {!offer&&!error&&<p role="status">Loading checkout details…</p>}
      {offer&&<><p className="continuation-note">Token amount verified from mainnet metadata.</p>
        <p className="continuation-note">Proposed recipient (awaiting confirmation)</p>
        <code>{offer.recipient}</code></>}
      {error&&<><p role="alert">{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry details</button></>}
      <p>Paid continues are being tested. No TREE will be transferred.</p>
      <button type="button" disabled>Payments disabled</button>
      <button type="button" ref={closeButton} onClick={onClose}>Back to Game Over</button>
    </section>
  </div>;
}
