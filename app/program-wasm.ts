/**
 * OpenGrail's deliberately restricted, deterministic WASM interpreter.
 * Guest bytes are parsed data. No native compilation, imports or guest JS runs.
 * Opaque handles retain their validated AST and mutable state only in WeakMaps.
 *
 * Numerical profile: i32 values use signed two's-complement host numbers, with
 * wrapping arithmetic and unsigned operations explicitly reinterpreting bits.
 * Signed division overflow, division/remainder by zero and out-of-range float
 * conversions trap. f64 uses IEEE binary64, ties-to-even nearest and signed-zero
 * min/max/copysign; any non-finite constant, loaded value or computed result is
 * refused. This deliberate finite restriction is stricter than general WASM.
 *
 * Function results and block results are zero-or-one numeric values; indexed
 * block types, block parameters and multi-value results are outside this profile.
 * Every executed semantic instruction, including structured blocks, calls and
 * branches, costs one fuel before execution. Else/end are binary delimiters, not
 * additional executed AST instructions. Memory growth is bounded to one page.
 */
export const programWasmProfile = 'opengrail-wasm-i32-f64-v1' as const;
export const programWasmAbi = 'opengrail-causal-signal-wasm-v1' as const;
export const programWasmLimits = Object.freeze({moduleBytes:4096,types:32,functions:32,parameters:16,locals:128,globals:64,instructions:8192,nesting:32,callDepth:16,operandStack:256,memoryPages:1,fuel:20000});
export type ProgramWasmErrorCode = 'BINARY'|'UNSUPPORTED'|'LIMIT'|'TYPE'|'ABI'|'HANDLE'|'ARGUMENT'|'FUEL'|'TRAP'|'NONFINITE'|'MEMORY';
export class ProgramWasmError extends Error {
  readonly code:ProgramWasmErrorCode;
  readonly fuelUsed:number|null;
  constructor(code:ProgramWasmErrorCode,message:string,fuelUsed:number|null=null){super(message);this.name='ProgramWasmError';this.code=code;this.fuelUsed=fuelUsed;}
}
const fail=(code:ProgramWasmErrorCode,message:string):never=>{throw new ProgramWasmError(code,message);};
type ValueType='i32'|'f64';
type StackType=ValueType|'unknown';
type FunctionType={params:ValueType[];results:ValueType[]};
type Instruction={op:number;arg?:number;align?:number;offset?:number;result?:ValueType;body?:Instruction[];otherwise?:Instruction[]};
type FunctionBody={type:number;locals:ValueType[];body:Instruction[]};
type Global={type:ValueType;mutable:boolean;value:number};
type InternalModule={types:FunctionType[];functions:FunctionBody[];globals:Global[];memory:{initial:number;maximum:number}|null;data:{offset:number;bytes:Uint8Array}[];exports:Map<string,number>};
type InternalInstance={module:InternalModule;globals:number[];memory:Uint8Array;pages:number;running:boolean};
declare const moduleBrand:unique symbol;
declare const instanceBrand:unique symbol;
export type ProgramModule={readonly [moduleBrand]:true};
export type ProgramInstance={readonly [instanceBrand]:true};
const modules=new WeakMap<object,InternalModule>(),instances=new WeakMap<object,InternalInstance>();
const isObject=(value:unknown):value is object=>typeof value==='object'&&value!==null;
const moduleFor=(handle:ProgramModule):InternalModule=>{const value=isObject(handle)?modules.get(handle):undefined;return value??fail('HANDLE','Unknown program module handle.');};
const instanceFor=(handle:ProgramInstance):InternalInstance=>{const value=isObject(handle)?instances.get(handle):undefined;return value??fail('HANDLE','Unknown program instance handle.');};
const finite=(value:number):number=>Number.isFinite(value)?value:fail('NONFINITE','The numeric profile forbids non-finite values.');

