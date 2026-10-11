/**
 * Independent asynchronous IDB transaction fixture for deterministic faults.
 * A request success never commits a write. Each transaction uses an isolated
 * snapshot; writes become visible only on complete and aborted writes roll back.
 * Real browser IndexedDB acceptance is a separate required validation.
 */
export function createProgramIdbFixture(){
  const fixture={rows:new Map(),transactions:[],failNextWriteCommit:false,blockNextOpen:false,failNextOpen:false,holdNextWriteCommit:false,held:false,closed:0};
  let exists=false,tail=Promise.resolve(),heldCommit=null;
  fixture.releaseCommit=()=>{const resume=heldCommit;heldCommit=null;fixture.held=false;resume?.();};
  function database(){return {objectStoreNames:{length:1,contains:name=>name==='history'},onversionchange:null,close(){fixture.closed++;},createObjectStore(name,options){if(name!=='history'||options.keyPath!=='owner')throw Error('Unexpected schema');exists=true;},transaction(name,mode,options){
    if(name!=='history')throw Error('Unknown store');
    let started=false,ended=false,processing=false,working=null,pending=[],completeTimer=null,end;
    const finished=new Promise(resolve=>{end=resolve;});
    const tx={mode,durability:options?.durability??'default',oncomplete:null,onerror:null,onabort:null,error:null,objectStore(){return {keyPath:'owner',autoIncrement:false,indexNames:{length:0},get:key=>request(()=>working.get(key)),put:value=>request(()=>{working.set(value.owner,structuredClone(value));return value.owner;}),delete:key=>request(()=>{working.delete(key);})};},abort(){if(ended)throw Error('Transaction finished');ended=true;if(completeTimer)clearTimeout(completeTimer);queueMicrotask(()=>{tx.onabort?.({target:tx});end();});}};
    fixture.transactions.push(tx);
    function commit(){if(ended)return;if(mode==='readwrite'&&fixture.failNextWriteCommit){fixture.failNextWriteCommit=false;tx.error=new Error('Injected commit failure');tx.onerror?.({target:tx});tx.abort();return;}ended=true;if(mode==='readwrite'){fixture.rows.clear();for(const [key,value]of working)fixture.rows.set(key,structuredClone(value));}queueMicrotask(()=>{tx.oncomplete?.({target:tx});end();});}
    function drain(){if(!started||ended||processing)return;if(!pending.length){if(completeTimer)clearTimeout(completeTimer);completeTimer=setTimeout(()=>{if(ended)return;if(mode==='readwrite'&&fixture.holdNextWriteCommit){fixture.holdNextWriteCommit=false;fixture.held=true;heldCommit=commit;}else commit();},0);return;}
      processing=true;const {req,operation}=pending.shift();queueMicrotask(()=>{if(ended){processing=false;return;}try{req.result=structuredClone(operation());req.onsuccess?.({target:req});}catch(error){req.error=error;req.onerror?.({target:req});tx.error=error;tx.onerror?.({target:tx});if(!ended)tx.abort();}processing=false;drain();});
    }
    function request(operation){if(ended)throw Error('Transaction finished');if(completeTimer)clearTimeout(completeTimer);const req={result:undefined,error:null,onsuccess:null,onerror:null};pending.push({req,operation});drain();return req;}
    const prior=tail;tail=finished;prior.then(()=>{if(ended)return;started=true;working=new Map([...fixture.rows].map(([key,value])=>[key,structuredClone(value)]));drain();});
    return tx;
  }};}
  fixture.factory={open(name,version){if(name!=='opengrail-program-history-v1'||version!==1)throw Error('Unexpected database');const req={result:null,error:null,transaction:null,onerror:null,onblocked:null,onupgradeneeded:null,onsuccess:null};setTimeout(()=>{if(fixture.failNextOpen){fixture.failNextOpen=false;req.error=new Error('Injected open failure');req.onerror?.({target:req});return;}req.result=database();if(fixture.blockNextOpen){fixture.blockNextOpen=false;req.onblocked?.({target:req});setTimeout(()=>req.onsuccess?.({target:req}),0);return;}if(!exists){let aborted=false;req.transaction={abort(){aborted=true;}};req.onupgradeneeded?.({oldVersion:0,target:req});if(aborted){req.error=new Error('Upgrade aborted');req.onerror?.({target:req});return;}}req.onsuccess?.({target:req});},0);return req;}};
  return fixture;
}
