import {getDatabase} from '@netlify/database';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {createWalletGatewayService} from '../app/game/wallet-gateway-service.mjs';

const client=new SuiGrpcClient({network:'mainnet',baseUrl:'https://fullnode.mainnet.sui.io:443'});
let pool;
export function getGatewayService(origin) {
  pool ??= getDatabase().pool;
  return createWalletGatewayService({pool,client,origin});
}