class Reader {
  readonly bytes:Uint8Array;position=0;
  constructor(bytes:Uint8Array){this.bytes=bytes;}
  get remaining(){return this.bytes.length-this.position;}
  byte():number{if(!this.remaining)fail('BINARY','Unexpected end of module.');return this.bytes[this.position++];}
  take(length:number):Uint8Array{if(!Number.isInteger(length)||length<0||length>this.remaining)fail('BINARY','Truncated binary section.');const result=this.bytes.slice(this.position,this.position+length);this.position+=length;return result;}
  u32():number{let result=0;for(let i=0;i<5;i++){const byte=this.byte(),payload=byte&127;if(i===4&&payload>15)fail('BINARY','Unsigned LEB exceeds 32 bits.');result+=payload*2**(i*7);if(!(byte&128))return result;}return fail('BINARY','Unsigned LEB is too long.');}
  i32():number{let result=0;for(let i=0;i<5;i++){const byte=this.byte(),payload=byte&127;result+=payload*2**(i*7);if(!(byte&128)){if(byte&64)result-=2**((i+1)*7);if(result<-2147483648||result>2147483647)fail('BINARY','Signed LEB exceeds 32 bits.');return result;}}return fail('BINARY','Signed LEB is too long.');}
  f64():number{const bytes=this.take(8);return finite(new DataView(bytes.buffer,bytes.byteOffset,8).getFloat64(0,true));}
  name():string{const size=this.u32();if(size>128)fail('LIMIT','Binary names exceed the profile bound.');try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(this.take(size));}catch(error){if(error instanceof ProgramWasmError)throw error;return fail('BINARY','Invalid UTF-8 name.');}}
  count(limit:number,label:string):number{const count=this.u32();if(count>limit)fail('LIMIT',`${label} exceeds the profile bound.`);return count;}
  done():void{if(this.remaining)fail('BINARY','Unexpected trailing section bytes.');}
}
const valueType=(reader:Reader):ValueType=>{const byte=reader.byte();if(byte===0x7f)return 'i32';if(byte===0x7c)return 'f64';return fail('UNSUPPORTED','Only i32 and f64 values are admitted.');};
const simpleOps=new Set([0x00,0x01,0x0f,0x1a,0x1b,...Array.from({length:11},(_,i)=>0x45+i),...Array.from({length:6},(_,i)=>0x61+i),...Array.from({length:18},(_,i)=>0x67+i),...Array.from({length:14},(_,i)=>0x99+i),0xaa,0xab,0xb7,0xb8,0xc0,0xc1]);
const memoryWidths=new Map([[0x28,4],[0x2b,8],[0x2c,1],[0x2d,1],[0x2e,2],[0x2f,2],[0x36,4],[0x39,8],[0x3a,1],[0x3b,2]]);
const loadOps=new Set([0x28,0x2b,0x2c,0x2d,0x2e,0x2f]);
const storeOps=new Set([0x36,0x39,0x3a,0x3b]);

function parseInstructions(reader:Reader,counter:{count:number},depth:number,allowElse:boolean):{instructions:Instruction[];elseSeen:boolean}{
  if(depth>programWasmLimits.nesting)fail('LIMIT','Structured control nesting exceeds the profile bound.');
  const instructions:Instruction[]=[];
  for(;;){const op=reader.byte();if(op===0x0b)return {instructions,elseSeen:false};if(op===0x05){if(!allowElse)fail('BINARY','Unexpected else.');return {instructions,elseSeen:true};}
    if(++counter.count>programWasmLimits.instructions)fail('LIMIT','Instruction count exceeds the profile bound.');
    const instruction:Instruction={op};
    if(op===0x02||op===0x03||op===0x04){const blockType=reader.byte();if(blockType===0x7f)instruction.result='i32';else if(blockType===0x7c)instruction.result='f64';else if(blockType!==0x40)fail('UNSUPPORTED','Indexed or multi-value block types are not admitted.');const body=parseInstructions(reader,counter,depth+1,op===0x04);instruction.body=body.instructions;if(body.elseSeen){const other=parseInstructions(reader,counter,depth+1,false);instruction.otherwise=other.instructions;}instructions.push(instruction);continue;}
    if(op===0x0c||op===0x0d||op===0x10||(op>=0x20&&op<=0x24))instruction.arg=reader.u32();
    else if(memoryWidths.has(op)){instruction.align=reader.u32();instruction.offset=reader.u32();const width=memoryWidths.get(op)!;if(instruction.align>Math.log2(width))fail('TYPE','Memory alignment exceeds the natural alignment.');}
    else if(op===0x3f||op===0x40){if(reader.u32()!==0)fail('UNSUPPORTED','Only memory zero is admitted.');}
    else if(op===0x41)instruction.arg=reader.i32();
    else if(op===0x44)instruction.arg=reader.f64();
    else if(!simpleOps.has(op))fail('UNSUPPORTED',`Unsupported WASM opcode 0x${op.toString(16)}.`);
    instructions.push(instruction);
  }
}

