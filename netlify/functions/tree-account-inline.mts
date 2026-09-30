import {createInlineProxy} from '../lib/tree-account-inline.mjs';
import {accountConfig} from '../lib/recovery-candidate.mjs';
export default async(request:Request)=>createInlineProxy(accountConfig(request,Netlify.env))(request);
export const config={path:'/api/tree-account-inline'};
