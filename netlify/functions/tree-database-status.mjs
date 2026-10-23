import {getDatabase} from '@netlify/database';
import build from '../generated/tree-deploy-context.json' with {type:'json'};
import {createPreviewDatabaseStatusHandler} from '../../app/game/preview-database-status.mjs';

export default createPreviewDatabaseStatusHandler({build,
  getPool:() => getDatabase().pool});

export const config = {
  rateLimit:{action:'rate_limit', aggregateBy:'ip', windowSize:60, windowLimit:10},
};
