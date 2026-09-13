import { validIdentity } from './tree-account-session.mjs';
const FLOW = '__Host-tree-game-inline', SESSION = '__Host-tree-game-session';
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const cookie = (r, n) => (r.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${n}=`))?.slice(n.length + 1) || '';
const setCookie = (n, v, seconds) => `${n}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function json(body, status = 200, cookies = []) { const headers = new Headers({ 'Cache-Control': 'no-store, private', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' }); cookies.forEach(c => headers.append('Set-Cookie', c)); return new Response(JSON.stringify(body), { status, headers }); }
const preview = v => { try { const u = new URL(v); return u.origin === v && u.protocol === 'https:' && u.hostname.startsWith('deploy-preview-'); } catch { return false; } };
export function createInlineProxy({ authOrigin, gameOrigin, fetcher = fetch, now = Date.now }) {
  return async request => {
    try {
      if (!preview(authOrigin) || !preview(gameOrigin) || new URL(request.url).origin !== gameOrigin) return json({ error: 'preview-not-configured' }, 503);
      if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
      if (request.headers.get('origin') !== gameOrigin) return json({ error: 'origin-mismatch' }, 403);
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'json-required' }, 415);
      const reader = request.body?.getReader(); if (!reader) return json({ error: 'invalid-json' }, 400);
      let size = 0; const parts = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 15000) { await reader.cancel(); return json({ error: 'request-too-large' }, 413); } parts.push(value); }
      let b; try { b = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { return json({ error: 'invalid-json' }, 400); }
      const allowed = { challenge: ['family', 'address', 'chainId'], verify: ['signature'], cancel: [] };
      if (!b || !Object.hasOwn(allowed, b.action) || Object.keys(b).some(k => !['action', ...allowed[b.action]].includes(k))) return json({ error: 'invalid-command' }, 400);
      let flow; try { flow = JSON.parse(Buffer.from(cookie(request, FLOW), 'base64url').toString()); } catch {}
      async function upstream(fields) {
        const r = await fetcher(`${authOrigin}/api/tree-account-inline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, clientOrigin: gameOrigin }), redirect: 'error', signal: AbortSignal.timeout(18000) });
        const data = await r.json(); if (!r.ok || data.status !== 'ok') throw Object.assign(new Error(data.error), { status: r.status }); return data;
      }
      if (b.action === 'cancel') {
        if (hex(flow?.nonce) && hex(flow?.binding)) await upstream({ action: 'cancel', nonce: flow.nonce, binding: flow.binding }).catch(() => {});
        return json({ status: 'ok' }, 200, [setCookie(FLOW, '', 0)]);
      }
      if (b.action === 'challenge') {
        const p = await upstream(b);
        if (!hex(p.nonce) || !hex(p.binding) || typeof p.message !== 'string' || !Number.isSafeInteger(p.expiresAt) || p.expiresAt <= now()) throw Error('invalid-challenge');
        const value = Buffer.from(JSON.stringify({ nonce: p.nonce, binding: p.binding, expiresAt: p.expiresAt })).toString('base64url');
        // The binding is intentionally stripped from the browser JSON response.
        return json({ status: 'ok', message: p.message, expiresAt: p.expiresAt }, 200, [setCookie(FLOW, value, 300)]);
      }
      if (!hex(flow?.nonce) || !hex(flow?.binding) || flow.expiresAt <= now()) return json({ error: 'sign-in-expired' }, 401, [setCookie(FLOW, '', 0)]);
      if (typeof b.signature !== 'string' || !b.signature || b.signature.length > 14000) return json({ error: 'invalid-proof' }, 400);
      const p = await upstream({ action: 'verify', signature: b.signature, nonce: flow.nonce, binding: flow.binding });
      if (!hex(p.accessToken) || !validIdentity(p.identity) || p.identity.expiresAt <= now()) throw Error('invalid-session');
      const seconds = Math.min(1800, Math.floor((p.identity.expiresAt - now()) / 1000));
      return json({ status: 'ok', identity: p.identity }, 200, [setCookie(SESSION, p.accessToken, seconds), setCookie(FLOW, '', 0)]);
    } catch (e) {
      const safe = [400, 401, 403, 413, 415, 429].includes(e.status);
      return json({ error: safe ? e.message : 'authentication-unavailable' }, safe ? e.status : 503);
    }
  };
}
