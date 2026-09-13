(async () => {
  const error = new URLSearchParams(location.search).get('error');
  history.replaceState(null, '', '/account-return.html');
  let signed = false;
  try { const r = await fetch('/api/tree-account', { credentials: 'same-origin', cache: 'no-store' }); signed = r.ok && !!(await r.json()).identity; } catch {}
  document.getElementById('heading').textContent = !error && signed ? 'TREE Account connected' : 'Sign-in was not completed';
  document.getElementById('detail').textContent = !error && signed ? 'Your game can now recognize this signed-in account. NFTree access and online records are not enabled by this step.' : 'No transaction was made. Return to the game and try signing in again.';
  if (window.opener) { window.opener.postMessage({ type: 'tree-account:refresh' }, location.origin); if (!error && signed) window.close(); }
})();
