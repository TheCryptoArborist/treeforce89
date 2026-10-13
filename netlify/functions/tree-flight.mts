import {recoveryProxy} from '../lib/recovery-candidate.mjs';
export default async(request:Request)=>recoveryProxy(request);
export const config={path:'/api/tree-flight'};
