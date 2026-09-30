/** Real compiled Phaser + browser + PostgreSQL round trip. Only authentication is a fixture;
 * no installed wallet is available and no blockchain purchase is simulated as genuine.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import {randomUUID,randomBytes} from 'node:crypto';
import {createRecoveryGateway} from '../backend/services/canopy-credits/recovery-gateway.mjs';
import {recoveryProxy,GAME_ORIGIN} from '../netlify/lib/recovery-candidate.mjs';
const require=createRequire(process.env.RECOVERY_TEST_PACKAGE);const {chromium}=require('playwright'),{Pool}=require('pg');
assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGDATABASE,'recovery_ci');
const pool=new Pool({max:4});
await pool.query('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;');
for(const name of ['direct-continue-schema.sql','migrations/flight-storage-v1.sql','migrations/recovery-candidate-rpc.sql'])await pool.query(await readFile(resolve('backend/services/canopy-credits',name),'utf8'));
const identities=new Map();let storageCalls=0,paymentCalls=0;
const gateway=createRecoveryGateway({verifySession:async token=>identities.get(token),invokeStorage:async params=>{
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SET LOCAL ROLE service_role');storageCalls++;
 const args=['p_account','p_payer','p_action','p_run','p_request','p_snapshot','p_hash'].map(k=>params[k]);
 const r=await db.query('SELECT public.tree_recovery_candidate_rpc($1::uuid,$2,$3,$4::uuid,$5::uuid,$6,$7) AS result',args);await db.query('COMMIT');return r.rows[0].result;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1');const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fixture='))?.slice(8);
 let response;
 if(url.pathname==='/api/tree-account')response=Response.json({status:'ok',configured:true,identity:identities.get(token)||null});
 else if(url.pathname==='/api/tree-continue'){paymentCalls++;response=Response.json({error:'checkout-not-enabled'},{status:503});}
 else if(url.pathname==='/api/tree-flight'){
  const chunks=[];for await(const c of req)chunks.push(c);
  response=await recoveryProxy(new Request(GAME_ORIGIN+url.pathname,{method:req.method,headers:{'Content-Type':'application/json',Origin:GAME_ORIGIN,Cookie:'__Host-tree-game-session='+token},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),async(_url,options)=>gateway(new Request('https://edge.test/',options)));
 }else{
  const path=resolve('dist','.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!path.startsWith(resolve('dist')+'/'))throw Error('path');
  const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(data);return;
 }
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end('Test server error');console.error(e);}
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));await mkdir('recovery-evidence',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];const reports=[];
async function pageFor(token,wave=0,viewport={width:1200,height:1000}){
 const context=await browser.newContext({viewport});await context.addCookies([{name:'fixture',value:token,url:'http://127.0.0.1:4173'}]);const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4173/?recoveryTest=1${wave?'&wave='+wave:''}`);
 await page.waitForFunction(()=>window.__treeRecoveryTestGame?.scene.isActive('title'),{},{timeout:20000});
 await page.waitForFunction(()=>window.__treeRecoveryTestGame?.registry.get('treeAccountIdentity')?.authenticated);
 return {page,context};
}
try{
 for(const wave of [1,2,3,4,5,6,7,8,9,10]){
  const token=randomBytes(32).toString('hex'),accountId=randomUUID();identities.set(token,{authenticated:true,environment:'preview',accountId,wallet:{family:'sui',address:'0x'+'1'.repeat(64)},expiresAt:Date.now()+1800000});
  const viewport=wave%2?{width:390,height:844}:{width:1200,height:1000};
  let {page,context}=await pageFor(token,wave,viewport);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const s=window.__treeRecoveryTestGame?.scene.getScene('game');return s?.enemies?.countActive()>0;},{},{timeout:15000});
  if(wave===10)await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies.getChildren().some(e=>e.kind==='boss'&&e.settled),{},{timeout:10000});
  const score=7000+wave*50;
  await page.evaluate(({score,wave})=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');s.run.score=score;s.stage=0;s.grafted=false;s.invincible=false;s.cloakUntil=0;s.invulnUntil=0;s.lives=1;if(wave===10){const b=s.enemies.getChildren().find(e=>e.kind==='boss');b.hp=59;}s.damagePlayer();},{score,wave});
  await page.waitForFunction(()=>document.querySelector('.flight-recovery-box button')?.textContent==='SAVED — SAFE TO RELOAD FOR TEST',{},{timeout:15000}).catch(async e=>{throw Error(e.message+' '+await page.locator('.flight-recovery-box').innerText())});
  const {rows}=await pool.query('SELECT snapshot_text FROM tree_continue_v1.checkpoints WHERE account_id=$1',[accountId]);assert.equal(rows.length,1);const snap=JSON.parse(rows[0].snapshot_text);
  assert.equal(snap.wave,wave);assert.equal(snap.score,score);
  await context.close(); // Complete browser context loss, not just a mocked reload callback.
  ({page,context}=await pageFor(token,0,viewport));await page.getByRole('button',{name:'SAVED FLIGHTS',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('LOAD WAVE '+wave+' ·')}).click();
  await page.waitForFunction(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return s?.lives===0&&s.run?.continued===true&&document.querySelector('.flight-recovery-box')?.textContent.includes('loaded.');},{},{timeout:12000}).catch(async e=>{throw Error(e.message+' '+await page.locator('body').innerText())});
  const restored=await page.evaluate(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return{wave:s.run.wave+1,score:s.run.score,lives:s.lives,rng:s.rng.seed,spawned:s.waveSpawned,paused:s.paused,enemies:s.enemies.getChildren().filter(e=>e.active).map(e=>({hp:e.hp,kind:e.kind})),practice:s.run.practice}});
  assert.equal(restored.wave,wave);assert.equal(restored.score,score);assert.equal(restored.lives,0);assert.equal(restored.rng,snap.scene.rngSeed);assert.equal(restored.spawned,snap.scene.values.waveSpawned);assert.equal(restored.paused,true);assert.equal(restored.practice,true);
  assert.deepEqual(restored.enemies,snap.scene.enemies.map(e=>({hp:e.props.hp,kind:e.props.kind})));
  if(wave===10)assert.equal(restored.enemies.find(e=>e.kind==='boss').hp,59);
  await page.screenshot({path:`recovery-evidence/wave-${wave}-restored.png`,fullPage:true});
  await page.getByRole('button',{name:'RESUME AS PRACTICE — NO TREE',exact:true}).click();
  await page.waitForFunction(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return !s.paused&&s.lives===3;});
  await page.keyboard.down('a');await page.waitForTimeout(200);await page.keyboard.up('a');
  const x=await page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').player.x);assert.ok(x<240,'Movement resumes');
  await page.keyboard.down('z');await page.waitForTimeout(200);await page.keyboard.up('z');
  const shot=await page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').run.shotsFired);assert.ok(shot>snap.scene.run.shotsFired,'Shooting resumes');
  reports.push({wave,score,actors:restored.enemies.length,contextRecreated:true,threeLives:true,movement:true,shooting:true});console.log('PASS actual Phaser + PostgreSQL recovery wave',wave,JSON.stringify(reports.at(-1)));await context.close();
 }
 assert.deepEqual(errors,[]);assert.equal(paymentCalls,0);
 for(const table of ['orders','receipts','checkpoint_reviews'])assert.equal((await pool.query(`SELECT count(*)::int n FROM tree_continue_v1.${table}`)).rows[0].n,0);
 console.log('RECOVERY_BROWSER_RESULT',JSON.stringify({passed:reports.length,storageCalls,paymentCalls,pageErrors:errors.length,realPhaser:true,realPostgres:true,authentication:'fixture',reports}));
}finally{await browser.close();await new Promise(r=>server.close(r));await pool.end();}