type Control={height:number;result:ValueType[];label:ValueType[];unreachable:boolean};
function validateFunction(module:InternalModule,func:FunctionBody):void{
  const signature=module.types[func.type],locals=[...signature.params,...func.locals],stack:StackType[]=[],controls:Control[]=[];
  const current=()=>controls[controls.length-1];
  const push=(type:StackType)=>{if(stack.length>=programWasmLimits.operandStack)fail('LIMIT','Validated operand stack exceeds the profile bound.');stack.push(type);};
  const pop=(expected?:ValueType):StackType=>{const control=current();if(stack.length===control.height){if(control.unreachable)return expected??'unknown';return fail('TYPE','Operand stack underflow.');}const actual=stack.pop()!;if(expected&&actual!=='unknown'&&actual!==expected)fail('TYPE','Operand type mismatch.');return actual;};
  const popTypes=(types:ValueType[])=>{for(let i=types.length-1;i>=0;i--)pop(types[i]);};
  const dead=()=>{stack.length=current().height;current().unreachable=true;};
  const sequence=(instructions:Instruction[])=>{for(const instruction of instructions){const {op,arg}=instruction;
    if(op===0x00){dead();continue;}if(op===0x01)continue;
    if(op===0x02||op===0x03||op===0x04){if(op===0x04)pop('i32');const result=instruction.result?[instruction.result]:[],height=stack.length;
      const validateArm=(body:Instruction[])=>{controls.push({height,result,label:op===0x03?[]:result,unreachable:false});sequence(body);popTypes(result);if(stack.length!==height)fail('TYPE','Structured block leaves unexpected operands.');controls.pop();stack.length=height;};
      validateArm(instruction.body!);if(op===0x04){if(!instruction.otherwise&&result.length)fail('TYPE','A result-bearing if requires an else.');validateArm(instruction.otherwise??[]);}for(const type of result)push(type);continue;}
    if(op===0x0c||op===0x0d){if(arg!>=controls.length)fail('TYPE','Branch label is outside the function.');if(op===0x0d)pop('i32');const label=controls[controls.length-1-arg!].label;popTypes(label);if(op===0x0d){for(const type of label)push(type);}else dead();continue;}
    if(op===0x0f){popTypes(signature.results);dead();continue;}
    if(op===0x10){const called=module.functions[arg!];if(!called)fail('TYPE','Unknown direct function.');const type=module.types[called.type];popTypes(type.params);for(const result of type.results)push(result);continue;}
    if(op===0x1a){pop();continue;}if(op===0x1b){pop('i32');const right=pop(),left=pop();if(left!=='unknown'&&right!=='unknown'&&left!==right)fail('TYPE','Select operands have different types.');push(left==='unknown'?right:left);continue;}
    if(op>=0x20&&op<=0x22){const type=locals[arg!];if(!type)fail('TYPE','Unknown local.');if(op!==0x20)pop(type);if(op!==0x21)push(type);continue;}
    if(op===0x23||op===0x24){const global=module.globals[arg!];if(!global)fail('TYPE','Unknown global.');if(op===0x23)push(global.type);else{if(!global.mutable)fail('TYPE','Cannot set an immutable global.');pop(global.type);}continue;}
    if(memoryWidths.has(op)){if(!module.memory)fail('TYPE','Memory instruction requires a declared memory.');const type=op===0x2b||op===0x39?'f64':'i32';if(storeOps.has(op))pop(type);pop('i32');if(loadOps.has(op))push(type);continue;}
    if(op===0x3f||op===0x40){if(!module.memory)fail('TYPE','Memory instruction requires a declared memory.');if(op===0x40)pop('i32');push('i32');continue;}
    if(op===0x41){push('i32');continue;}if(op===0x44){push('f64');continue;}
    if(op===0x45){pop('i32');push('i32');continue;}
    if(op>=0x46&&op<=0x4f){pop('i32');pop('i32');push('i32');continue;}
    if(op>=0x61&&op<=0x66){pop('f64');pop('f64');push('i32');continue;}
    if(op>=0x67&&op<=0x69||op===0xc0||op===0xc1){pop('i32');push('i32');continue;}
    if(op>=0x6a&&op<=0x78){pop('i32');pop('i32');push('i32');continue;}
    if(op>=0x99&&op<=0x9f){pop('f64');push('f64');continue;}
    if(op>=0xa0&&op<=0xa6){pop('f64');pop('f64');push('f64');continue;}
    if(op===0xaa||op===0xab){pop('f64');push('i32');continue;}
    if(op===0xb7||op===0xb8){pop('i32');push('f64');continue;}
    fail('UNSUPPORTED','Unimplemented validated opcode.');
  }};
  controls.push({height:0,result:signature.results,label:signature.results,unreachable:false});sequence(func.body);popTypes(signature.results);if(stack.length)fail('TYPE','Function leaves unexpected operands.');controls.pop();
}

