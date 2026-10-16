import type { Operation } from '../sdk/contracts';
import type { Identity } from '../sdk/broker';
import { AuthFailure, type AuthClient, type Clinic, type Tokens } from './client';
import { loginInput, type ActionResult, type Phase, type SessionView } from './contracts';
import type { CredentialStore } from './storage';
/** One platform-owned clinic session. Only view() crosses shell IPC. */
export class SessionManager implements Identity {
  private phase:Phase='restoring'; private generation=1; private tokens?:Tokens; private clinic?:Clinic;
  private message=''; private remembered=false; private busy=false; private timer?:ReturnType<typeof setTimeout>;
  private accessCheck?:Promise<void>; private action?:AbortController; private renewal?:Promise<string>; private listeners=new Set<(v:SessionView)=>void>();
  private storageChain:Promise<unknown>=Promise.resolve();
  constructor(private client:AuthClient,private store:CredentialStore,private invalidate:()=>void,private mode:'staging'|'fixture'='staging',private now=Date.now,private timeoutMs=8000){}
  view():SessionView{return{phase:this.phase,generation:this.generation,userLabel:this.phase==='ready'?this.clinic?.userLabel??'':'',clinicLabel:this.phase==='ready'?this.clinic?.clinicLabel??'':'',role:this.phase==='ready'?this.clinic?.role??'':'',rememberAvailable:this.store.available(),remembered:this.remembered,message:this.message,mode:this.mode};}
  snapshot(){return{generation:this.generation,active:this.phase==='ready',userLabel:this.phase==='ready'?this.clinic?.userLabel??'':'',clinicLabel:this.phase==='ready'?this.clinic?.clinicLabel??'':''};}
  subscribe(listener:(v:SessionView)=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  private emit(){const v=this.view();for(const fn of this.listeners)fn(v);}
  private persist<T>(fn:()=>Promise<T>):Promise<T>{const next=this.storageChain.then(fn,fn);this.storageChain=next.catch(()=>{});return next;}
  private reset(phase:Phase,message=''){
    this.generation++;this.renewal=undefined;this.accessCheck=undefined;this.phase=phase;this.message=message;this.tokens=undefined;this.clinic=undefined;this.remembered=false;
    clearTimeout(this.timer);this.action?.abort();this.invalidate();this.emit();
  }
  private async bounded<T>(fn:(signal:AbortSignal)=>Promise<T>):Promise<T>{
    const controller=new AbortController();this.action=controller;
    let timeout:ReturnType<typeof setTimeout>|undefined;
    const stopped=new Promise<never>((_resolve,reject)=>{controller.signal.addEventListener('abort',()=>reject(new AuthFailure('unavailable')),{once:true});timeout=setTimeout(()=>controller.abort(),this.timeoutMs);});
    try{return await Promise.race([Promise.resolve().then(()=>fn(controller.signal)),stopped]);}
    finally{clearTimeout(timeout);if(this.action===controller)this.action=undefined;}
  }
  private schedule(){clearTimeout(this.timer);if(this.tokens)this.timer=setTimeout(()=>void this.refreshNow().catch(()=>{}),Math.max(1000,this.tokens.expiresAt-this.now()-60_000));}
  private async install(tokens:Tokens,clinic:Clinic,epoch:number,remember:boolean){
    if(epoch!==this.generation)throw new Error('Stale');
    let remembered=false,warning='';
    if(remember&&this.store.available()){
      try{await this.persist(()=>this.store.save(tokens.refreshToken));remembered=true;}
      catch{warning='Protected storage unavailable. This login is session-only.';if(epoch===this.generation)await this.persist(()=>this.store.clear()).catch(()=>{});}
    }else if(remember)warning='Protected storage unavailable. This login is session-only.';
    if(epoch!==this.generation)throw new Error('Stale');
    this.remembered=remembered;if(warning)this.message=warning;this.tokens=tokens;this.clinic=clinic;this.phase='ready';this.schedule();this.emit();
  }
  async restore():Promise<ActionResult>{
    const epoch=this.generation;this.busy=true;
    try{
      const token=await this.persist(()=>this.store.load());
      if(epoch!==this.generation)return{ok:false,code:'STALE'};
      if(!token){this.phase='signed-out';this.message=this.store.available()?'':'Protected storage unavailable. Sign in for this session only.';this.emit();return{ok:true};}
      const {tokens,clinic}=await this.bounded(async signal=>{const tokens=await this.client.refresh(token,signal);const clinic=await this.client.resolve(tokens.idToken,signal);return{tokens,clinic};});
      await this.install(tokens,clinic,epoch,true);return{ok:true};
    }catch(error){if(epoch!==this.generation)return{ok:false,code:'STALE'};this.reset(error instanceof AuthFailure&&error.kind==='denied'?'expired':'signed-out','Saved session could not be restored. Sign in again.');await this.persist(()=>this.store.clear()).catch(()=>{});return{ok:false,code:error instanceof AuthFailure&&error.kind==='denied'?'DENIED':'STORAGE_UNAVAILABLE'};}
    finally{this.busy=false;}
  }
  async login(input:unknown):Promise<ActionResult>{
    if(!loginInput(input))return{ok:false,code:'INVALID_INPUT'};
    if(this.busy)return{ok:false,code:'BUSY'};this.busy=true;this.reset('signing-in');const epoch=this.generation;
    try{
      await this.persist(()=>this.store.clear());
      const {tokens,clinic}=await this.bounded(async signal=>{const tokens=await this.client.signIn(input.email,input.password,signal);const clinic=await this.client.resolve(tokens.idToken,signal);return{tokens,clinic};});
      await this.install(tokens,clinic,epoch,input.remember);return{ok:true};
    }catch(error){if(epoch!==this.generation)return{ok:false,code:'STALE'};const denied=error instanceof AuthFailure&&error.kind==='denied';this.reset(denied?'signed-out':'unavailable',denied?'Sign-in or clinic access denied.':'Staging sign-in is unavailable. Retry when connected.');return{ok:false,code:denied?'DENIED':'UNAVAILABLE'};}
    finally{this.busy=false;}
  }
  credential(generation:number,_signal:AbortSignal):Promise<string>{
    if(generation!==this.generation||this.phase!=='ready'||!this.tokens)return Promise.reject(new AuthFailure('denied'));
    return this.tokens.expiresAt-this.now()>60_000?Promise.resolve(this.tokens.idToken):this.refreshNow();
  }
  refreshNow():Promise<string>{
    if(this.renewal)return this.renewal;
    if(this.phase!=='ready'||!this.tokens)return Promise.reject(new AuthFailure('denied'));
    const epoch=this.generation,old=this.tokens,priorClinic=this.clinic!,remember=this.remembered;
    const run=async()=>{
      try{
        const {tokens,clinic}=await this.bounded(async signal=>{const tokens=await this.client.refresh(old.refreshToken,signal);if(tokens.uid!==old.uid)throw new AuthFailure('denied');const clinic=await this.client.resolve(tokens.idToken,signal);return{tokens,clinic};});
        if(epoch!==this.generation)throw new Error('Stale');
        if(JSON.stringify(clinic)!==JSON.stringify(priorClinic)){
          this.reset('signing-in','Clinic access changed. Workspaces were cleared.');await this.install(tokens,clinic,this.generation,remember);throw new AuthFailure('denied');
        }
        await this.install(tokens,clinic,epoch,remember);return tokens.idToken;
      }catch(error){if(epoch===this.generation){this.reset(error instanceof AuthFailure&&error.kind==='denied'?'expired':'unavailable','Session expired or access could not be verified. Sign in again.');await this.persist(()=>this.store.clear()).catch(()=>{});}throw error;}
    };
    const promise=run();this.renewal=promise;void promise.finally(()=>{if(this.renewal===promise)this.renewal=undefined;}).catch(()=>{});return promise;
  }
  lock(){if(this.phase!=='ready')return;this.reset('locked','Session locked. Sign in to continue. In-memory workspaces were cleared.');void this.persist(()=>this.store.clear()).catch(()=>{});}
  async logout():Promise<ActionResult>{this.reset('signed-out','Signed out. In-memory workspaces were cleared.');try{await this.persist(()=>this.store.clear());return{ok:true};}catch{this.message='Signed out locally, but protected storage could not be cleared. Contact support before sharing this device.';this.emit();return{ok:false,code:'STORAGE_UNAVAILABLE'};}}
  async rejected(status:401|403):Promise<void>{
    if(this.phase!=='ready'||!this.tokens)return;
    if(status===401){this.reset('expired','Session access was revoked. Sign in again.');await this.persist(()=>this.store.clear()).catch(()=>{});return;}
    // An operation-level 403 is not proof that the entire clinic session was revoked.
    // Re-resolve /v1/me once; deny/changed membership clears all old workspaces.
    if(this.accessCheck)return this.accessCheck;
    if(this.renewal){await this.renewal.catch(()=>{});return;}
    const epoch=this.generation,tokens=this.tokens,prior=this.clinic,remember=this.remembered;
    const run=async()=>{try{
      const clinic=await this.bounded(signal=>this.client.resolve(tokens.idToken,signal));
      if(epoch!==this.generation)return;
      if(JSON.stringify(clinic)!==JSON.stringify(prior)){this.reset('signing-in','Clinic access changed. Workspaces were cleared.');await this.install(tokens,clinic,this.generation,remember);}
    }catch(error){if(epoch===this.generation){this.reset(error instanceof AuthFailure&&error.kind==='denied'?'expired':'unavailable','Clinic access could not be verified. Sign in again.');await this.persist(()=>this.store.clear()).catch(()=>{});}}};
    const promise=run();this.accessCheck=promise;try{await promise;}finally{if(this.accessCheck===promise)this.accessCheck=undefined;}
  }
  allowed(operation:Operation){return this.phase==='ready'&&(!operation.startsWith('appointments.')||!!this.clinic?.capabilities.includes('appointments.access'));}
  flush(){return this.storageChain;}
  dispose(){this.generation++;this.phase='signed-out';clearTimeout(this.timer);this.action?.abort();this.tokens=undefined;this.clinic=undefined;this.listeners.clear();}
}
