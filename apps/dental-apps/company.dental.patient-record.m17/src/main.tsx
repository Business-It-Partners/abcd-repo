import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicClient, ClinicCommand, ClinicError } from "../../../../packages/app-sdk/src/clinicClient";
import type { ClinicSessionContext, AppSdk } from "../../../../electron/sdk/contracts";
import { APP_ID, PatientApi, PatientMediaSdk, readable, isUnknown } from "./api";
import { SaaSPatientDirectory } from "./saasDirectory";
import { SaaSPatientDetail } from "./saasPatientDetail";
import { SaaSPatientIntake } from "./saasPatientIntake";
import { ClinicPageRefreshAction, ClinicPageRefreshProvider } from "@/shared/ui/ClinicPageRefresh";
import { ClinicSnackbarProvider } from "@/shared/ui/ClinicSnackbar";
import { ClinicLoadingProvider } from "@/shared/ui/ClinicLoadingOverlay";
import { SnackbarProvider } from "@/shared/ui/SnackbarProvider";
import "../vendor/dental-saas/apps/clinic-web/src/app/globals.css";
import "./saasAdapter.css";

type Screen = {mode:"directory"} | {mode:"intake"} | {mode:"detail";patientId:string};
type Pending = {label:string; retry:()=>Promise<void>};
export type AppStore = {
  api:PatientApi; media:PatientMediaSdk; session:ClinicSessionContext;
  busy:string; pending:boolean; capabilities:Set<string>;
  run:<T,>(label:string, cmd:ClinicCommand<T>, done:(value:T)=>void|Promise<void>)=>Promise<void>;
  dirty:(key:string, value:boolean)=>void;
  go:(screen:Screen)=>boolean;
  refreshDirectory:()=>void;
};
const Context=createContext<AppStore|null>(null);
export function useApp() {const ctx=useContext(Context);if(!ctx)throw new Error("Patient Record is not connected to Dental OS.");return ctx;}
export function errorText(e:unknown) {
  if(e instanceof ClinicError) {
    if(e.code==="CONFLICT")return "This record changed on the server. Refresh the record before editing it again.";
    if(e.code==="FORBIDDEN"||e.code==="ACCESS_DENIED")return "Your current clinic role cannot perform this action.";
    if(e.code==="AUTH_REQUIRED"||e.code==="STALE_SESSION")return "The clinic session changed. Reopen Patient Record.";
    if(isUnknown(e))return "The save may have reached the clinic. Retry the original action using the same operation key.";
  }
  return readable(e);
}
export function Empty({children}:{children:React.ReactNode}) {return <div className="prEmpty">{children}</div>;}
export function Alert({children}:{children:React.ReactNode}) {return <p className="prAlert" role="alert">{children}</p>;}
export function FormField({label,children,help}:{label:string;children:React.ReactNode;help?:string}) {
  return <label className="prField"><span>{label}</span>{children}{help&&<small>{help}</small>}</label>;
}
export function dateLabel(value:string|null|undefined) {if(!value)return "—";const d=new Date(value.slice(0,10)+"T12:00:00Z");return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("en-NP",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(d);}
export function currency(amount:number) {return new Intl.NumberFormat("en-NP",{style:"currency",currency:"NPR",maximumFractionDigits:2}).format(amount);}
export function useDraft(key:string, dirty:boolean) {
  const {dirty:register}=useApp();
  useEffect(()=>{register(key,dirty);return ()=>register(key,false);},[key,dirty,register]);
}
function Main() {
  const [ready,setReady]=useState(false),[openingError,setOpeningError]=useState("");
  const [session,setSession]=useState<ClinicSessionContext|null>(null);
  const [screen,setScreen]=useState<Screen>({mode:"directory"});
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const [reconcileError,setReconcileError]=useState("");
  const dirtyKeys=useRef(new Set<string>()),lock=useRef(false),currentPending=useRef<Pending|null>(null);
  const client=useRef<ClinicClient|null>(null),alive=useRef(true);
  const [api,setApi]=useState<PatientApi|null>(null),[media,setMedia]=useState<PatientMediaSdk|null>(null);
  const report=useCallback(()=>{
    client.current?.report({dirty:dirtyKeys.current.size>0||lock.current||!!currentPending.current,
      modal:!!document.querySelector("[role='dialog'][aria-modal='true']")});
  },[]);
  const dirty=useCallback((key:string,value:boolean)=>{if(value)dirtyKeys.current.add(key);else dirtyKeys.current.delete(key);report();},[report]);
  const go=useCallback((next:Screen)=>{
    if(dirtyKeys.current.size||lock.current||currentPending.current){
      return false;
    }
    setScreen(next);return true;
  },[]);
  const run=useCallback(async<T,>(label:string,cmd:ClinicCommand<T>,done:(value:T)=>void|Promise<void>)=>{
    if(currentPending.current||lock.current)throw new ClinicError("BUSY","Finish or reconcile the previous save first.");
    lock.current=true;setBusy(label);setReconcileError("");report();
    try{
      const value=await cmd.execute();
      if(!alive.current)throw new ClinicError("STALE_SESSION","The clinic session changed. Reopen Patient Record.");
      await done(value);
    }catch(e){
      if(isUnknown(e)&&alive.current){
        const retry=async()=>{const result=await cmd.execute();if(!alive.current)throw new ClinicError("STALE_SESSION","Clinic session changed.");await done(result);};
        const record={label,retry};currentPending.current=record;setPending(record);
      }
      throw e;
    }finally{lock.current=false;setBusy("");report();}
  },[report]);
  useEffect(()=>{
    alive.current=true;
    if(!window.dentalApp){setOpeningError("Open Patient Record from Dental OS.");return;}
    let active=true;
    const bridge=window.dentalApp;
    const sdk=new ClinicClient(bridge,()=>{
      alive.current=false;dirtyKeys.current.clear();currentPending.current=null;
      if(active){setReady(false);setSession(null);setScreen({mode:"directory"});
        setOpeningError("The clinic session changed. Reopen Patient Record from Dental OS.");}
    });
    client.current=sdk;
    const unsub=sdk.onModuleSelected(({moduleId})=>{
      if(moduleId!=="patient-record"&&active)setOpeningError("The selected module is not part of Patient Record.");
    });
    void sdk.initialize(APP_ID).then(({session:ctx})=>{
      if(!ctx.clinicUser.capabilities.includes("patient_record.access"))
        throw new ClinicError("FORBIDDEN","Patient Record is unavailable for this clinic role.");
      if(!active)return;
      setSession(ctx);setApi(new PatientApi(sdk));setMedia(new PatientMediaSdk(bridge));
      setReady(true);setOpeningError("");
    }).catch(e=>{if(active)setOpeningError(errorText(e));});
    const observer=new MutationObserver(report);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>{active=false;alive.current=false;unsub();observer.disconnect();dirtyKeys.current.clear();
      currentPending.current=null;sdk.report({dirty:false,modal:false});client.current=null;};
  },[report]);
  const retry=useCallback(async()=>{
    const record=currentPending.current;if(!record)return;setBusy("Checking original save");setReconcileError("");lock.current=true;report();
    try{await record.retry();currentPending.current=null;setPending(null);setRevision(v=>v+1);}
    catch(e){setReconcileError(errorText(e));}
    finally{lock.current=false;setBusy("");report();}
  },[report]);
  const store=useMemo<AppStore|null>(()=>api&&media&&session?{
    api,media,session,busy,pending:!!pending,capabilities:new Set(session.clinicUser.capabilities),
    run,dirty,go,refreshDirectory:()=>setRevision(v=>v+1)
  }:null,[api,media,session,busy,pending,run,dirty,go]);
  if(openingError)return <main className="saasAdapterMessage" role="alert"><h1>Patient Record unavailable</h1><p>{openingError}</p></main>;
  if(!ready||!store)return <main className="saasAdapterMessage" role="status">Opening Patient Record…</main>;
  return <ClinicSnackbarProvider><SnackbarProvider><ClinicLoadingProvider><ClinicPageRefreshProvider><Context.Provider value={store}>
    <main className="clinicApp">
      <section className="clinicWorkspaceCanvas" data-dental-os-app={APP_ID}>
        <ClinicPageRefreshAction />
        <div className="clinicCareWorkspace">
          {pending&&<section className="prWarning" role="alert"><strong>Uncertain save: {pending.label}</strong>
            <p>The clinic may have received this change. Do not submit it again as a new action. Only retry the original operation.</p>
            {reconcileError&&<Alert>{reconcileError}</Alert>}
            <button type="button" onClick={()=>void retry()} disabled={!!busy}>Retry original save</button></section>}
          {busy&&<p className="prBusy" role="status">{busy}…</p>}
          {screen.mode==="directory"&&<SaaSPatientDirectory key={revision} onOpenPatient={patientId=>go({mode:"detail",patientId})}
            onAddPatient={()=>go({mode:"intake"})}/>}
          {screen.mode==="intake"&&<SaaSPatientIntake onBack={()=>go({mode:"directory"})}
            onSaved={()=>setRevision(v=>v+1)}/>}
          {screen.mode==="detail"&&<SaaSPatientDetail key={screen.patientId+"-"+revision} patientId={screen.patientId}
            onBack={()=>{go({mode:"directory"});}}/>}
        </div>
        <ClinicPageRefreshAction placement="page-bottom" />
      </section>
    </main>
  </Context.Provider></ClinicPageRefreshProvider></ClinicLoadingProvider></SnackbarProvider></ClinicSnackbarProvider>;
}
declare global {interface Window {dentalApp?:AppSdk}}
createRoot(document.getElementById("root")!).render(<Main/>);
