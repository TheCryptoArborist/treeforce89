import build from '../generated/tree-deploy-context.json' with {type:'json'};
import {previewAccessAllowed} from '../../app/game/preview-access.mjs';
import {createGameLogoutHttpHandler} from '../../app/game/game-logout-http.mjs';
import {getGatewayService} from '../gateway-runtime.mjs';

export default async function handler(request,context) {
  if(!previewAccessAllowed(build,context,request))return Response.json({enabled:false,loggedOut:false},{status:503,headers:{'Cache-Control':'no-store'}});
  return createGameLogoutHttpHandler({revoker:{revoke:input=>
    getGatewayService(new URL(request.url).origin).revoke(input)}})(request);
}
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:20}};
