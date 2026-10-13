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
const identities=new Map(),uiChallenges=new Map();let storageCalls=0,paymentCalls=0;
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
 if(url.pathname==='/api/tree-account'){
  if(req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(c);const b=JSON.parse(Buffer.concat(chunks));if(b.action==='logout')identities.delete(token);}
  response=Response.json({status:'ok',configured:true,identity:identities.get(token)||null});
 }
 else if(url.pathname==='/api/tree-account-inline'){
  const chunks=[];for await(const c of req)chunks.push(c);const b=JSON.parse(Buffer.concat(chunks));
  if(b.action==='challenge'){uiChallenges.set(token,b.address);response=Response.json({status:'ok',message:'Fixture wallet verification',expiresAt:Date.now()+300000});}
  else if(b.action==='verify'){
   assert.equal(b.signature,'fixture-signed');
   const identity={authenticated:true,environment:'preview',accountId:randomUUID(),wallet:{family:'sui',address:uiChallenges.get(token)},expiresAt:Date.now()+1800000};
   identities.set(token,identity);response=Response.json({status:'ok',identity});
  }else response=Response.json({status:'ok'});
 }
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
async function inputDiagnostic(page){return page.evaluate(()=>{const g=window.__treeRecoveryTestGame,s=g.scene.getScene('game');return{paused:s.paused,sceneActive:g.scene.isActive('game'),physicsPaused:s.physics.world.isPaused,inputEnabled:s.input.enabled,keyboardEnabled:s.input.keyboard.enabled,globalKeyboard:g.input.keyboard.enabled,keyDown:s.input.keyboard.keys[65]?.isDown,x:s.player.x,velocity:s.player.body.velocity.x,lives:s.lives,focus:document.activeElement?.tagName,documentFocused:document.hasFocus(),visibility:document.visibilityState,openDialogs:document.querySelectorAll('dialog[open]').length};});}
try{
 for(const width of [320,390,1200]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addCookies([{name:'fixture',value:'wallet-ui-'+width,url:'http://127.0.0.1:4173'}]);
  await context.addInitScript(()=>{
   window.__suiOnlyWalletCalls={connect:0,sign:0,transaction:0,evmDiscovery:0,evmAccess:0};window.__walletMode='success';
   const calls=window.__suiOnlyWalletCalls,listeners=new Set();
   const account={address:'0x'+'1'.repeat(64),publicKey:new Uint8Array(32),chains:['sui:mainnet'],features:['sui:signPersonalMessage','sui:signTransaction','sui:signAndExecuteTransaction']};
   const second={...account,address:'0x'+'2'.repeat(64)};
   const wallet={version:'1.0.0',name:'Slush fixture',icon:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',chains:['sui:mainnet'],accounts:[account,second],features:{
    'standard:events':{version:'1.0.0',on:(_e,fn)=>{listeners.add(fn);return()=>listeners.delete(fn)}},
    'standard:connect':{version:'1.0.0',connect:async()=>{calls.connect++;if(window.__walletMode==='connectReject')throw Error('Malicious website');if(window.__walletMode==='connectWait')return new Promise(()=>{});wallet.accounts=[account,second];listeners.forEach(fn=>fn({accounts:wallet.accounts}));return{accounts:wallet.accounts}}},
    'standard:disconnect':{version:'1.0.0',disconnect:async()=>{wallet.accounts=[];listeners.forEach(fn=>fn({accounts:[]}))}},
    'sui:signPersonalMessage':{version:'1.1.0',signPersonalMessage:async()=>{calls.sign++;if(window.__walletMode==='signReject')throw Object.assign(Error('User rejected'),{code:4001});return{signature:'fixture-signed',bytes:''}}},
    'sui:signTransaction':{version:'2.0.0',signTransaction:async()=>{calls.transaction++;throw Error('No payment expected')}},
    'sui:signAndExecuteTransaction':{version:'2.0.0',signAndExecuteTransaction:async()=>{calls.transaction++;throw Error('No payment expected')}}
   }};
   window.addEventListener('wallet-standard:app-ready',e=>e.detail.register(wallet));
   window.addEventListener('eip6963:requestProvider',()=>calls.evmDiscovery++);
   Object.defineProperty(window,'ethereum',{get(){calls.evmAccess++;throw Error('EVM provider must not be accessed')}});
  });
  const page=await context.newPage(),inlineCalls=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().endsWith('/api/tree-account-inline'))inlineCalls.push(JSON.parse(r.postData()).action)});
  await page.goto('http://127.0.0.1:4173/?recoveryTest=1&walletCheck=1');
  await page.waitForFunction(()=>window.__treeRecoveryTestGame?.scene.isActive('title'),{},{timeout:20000});
  const bar=page.getByRole('region',{name:'Sui wallet'});
  await bar.getByRole('combobox',{name:'Sui wallet picker'}).getByRole('option',{name:'Slush fixture',exact:true}).waitFor({state:'attached'});
  await bar.getByRole('button',{name:'CHECK CONNECTION ONLY',exact:true}).click();
  await bar.getByText(/Connection check PASSED:/).waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.__suiOnlyWalletCalls),{connect:1,sign:0,transaction:0,evmDiscovery:0,evmAccess:0});
  assert.deepEqual(inlineCalls,[]);
  assert.equal(await page.evaluate(()=>window.__treeRecoveryTestGame.registry.get('treeAccountIdentity')),null);
  assert.equal(await bar.getByRole('button',{name:'DISCONNECT',exact:true}).isVisible(),false);
  await bar.getByRole('button',{name:'CONNECT WALLET',exact:true}).click();
  await bar.getByRole('button',{name:'DISCONNECT',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await bar.getByRole('button',{name:'EVM',exact:true}).count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__suiOnlyWalletCalls),{connect:2,sign:1,transaction:0,evmDiscovery:0,evmAccess:0});
  assert.deepEqual(inlineCalls,['challenge','verify']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:`recovery-evidence/simple-wallet-${width}.png`,fullPage:true});
  await bar.getByRole('combobox',{name:'Wallet account'}).selectOption('0x'+'2'.repeat(64));
  await bar.getByText('Slush fixture · 0x222222…222222',{exact:true}).waitFor({state:'visible'});
  assert.equal(inlineCalls.filter(a=>a==='verify').length,2);
  await bar.getByRole('button',{name:'DISCONNECT',exact:true}).click();
  await bar.getByRole('button',{name:'CONNECT WALLET',exact:true}).waitFor({state:'visible'});
  await page.evaluate(()=>window.__walletMode='connectReject');
  const beforeCheck=await page.evaluate(()=>window.__suiOnlyWalletCalls.sign),beforeInline=inlineCalls.length;
  await bar.getByRole('button',{name:'CHECK CONNECTION ONLY',exact:true}).click();
  await bar.getByText(/Connection check STOPPED before sign-in:/).waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__suiOnlyWalletCalls.sign),beforeCheck);
  assert.equal(inlineCalls.length,beforeInline);
  assert.equal(await page.evaluate(()=>window.__treeRecoveryTestGame.registry.get('treeAccountIdentity')),null);
  await bar.getByRole('button',{name:'CONNECT WALLET',exact:true}).click();
  await bar.getByText('Malicious website',{exact:true}).waitFor({state:'visible'});
  assert.equal(inlineCalls.filter(a=>a==='challenge').length,2);
  await page.evaluate(()=>window.__walletMode='signReject');
  await bar.getByRole('button',{name:'CONNECT WALLET',exact:true}).click();
  await bar.getByText('Wallet approval declined. No payment was made.',{exact:true}).waitFor({state:'visible'});
  assert.equal(inlineCalls.filter(a=>a==='verify').length,2);
  assert.equal((await page.evaluate(()=>window.__suiOnlyWalletCalls)).transaction,0);
  await page.evaluate(()=>window.__walletMode='connectWait');
  await bar.getByRole('button',{name:'CONNECT WALLET',exact:true}).click();
  await bar.getByRole('button',{name:'CANCEL',exact:true}).click();
  await bar.getByText('Connection canceled. Your flight is unchanged.',{exact:true}).waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__treeRecoveryTestGame.scene.isActive('title')),true);
  assert.equal(inlineCalls.filter(a=>a==='verify').length,2);
  await context.close();console.log('PASS connection-only success/rejection without authentication or signatures; top wallet picker, automatic verification, account switch, cancellation and security/signature rejection at width',width);
 }
 for(const wave of [1,2,3,4,5,6,7,8,9,10]){
  const token=randomBytes(32).toString('hex'),accountId=randomUUID(),payer='0x'+randomBytes(32).toString('hex');
  identities.set(token,{authenticated:true,environment:'preview',accountId,wallet:{family:'sui',address:payer},expiresAt:Date.now()+1800000});
  const viewport=wave%2?{width:390,height:844}:{width:1200,height:1000};
  let {page,context}=await pageFor(token,wave,viewport);await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const s=window.__treeRecoveryTestGame?.scene.getScene('game');return s?.enemies?.countActive()>0;},{},{timeout:15000});
  if(wave===10)await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').enemies.getChildren().some(e=>e.kind==='boss'&&e.settled),{},{timeout:10000});
  const score=7000+wave*50;
  await page.evaluate(({score,wave})=>{
   const s=window.__treeRecoveryTestGame.scene.getScene('game');
   if(wave===3){
    // Use actual game factories/handlers for nonstandard sprites rather than making
    // the checkpoint itself a hand-authored fixture.
    const leader=s.enemies.getChildren().find(e=>e.active);leader.hp=2;leader.setData('leader',true);s.hitEnemy(leader,1,false);
    s.beginRootSnare();const captor=s.snareEnemy;
    s.capturedStage=3;s.capturedWing=s.physics.add.sprite(captor.x,captor.y+45,'playerSheet',3);
    captor.setData('corruptionHits',2).setData('lastCorruptAt',s.time.now-1000);s.corruptCapturedWing(captor);
    s.spawn('spore');const spore=s.enemies.getChildren().find(e=>e.active&&e.kind==='spore');s.hitEnemy(spore,100,false);
    s.killsSinceTurbo=1000;s.maybeDropVictoryTurbo(100,200,'bat');
    s.killsSinceCloak=1000;s.maybeDropSovereignShield(350,200,'bat');
   }
   s.run.score=score;s.stage=0;s.grafted=false;s.invincible=false;s.cloakUntil=0;s.invulnUntil=0;s.lives=1;
   if(wave===10){const b=s.enemies.getChildren().find(e=>e.kind==='boss');b.hp=59;}
   s.damagePlayer();
  },{score,wave});
  await page.waitForFunction(()=>document.querySelector('.flight-recovery-box button')?.textContent==='SAVED — SAFE TO RELOAD FOR TEST',{},{timeout:15000}).catch(async e=>{throw Error(e.message+' '+await page.locator('.flight-recovery-box').innerText())});
  assert.equal(await page.locator('.tree-continue-panel').isVisible(),true);
  assert.equal(await page.getByRole('region',{name:'Wallet connection check',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').cameras.main.flashEffect.isRunning),false);
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.getByRole('button',{name:'CONTINUE — 20,000 TREE',exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  const {rows}=await pool.query('SELECT snapshot_text FROM tree_continue_v1.checkpoints WHERE account_id=$1',[accountId]);assert.equal(rows.length,1);const snap=JSON.parse(rows[0].snapshot_text);
  assert.equal(snap.wave,wave);assert.equal(snap.score,score);
  if(wave===3){
   for(const key of ['leaderCracked','rootCaptor','playerSheet','small'])assert.ok(snap.scene.enemies.some(e=>e.texture===key),'Missing scenario actor '+key);
   for(const key of ['victoryTurbo-circle-v1','sovereignShield-circle-v1'])assert.ok(snap.scene.pickups.some(e=>e.texture===key),'Missing circular pickup '+key);
  }
  await context.close();
  ({page,context}=await pageFor(token,0,viewport));await page.getByRole('button',{name:'SAVED FLIGHTS',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('LOAD WAVE '+wave+' ·')}).click();
  await page.waitForFunction(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return s?.lives===0&&s.run?.continued===true&&document.querySelector('.flight-recovery-box')?.textContent.includes('loaded.');},{},{timeout:12000}).catch(async e=>{throw Error(e.message+' '+await page.locator('body').innerText())});
  const restored=await page.evaluate(()=>{const s=window.__treeRecoveryTestGame.scene.getScene('game');return{wave:s.run.wave+1,score:s.run.score,lives:s.lives,rng:s.rng.seed,spawned:s.waveSpawned,paused:s.paused,enemies:s.enemies.getChildren().filter(e=>e.active).map(e=>({hp:e.hp,kind:e.kind})),pickups:s.pickups.getChildren().filter(e=>e.active).map(e=>e.texture.key),corruptedFrame:s.enemies.getChildren().find(e=>e.texture.key==='playerSheet')?.frame.name,smallMotion:s.enemies.getChildren().filter(e=>e.kind==='small').every(e=>!e.settled&&e.diving&&e.body.velocity.y===90),practice:s.run.practice}});
  assert.equal(restored.wave,wave);assert.equal(restored.score,score);assert.equal(restored.lives,0);assert.equal(restored.rng,snap.scene.rngSeed);assert.equal(restored.spawned,snap.scene.values.waveSpawned);assert.equal(restored.paused,true);assert.equal(restored.practice,true);
  assert.deepEqual(restored.enemies,snap.scene.enemies.map(e=>({hp:e.props.hp,kind:e.props.kind})));
  assert.deepEqual(restored.pickups,snap.scene.pickups.map(e=>e.texture));
  if(wave===3){assert.equal(Number(restored.corruptedFrame),3);assert.equal(restored.smallMotion,true);}
  if(wave===10)assert.equal(restored.enemies.find(e=>e.kind==='boss').hp,59);
  await page.screenshot({path:`recovery-evidence/wave-${wave}-restored.png`,fullPage:true});
  await page.getByRole('button',{name:'RESUME AS PRACTICE — NO TREE',exact:true}).click();
  await page.waitForFunction(()=>{const g=window.__treeRecoveryTestGame,s=g.scene.getScene('game');return g.scene.isActive('game')&&!s.paused&&!s.physics.world.isPaused&&s.lives===3&&s.input.enabled&&s.input.keyboard.enabled&&s.input.keyboard.keys[65];},{},{timeout:5000}).catch(async e=>{throw Error('Input not ready: '+JSON.stringify(await inputDiagnostic(page))+' '+e.message);});
  // Let the resumed scene complete its first updates before holding a key.
  // Scene/focus transitions reset Phaser's keyboard state during that boundary.
  await page.bringToFront();
  const resumeFrame=await page.evaluate(()=>window.__treeRecoveryTestGame.loop.frame);
  await page.waitForFunction(frame=>document.hasFocus()&&window.__treeRecoveryTestGame.loop.frame>=frame+2,resumeFrame,{timeout:5000});
  await page.keyboard.down('a');
  try{await page.waitForFunction(()=>window.__treeRecoveryTestGame.scene.getScene('game').player.x<230,{},{timeout:3000});}
  catch(e){throw Error('Movement failed: '+JSON.stringify(await inputDiagnostic(page))+' '+e.message);}
  finally{await page.keyboard.up('a');}
  const x=await page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').player.x);assert.ok(x<240,'Movement resumes');
  await page.keyboard.down('z');
  try{await page.waitForFunction(before=>window.__treeRecoveryTestGame.scene.getScene('game').run.shotsFired>before,snap.scene.run.shotsFired,{timeout:3000});}
  finally{await page.keyboard.up('z');}
  const shot=await page.evaluate(()=>window.__treeRecoveryTestGame.scene.getScene('game').run.shotsFired);assert.ok(shot>snap.scene.run.shotsFired,'Shooting resumes');
  reports.push({wave,score,actors:restored.enemies.length,pickups:restored.pickups.length,contextRecreated:true,threeLives:true,movement:true,shooting:true});console.log('PASS actual Phaser + PostgreSQL recovery wave',wave,JSON.stringify(reports.at(-1)));await context.close();
 }
 assert.deepEqual(errors,[]);assert.equal(paymentCalls,0);
 for(const table of ['orders','receipts','checkpoint_reviews'])assert.equal((await pool.query(`SELECT count(*)::int n FROM tree_continue_v1.${table}`)).rows[0].n,0);
 console.log('RECOVERY_BROWSER_RESULT',JSON.stringify({passed:reports.length,storageCalls,paymentCalls,pageErrors:errors.length,realPhaser:true,realPostgres:true,authentication:'fixture',reports}));
}finally{await browser.close();await new Promise(r=>server.close(r));await pool.end();}
