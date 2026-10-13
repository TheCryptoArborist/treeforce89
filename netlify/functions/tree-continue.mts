import { directContinueGate } from '../lib/tree-continue-gate.mjs';
export default async (request: Request) => directContinueGate(request);
export const config = { path: '/api/tree-continue' };
