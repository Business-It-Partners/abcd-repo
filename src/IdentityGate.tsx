import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SessionGeneration } from './SessionBoundary';
import { App } from './App';
import { BrandSplash } from './BrandSplash';
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';
import { ArrowRight, Eye, EyeOff, LifeBuoy, LoaderCircle, LockKeyhole, Mail, Minus, ShieldCheck, X } from 'lucide-react';
import './IdentityGate.css';
import type { SessionView } from '../electron/identity/contracts';

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
 const [passwordVisible,setPasswordVisible]=useState(false);
 const [rememberEmail,setRememberEmail]=useState(readRememberEmailPreference);
 const rememberEmailRef=useRef(rememberEmail);
 const [view,setView]=useState<SessionView>(),[email,setEmail]=useState(readRememberedEmail),[password,setPassword]=useState(''),[error,setError]=useState(''),[devLoginAvailable,setDevLoginAvailable]=useState(false),[startupMinimumElapsed,setStartupMinimumElapsed]=useState(false),[startupResolved,setStartupResolved]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setStartupMinimumElapsed(true),5000);return()=>window.clearTimeout(timer);},[]);
 function updateEmail(value: string) {setEmail(value);persistEmailPreference(rememberEmailRef.current,value);}
 function updateRememberEmail(enabled: boolean) {rememberEmailRef.current=enabled;setRememberEmail(enabled);persistEmailPreference(enabled,email);}
 useEffect(()=>{
  let mounted=true,revision=0;
  if(!window.desktop?.identity){setError('Platform session is unavailable. Close and reopen Dental OS.');setStartupResolved(true);return()=>{mounted=false;};}
  const unsubscribe=window.desktop?.identity.subscribe(value=>{revision++;if(mounted){setView(value);if(value.phase!=='restoring')setStartupResolved(true);setPassword('');if(!rememberEmailRef.current&&['locked','signed-out','expired'].includes(value.phase)){setEmail('');}}});
  const requested=revision;void window.desktop?.identity.view().then(value=>{if(mounted&&revision===requested){setView(value);if(value.phase!=='restoring')setStartupResolved(true);}}).catch(()=>{if(mounted){setError('Platform session is unavailable. Close and reopen Dental OS.');setStartupResolved(true);}});
  void window.desktop?.identity.devCredentialsAvailable().then(value=>{if(mounted)setDevLoginAvailable(value);}).catch(()=>{});
  return()=>{mounted=false;unsubscribe?.();};
 },[]);
 async function login(event:FormEvent){event.preventDefault();setError('');const input={email,password};setPassword('');setPasswordVisible(false);const result=await window.desktop?.identity.action('login',input);if(!result?.ok)setError(result?.code==='DENIED'?'Sign-in or clinic access denied.':result?.code==='BUSY'?'A sign-in request is already running.':'Staging sign-in is unavailable. Please try again.');}
 async function fillDevelopmentLogin(){setError('');const credentials=await window.desktop?.identity.devCredentials().catch(()=>undefined);if(!credentials){setDevLoginAvailable(false);setError('Development sign-in details are unavailable.');return;}updateEmail(credentials.email);setPassword(credentials.password);}
 if(!startupMinimumElapsed||!startupResolved)return <BrandSplash stage={!startupResolved?'checking':error?'unavailable':view?.phase==='ready'?'workspace':'sign-in'}/>;
 if(view?.phase==='ready')return <>
  <SessionGeneration.Provider value={view.generation}><App key={view.generation} session={view} leaveConfirmationOpen={leaveConfirmationOpen||signOutConfirmationOpen} onRequestClose={()=>setLeaveConfirmationOpen(true)} onRequestSignOut={view.mode!=='demo-fixture'?()=>setSignOutConfirmationOpen(true):undefined} sessionControls={view.mode!=='demo-fixture'&&<div className="identity-menu-actions" role="group" aria-label="Session controls"><button onClick={()=>void window.desktop?.support()}>Support diagnostics</button><button onClick={()=>void window.desktop?.identity.action('lock')}>Lock</button><button onClick={()=>void window.desktop?.identity.action('logout')}>Switch account</button><button onClick={()=>setSignOutConfirmationOpen(true)}>Sign out</button></div>}/></SessionGeneration.Provider>
  {leaveConfirmationOpen&&<LeaveConfirmationDialog onCancel={()=>setLeaveConfirmationOpen(false)} onConfirm={()=>void window.desktop?.control('close')}/>}
  {signOutConfirmationOpen&&<LeaveConfirmationDialog title="Sign out of Sajilo Dental?" detail="You will return to the sign-in screen." confirmLabel="Sign out" onCancel={()=>setSignOutConfirmationOpen(false)} onConfirm={()=>{setSignOutConfirmationOpen(false);void window.desktop?.identity.action('logout');}}/>}
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
