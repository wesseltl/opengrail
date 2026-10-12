'use client';

import {useState} from 'react';
import LegacyWorkspace from './program-search-workspace';
import DirectionWorkspace from './program-direction-search-workspace';
import type {ProgramDirectionCohortReference} from './program-direction-cohort-link';

/** Changing method creates no conversion, write, execution or storage migration. */
export default function ProgramSearchMethodWorkspace({signedIn=false,onRules,initialMethod='LEGACY',initialStrategy}:{signedIn?:boolean;onRules?:()=>void;initialMethod?:'LEGACY'|'DIRECTION';initialStrategy?:ProgramDirectionCohortReference}={}){
 const [method,setMethod]=useState(initialMethod);
 const rules=onRules??(()=>{window.location.href='/search';});
 return method==='DIRECTION'?<DirectionWorkspace signedIn={signedIn} onRules={rules} onLegacy={()=>setMethod('LEGACY')} initialStrategy={initialStrategy}/>:<LegacyWorkspace signedIn={signedIn} onRules={rules} onDirection={()=>setMethod('DIRECTION')}/>;
}