/** Admission performs bounded binary, index, ABI and complete operand/control typing. */
export function parseProgramModule(bytes:Uint8Array):ProgramModule{
  if(!(bytes instanceof Uint8Array))fail('ARGUMENT','Module bytes must be a Uint8Array.');if(bytes.byteLength>programWasmLimits.moduleBytes)fail('LIMIT','Module bytes exceed the profile bound.');
  // Copy once: mutation of the caller's array cannot alter an admitted program.
  const reader=new Reader(new Uint8Array(bytes));if(reader.take(8).some((byte,index)=>byte!==[0,97,115,109,1,0,0,0][index]))fail('BINARY','Invalid WASM magic or version.');
  const module:InternalModule={types:[],functions:[],globals:[],memory:null,data:[],exports:new Map()},functionTypes:number[]=[],counter={count:0};let lastSection=0,hasCode=false;
  while(reader.remaining){const id=reader.byte(),section=new Reader(reader.take(reader.u32()));if(id===0){section.name();section.take(section.remaining);continue;}if(id>11)fail('UNSUPPORTED','Unsupported binary section.');if(id<=lastSection)fail('BINARY','Non-custom sections must be unique and ordered.');lastSection=id;
    if(id===1){const count=section.count(programWasmLimits.types,'Types');for(let i=0;i<count;i++){if(section.byte()!==0x60)fail('UNSUPPORTED','Only numeric function types are admitted.');const params=Array.from({length:section.count(programWasmLimits.parameters,'Parameters')},()=>valueType(section)),results=Array.from({length:section.count(1,'Results')},()=>valueType(section));module.types.push({params,results});}}
    else if(id===2||id===4||id===8||id===9)fail('UNSUPPORTED','Imports, tables, start and element sections are forbidden.');
    else if(id===3){const count=section.count(programWasmLimits.functions,'Functions');for(let i=0;i<count;i++){const type=section.u32();if(!module.types[type])fail('TYPE','Unknown function type.');functionTypes.push(type);}}
    else if(id===5){const count=section.count(1,'Memories');if(count){if(section.byte()!==1)fail('UNSUPPORTED','Memory requires a non-shared explicit maximum.');const initial=section.u32(),maximum=section.u32();if(initial>maximum||maximum>programWasmLimits.memoryPages)fail('LIMIT','Memory exceeds the one-page profile bound.');module.memory={initial,maximum};}}
    else if(id===6){const count=section.count(programWasmLimits.globals,'Globals');for(let i=0;i<count;i++){const type=valueType(section),mutable=section.byte();if(mutable>1)fail('BINARY','Invalid global mutability.');const op=section.byte();if(op!==(type==='i32'?0x41:0x44))fail('TYPE','Global initializer must be a matching numeric constant.');const value=type==='i32'?section.i32():section.f64();if(section.byte()!==0x0b)fail('BINARY','Invalid global initializer terminator.');module.globals.push({type,mutable:mutable===1,value});}}
    else if(id===7){const count=section.count(3,'Exports');for(let i=0;i<count;i++){const name=section.name(),kind=section.byte(),index=section.u32();if(module.exports.has(name))fail('BINARY','Duplicate export name.');if(name==='memory'){if(kind!==2||index!==0||!module.memory)fail('ABI','Invalid memory export.');}else if(name==='on_bar'||name==='configure'){if(kind!==0)fail('ABI','ABI exports must be functions.');}else fail('ABI','Unknown exported capability.');module.exports.set(name,index);}}
    else if(id===10){hasCode=true;const count=section.count(programWasmLimits.functions,'Code bodies');if(count!==functionTypes.length)fail('BINARY','Function and code counts differ.');for(let i=0;i<count;i++){const body=new Reader(section.take(section.u32())),locals:ValueType[]=[],groups=body.count(programWasmLimits.locals,'Local groups');for(let group=0;group<groups;group++){const count=body.count(programWasmLimits.locals,'Expanded locals'),type=valueType(body);if(locals.length+count+module.types[functionTypes[i]].params.length>programWasmLimits.locals)fail('LIMIT','Expanded locals exceed the profile bound.');for(let j=0;j<count;j++)locals.push(type);}const instructions=parseInstructions(body,counter,0,false);body.done();module.functions.push({type:functionTypes[i],locals,body:instructions.instructions});}}
    else if(id===11){const count=section.count(32,'Data segments');for(let i=0;i<count;i++){const flags=section.u32();if(flags!==0&&flags!==2)fail('UNSUPPORTED','Only active data segments are admitted.');if(flags===2&&section.u32()!==0)fail('UNSUPPORTED','Only memory zero is admitted.');const memory=module.memory??fail('TYPE','Data segment requires memory.');if(section.byte()!==0x41)fail('UNSUPPORTED','Data offset must be an i32 constant.');const offset=section.i32()>>>0;if(section.byte()!==0x0b)fail('BINARY','Invalid data offset expression.');const data=section.take(section.u32());if(offset+data.length>memory.initial*65536)fail('MEMORY','Active data segment exceeds initial memory.');module.data.push({offset,bytes:data});}}
    section.done();
  }
  if(!hasCode||module.functions.length!==functionTypes.length)fail('BINARY','Missing function code.');
  const checkExport=(name:string,params:ValueType[],results:ValueType[],required:boolean)=>{const index=module.exports.get(name);if(index===undefined){if(required)fail('ABI',`Missing ${name} export.`);return;}const func=module.functions[index];if(!func)fail('TYPE','Export refers to an unknown function.');const type=module.types[func.type];if(type.params.join(',')!==params.join(',')||type.results.join(',')!==results.join(','))fail('ABI',`Incorrect ${name} signature.`);};
  checkExport('on_bar',['i32','f64','f64','f64','f64','f64','f64'],['i32'],true);checkExport('configure',['i32','f64'],[],false);
  for(const func of module.functions)validateFunction(module,func);
  const handle=Object.freeze({}) as ProgramModule;modules.set(handle,module);return handle;
}

