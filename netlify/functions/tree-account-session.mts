import { createGameSessionHandler } from '../lib/tree-account-session.mjs';
export default async (request: Request) => createGameSessionHandler({
  authOrigin: Netlify.env.get('TREE_ACCOUNT_AUTH_ORIGIN'),
  gameOrigin: Netlify.env.get('TREE_ACCOUNT_GAME_ORIGIN'),
})(request);
export const config = { path: ['/api/tree-account', '/api/tree-account/callback'] };
