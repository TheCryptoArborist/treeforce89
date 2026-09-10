/** Identity-only UI: it never grants access, credits or verified records. */
export function installTreeAccount(game, frame) {
  if (!frame) return () => {};
  let disposed = false, popup = null, busy = false, identity = null, configured = false, revision = 0;
  const bar = document.createElement('section'); bar.className = 'tree-account-bar'; bar.setAttribute('aria-label', 'TREE Account sign-in');
  const copy = document.createElement('div'), label = document.createElement('strong'), note = document.createElement('small');
  label.textContent = 'GUEST PLAY'; note.textContent = 'Checking account sign-in…'; note.setAttribute('role', 'status'); copy.append(label, note);
  const login = document.createElement('button'); login.type = 'button'; login.textContent = 'SIGN IN'; login.disabled = true;
  const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = 'SIGN OUT'; logout.hidden = true;
  bar.append(copy, login, logout); frame.insertBefore(bar, frame.querySelector('.screen-bezel')); frame.classList.add('has-tree-account');
  function render() {
    if (disposed) return;
    label.textContent = identity ? `TREE ACCOUNT · ${identity.wallet.address.slice(0, 6)}…${identity.wallet.address.slice(-4)}` : 'GUEST PLAY';
    label.title = identity ? `Preview TREE Account ${identity.accountId}` : '';
    login.hidden = !!identity; logout.hidden = !identity;
    login.disabled = busy || !configured; logout.disabled = busy;
    game.registry.set('treeAccountIdentity', identity);
    game.events.emit('tree-account:identity', identity); // Display only; backend must authenticate its own requests.
  }
  async function api(body) {
    const r = await fetch('/api/tree-account', { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    if (!r.ok) throw new Error('Account sign-in is unavailable. Guest play still works.'); return r.json();
  }
  async function refresh() {
    const serial = ++revision;
    try { const p = await api(); if (disposed || serial !== revision) return;
      identity = p.identity?.authenticated === true && p.identity?.environment === 'preview' ? p.identity : null; configured = p.configured === true;
      note.textContent = identity ? 'Signed in · scores and badges remain browser-local.' : 'Sui or EVM · signature only · no payment';
    } catch (e) { if (disposed || serial !== revision) return; identity = null; configured = false; note.textContent = e.message; }
    render();
  }
  login.addEventListener('click', async () => {
    if (busy) return;
    popup = window.open('about:blank', 'tree-account-signin', 'popup,width=760,height=860');
    if (!popup) { note.textContent = 'Allow pop-ups for this preview, then select Sign in again.'; return; }
    popup.document.title = 'TREE Account sign-in'; popup.document.body.textContent = 'Opening the TREE Arcade sign-in preview…';
    busy = true; render();
    try { const p = await api({ action: 'begin' }); if (disposed) return; popup.location.replace(p.url); note.textContent = 'Complete sign-in in the TREE Arcade window. No payment is requested.'; }
    catch (e) { popup?.close(); note.textContent = e.message; }
    finally { busy = false; render(); }
  });
  logout.addEventListener('click', async () => {
    if (busy) return; busy = true; ++revision; render();
    try { await api({ action: 'logout' }); identity = null; note.textContent = 'Signed out of the game. Local scores and gameplay are unchanged.'; }
    catch (e) { note.textContent = 'Sign-out could not be confirmed. Try again when the connection returns.'; }
    finally { busy = false; render(); }
  });
  const message = event => { if (event.origin === location.origin && event.source === popup && event.data?.type === 'tree-account:refresh') void refresh(); };
  const focus = () => { if (!busy) void refresh(); };
  window.addEventListener('message', message); window.addEventListener('focus', focus);
  const timer = window.setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 60000);
  void refresh();
  return () => { disposed = true; ++revision; window.clearInterval(timer); window.removeEventListener('message', message); window.removeEventListener('focus', focus); bar.remove(); frame.classList.remove('has-tree-account'); };
}
