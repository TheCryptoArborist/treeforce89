import {getDatabase} from '@netlify/database';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {createWalletGatewayService} from '../app/game/wallet-gateway-service.mjs';
import {createGameRunService} from '../app/game/game-run-service.mjs';
import {checkDirectNFTreeOwnership} from '../app/game/nftree-access.mjs';

const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
let pool;
export function getGatewayService(origin) {
  pool ??= getDatabase().pool;
  return createWalletGatewayService({pool,client,origin});
}

export function getRunService() {
  pool ??= getDatabase().pool;
  return createGameRunService({pool,
    ownershipChecker:({wallet})=>checkDirectNFTreeOwnership({client,wallet,network:'mainnet'})});
}
