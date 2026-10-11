import {parseUniqueJson} from './unique-json';
export class NetworkBodyLimit extends Error{}
export async function readNetworkJson(request:Request,maximum:number,maximumDepth=8){
 if(!request.body)throw Error('Missing JSON body.');
 const reader=request.body.getReader(),chunks:Uint8Array[]= [];let length=0;
 try{
  for(;;){const result=await reader.read();if(result.done)break;length+=result.value.byteLength;if(length>maximum){await reader.cancel();throw new NetworkBodyLimit();}chunks.push(result.value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return parseUniqueJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes),maximum,maximumDepth);
}