export function programModuleInfo(handle:ProgramModule){const module=moduleFor(handle);return Object.freeze({profile:programWasmProfile,abi:programWasmAbi,exports:Object.freeze([...module.exports.keys()]),functions:module.functions.length,globals:module.globals.length,globalTypes:Object.freeze(module.globals.map(global=>global.type)),memoryPages:module.memory?.initial??0,memoryMaximumPages:module.memory?.maximum??0});}
export function createProgramInstance(handle:ProgramModule):ProgramInstance{const module=moduleFor(handle),memory=new Uint8Array((module.memory?.initial??0)*65536);for(const segment of module.data)memory.set(segment.bytes,segment.offset);const value:InternalInstance={module,globals:module.globals.map(global=>global.value),memory,pages:module.memory?.initial??0,running:false},instance=Object.freeze({}) as ProgramInstance;instances.set(instance,value);return instance;}

type Flow={kind:'branch';depth:number;values:number[]}|{kind:'return';values:number[]};
type Budget={used:number;limit:number;depth:number;operands:number};
const nearest=(value:number)=>{if(value===0)return value;const floor=Math.floor(value),fraction=value-floor;const result=fraction<0.5?floor:fraction>0.5?floor+1:floor%2===0?floor:floor+1;return result===0&&value<0?-0:result;};
const popcount=(value:number)=>{let number=value>>>0;number-=number>>>1&0x55555555;number=(number&0x33333333)+(number>>>2&0x33333333);return (((number+(number>>>4))&0x0f0f0f0f)*0x01010101)>>>24;};
function executeFunction(instance:InternalInstance,index:number,args:number[],budget:Budget):number[]{
  if(++budget.depth>programWasmLimits.callDepth)fail('LIMIT','Direct call depth exceeds the profile bound.');
  const func=instance.module.functions[index],type=instance.module.types[func.type],locals=[...args,...func.locals.map(()=>0)],stack:number[]=[],labels:{height:number;arity:number;loop:boolean}[]=[];
  const push=(value:number)=>{finite(value);if(budget.operands>=programWasmLimits.operandStack)fail('LIMIT','Runtime operand stack exceeds the profile bound.');stack.push(value);budget.operands++;};
  const pop=()=>{if(!stack.length)fail('TRAP','Runtime stack underflow.');budget.operands--;return stack.pop()!;};
  const truncate=(height:number)=>{if(height>stack.length)fail('TRAP','Invalid runtime block height.');budget.operands-=stack.length-height;stack.length=height;};
  const values=(count:number)=>{if(stack.length<count)fail('TRAP','Runtime result underflow.');const result=stack.slice(stack.length-count);truncate(stack.length-count);return result;};
  const charge=()=>{if(budget.used>=budget.limit)fail('FUEL','Program instruction fuel exhausted.');budget.used++;};
  const sequence=(instructions:Instruction[]):Flow|null=>{for(const instruction of instructions){charge();const {op,arg}=instruction;
    if(op===0x00)fail('TRAP','Program executed unreachable.');if(op===0x01)continue;
    if(op===0x02||op===0x03||op===0x04){const condition=op===0x04?pop():1,height=stack.length,arity=instruction.result?1:0;labels.push({height,arity:op===0x03?0:arity,loop:op===0x03});const body=op===0x04&&!condition?(instruction.otherwise??[]):instruction.body!;
      for(;;){const flow=sequence(body);if(!flow)break;if(flow.kind==='return'){labels.pop();return flow;}if(flow.depth>0){labels.pop();return {...flow,depth:flow.depth-1};}truncate(height);for(const value of flow.values)push(value);if(op===0x03)continue;break;}
      labels.pop();const result=values(arity);truncate(height);for(const value of result)push(value);continue;}
    if(op===0x0c||op===0x0d){if(op===0x0d&&!pop())continue;const label=labels[labels.length-1-arg!];if(!label)fail('TRAP','Unknown runtime branch label.');return {kind:'branch',depth:arg!,values:values(label.arity)};}
    if(op===0x0f)return {kind:'return',values:values(type.results.length)};
    if(op===0x10){const target=instance.module.functions[arg!],targetType=instance.module.types[target.type],callArgs=values(targetType.params.length),result=executeFunction(instance,arg!,callArgs,budget);for(const value of result)push(value);continue;}
    if(op===0x1a){pop();continue;}if(op===0x1b){const condition=pop(),right=pop(),left=pop();push(condition?left:right);continue;}
    if(op===0x20){push(locals[arg!]);continue;}if(op===0x21){locals[arg!]=pop();continue;}if(op===0x22){const value=pop();locals[arg!]=value;push(value);continue;}
    if(op===0x23){push(instance.globals[arg!]);continue;}if(op===0x24){instance.globals[arg!]=pop();continue;}
    if(memoryWidths.has(op)){const stored=storeOps.has(op)?pop():null,address=(pop()>>>0)+instruction.offset!,width=memoryWidths.get(op)!;if(address+width>instance.memory.length)fail('MEMORY','Program memory access is out of bounds.');const view=new DataView(instance.memory.buffer,instance.memory.byteOffset,instance.memory.byteLength);
      if(op===0x28)push(view.getInt32(address,true));else if(op===0x2b)push(finite(view.getFloat64(address,true)));else if(op===0x2c)push(view.getInt8(address));else if(op===0x2d)push(view.getUint8(address));else if(op===0x2e)push(view.getInt16(address,true));else if(op===0x2f)push(view.getUint16(address,true));else if(op===0x36)view.setInt32(address,stored!,true);else if(op===0x39)view.setFloat64(address,stored!,true);else if(op===0x3a)view.setInt8(address,stored!);else view.setInt16(address,stored!,true);continue;}
    if(op===0x3f){push(instance.pages);continue;}if(op===0x40){const delta=pop()>>>0,previous=instance.pages,next=previous+delta;if(next>instance.module.memory!.maximum){push(-1);}else{if(delta){const memory=new Uint8Array(next*65536);memory.set(instance.memory);instance.memory=memory;instance.pages=next;}push(previous);}continue;}
    if(op===0x41||op===0x44){push(arg!);continue;}
    if(op===0x45){push(pop()===0?1:0);continue;}
    if(op>=0x46&&op<=0x4f){const right=pop(),left=pop();let result=false;switch(op){case 0x46:result=left===right;break;case 0x47:result=left!==right;break;case 0x48:result=left<right;break;case 0x49:result=(left>>>0)<(right>>>0);break;case 0x4a:result=left>right;break;case 0x4b:result=(left>>>0)>(right>>>0);break;case 0x4c:result=left<=right;break;case 0x4d:result=(left>>>0)<=(right>>>0);break;case 0x4e:result=left>=right;break;case 0x4f:result=(left>>>0)>=(right>>>0);break;}push(result?1:0);continue;}
    if(op>=0x61&&op<=0x66){const right=pop(),left=pop();push([left===right,left!==right,left<right,left>right,left<=right,left>=right][op-0x61]?1:0);continue;}
    if(op===0x67){push(Math.clz32(pop()));continue;}if(op===0x68){const value=pop();push(value===0?32:31-Math.clz32((value&-value)>>>0));continue;}if(op===0x69){push(popcount(pop()));continue;}
    if(op>=0x6a&&op<=0x78){const right=pop(),left=pop();let result:number;switch(op){case 0x6a:result=(left+right)|0;break;case 0x6b:result=(left-right)|0;break;case 0x6c:result=Math.imul(left,right);break;case 0x6d:if(right===0||left===-2147483648&&right===-1)fail('TRAP','Signed integer division trap.');result=Math.trunc(left/right)|0;break;case 0x6e:if(right===0)fail('TRAP','Unsigned integer division by zero.');result=Math.trunc((left>>>0)/(right>>>0))|0;break;case 0x6f:if(right===0)fail('TRAP','Signed integer remainder by zero.');result=(left%right)|0;break;case 0x70:if(right===0)fail('TRAP','Unsigned integer remainder by zero.');result=((left>>>0)%(right>>>0))|0;break;case 0x71:result=left&right;break;case 0x72:result=left|right;break;case 0x73:result=left^right;break;case 0x74:result=left<<(right&31);break;case 0x75:result=left>>(right&31);break;case 0x76:result=(left>>>(right&31))|0;break;case 0x77:result=(left<<(right&31))|(left>>>(32-(right&31)));break;case 0x78:result=(left>>>(right&31))|(left<<(32-(right&31)));break;default:return fail('TRAP','Unknown integer instruction.');}push(result);continue;}
    if(op>=0x99&&op<=0x9f){const value=pop();let result:number;switch(op){case 0x99:result=Math.abs(value);break;case 0x9a:result=-value;break;case 0x9b:result=Math.ceil(value);break;case 0x9c:result=Math.floor(value);break;case 0x9d:result=Math.trunc(value);break;case 0x9e:result=nearest(value);break;default:result=Math.sqrt(value);}push(finite(result));continue;}
    if(op>=0xa0&&op<=0xa6){const right=pop(),left=pop();let result:number;switch(op){case 0xa0:result=left+right;break;case 0xa1:result=left-right;break;case 0xa2:result=left*right;break;case 0xa3:result=left/right;break;case 0xa4:result=Math.min(left,right);break;case 0xa5:result=Math.max(left,right);break;default:result=(right<0||Object.is(right,-0)?-1:1)*Math.abs(left);}push(finite(result));continue;}
    if(op===0xaa||op===0xab){const value=pop(),truncated=Math.trunc(value);if(op===0xaa?(truncated<-2147483648||truncated>2147483647):(truncated<0||truncated>4294967295))fail('TRAP','Floating-to-integer conversion is out of bounds.');push(truncated|0);continue;}
    if(op===0xb7||op===0xb8){const value=pop();push(op===0xb7?value:value>>>0);continue;}
    if(op===0xc0){push(pop()<<24>>24);continue;}if(op===0xc1){push(pop()<<16>>16);continue;}
    fail('TRAP','Unexpected admitted instruction.');
  }return null;};
  labels.push({height:0,arity:type.results.length,loop:false});
  try{const flow=sequence(func.body);let result:number[];if(flow){if(flow.kind==='branch'&&flow.depth!==0)fail('TRAP','Branch escaped the function.');result=flow.values;}else result=values(type.results.length);truncate(0);return result;}finally{budget.operands-=stack.length;budget.depth--;}
}

