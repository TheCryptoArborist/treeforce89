import { createInlineProxy } from '../lib/tree-account-inline.mjs';
export default async (request: Request) => createInlineProxy({
  authOrigin: Netlify.env.get('TREE_ACCOUNT_AUTH_ORIGIN'),
  gameOrigin: Netlify.env.get('TREE_ACCOUNT_GAME_ORIGIN'),
})(request);
export const config = { path: '/api/tree-account-inline' };
