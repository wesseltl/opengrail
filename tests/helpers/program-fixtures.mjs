/** Reviewed first-party binary fixtures. Never native-execute outside or adversarial bytes. */
export const u32=value=>{const result=[];do{const byte=value%128;value=Math.floor(value/128);result.push(byte|(value?128:0));}while(value);return result;};
export const i32=value=>{const result=[];let more=true;while(more){const byte=value&127;value>>=7;more=!((value===0&&(byte&64)===0)||(value===-1&&(byte&64)!==0));result.push(byte|(more?128:0));}return result;};
export const f64=value=>{const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat64(0,value,true);return [...bytes];};
export const text=value=>{const bytes=new TextEncoder().encode(value);return [...u32(bytes.length),...bytes];};
export const section=(id,bytes)=>[id,...u32(bytes.length),...bytes];
export const vector=values=>[...u32(values.length),...values.flat()];
export const valueType=type=>type==='i32'?0x7f:type==='f64'?0x7c:type==='i64'?0x7e:0x7d;
export const onBarType={params:['i32','f64','f64','f64','f64','f64','f64'],results:['i32']};
export const configureType={params:['i32','f64'],results:[]};
export const iconst=value=>[0x41,...i32(value)];
export const dconst=value=>[0x44,...f64(value)];
export const local=index=>[0x20,...u32(index)];
export const global=index=>[0x23,...u32(index)];
export const call=index=>[0x10,...u32(index)];
export function makeProgram({types=[onBarType],functions=[{type:0,body:iconst(0)}],globals=[],memory=null,data=[],exports=[{name:'on_bar',kind:0,index:0}],beforeCode=[],afterCode=[]}={}){
  const result=[0,97,115,109,1,0,0,0];
  result.push(...section(1,vector(types.map(type=>[0x60,...vector(type.params.map(valueType)),...vector(type.results.map(valueType))]))));
  result.push(...section(3,vector(functions.map(func=>u32(func.type)))));
  if(memory)result.push(...section(5,[1,memory.flags??1,...u32(memory.initial),...(memory.maximum===undefined?[]:u32(memory.maximum))]));
  if(globals.length)result.push(...section(6,vector(globals.map(item=>[valueType(item.type),item.mutable?1:0,...(item.type==='i32'?iconst(item.value):dconst(item.value)),0x0b]))));
  result.push(...section(7,vector(exports.map(item=>[...text(item.name),item.kind,...u32(item.index)]))));
  for(const bytes of beforeCode)result.push(...bytes);
  result.push(...section(10,vector(functions.map(func=>{const groups=(func.locals??[]).map(type=>[1,valueType(type)]),body=[...vector(groups),...func.body,0x0b];return [...u32(body.length),...body];}))));
  if(data.length)result.push(...section(11,vector(data.map(item=>[0,...iconst(item.offset),0x0b,...u32(item.bytes.length),...item.bytes]))));
  for(const bytes of afterCode)result.push(...bytes);
  return new Uint8Array(result);
}
export const constantProgram=(decision=0)=>makeProgram({functions:[{type:0,body:iconst(decision)}]});
export const firstOnlyProgram=()=>makeProgram({functions:[{type:0,body:[...local(0),0x45,0x04,0x7f,...iconst(1),0x05,...iconst(0),0x0b]}]});
export const alternatingProgram=()=>makeProgram({functions:[{type:0,body:[...local(0),...iconst(1),0x71,0x04,0x7f,...iconst(2),0x05,...iconst(1),0x0b]}]});
export const trendProgram=()=>makeProgram({types:[onBarType,configureType],globals:[{type:'f64',mutable:true,value:0},{type:'f64',mutable:true,value:0}],functions:[
  {type:0,locals:['i32'],body:[...local(0),0x45,0x04,0x7f,...iconst(0),0x05,...local(5),...global(0),...global(1),0xa0,0x64,0x04,0x7f,...iconst(1),0x05,...local(5),...global(0),...global(1),0xa1,0x63,0x04,0x7f,...iconst(2),0x05,...iconst(0),0x0b,0x0b,0x0b,0x21,7,...local(5),0x24,0,...local(7)]},
  {type:1,body:[...local(1),0x24,1]},
],exports:[{name:'on_bar',kind:0,index:0},{name:'configure',kind:0,index:1}]});
export const infiniteProgram=()=>makeProgram({functions:[{type:0,body:[0x03,0x40,0x0c,0,0x0b,...iconst(0)]}]});
export const trapProgram=()=>makeProgram({functions:[{type:0,body:[...iconst(1),...iconst(0),0x6d]}]});
export const moduleHex=bytes=>Buffer.from(bytes).toString('hex');
