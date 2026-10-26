import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SessionGeneration } from './SessionBoundary';
import { App } from './App';
import { BrandSplash } from './BrandSplash';
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LifeBuoy, LoaderCircle, LockKeyhole, Mail, Minus, ShieldCheck, X } from 'lucide-react';
import './IdentityGate.css';
import type { ClinicRole, SessionView } from '../electron/identity/contracts';

const brandMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;
const rememberEmailPreferenceKey = 'sajilo.identity.remember-email';
const rememberedEmailKey = 'sajilo.identity.email';

function readRememberEmailPreference() {
 try { return window.localStorage.getItem(rememberEmailPreferenceKey) !== 'off'; } catch { return true; }
}

function readRememberedEmail() {
 if (!readRememberEmailPreference()) return '';
 try {
  const value = window.localStorage.getItem(rememberedEmailKey) ?? '';
  return value.length <= 254 ? value : '';
 } catch { return ''; }
}

function persistEmailPreference(enabled: boolean, value: string) {
 try {
  window.localStorage.setItem(rememberEmailPreferenceKey, enabled ? 'on' : 'off');
  const email = value.trim();
  if (enabled && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) window.localStorage.setItem(rememberedEmailKey, email);
  else window.localStorage.removeItem(rememberedEmailKey);
 } catch { /* Remembering email is a convenience; sign-in still works without browser storage. */ }
}

function LoginClock() {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>window.clearInterval(timer);},[]);
 return <header className="identity-clock" aria-label="Local date and time">
  <p>{now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p>
  <time dateTime={now.toISOString()}>{now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false})}</time>
 </header>;
}

