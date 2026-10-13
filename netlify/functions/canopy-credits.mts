import { createCreditsProxy } from '../lib/canopy-credits-proxy.mjs';
export default async (request: Request) => createCreditsProxy({
  authOrigin:Netlify.env.get('TREE_ACCOUNT_AUTH_ORIGIN'),
  gameOrigin:Netlify.env.get('TREE_ACCOUNT_GAME_ORIGIN'),
  enabled:Netlify.env.get('TREE_CC_SIMULATION_ENABLED'),
})(request);
export const config={path:'/api/canopy-credits'};
