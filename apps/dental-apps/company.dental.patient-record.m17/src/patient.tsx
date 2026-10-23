import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, UserRound, NotebookTabs, ClipboardList, FileClock, Stethoscope, Image, Pill, Wallet, CalendarClock, FlaskConical, ShieldCheck } from "lucide-react";
import type { PatientCore, PatientTreatmentPlan, PatientIntakeInput, AllergySeverity, PatientSex } from "./types";
import { dateValid, today, readable } from "./api";
import { Alert, Empty, FormField, dateLabel, useApp, useDraft, errorText } from "./main";
import { NotesPanel, PrescriptionsPanel, TimelinePanel } from "./clinical";
import { FollowUpsPanel, LedgerPanel, ChartsPanel, LabsPanel } from "./operations";
import { XrayPanel } from "./media";

type Tab="profile"|"cases"|"notes"|"timeline"|"periodontal"|"plan"|"lab"|"xrays"|"prescriptions"|"followups"|"ledger";
const tabs:{key:Tab;label:string;icon:typeof UserRound}[]=[
  {key:"profile",label:"Profile",icon:UserRound},{key:"cases",label:"Chief complaints",icon:NotebookTabs},
  {key:"notes",label:"Notes",icon:ClipboardList},{key:"timeline",label:"Timeline",icon:FileClock},
  {key:"periodontal",label:"Dental charts",icon:Stethoscope},{key:"plan",label:"Treatment plans",icon:ShieldCheck},
  {key:"lab",label:"Lab orders",icon:FlaskConical},{key:"xrays",label:"X-rays",icon:Image},
  {key:"prescriptions",label:"Prescriptions",icon:Pill},{key:"followups",label:"Follow-ups",icon:CalendarClock},
  {key:"ledger",label:"Billing ledger",icon:Wallet}
];
type Props={patientId:string;onBack:()=>boolean};
export function PatientDetail({patientId,onBack}:Props){
  const {api,capabilities}=useApp();
  const [core,setCore]=useState<PatientCore|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [tab,setTab]=useState<Tab>("profile"),[tabDirty,setTabDirty]=useState(false),[tabMessage,setTabMessage]=useState("");
  const [revision,setRevision]=useState(0);
  useDraft("patient-detail-form",tabDirty);
  const refresh=useCallback(()=>{
    setLoading(true);setError("");
    void api.core(patientId).then(setCore).catch(e=>{setCore(null);setError(errorText(e));}).finally(()=>setLoading(false));
    setRevision(v=>v+1);
  },[api,patientId]);
  useEffect(()=>{let active=true;setLoading(true);api.core(patientId).then(value=>{if(active)setCore(value);})
    .catch(e=>{if(active){setCore(null);setError(errorText(e));}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,patientId]);
  const choose=(next:Tab)=>{if(tabDirty){setTabMessage("Save or cancel the current draft before switching tabs.");return;}
    setTabMessage("");setTab(next);};
  const back=()=>{if(tabDirty){setTabMessage("Save or discard your draft before leaving this patient record.");return;}
    if(!onBack())setTabMessage("Finish or reconcile the current save before returning to the directory.");};
  if(loading&&!core)return <section className="prPage" role="status">Loading patient profile…</section>;
  if(error&&!core)return <section className="prPage"><Alert>{error}</Alert><button type="button" onClick={refresh}>Retry patient record</button><button type="button" onClick={onBack}>Back to directory</button></section>;
  if(!core)return <section className="prPage"><Empty>Patient record is unavailable.</Empty></section>;
  return <section className="prPage">
    <div className="prHeading"><div><button className="prBack" type="button" onClick={back}><ArrowLeft size={15}/> Patient directory</button>
      <h2><span className="prAvatar large">{core.fullName.slice(0,1)}</span>{core.fullName}</h2>
      <p>Record {core.patientNumber} · Registered {dateLabel(core.registeredOn)} · {core.status}</p></div>
      <button type="button" onClick={refresh} disabled={tabDirty||loading}><RefreshCw size={15}/> Refresh</button></div>
    {error&&<Alert>{error}</Alert>}
    {tabMessage&&<Alert>{tabMessage}</Alert>}
    <div className="prTabs" role="tablist" aria-label="Patient record sections">
      {tabs.filter(t=>t.key!=="ledger"||capabilities.has("patient_billing_ledger.read")).map(t=><button key={t.key} type="button" role="tab"
        aria-selected={tab===t.key} className={tab===t.key?"active":""} onClick={()=>choose(t.key)}>
        <t.icon size={15}/>{t.label}</button>)}
    </div>
    <div className="prTabPanel" role="tabpanel" aria-label={tabs.find(t=>t.key===tab)?.label} key={tab+"-"+revision}>
      {tab==="profile"&&<ProfilePanel core={core} onSaved={setCore} onEditing={setTabDirty}/>}
      {tab==="cases"&&<CasesPanel core={core} onEditing={setTabDirty}/>}
      {tab==="notes"&&<NotesPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="timeline"&&<TimelinePanel patientId={patientId}/>}
      {tab==="periodontal"&&<ChartsPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="plan"&&<PlansPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="lab"&&<LabsPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="xrays"&&<XrayPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="prescriptions"&&<PrescriptionsPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="followups"&&<FollowUpsPanel patientId={patientId} onEditing={setTabDirty}/>}
      {tab==="ledger"&&capabilities.has("patient_billing_ledger.read")&&<LedgerPanel patientId={patientId} onEditing={setTabDirty}/>}
    </div>
  </section>;
}
const textOrDash=(v:string|null|undefined)=>v?.trim()||"Not recorded";
export function ProfilePanel({core,onSaved,onEditing}:{core:PatientCore;onSaved:(core:PatientCore)=>void;onEditing:(dirty:boolean)=>void}){
  const {api,run,pending,busy}=useApp();
  const [editing,setEditing]=useState(false),[error,setError]=useState("");
  const [patient,setPatient]=useState({
    fullName:core.fullName,preferredLanguage:core.preferredLanguage,ageYears:core.ageYears,sex:core.sex,
    phone:core.phone,address:core.address,emergencyContactName:core.emergencyContactName,emergencyContactPhone:core.emergencyContactPhone
  });
  const [medical,setMedical]=useState<PatientIntakeInput["medicalProfile"]>({
    conditionsSummary:core.medicalProfile.conditionsSummary,currentMedicationsSummary:core.medicalProfile.currentMedicationsSummary,
    habitsSummary:core.medicalProfile.habitsSummary,medicalNotes:core.medicalProfile.medicalNotes,
    verifiedOn:core.medicalProfile.verifiedOn
  });
  const [allergies,setAllergies]=useState<PatientIntakeInput["allergies"]>(core.allergies.filter(a=>a.status==="active").map(({allergen,reaction,severity,note,recordedOn})=>({allergen,reaction,severity,note,recordedOn})));
  const mark=()=>{setEditing(true);onEditing(true);};
  const cancel=()=>{setEditing(false);onEditing(false);setError("");setPatient({fullName:core.fullName,preferredLanguage:core.preferredLanguage,
    ageYears:core.ageYears,sex:core.sex,phone:core.phone,address:core.address,emergencyContactName:core.emergencyContactName,emergencyContactPhone:core.emergencyContactPhone});
    setMedical({conditionsSummary:core.medicalProfile.conditionsSummary,currentMedicationsSummary:core.medicalProfile.currentMedicationsSummary,
      habitsSummary:core.medicalProfile.habitsSummary,medicalNotes:core.medicalProfile.medicalNotes,verifiedOn:core.medicalProfile.verifiedOn});
    setAllergies(core.allergies.filter(a=>a.status==="active").map(({allergen,reaction,severity,note,recordedOn})=>({allergen,reaction,severity,note,recordedOn})));};
  const save=async()=>{
    if(pending||busy)return;
    if(!patient.fullName.trim()||patient.fullName.length>160){setError("Enter a valid full name.");return;}
    if(patient.ageYears!==null&&(!Number.isInteger(patient.ageYears)||patient.ageYears<0||patient.ageYears>130)){setError("Age must be 0–130 years.");return;}
    if(medical.verifiedOn&&!dateValid(medical.verifiedOn)){setError("Medical verification date is invalid.");return;}
    if(allergies.some(a=>!a.allergen.trim())){setError("Complete each allergy or remove it.");return;}
    try{await run("Update patient profile",api.updateProfile(core.patientId,{expectedPatientRowVersion:core.rowVersion,
      expectedMedicalProfileRowVersion:core.medicalProfile.rowVersion,
      patient:{...patient,fullName:patient.fullName.trim()},medicalProfile:medical,allergies}),v=>{
      onSaved(v.patient);setEditing(false);onEditing(false);
    });}catch(e){setError(errorText(e));}
  };
  if(!editing)return <div className="prTwoCols">
    <article className="prCard"><div className="prSectionHeading"><h3>Demographics & contact</h3><button type="button" onClick={mark} disabled={pending}>Edit profile</button></div>
      <dl className="prFacts">{[
        ["Full name",core.fullName],["Record ID",core.patientNumber],["Age",core.ageYears?.toString()??"Not recorded"],
        ["Date of birth",dateLabel(core.dateOfBirth)],["Sex",textOrDash(core.sex)],["Preferred language",textOrDash(core.preferredLanguage)],
        ["Phone",textOrDash(core.phone)],["Address",textOrDash(core.address)],["Emergency contact",textOrDash(core.emergencyContactName)],
        ["Emergency phone",textOrDash(core.emergencyContactPhone)]
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </article>
    <article className="prCard"><h3>Clinical safety profile</h3>
      <dl className="prFacts">{[
        ["Conditions",textOrDash(core.medicalProfile.conditionsSummary)],["Medication",textOrDash(core.medicalProfile.currentMedicationsSummary)],
        ["Habits",textOrDash(core.medicalProfile.habitsSummary)],["Medical notes",textOrDash(core.medicalProfile.medicalNotes)],
        ["Last verified",dateLabel(core.medicalProfile.verifiedOn)]
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <h4>Allergies</h4>{core.allergies.filter(a=>a.status==="active").length?
        core.allergies.filter(a=>a.status==="active").map(a=><p key={a.patientAllergyId} className="prAllergyNote"><strong>{a.allergen}</strong> · {a.severity}{a.reaction?" · "+a.reaction:""}</p>):
        <p className="prHint">No documented allergies. Confirm verbally before treatment.</p>}
    </article></div>;
  const editText=(key:keyof typeof patient,value:string|number|null)=>setPatient(v=>({...v,[key]:value}));
  const editMedical=(key:keyof typeof medical,value:string|null)=>setMedical(v=>({...v,[key]:value}));
  return <article className="prCard"><div className="prSectionHeading"><h3>Edit patient profile</h3><p className="prHint">Changes use the current patient and medical-profile row versions.</p></div>
    <div className="prFormGrid">
      <FormField label="Full name"><input maxLength={160} value={patient.fullName} onChange={e=>editText("fullName",e.target.value)}/></FormField>
      <FormField label="Age (years)"><input type="number" min="0" max="130" value={patient.ageYears??""} onChange={e=>editText("ageYears",e.target.value===""?null:Number(e.target.value))}/></FormField>
      <FormField label="Sex"><select value={patient.sex??""} onChange={e=>editText("sex",(e.target.value||null) as PatientSex|null)}>
        <option value="">Not recorded</option>{["female","male","other","not_recorded"].map(v=><option value={v} key={v}>{v}</option>)}</select></FormField>
      <FormField label="Preferred language"><input maxLength={80} value={patient.preferredLanguage??""} onChange={e=>editText("preferredLanguage",e.target.value||null)}/></FormField>
      <FormField label="Phone"><input maxLength={40} value={patient.phone??""} onChange={e=>editText("phone",e.target.value||null)}/></FormField>
      <FormField label="Address"><input maxLength={500} value={patient.address??""} onChange={e=>editText("address",e.target.value||null)}/></FormField>
      <FormField label="Emergency contact"><input maxLength={160} value={patient.emergencyContactName??""} onChange={e=>editText("emergencyContactName",e.target.value||null)}/></FormField>
      <FormField label="Emergency phone"><input maxLength={40} value={patient.emergencyContactPhone??""} onChange={e=>editText("emergencyContactPhone",e.target.value||null)}/></FormField>
      <FormField label="Medical conditions"><textarea rows={2} maxLength={2000} value={medical.conditionsSummary??""} onChange={e=>editMedical("conditionsSummary",e.target.value||null)}/></FormField>
      <FormField label="Current medications"><textarea rows={2} maxLength={2000} value={medical.currentMedicationsSummary??""} onChange={e=>editMedical("currentMedicationsSummary",e.target.value||null)}/></FormField>
      <FormField label="Habits"><textarea rows={2} maxLength={1000} value={medical.habitsSummary??""} onChange={e=>editMedical("habitsSummary",e.target.value||null)}/></FormField>
      <FormField label="Medical notes"><textarea rows={2} maxLength={4000} value={medical.medicalNotes??""} onChange={e=>editMedical("medicalNotes",e.target.value||null)}/></FormField>
      <FormField label="Verified on (AD)"><input type="date" value={medical.verifiedOn??""} onChange={e=>editMedical("verifiedOn",e.target.value||null)}/></FormField>
    </div>
    <div className="prSectionHeading"><h4>Recorded allergies</h4><button type="button" onClick={()=>setAllergies(v=>[...v,{allergen:"",reaction:null,severity:"unknown",note:null,recordedOn:today()}])} disabled={allergies.length>=30}>Add allergy</button></div>
    {allergies.map((a,i)=><div className="prAllergy" key={i}><FormField label="Allergen"><input value={a.allergen} maxLength={160} onChange={e=>setAllergies(list=>list.map((v,j)=>i===j?{...v,allergen:e.target.value}:v))}/></FormField>
      <FormField label="Reaction"><input value={a.reaction??""} maxLength={500} onChange={e=>setAllergies(list=>list.map((v,j)=>i===j?{...v,reaction:e.target.value||null}:v))}/></FormField>
      <FormField label="Severity"><select value={a.severity} onChange={e=>setAllergies(list=>list.map((v,j)=>i===j?{...v,severity:e.target.value as AllergySeverity}:v))}>
        {["unknown","mild","moderate","severe"].map(v=><option key={v} value={v}>{v}</option>)}</select></FormField>
      <button type="button" className="prDanger" onClick={()=>setAllergies(list=>list.filter((_,j)=>i!==j))}>Remove</button></div>)}
    {error&&<Alert>{error}</Alert>}
    <div className="prFormActions"><button type="button" onClick={cancel}>Cancel</button><button type="button" className="prPrimary" onClick={()=>void save()} disabled={!!busy||pending}>Save changes</button></div>
  </article>;
}
function CasesPanel({core,onEditing}:{core:PatientCore;onEditing:(value:boolean)=>void}){
  const {api,run,capabilities,pending,busy}=useApp();
  const [plans,setPlans]=useState<PatientTreatmentPlan[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [newCase,setNewCase]=useState(""),[openedOn,setOpenedOn]=useState(today());
  const [target,setTarget]=useState<PatientTreatmentPlan|null>(null),[status,setStatus]=useState<"open"|"completed"|"closed">("open"),[reason,setReason]=useState("");
  const [editing,setEditing]=useState(false);
  const canChange=capabilities.has("work_entry.access");
  const load=useCallback(()=>{setLoading(true);setError("");api.plans(core.patientId).then(setPlans).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,core.patientId]);
  useEffect(()=>{load();},[load]);
  const setDraft=(v:boolean)=>{setEditing(v);onEditing(v);};
  const create=async()=>{
    if(!newCase.trim()||!dateValid(openedOn)){setError("Enter the complaint and a valid opening date.");return;}
    try{await run("Create chief complaint",api.createCase(core.patientId,newCase.trim(),openedOn),()=>{setNewCase("");setDraft(false);load();});}
    catch(e){setError(errorText(e));}
  };
  const saveStatus=async()=>{
    if(!target)return;
    try{await run("Update case status",api.updateCaseStatus(target.chiefComplaintId,{patientId:core.patientId,expectedRowVersion:target.rowVersion,
      status,reason:reason.trim()||null}),()=>{setTarget(null);setReason("");setDraft(false);load();});}
    catch(e){setError(errorText(e));}
  };
  return <div className="prCard"><div className="prSectionHeading"><h3>Chief complaints & episodes</h3><button type="button" onClick={load}>Refresh</button></div>
    {error&&<Alert>{error}</Alert>}{loading?<p role="status">Loading chief complaints…</p>:plans.length===0?<Empty>No chief complaints recorded yet.</Empty>:
      plans.map(c=><div className="prListItem" key={c.chiefComplaintId}><div><strong>{c.chiefComplaint}</strong><small>Opened {dateLabel(c.openedOn)} · {c.protocols.length} protocols</small></div>
        <span className={"prStatus "+c.status}>{c.status}</span>{canChange&&<button type="button" disabled={pending} onClick={()=>{setTarget(c);setStatus(c.status);setDraft(true);}}>Update status</button>}</div>)}
    {canChange&&<><div className="prSectionHeading"><h4>Open a new complaint</h4></div>
      <div className="prFormGrid"><FormField label="Chief complaint"><input maxLength={1000} value={newCase} onChange={e=>{setNewCase(e.target.value);setDraft(Boolean(e.target.value));}}/></FormField>
      <FormField label="Opened on (AD)"><input type="date" value={openedOn} onChange={e=>{setOpenedOn(e.target.value);setDraft(true);}}/></FormField></div>
      <div className="prFormActions"><button type="button" className="prPrimary" disabled={!newCase.trim()||pending||!!busy} onClick={()=>void create()}>Create complaint</button></div></>}
    {target&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>Update complaint status</h3><p>{target.chiefComplaint}</p>
      <FormField label="Status"><select value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
        {["open","completed","closed"].map(s=><option key={s}>{s}</option>)}</select></FormField>
      <FormField label="Reason / outcome"><textarea rows={2} value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></FormField>
      <div className="prFormActions"><button type="button" onClick={()=>{setTarget(null);setDraft(false);}}>Cancel</button>
        <button type="button" className="prPrimary" onClick={()=>void saveStatus()} disabled={pending||!!busy}>Save status</button></div>
      </div></div>}
  </div>;
}
function PlansPanel({patientId,onEditing}:{patientId:string;onEditing:(value:boolean)=>void}){
  const {api}=useApp();const [plans,setPlans]=useState<PatientTreatmentPlan[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=useCallback(()=>{setLoading(true);setError("");api.plans(patientId).then(setPlans).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();},[refresh]);
  return <article className="prCard"><div className="prSectionHeading"><h3>Longitudinal treatment plans</h3><button type="button" onClick={refresh}>Refresh</button></div>
    {error&&<Alert>{error}</Alert>}{loading?<p role="status">Loading treatment plans…</p>:
      plans.length===0?<Empty>No treatment plans documented.</Empty>:plans.map(c=><div key={c.chiefComplaintId} className="prPlan">
        <div className="prSectionHeading"><h4>{c.chiefComplaint}</h4><span className={"prStatus "+c.status}>{c.status}</span></div>
        <p className="prHint">{dateLabel(c.openedOn)} · {c.protocols.length} protocols</p>
        {!c.protocols.length&&<p className="prHint">No treatment protocols assigned to this complaint.</p>}
        {c.protocols.map(protocol=><div key={protocol.patientProtocolId} className="prProtocol">
          <div className="prSectionHeading"><strong>{protocol.protocolName}</strong><span>{protocol.toothCode||protocol.treatmentArea||"General"} · {protocol.status}</span></div>
          <div className="prStages">{protocol.stages.map(stage=><div key={stage.stageId} className="prStage">
            <span className={stage.status==="done"?"prDot complete":"prDot"}/><span>{stage.stageName}</span>
            <span>{stage.status}</span><strong>{stage.price.toLocaleString("en-NP")} NPR</strong></div>)}</div>
        </div>)}</div>)}
    <p className="prHint">Treatment plan changes and work finalisation follow the separately permitted Work Entry clinical workflow.</p>
  </article>;
}
