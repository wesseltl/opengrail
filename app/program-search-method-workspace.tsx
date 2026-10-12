'use client';

import {useState} from 'react';
import LegacyWorkspace from './program-search-workspace';
import DirectionWorkspace from './program-direction-search-workspace';

/** Changing method creates no conversion, write, execution or storage migration. */
export default function ProgramSearchMethodWorkspace({signedIn=false,onRules,initialMethod='LEGACY'}:{signedIn?:boolean;onRules?:()=>void;initialMethod?:'LEGACY'|'DIRECTION'}={}){
 const [method,setMethod]=useState(initialMethod);
 const rules=onRules??(()=>{window.location.href='/search';});
 return method==='DIRECTION'?<DirectionWorkspace signedIn={signedIn} onRules={rules} onLegacy={()=>setMethod('LEGACY')}/>:<LegacyWorkspace signedIn={signedIn} onRules={rules} onDirection={()=>setMethod('DIRECTION')}/>;
}
