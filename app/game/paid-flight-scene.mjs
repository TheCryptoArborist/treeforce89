import {validateCheckpoint,rehydrateCheckpoint} from './flight-checkpoint.mjs';
/** Renderer-side loader for createPaidFlightDelivery. Only the caller's server
 * activation permits the returned port to restore lives; decoding is not proof
 * of payment. No wallet call, checkout activation, or storage write occurs here.
 */
export function createPaidFlightSceneLoader(game){
 let current=null,disposed=false,pending=null;
 const exhausted=flight=>{
  current=flight;
  if(pending?.runId===flight.runId){const p=pending;pending=null;clearTimeout(p.timer);
   try{p.resolve(port(flight,p.snapshot));}catch(e){p.reject(e);}
  }
 };
 const closed=runId=>{if(current?.runId===runId)current=null;};
 game.events.on('tree-flight:exhausted',exhausted);game.events.on('tree-flight:closed',closed);
 function port(flight,snapshot){
  if(disposed||flight.runId!==snapshot.runId||flight.scene.run.wave+1!==snapshot.wave||Math.round(flight.scene.run.score)!==snapshot.score||typeof flight.openPaidPort!=='function')throw Error('Paid checkpoint does not match the paused flight.');
  const result=flight.openPaidPort();result.assertPaused();return result;
 }
 return{
  async loadPaused(input,binding){
   if(disposed||pending)throw Error('Paid scene loader unavailable.');
   const snapshot=validateCheckpoint(input);
   if(snapshot.runId!==binding.runId)throw Error('Paid checkpoint run mismatch.');
   if(current?.runId===binding.runId)return port(current,snapshot);
   if(game.scene.isActive('game')||game.scene.isPaused('game'))throw Error('Finish the current flight before loading another paid flight.');
   const scene=game.scene.getScene('game');if(!scene)throw Error('Game scene unavailable.');
   return new Promise((resolve,reject)=>{
    const previous=scene.create;
    const restore=()=>{if(scene.create===create)scene.create=previous;};
    const fail=error=>{restore();if(pending){clearTimeout(pending.timer);pending=null;}reject(error);};
    function create(...args){
     restore();
     try{previous.apply(this,args);if(disposed)throw Error('Paid scene loader closed.');
      rehydrateCheckpoint(this,snapshot);this.endRun(false);
     }catch(e){this.paused=true;this.physics?.world?.pause();fail(e);}
    }
    pending={runId:snapshot.runId,snapshot,resolve,reject,restore,timer:setTimeout(()=>fail(Error('Paid scene reconstruction timed out.')),12000)};
    scene.create=create;
    game.registry.set('treeRecoveryRunId',snapshot.runId);game.registry.set('treePaidRecoveryRunId',snapshot.runId);
    try{game.scene.stop('title');game.scene.stop('gameover');game.scene.start('game');}
    catch(e){fail(e);}
   });
  },
  dispose(){
   disposed=true;game.events.off('tree-flight:exhausted',exhausted);game.events.off('tree-flight:closed',closed);
   if(pending){clearTimeout(pending.timer);pending.restore();pending.reject(Error('Paid scene loader closed.'));pending=null;}
   current=null;
  },
 };
}