export function invokeProgram(handle:ProgramInstance,exportName:'on_bar'|'configure',numericArgs:readonly number[],fuelLimit:number):{value:number|null;fuelUsed:number}{
  const instance=instanceFor(handle);if(exportName!=='on_bar'&&exportName!=='configure')fail('ABI','Unknown callable export.');const index=instance.module.exports.get(exportName)??fail('ABI',`Missing ${exportName} export.`);if(instance.running)fail('HANDLE','An instance cannot be invoked recursively by its host.');
  if(!Number.isInteger(fuelLimit)||fuelLimit<1||fuelLimit>programWasmLimits.fuel)fail('ARGUMENT','Fuel limit must be a bounded positive integer.');const type=instance.module.types[instance.module.functions[index].type];if(!Array.isArray(numericArgs)||numericArgs.length!==type.params.length)fail('ARGUMENT','Arguments do not match the export signature.');
  const args=Array.from(numericArgs,(value,index)=>{if(typeof value!=='number'||!Number.isFinite(value))fail('ARGUMENT','Arguments must be finite numbers.');if(type.params[index]==='i32'&&(!Number.isInteger(value)||value<-2147483648||value>2147483647))fail('ARGUMENT','i32 argument is out of bounds.');return type.params[index]==='i32'?value|0:value;});
  const budget:Budget={used:0,limit:fuelLimit,depth:0,operands:0};instance.running=true;try{const result=executeFunction(instance,index,args,budget);return Object.freeze({value:result.length?result[0]:null,fuelUsed:budget.used});}catch(error){if(error instanceof ProgramWasmError)throw new ProgramWasmError(error.code,error.message,budget.used);throw error;}finally{instance.running=false;}
}

/** State is a bounded detached copy, never the interpreter's live backing arrays. */
export function programState(handle:ProgramInstance):{globals:number[];globalBits:string[];memory:number[]}{
  const instance=instanceFor(handle),globalBits=instance.globals.map((value,index)=>{const type=instance.module.globals[index].type,bytes=new Uint8Array(type==='i32'?4:8),view=new DataView(bytes.buffer);if(type==='i32')view.setInt32(0,value,true);else view.setFloat64(0,value,true);return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');});
  return {globals:[...instance.globals],globalBits,memory:Array.from(instance.memory)};
}
