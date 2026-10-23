import {createAuthenticatedRunHttpHandler} from './game-run-http.mjs';

// Reuse the development deploy/origin guard and exact authenticated run input.
// This adapter can only read the current session and public coin metadata.
export function createContinuationOfferHttpHandler(options) {
  return createAuthenticatedRunHttpHandler({...options,action:'review'});
}
