import {createGameSessionHandler} from '../lib/tree-account-session.mjs';
import {accountConfig} from '../lib/recovery-candidate.mjs';
export default async(request:Request)=>createGameSessionHandler(accountConfig(request,Netlify.env))(request);
export const config={path:['/api/tree-account','/api/tree-account/callback']};
