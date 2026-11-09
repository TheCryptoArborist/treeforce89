"use client";
export default function TestContinuationReview({onClose}:{session:unknown;onClose:()=>void}) {
return <div className="continuation-backdrop"><section role="dialog" aria-modal="true" aria-label="Test payments disabled" className="continuation-review"><h2>Payments disabled</h2><p>This mobile test never transfers TREE or SUI.</p><button type="button" autoFocus onClick={onClose}>Back to Game Over</button></section></div>;
}
