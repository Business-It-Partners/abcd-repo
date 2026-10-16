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

let connection, operationKey;
const sdkResult=document.querySelector('#sdk-result');
async function sdkCall(operation,input){
 const result=await window.dentalApp.request({version:1,...connection,requestId:crypto.randomUUID(),operation,input});
 sdkResult.textContent=JSON.stringify(result);return result;
}
document.querySelector('#sdk-connect').onclick=async()=>{
 const result=await window.dentalApp.connect({major:1,minor:0});
 if(result.ok){connection={connection:result.value.connection,generation:result.value.generation};document.querySelector('#sdk-read').disabled=false;document.querySelector('#sdk-write').disabled=false;}
 sdkResult.textContent=result.ok?`SDK connected: ${result.value.appId}`:result.error.code;
};
document.querySelector('#sdk-read').onclick=()=>sdkCall('appointments.list',{date:'2026-10-16'});
document.querySelector('#sdk-write').onclick=()=>{operationKey??=crypto.randomUUID();return sdkCall('appointments.setStatus',{appointmentId:'11111111-1111-4111-8111-111111111111',status:'arrived',expectedRowVersion:1,idempotencyKey:operationKey});};
