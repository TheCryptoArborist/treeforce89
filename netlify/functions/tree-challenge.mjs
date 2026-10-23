import build from '../generated/tree-deploy-context.json' with {type:'json'};
import {createWalletGatewayHttpHandler} from '../../app/game/wallet-gateway-http.mjs';
import {getGatewayService} from '../gateway-runtime.mjs';

export default createWalletGatewayHttpHandler({action:'challenge',build,getService:getGatewayService});
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
