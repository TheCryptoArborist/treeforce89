import build from '../generated/tree-deploy-context.json' with {type:'json'};
import {createContinuationOfferHttpHandler} from '../../app/game/continuation-offer-http.mjs';
import {getContinuationOfferService} from '../gateway-runtime.mjs';

export default createContinuationOfferHttpHandler({build,getService:getContinuationOfferService});
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:10}};