export function IdentityGate(){
 const [leaveConfirmationOpen,setLeaveConfirmationOpen]=useState(false);
 const [signOutConfirmationOpen,setSignOutConfirmationOpen]=useState(false);
 const [workspaceTarget,setWorkspaceTarget]=useState<ClinicRole|null>(null),[workspacePin,setWorkspacePin]=useState(''),[workspaceSwitchError,setWorkspaceSwitchError]=useState(''),[workspaceSwitchBusy,setWorkspaceSwitchBusy]=useState(false);
 const [workspaceSwitchingTarget,setWorkspaceSwitchingTarget]=useState<ClinicRole|null>(null);
 const [workspaceSwitchNotice,setWorkspaceSwitchNotice]=useState<string|null>(null);
 const [passwordVisible,setPasswordVisible]=useState(false);
 const [rememberEmail,setRememberEmail]=useState(readRememberEmailPreference);
 const rememberEmailRef=useRef(rememberEmail);
 const currentSessionRef=useRef<SessionView|undefined>(undefined);
 const lastReadySessionRef=useRef<SessionView|undefined>(undefined);
 const workspaceSwitchInFlightRef=useRef(false);
 const workspaceSwitchTargetRef=useRef<ClinicRole|null>(null);
 const workspaceSwitchStartGenerationRef=useRef<number>(-1);
 const [view,setView]=useState<SessionView>(),[email,setEmail]=useState(readRememberedEmail),[password,setPassword]=useState(''),[error,setError]=useState(''),[devLoginAvailable,setDevLoginAvailable]=useState(false),[startupMinimumElapsed,setStartupMinimumElapsed]=useState(false),[startupResolved,setStartupResolved]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setStartupMinimumElapsed(true),5000);return()=>window.clearTimeout(timer);},[]);
 useEffect(()=>{if(!workspaceSwitchNotice)return;const timer=window.setTimeout(()=>setWorkspaceSwitchNotice(null),5000);return()=>window.clearTimeout(timer);},[workspaceSwitchNotice]);
 function updateEmail(value: string) {setEmail(value);persistEmailPreference(rememberEmailRef.current,value);}
 function updateRememberEmail(enabled: boolean) {rememberEmailRef.current=enabled;setRememberEmail(enabled);persistEmailPreference(enabled,email);}
 useEffect(()=>{
  let mounted=true,revision=0;
  if(!window.desktop?.identity){setError('Sajilo Dental session is unavailable. Close and reopen the app.');setStartupResolved(true);return()=>{mounted=false;};}
  const receiveView=(value:SessionView)=>{
   currentSessionRef.current=value;
   if(value.phase==='ready'){
    lastReadySessionRef.current=value;
    if(workspaceSwitchInFlightRef.current&&value.role===workspaceSwitchTargetRef.current&&value.generation>workspaceSwitchStartGenerationRef.current){workspaceSwitchInFlightRef.current=false;workspaceSwitchTargetRef.current=null;setWorkspaceSwitchBusy(false);setWorkspaceSwitchingTarget(null);setWorkspaceTarget(null);setWorkspacePin('');setWorkspaceSwitchError('');setWorkspaceSwitchNotice(value.role[0].toLocaleUpperCase()+value.role.slice(1));}
   }else if(!workspaceSwitchInFlightRef.current){
    setWorkspaceTarget(null);setWorkspacePin('');setWorkspaceSwitchError('');setWorkspaceSwitchBusy(false);setWorkspaceSwitchingTarget(null);
   }
   setView(value);if(value.phase!=='restoring')setStartupResolved(true);setPassword('');
   if(!rememberEmailRef.current&&['locked','signed-out','expired'].includes(value.phase))setEmail('');
  };
  const unsubscribe=window.desktop?.identity.subscribe(value=>{revision++;if(mounted)receiveView(value);});
  const requested=revision;void window.desktop?.identity.view().then(value=>{if(mounted&&revision===requested)receiveView(value);}).catch(()=>{if(mounted){setError('Sajilo Dental session is unavailable. Close and reopen the app.');setStartupResolved(true);}});
  void window.desktop?.identity.devCredentialsAvailable().then(value=>{if(mounted)setDevLoginAvailable(value);}).catch(()=>{});
  return()=>{mounted=false;unsubscribe?.();};
 },[]);
 async function login(event:FormEvent){event.preventDefault();setError('');const input={email,password};setPassword('');setPasswordVisible(false);const result=await window.desktop?.identity.action('login',input);if(!result?.ok)setError(result?.code==='DENIED'?'Sign-in or clinic access denied.':result?.code==='BUSY'?'A sign-in request is already running.':'Staging sign-in is unavailable. Please try again.');}
 async function retryRestore(){setError('');const result=await window.desktop?.identity.action('restore');if(!result?.ok&&result?.code==='BUSY')setError('A saved-session check is already running.');}
 async function fillDevelopmentLogin(){setError('');const credentials=await window.desktop?.identity.devCredentials().catch(()=>undefined);if(!credentials){setDevLoginAvailable(false);setError('Development sign-in details are unavailable.');return;}updateEmail(credentials.email);setPassword(credentials.password);}
 const desktopSession=view?.phase==='ready'?view:workspaceSwitchBusy&&lastReadySessionRef.current?.phase==='ready'?lastReadySessionRef.current:undefined;
 const availableWorkspaceRoles=(desktopSession?.workspaceRoles??[]).filter(role=>role!==desktopSession?.role);
 const roleControls=desktopSession?.phase==='ready'&&desktopSession.mode!=='demo-fixture'&&<div className="workspace-role-actions" role="group" aria-label="Available clinic workspaces">
  {availableWorkspaceRoles.length?availableWorkspaceRoles.map(role=><button key={role} type="button" onClick={()=>{setWorkspaceTarget(role);setWorkspacePin('');setWorkspaceSwitchError('');}}><span>Switch to {role[0].toUpperCase()+role.slice(1)}</span></button>):<span className="workspace-role-current">{desktopSession.role[0]?.toUpperCase()+desktopSession.role.slice(1)} workspace</span>}
 </div>;
 const workspaceNeedsAdminPin=workspaceTarget==='admin';
 if(!startupMinimumElapsed||!startupResolved)return <BrandSplash stage={!startupResolved?'checking':error?'unavailable':view?.phase==='ready'?'workspace':'sign-in'}/>;
 if(desktopSession?.phase==='ready')return <>
  <SessionGeneration.Provider value={desktopSession.generation}><App key={desktopSession.generation} session={desktopSession} leaveConfirmationOpen={leaveConfirmationOpen||signOutConfirmationOpen||!!workspaceTarget||workspaceSwitchBusy} onRequestClose={()=>setLeaveConfirmationOpen(true)} onRequestLock={desktopSession.mode!=='demo-fixture'?()=>void window.desktop?.identity.action('lock'):undefined} onRequestSignOut={desktopSession.mode!=='demo-fixture'?()=>setSignOutConfirmationOpen(true):undefined} roleControls={roleControls}/></SessionGeneration.Provider>
  {workspaceSwitchBusy&&<div className="workspace-switching-backdrop" role="status" aria-live="polite" aria-label={`Switching to the ${workspaceSwitchingTarget??'selected'} workspace`}>
   <section className="workspace-switching-card">
    <img src={brandMark} alt=""/>
    <LoaderCircle className="identity-spinner workspace-switching-spinner" size={24} aria-hidden="true"/>
    <div><h2>Switching workspace</h2><p>Opening the {workspaceSwitchingTarget??'selected'} workspace…</p><span>Refreshing secure workspace access.</span></div>
   </section>
  </div>}
  {workspaceSwitchNotice&&<div className="workspace-switch-success" role="status" aria-live="polite" aria-label={`${workspaceSwitchNotice} workspace is active`}>
   <CheckCircle2 className="workspace-switch-success-icon" size={22} aria-hidden="true"/>
   <div><strong>{workspaceSwitchNotice} workspace is active</strong><span>You're all set. Enjoy your day!</span></div>
   <button type="button" aria-label="Dismiss workspace ready message" title="Dismiss" onClick={()=>setWorkspaceSwitchNotice(null)}><X size={15} aria-hidden="true"/></button>
  </div>}
  {leaveConfirmationOpen&&<LeaveConfirmationDialog onCancel={()=>setLeaveConfirmationOpen(false)} onConfirm={()=>void window.desktop?.control('close')}/>}
  {signOutConfirmationOpen&&<LeaveConfirmationDialog title="Sign out of Sajilo Dental?" detail="You will return to the sign-in screen." confirmLabel="Sign out" onCancel={()=>setSignOutConfirmationOpen(false)} onConfirm={()=>{setSignOutConfirmationOpen(false);void window.desktop?.identity.action('logout');}}/>}
  {workspaceTarget&&<LeaveConfirmationDialog title={`Switch to the ${workspaceTarget[0].toUpperCase()+workspaceTarget.slice(1)} workspace?`} detail="Open apps will close when the role changes. Save unfinished work first; unsaved changes will be discarded." confirmLabel={workspaceNeedsAdminPin?'Switch to Admin':'Switch workspace'} confirmDisabled={workspaceNeedsAdminPin&&workspacePin.length!==4} error={workspaceSwitchError} dismissOnBackdrop onCancel={()=>{setWorkspaceTarget(null);setWorkspacePin('');setWorkspaceSwitchError('');}} onConfirm={async()=>{
   const target=workspaceTarget;
   if(!target||workspaceSwitchInFlightRef.current)return;
   setWorkspaceSwitchError('');setWorkspaceSwitchNotice(null);setWorkspaceSwitchBusy(true);setWorkspaceSwitchingTarget(target);setWorkspaceTarget(null);setWorkspacePin('');workspaceSwitchInFlightRef.current=true;workspaceSwitchTargetRef.current=target;workspaceSwitchStartGenerationRef.current=currentSessionRef.current?.generation??lastReadySessionRef.current?.generation??-1;
   let switchFailed=false,failureCode:string|undefined;
   try{const result=await window.desktop?.identity.action('workspace-role',{role:target,...(target==='admin'?{pin:workspacePin}:{})});if(!result?.ok){switchFailed=true;failureCode=result?.code;}}
   catch{switchFailed=true;}
   if(switchFailed){
    workspaceSwitchInFlightRef.current=false;workspaceSwitchTargetRef.current=null;setWorkspaceSwitchBusy(false);setWorkspaceSwitchingTarget(null);
    if(currentSessionRef.current?.phase==='ready'){
     setWorkspaceTarget(target);setWorkspaceSwitchError(failureCode==='BUSY'?'A clinic save is still in progress. Wait for it to finish, then switch roles.':failureCode==='DENIED'?'The role or PIN was rejected. Check your access and try again.':'Workspace access could not be verified. Please try again.');
    }else{setWorkspaceTarget(null);setWorkspacePin('');setWorkspaceSwitchError('');}
    return;
   }
   setWorkspacePin('');
  }}>
   {workspaceNeedsAdminPin&&<div className="workspace-role-pin-fields"><label htmlFor="workspace-admin-pin">Admin PIN<input id="workspace-admin-pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} value={workspacePin} onChange={event=>setWorkspacePin(event.target.value.replace(/\D/g,'').slice(0,4))} aria-label="Four-digit Admin PIN"/></label></div>}
  </LeaveConfirmationDialog>}
 </>;
 const busy=!view||view.phase==='restoring'||view.phase==='signing-in';
 return (
  <>
  <main className="identity-gate sajilo-startup-surface" data-session-phase={view?.phase??'loading'} inert={leaveConfirmationOpen}>
   <div className="identity-backdrop" aria-hidden="true">
    <div className="brand-splash__ambient"/>
    <div className="brand-splash__flow brand-splash__flow--near"/>
    <div className="brand-splash__flow brand-splash__flow--far"/>
   </div>
   <div className="identity-window-controls" role="group" aria-label="Window controls">
    <button type="button" aria-label="Minimize Sajilo Dental" title="Minimize" onClick={()=>void window.desktop?.control('minimize')}><Minus size={17} strokeWidth={1.8} aria-hidden="true"/></button>
    <button className="identity-window-close" type="button" aria-label="Close Sajilo Dental" title="Close" onClick={()=>setLeaveConfirmationOpen(true)}><X size={17} strokeWidth={1.8} aria-hidden="true"/></button>
   </div>
   <div className="identity-brand" aria-hidden="true">Sajilo <span>Dental</span></div>
   <LoginClock/>
   <div className="identity-center">
    <section className="identity-card" aria-labelledby="identity-heading">
     <img className="identity-mark" src={brandMark} alt="Sajilo Dental"/>
     <h1 id="identity-heading">{view?.phase==='locked'?'Session locked':'Sign in to your clinic'}</h1>
     <p className="identity-intro">{view?.phase==='locked'?'Sign in again to unlock your workspace.':'Your clinic. Your workspace.'}</p>
     {view?.message&&<p className="identity-message" role="status">{view.message}</p>}
     {error&&<p className="identity-error" role="alert">{error}</p>}
     <form onSubmit={login} autoComplete="off" aria-label="Clinic sign-in" aria-busy={busy}>
      <label className="identity-field" htmlFor="clinic-email"><span>Email</span>
       <span className="identity-input"><Mail size={16} aria-hidden="true"/><input id="clinic-email" type="email" value={email} onChange={e=>updateEmail(e.target.value)} placeholder="Your clinic email" required maxLength={254} autoComplete="off" spellCheck={false} autoCapitalize="none" disabled={busy}/></span>
      </label>
      <label className="identity-field" htmlFor="clinic-password"><span>Password</span></label>
      <div className="identity-input identity-password"><LockKeyhole size={16} aria-hidden="true"/>
       <input id="clinic-password" type={passwordVisible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required maxLength={1024} autoComplete="off" disabled={busy}/>
       <button className="identity-reveal" type="button" aria-label={passwordVisible?'Hide password':'Show password'} aria-pressed={passwordVisible} disabled={busy} onClick={()=>setPasswordVisible(value=>!value)}>{passwordVisible?<EyeOff size={16} aria-hidden="true"/>:<Eye size={16} aria-hidden="true"/>}</button>
      </div>
      <label className="identity-remember"><input type="checkbox" checked={rememberEmail} onChange={e=>updateRememberEmail(e.target.checked)} disabled={busy}/><span>Remember me</span></label>
      <button className="identity-submit" type="submit" disabled={busy}><span>{busy?'Please wait…':'Sign in'}</span>{busy?<LoaderCircle className="identity-spinner" size={17} aria-hidden="true"/>:<ArrowRight size={17} aria-hidden="true"/>}</button>
      {devLoginAvailable&&<button className="identity-development" type="button" disabled={busy} onClick={()=>void fillDevelopmentLogin()}>Fill development sign-in</button>}
     </form>
     {(view?.phase==='unavailable'||view?.phase==='restoring'||view?.restoreAvailable)&&<button className="identity-retry" type="button" onClick={()=>void retryRestore()} disabled={busy} aria-busy={view?.phase==='restoring'}>{view?.phase==='restoring'?'Checking saved session…':'Retry saved session'}</button>}
     <p className="identity-note"><ShieldCheck size={14} aria-hidden="true"/><span>{rememberEmail?'Your email is remembered on this device. Sign out clears the secure session, not this email.':'Your email is not remembered. Secure session restore uses protected storage separately.'}</span></p>
    </section>
   </div>
   <footer className="identity-utilities" aria-label="Workspace options">
    <button type="button" onClick={()=>void window.desktop?.support()}><span className="identity-utility-icon"><LifeBuoy size={19} aria-hidden="true"/></span><span>Support diagnostics</span></button>
   </footer>
  </main>
  {leaveConfirmationOpen&&<LeaveConfirmationDialog onCancel={()=>setLeaveConfirmationOpen(false)} onConfirm={()=>void window.desktop?.control('close')}/>}
  </>
 );
}
