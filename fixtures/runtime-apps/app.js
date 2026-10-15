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
