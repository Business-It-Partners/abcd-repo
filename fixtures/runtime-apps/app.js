const title=document.querySelector('#title'),draft=document.querySelector('#draft'),modal=document.querySelector('#modal');
title.textContent=`Sample ${location.hostname}`;
let dirty=false;
function report(){window.dentalApp.report({dirty,modal:!modal.hidden});}
document.querySelector('#security').textContent=`Node: ${typeof window.require}; shell bridge: ${typeof window.desktop}`;
draft.addEventListener('input',()=>{dirty=true;report();});
document.querySelector('#save').onclick=()=>{localStorage.setItem('sample',draft.value);document.querySelector('#saved').textContent='Saved in this runtime only';dirty=false;report();};
document.querySelector('#dialog').onclick=()=>{modal.hidden=false;document.querySelector('#content').inert=true;report();document.querySelector('#dismiss').focus();};
document.querySelector('#dismiss').onclick=()=>{modal.hidden=true;document.querySelector('#content').inert=false;report();draft.focus();};
report();

document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){e.preventDefault();document.querySelector('#dismiss').click();}else if(e.key==='Tab'){e.preventDefault();document.querySelector('#dismiss').focus();}});

let connection, grantWrite=false, records=[], selected, frozenWrite, outcome='none';
const sdkResult=document.querySelector('#sdk-result'), summary=document.querySelector('#sdk-summary');
const day=document.querySelector('#sdk-date'), choice=document.querySelector('#sdk-appointment'), status=document.querySelector('#sdk-status');
function controls(){const unresolved=outcome==='pending'||outcome==='unknown';day.disabled=choice.disabled=status.disabled=unresolved;document.querySelector('#sdk-reconcile').hidden=outcome!=='unknown';document.querySelector('#sdk-new').disabled=outcome!=='complete';}
async function sdkCall(operation,input){
 sdkResult.textContent='Request pending…';
 const result=await window.dentalApp.request({version:1,...connection,requestId:crypto.randomUUID(),operation,input});
 sdkResult.textContent=JSON.stringify(result);return result;
}
function project(){choice.replaceChildren();for(const row of records){const option=document.createElement('option');option.value=row.appointmentId;option.textContent=`${row.patientName} · ${row.status} · revision ${row.rowVersion}`;choice.append(option);}if(selected)choice.value=selected.appointmentId;summary.textContent=selected?`${selected.patientName}: ${selected.status}, revision ${selected.rowVersion}`:'No appointments for this date.';}
document.querySelector('#sdk-connect').onclick=async()=>{
 const result=await window.dentalApp.connect({major:1,minor:0});
 if(result.ok){connection={connection:result.value.connection,generation:result.value.generation};grantWrite=result.value.capabilities.includes('appointments.setStatus');document.querySelector('#sdk-read').disabled=false;document.querySelector('#sdk-write').disabled=false;}
 sdkResult.textContent=result.ok?`SDK connected: ${result.value.appId}`:result.error.code;
};
document.querySelector('#sdk-read').onclick=async()=>{if(outcome==='pending'||outcome==='unknown'){summary.textContent='Check the pending change before selecting another record.';return;}const result=await sdkCall('appointments.list',{date:day.value});if(result.ok){records=result.value.appointments;selected=records[0];frozenWrite=undefined;outcome='none';project();controls();}};
choice.onchange=()=>{if(outcome==='pending'||outcome==='unknown')return;selected=records.find(r=>r.appointmentId===choice.value);frozenWrite=undefined;outcome='none';project();controls();};
status.onchange=()=>{if(outcome!=='pending'&&outcome!=='unknown'){frozenWrite=undefined;outcome='none';controls();}};
async function changeStatus(){
 if(outcome==='pending')return;
 if(!frozenWrite){if(!selected&&grantWrite){summary.textContent='Read and select an appointment first.';return;}frozenWrite={appointmentId:selected?.appointmentId??crypto.randomUUID(),status:status.value,expectedRowVersion:selected?.rowVersion??1,idempotencyKey:crypto.randomUUID()};}
 outcome='pending';controls();const result=await sdkCall('appointments.setStatus',frozenWrite);
 if(result.ok){selected=result.value.appointment;records=records.map(r=>r.appointmentId===selected.appointmentId?selected:r);outcome='complete';project();}
 else if(result.error.outcome==='unknown'){outcome='unknown';summary.textContent='The server may have saved the change. Check its result before closing; no automatic retry will run.';}
 else{outcome='none';frozenWrite=undefined;summary.textContent=result.error.code==='CONFLICT'?'This record changed. Read the day again before deciding.':result.error.message;}
 controls();
}
document.querySelector('#sdk-write').onclick=changeStatus;
document.querySelector('#sdk-reconcile').onclick=changeStatus;
document.querySelector('#sdk-new').onclick=()=>{if(outcome==='complete'){frozenWrite=undefined;outcome='none';controls();summary.textContent='Ready for a new deliberate change.';}};
