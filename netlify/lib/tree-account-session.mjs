import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
const SESSION = '__Host-tree-game-session', FLOW = '__Host-tree-game-flow';
const cookie = (r, name) => (r.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) || '';
const setCookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, seconds)}`;
function reply(body, status = 200, cookies = [], location) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  cookies.forEach(c => headers.append('Set-Cookie', c)); if (location) headers.set('Location', location);
  return new Response(JSON.stringify(body), { status, headers });
}
const goodOrigin = v => { try { const u = new URL(v); return u.protocol === 'https:' && u.origin === v; } catch { return false; } };
export function validIdentity(i) {
  return i?.authenticated === true && i.environment === 'preview' && /^[a-f0-9-]{36}$/.test(i.accountId || '') &&
    ['sui','evm'].includes(i.wallet?.family) && /^0x[a-fA-F0-9]{40,64}$/.test(i.wallet?.address || '') && Number.isSafeInteger(i.expiresAt);
}
/** BFF: browser cookies stay on the game origin, opaque tokens stay out of JS. */
export function createGameSessionHandler({ authOrigin, gameOrigin, fetcher = fetch, now = Date.now }) {
  return async request => {
    if (!goodOrigin(authOrigin) || !goodOrigin(gameOrigin) || new URL(request.url).origin !== gameOrigin) return reply({ error: 'preview-not-configured' }, 503);
    async function upstream(body) {
      const r = await fetcher(`${authOrigin}/api/tree-account`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(12000) });
      const payload = await r.json(); if (!r.ok || payload.status !== 'ok') { const err = new Error(payload.error || 'authentication-unavailable'); err.status = r.status; throw err; } return payload;
    }
    const url = new URL(request.url);
    try {
      if (url.pathname.endsWith('/callback')) {
        if (request.method !== 'GET') return reply({ error: 'method-not-allowed' }, 405);
        let flow; try { flow = JSON.parse(Buffer.from(cookie(request, FLOW), 'base64url').toString()); } catch {}
        const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
        if (!flow || flow.expiresAt <= now() || !/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(flow.state || '') || !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state)) || !/^[a-f0-9]{64}$/.test(code)) {
          return reply({}, 303, [setCookie(FLOW, '', 0)], '/account-return.html?error=sign-in-expired');
        }
        const result = await upstream({ action: 'exchange', code, verifier: flow.verifier, clientOrigin: gameOrigin });
        if (!/^[a-f0-9]{64}$/.test(result.accessToken || '') || !validIdentity(result.identity) || result.identity.expiresAt <= now()) throw new Error('invalid-session');
        const seconds = Math.min(1800, Math.floor((result.identity.expiresAt - now()) / 1000));
        return reply({}, 303, [setCookie(SESSION, result.accessToken, seconds), setCookie(FLOW, '', 0)], '/account-return.html');
      }
      if (request.method === 'GET') {
        const token = cookie(request, SESSION); if (!token) return reply({ identity: null, configured: true });
        try {
          const result = await upstream({ action: 'game-session', token });
          if (!validIdentity(result.identity) || result.identity.expiresAt <= now()) throw new Error('invalid-session');
          return reply({ identity: result.identity, configured: true });
        } catch (e) {
          if (e.status === 401) return reply({ identity: null, configured: true }, 200, [setCookie(SESSION, '', 0)]);
          throw e;
        }
      }
      if (request.method !== 'POST') return reply({ error: 'method-not-allowed' }, 405);
      if (request.headers.get('origin') !== gameOrigin) return reply({ error: 'origin-mismatch' }, 403);
      if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'json-required' }, 415);
      const raw = await request.text(); if (raw.length > 2048) return reply({ error: 'request-too-large' }, 413);
      let body; try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid-json' }, 400); }
      if (body.action === 'begin') {
        const state = randomBytes(32).toString('hex'), verifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
        const login = new URL('/play/account/', authOrigin); login.search = new URLSearchParams({ clientOrigin: gameOrigin, state, codeChallenge }).toString();
        return reply({ url: login.href }, 200, [setCookie(FLOW, Buffer.from(JSON.stringify({ state, verifier, expiresAt: now() + 300000 })).toString('base64url'), 300)]);
      }
      if (body.action === 'logout') {
        const token = cookie(request, SESSION); if (token) await upstream({ action: 'game-logout', token });
        return reply({ identity: null }, 200, [setCookie(SESSION, '', 0), setCookie(FLOW, '', 0)]);
      }
      return reply({ error: 'unsupported-action' }, 400);
    } catch (error) {
      if (url.pathname.endsWith('/callback')) return reply({}, 303, [setCookie(FLOW, '', 0)], '/account-return.html?error=sign-in-failed');
      return reply({ error: 'authentication-unavailable' }, 503);
    }
  };
}
