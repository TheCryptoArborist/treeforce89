import build from '../generated/tree-deploy-context.json' with {type:'json'};
import {createGameRunHttpHandler} from '../../app/game/game-run-http.mjs';
import {getRunService} from '../gateway-runtime.mjs';

export default createGameRunHttpHandler({build,getService:getRunService});
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
