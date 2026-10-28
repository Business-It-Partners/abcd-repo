import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../../packages/dental-ui/src/shared/standard-app-page.css";
import { BrowserClinicClient, ClinicCommand, ClinicError, type BrowserClinicSessionContext } from "../../../clinic-app-runtime/browserClinicClient";
import { connectBrowserRuntime } from "../../../clinic-app-runtime/runtimeBridge";
import type { BrowserAppHistoryContract } from "../../../clinic-app-runtime/appHistory";
import { APP_ID, PatientApi, PatientMediaSdk, readable, isUnknown } from "./api";
import { SaaSPatientDirectory } from "./saasDirectory";
import { SaaSPatientDetail } from "./saasPatientDetail";
import { SaaSPatientIntake } from "./saasPatientIntake";
import { ClinicPageRefreshAction, ClinicPageRefreshProvider } from "@/shared/ui/ClinicPageRefresh";
import { ClinicSnackbarProvider, useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import { ClinicLoadingProvider } from "@/shared/ui/ClinicLoadingOverlay";
import { SnackbarProvider } from "@/shared/ui/SnackbarProvider";
import type { PatientDetail as PatientViewModel } from "@/features/patients/model/domain";
import "../vendor/dental-saas/apps/clinic-web/src/app/globals.css";
import "./saasAdapter.css";

type Screen = {mode:"directory"} | {mode:"intake"} | {mode:"detail";patientId:string;initialPatient?:PatientViewModel};
type Pending = {label:string; retry:()=>Promise<void>};
type ClinicSessionContext = BrowserClinicSessionContext;
export type AppStore = {
  api:PatientApi; media:PatientMediaSdk; session:ClinicSessionContext;
  busy:string; pending:boolean; capabilities:Set<string>;
  run:<T,>(label:string, cmd:ClinicCommand<T>, done:(value:T)=>void|Promise<void>)=>Promise<void>;
  dirty:(key:string, value:boolean)=>void;
  go:(screen:Screen)=>boolean;
  refreshDirectory:()=>void;
};
const Context=createContext<AppStore|null>(null);
const browserRuntime=connectBrowserRuntime();
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
function PatientRecordWorkspace() {
  const [ready,setReady]=useState(false),[openingError,setOpeningError]=useState("");
  const [session,setSession]=useState<ClinicSessionContext|null>(null);
  const [screen,setScreen]=useState<Screen>({mode:"directory"});
  const screenRef=useRef<Screen>({mode:"directory"});screenRef.current=screen;
  const navigation=useRef<BrowserAppHistoryContract<Screen>|null>(null);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const [reconcileError,setReconcileError]=useState("");
  const dirtyKeys=useRef(new Set<string>()),lock=useRef(false),currentPending=useRef<Pending|null>(null);
  const client=useRef<BrowserClinicClient|null>(null),alive=useRef(true);
  const [api,setApi]=useState<PatientApi|null>(null),[media,setMedia]=useState<PatientMediaSdk|null>(null);
  const {showLoading,showSuccess,showError}=useClinicSnackbar();
  const report=useCallback(()=>{
    client.current?.report({dirty:dirtyKeys.current.size>0||lock.current||!!currentPending.current||screenRef.current.mode==="intake",
      modal:!!document.querySelector("[role='dialog'][aria-modal='true']")});
  },[]);
  const dirty=useCallback((key:string,value:boolean)=>{if(value)dirtyKeys.current.add(key);else dirtyKeys.current.delete(key);report();},[report]);
  const go=useCallback((next:Screen)=>{
    if(dirtyKeys.current.size||lock.current||currentPending.current){
      return false;
    }
    const history=navigation.current;if(!history)return false;
    screenRef.current=next;
    history.push(next);return true;
  },[]);
  const run=useCallback(async<T,>(label:string,cmd:ClinicCommand<T>,done:(value:T)=>void|Promise<void>)=>{
    if(currentPending.current||lock.current)throw new ClinicError("BUSY","Finish or reconcile the previous save first.");
    lock.current=true;setBusy(label);setReconcileError("");report();
    showLoading(`${label}…`);
    try{
      const value=await cmd.execute();
      if(!alive.current)throw new ClinicError("STALE_SESSION","The clinic session changed. Reopen Patient Record.");
      await done(value);
      showSuccess(`${label} completed.`);
    }catch(e){
      if(isUnknown(e)&&alive.current){
        const retry=async()=>{const result=await cmd.execute();if(!alive.current)throw new ClinicError("STALE_SESSION","Clinic session changed.");await done(result);};
        const record={label,retry};currentPending.current=record;setPending(record);
      }
      showError(errorText(e));
      throw e;
    }finally{lock.current=false;setBusy("");report();}
  },[report,showError,showLoading,showSuccess]);
  useEffect(()=>{
    alive.current=true;
    let active=true;
    let sdk:BrowserClinicClient|null=null;
    let unsub=()=>{};
    void browserRuntime.then(async bridge=>{
      if(!active)return;
      sdk=new BrowserClinicClient(bridge,()=>{
        alive.current=false;dirtyKeys.current.clear();currentPending.current=null;
        navigation.current?.dispose();navigation.current=null;
        if(active){setReady(false);setSession(null);setScreen({mode:"directory"});
          setOpeningError("The clinic session changed. Reopen Patient Record from Dental OS.");}
      });
      client.current=sdk;
      unsub=sdk.onModuleSelected(()=>{});
      const {session:ctx}=await sdk.initialize("patients");
      if(!ctx.clinicUser.capabilities.includes("patient_record.access"))
        throw new ClinicError("FORBIDDEN","Patient Record is unavailable for this clinic role.");
      if(!active)return;
      const history=sdk.createHistory<Screen>({mode:"directory"},()=>
        !lock.current&&!currentPending.current&&(screenRef.current.mode==="intake"||!dirtyKeys.current.size));
      navigation.current=history;
      history.subscribe(page=>{screenRef.current=page;setScreen(page);});
      setSession(ctx);setApi(new PatientApi(sdk));setMedia(new PatientMediaSdk(sdk));
      setReady(true);setOpeningError("");
    }).catch(e=>{if(active)setOpeningError(errorText(e));});
    const observer=new MutationObserver(report);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>{active=false;alive.current=false;unsub();observer.disconnect();navigation.current?.dispose();navigation.current=null;dirtyKeys.current.clear();
      currentPending.current=null;sdk?.report({dirty:false,modal:false});client.current=null;};
  },[report]);
  useEffect(()=>{report();},[report,screen]);
  const retry=useCallback(async()=>{
    const record=currentPending.current;if(!record)return;setBusy("Checking original save");setReconcileError("");lock.current=true;report();
    showLoading("Checking original save…");
    try{await record.retry();currentPending.current=null;setPending(null);showSuccess("Original save completed.");}
    catch(e){setReconcileError(errorText(e));showError(errorText(e));}
    finally{lock.current=false;setBusy("");report();}
  },[report,showError,showLoading,showSuccess]);
  const store=useMemo<AppStore|null>(()=>api&&media&&session?{
    api,media,session,busy,pending:!!pending,capabilities:new Set(session.clinicUser.capabilities),
    run,dirty,go,refreshDirectory:()=>setRevision(v=>v+1)
  }:null,[api,media,session,busy,pending,run,dirty,go]);
  if(openingError)return <main className="saasAdapterMessage" role="alert"><h1>Patient Record unavailable</h1><p>{openingError}</p></main>;
  if(!ready||!store)return <main className="saasAdapterMessage" role="status">Opening Patient Record…</main>;
  return <Context.Provider value={store}>
    <main className="clinicApp">
      <section className="clinicWorkspaceCanvas" data-dental-os-app={APP_ID}>
        <ClinicPageRefreshAction />
        <div className="clinicCareWorkspace">
          {pending&&<section className="prWarning" role="alert"><strong>Uncertain save: {pending.label}</strong>
            <p>The clinic may have received this change. Do not submit it again as a new action. Only retry the original operation.</p>
            {reconcileError&&<Alert>{reconcileError}</Alert>}
            <button type="button" onClick={()=>void retry()} disabled={!!busy}>Retry original save</button></section>}
          {screen.mode==="directory"&&<SaaSPatientDirectory key={revision} onOpenPatient={patient=>go({mode:"detail",patientId:patient.id,initialPatient:patient})}
            onAddPatient={()=>go({mode:"intake"})}/>}
          {screen.mode==="intake"&&<SaaSPatientIntake onBack={()=>{navigation.current?.back(true);}}
            onSaved={()=>setRevision(v=>v+1)}/>}
          {screen.mode==="detail"&&<SaaSPatientDetail key={screen.patientId+"-"+revision} patientId={screen.patientId} initialPatient={screen.initialPatient}/>}
        </div>
        <ClinicPageRefreshAction placement="page-bottom" />
      </section>
    </main>
  </Context.Provider>;
}

function Main() {
  return <ClinicSnackbarProvider><SnackbarProvider><ClinicLoadingProvider><ClinicPageRefreshProvider>
    <PatientRecordWorkspace />
  </ClinicPageRefreshProvider></ClinicLoadingProvider></SnackbarProvider></ClinicSnackbarProvider>;
}
createRoot(document.getElementById("root")!).render(<Main/>);
