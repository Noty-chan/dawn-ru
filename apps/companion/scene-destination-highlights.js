"use strict";

// Presentation jobs retain no authority: every click still uses the current
// canonical validator. Each job and its query snapshot die with this board pass.
(function(global){
  function createRunner({schedule,now=()=>performance.now(),budget=6}={}){
    const jobs=new WeakMap();
    const current=job=>jobs.get(job.board)===job&&job.board.isConnected!==false&&job.key===job.currentKey();
    function release(job){const query=job.query;job.query=null;query?.dispose?.();}
    function clear(job){
      for(const[cell,title]of job.titles){cell.classList.remove("movement-valid");delete cell.dataset.destinationAvailable;if(job.describe)cell.title=title;}
      if(jobs.get(job.board)===job)job.board.removeAttribute("aria-busy");
    }
    function cancel(board){const job=jobs.get(board);if(!job)return;clear(job);jobs.delete(board);release(job);}
    function reconcile(board){const job=jobs.get(board);if(job&&!current(job))cancel(board);}
    function queue({board,cells,key,currentKey,createQuery,describe,onError}){
      cancel(board);
      const job={board,cells,key,currentKey,createQuery,describe,onError,index:0,query:null,titles:cells.map(cell=>[cell,cell.title||""])};jobs.set(board,job);
      board.setAttribute("aria-busy","true");
      const run=()=>{
        try{
          if(!current(job)){if(jobs.get(board)===job)cancel(board);else release(job);return;}
          job.query||=job.createQuery();
          if(!current(job)){if(jobs.get(board)===job)cancel(board);else release(job);return;}
          const start=now(),updates=[];
          do{
            const cell=job.cells[job.index++],[x,y]=cell.dataset.sceneCell.split(",").map(Number);
            updates.push([cell,job.query.status({x,y})]);
          }while(job.index<job.cells.length&&now()-start<budget);
          // A query provider may itself change current values or permissions.
          if(!current(job)){if(jobs.get(board)===job)cancel(board);else release(job);return;}
          for(const[cell,status]of updates){
            cell.classList.toggle("movement-valid",Boolean(status.available));
            cell.dataset.destinationAvailable=String(Boolean(status.available));
            if(job.describe)cell.title=job.describe(status);
          }
          if(job.index<job.cells.length)schedule(run);
          else{board.removeAttribute("aria-busy");release(job);}
        }catch(error){
          const report=jobs.get(board)===job;
          if(report)cancel(board);else release(job);
          if(report)job.onError?.(error);
        }
      };
      if(!cells.length){board.removeAttribute("aria-busy");return;}
      schedule(run);
    }
    return Object.freeze({queue,cancel,reconcile});
  }
  let schedule;
  if(typeof global.MessageChannel==="function"){
    const channel=new global.MessageChannel(),tasks=[];
    channel.port1.onmessage=()=>tasks.shift()?.();
    schedule=task=>{tasks.push(task);channel.port2.postMessage(0);};
  }else if(typeof global.setTimeout==="function")schedule=task=>global.setTimeout(task,0);
  const runner=schedule?createRunner({schedule}):null;
  global.DAWN_SCENE_DESTINATION_HIGHLIGHTS=Object.freeze({createRunner,supportsAsync:Boolean(runner),queue:options=>runner?.queue(options),cancel:board=>runner?.cancel(board),reconcile:board=>runner?.reconcile(board)});
})(typeof window==="object"?window:globalThis);
