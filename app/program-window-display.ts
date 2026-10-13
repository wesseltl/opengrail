/** Display only: these labels never alter retained values, identities or clocks. */
export function programWindowQuoteUnit(symbol?:string){
 return symbol&&/^[A-Z0-9]{2,12}\/[A-Z0-9]{2,12}$/.test(symbol)?symbol.slice(symbol.indexOf('/')+1):'quote units';
}

export function programWindowUtcTime(clock:string){
 return clock.endsWith('Z')?clock.slice(0,-1).replace('T',' ')+' UTC':clock+' (timezone UNKNOWN)';
}

/** A record label distinguishes repeated sources without a performance order. */
export function programWindowRecordLabel(id:string,ids:readonly string[]){
 let length=8;
 while(length<id.length&&ids.some(other=>other!==id&&other.slice(0,length)===id.slice(0,length)))length=Math.min(length+4,id.length);
 return id.slice(0,length);
}

const reasons:Readonly<Record<string,string>>={
 UNRESOLVED_PENDING:'An original input is still unresolved',
 PENDING_PROTECTIVE_EXIT:'A protective exit is still pending',
 GENERATOR_FAILED:'Strategy execution failed',
 GENERATOR_INTERRUPTED:'Strategy execution was interrupted',
 SESSION_FAILED:'The Demo session failed',
 OBSERVATION_PROTOCOL_NOT_COMPLETE:'The declared observation protocol is not complete',
 DATA_GAP:'The retained session records a data gap',
 LATE_OR_UNBOUND_INPUT:'An input is late or not bound to the declared window',
 NOT_ESTABLISHED:'Input timing has not been established',
 TERMINAL_QUOTE_UNAVAILABLE:'No eligible terminal quote is available',
 BASELINE_ENTRY_UNAVAILABLE:'The first-slot baseline entry quote is unavailable',
 CAPACITY_HALTED:'The retained session reached its capacity limit',
 RECONSTRUCTED_MISMATCH:'Reconstruction differs from the original',
 KERNEL_QUOTE_ACCOUNT_MISMATCH:'Accounting differs at a retained quote',
 COMMON_QUOTE_CHECKPOINT_UNAVAILABLE:'A required quote checkpoint is unavailable',
 SHORT_COLLATERAL_DEFICIT:'Terminal valuation records a SHORT collateral deficit',
 INSOLVENT_TERMINAL_ECONOMICS:'Terminal valuation is insolvent under the declared costs',
 NONFINITE_ACCOUNTING:'A required financial calculation is unavailable',
 NONFINITE_OR_UNAVAILABLE_ACCOUNTING:'A finite terminal valuation is unavailable',
 FAILED:'Local reconstruction failed',
 INTERRUPTED:'Local reconstruction was interrupted',
 UNAVAILABLE:'No fresh reconstruction is available',
 USER_CANCELLED:'Local reconstruction was cancelled',
};

export function programWindowReasonSummary(codes:readonly string[]){
 if(!codes.length)return 'The complete result is unavailable; see the retained disposition.';
 return [...new Set(codes.map(code=>Object.prototype.hasOwnProperty.call(reasons,code)?reasons[code]:'Another retained condition prevents a complete result; see the exact reasons'))].join('. ')+'.';
}

const comparisonFields:Readonly<Record<string,string>>={
 method:'method',newImplementation:'window implementation',legacyImplementation:'original execution implementation',
 clockMode:'receipt clock mode',market:'market',risk:'risk limits',costs:'cost assumptions',initialCapital:'initial capital',
 startsAt:'window dates',endsAt:'window dates',sourceMode:'observation source',policy:'sampling and valuation policy',
 sourceRequests:'source request policy',sourceAges:'quote age limits',schedule:'sampling schedule',resourceLimits:'resource bounds',
 observationPathDigest:'captured observations',acceptedQuotePathDigest:'accepted quote path',terminalMark:'terminal quote',markKeys:'valuation marks',
};

export function programWindowCompatibilitySummary(fields:readonly string[]){
 return [...new Set(fields.map(field=>Object.prototype.hasOwnProperty.call(comparisonFields,field)?comparisonFields[field]:'other comparison conditions'))].join(', ');
}
