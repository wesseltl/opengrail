/** Bounded JSON grammar pass before JSON.parse: duplicate fields must never silently replace risk limits. */
export function parseUniqueJson(raw:string,maximumBytes:number,maximumDepth=12):unknown{
 if(raw.length>maximumBytes||new TextEncoder().encode(raw).byteLength>maximumBytes)throw Error('JSON exceeds its size limit.');
 let i=0;
 const fail=():never=>{throw Error('Invalid JSON. Use a complete valid JSON document.');};
 const whitespace=()=>{while(i<raw.length&&/[\t\n\r ]/.test(raw[i]))i++;};
 const string=():string=>{
  const start=i;if(raw[i++]!=='"')return fail();
  while(i<raw.length){const c=raw[i++];if(c==='\\'){i++;continue;}if(c==='"'){try{return JSON.parse(raw.slice(start,i));}catch{return fail();}}}
  return fail();
 };
 function value(depth:number):void{
  if(depth>maximumDepth)throw Error('JSON is nested too deeply.');
  whitespace();const c=raw[i];
  if(c==='{'){
   i++;whitespace();if(raw[i]==='}'){i++;return;}
   const fields=new Set<string>();
   while(i<raw.length){
    whitespace();const key=string();
    if(fields.has(key))throw Error('Duplicate JSON fields are not allowed.');
    fields.add(key);whitespace();if(raw[i++]!==':')return fail();value(depth+1);whitespace();
    if(raw[i]==='}'){i++;return;}if(raw[i++]!==',')return fail();
   }
   return fail();
  }
  if(c==='['){
   i++;whitespace();if(raw[i]===']'){i++;return;}
   while(i<raw.length){value(depth+1);whitespace();if(raw[i]===']'){i++;return;}if(raw[i++]!==',')return fail();}
   return fail();
  }
  if(c==='"'){string();return;}
  const token=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(i));
  if(!token)return fail();i+=token[0].length;
 }
 value(0);whitespace();if(i!==raw.length)return fail();
 try{return JSON.parse(raw);}catch{return fail();}
}
