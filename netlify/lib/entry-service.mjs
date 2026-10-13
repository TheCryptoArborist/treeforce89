import {createHash,randomUUID} from 'node:crypto';
import {ENTRY,verifyEntryPayment} from '../../app/game/entry-policy.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
export function createEntryService({pool,reader,now=Date.now}){
 return async c=>{
  if(!c||!['status','order','verify','start'].includes(c.action))throw Error('invalid-command');
  if(c.action==='status'){
   await pool.query('select 1 from tree_entry_v1.orders limit 1');
   const meta=await reader.getTreeMetadata();if(meta.decimals!==ENTRY.decimals)throw Error('wrong-token-decimals');
   return {enabled:true,product:ENTRY};
  }
  if(typeof c.token!=='string'||! /^[a-f0-9]{64}$/.test(c.token))throw Error('invalid-command');
  const tokenHash=hash(c.token);
  if(c.action==='order'){
   if(!/^0x[a-f0-9]{64}$/.test(c.payer||'')||c.payer===ENTRY.recipient||/^0x0+$/.test(c.payer))throw Error('invalid-payer');
   const prior=await pool.query('select * from tree_entry_v1.orders where token_hash=$1',[tokenHash]);
   if(prior.rows[0]){if(prior.rows[0].payer!==c.payer)throw Error('wallet-changed');return {order:prior.rows[0],product:ENTRY};}
   const count=await pool.query('select count(*)::int as n from tree_entry_v1.orders where issued_at>$1',[now()-3600000]);
   if(count.rows[0].n>=1000)throw Error('checkout-busy');
   const meta=await reader.getTreeMetadata();if(meta.decimals!==ENTRY.decimals)throw Error('wrong-token-decimals');
   const stamp=now();const r=await pool.query('insert into tree_entry_v1.orders(id,token_hash,payer,issued_at,expires_at) values($1,$2,$3,$4,$5) on conflict(token_hash) do nothing returning *',[randomUUID(),tokenHash,c.payer,stamp,stamp+900000]);
   const row=r.rows[0]||(await pool.query('select * from tree_entry_v1.orders where token_hash=$1',[tokenHash])).rows[0];
   if(row.payer!==c.payer)throw Error('wallet-changed');return {order:row,product:ENTRY};
  }
  const found=await pool.query('select * from tree_entry_v1.orders where token_hash=$1',[tokenHash]);const order=found.rows[0];
  if(!order)throw Error('order-not-found');
  if(c.action==='verify'){
   if(order.digest){if(c.digest!==order.digest)throw Error('wrong-digest');return {verified:true,orderId:order.id};}
   if(!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(c.digest||''))throw Error('invalid-digest');
   await reader.getNetworkIdentity();const tx=await reader.getFinalizedTransaction(c.digest);verifyEntryPayment(order,tx);
   const r=await pool.query('update tree_entry_v1.orders set digest=$2 where id=$1 and (digest is null or digest=$2) returning id',[order.id,c.digest]);
   if(!r.rows.length)throw Error('wrong-digest');return {verified:true,orderId:order.id};
  }
  if(!uuid(c.runId)||!order.digest)throw Error('payment-not-verified');
  const r=await pool.query('update tree_entry_v1.orders set run_id=$2 where id=$1 and digest is not null and (run_id is null or run_id=$2) returning id,run_id',[order.id,c.runId]);
  if(!r.rows.length)throw Error('payment-already-used');return {authorized:true,runId:r.rows[0].run_id};
 };
}
