import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ShieldCheck, Plus, Trash2, UserPlus } from "lucide-react";
import { dateValid, today, readable } from "./api";
import type { PatientIntakeInput, AllergySeverity, PatientSex } from "./types";
import { Alert, FormField, useApp, useDraft, errorText } from "./main";
type Allergy = PatientIntakeInput["allergies"][number];
const emptyAllergy=():Allergy=>({allergen:"",reaction:null,severity:"unknown",note:null,recordedOn:today()});
const initial=():PatientIntakeInput=>({
  fullName:"",preferredLanguage:null,dateOfBirth:null,ageYears:null,sex:null,phone:null,address:null,
  emergencyContactName:null,emergencyContactPhone:null,registeredOn:today(),
  medicalProfile:{conditionsSummary:null,currentMedicationsSummary:null,habitsSummary:null,medicalNotes:null,verifiedOn:null},
  allergies:[]
});
const nullable=(v:string)=>v.trim()||null;
type Props={onBack:()=>boolean;onCreated:(id:string)=>void};
export function PatientIntake({onBack,onCreated}:Props){
  const {api,run,dirty,pending,busy}=useApp();
  const [form,setForm]=useState<PatientIntakeInput>(initial),[stage,setStage]=useState(0),[touched,setTouched]=useState(false);
  const [context,setContext]=useState(""),[contextError,setContextError]=useState(""),[error,setError]=useState("");
  const [confirm,setConfirm]=useState(false);
  useDraft("intake",touched);
  useEffect(()=>{let active=true;api.context().then(v=>{if(active)setContext(v.nextPatientNumber);}).catch(e=>{if(active)setContextError(readable(e));});return()=>{active=false;};},[api]);
  const change=<K extends keyof PatientIntakeInput>(key:K,value:PatientIntakeInput[K])=>{setForm(v=>({...v,[key]:value}));setTouched(true);setError("");};
  const medical=(key:keyof PatientIntakeInput["medicalProfile"],value:string|null)=>{setForm(v=>({...v,medicalProfile:{...v.medicalProfile,[key]:value}}));setTouched(true);};
  const allergy=(index:number,key:keyof Allergy,value:string|null)=>{setForm(v=>({...v,allergies:v.allergies.map((a,i)=>i===index?{...a,[key]:value}:a)}));setTouched(true);};
  const cancel=()=>{if(touched)setConfirm(true);else onBack();};
  const discard=()=>{dirty("intake",false);setTouched(false);setConfirm(false);onBack();};
  function validate():string{
    if(form.fullName.trim().length<2||form.fullName.length>160)return "Enter the patient's full name (2–160 characters).";
    if(!dateValid(form.registeredOn)||form.registeredOn>today())return "Choose a valid registration date that is not in the future.";
    if(form.dateOfBirth&&(!dateValid(form.dateOfBirth)||form.dateOfBirth>today()))return "Enter a valid date of birth.";
    if(form.ageYears!==null&&(!Number.isInteger(form.ageYears)||form.ageYears<0||form.ageYears>130))return "Age must be between 0 and 130.";
    if(form.ageYears===null&&!form.dateOfBirth)return "Enter age or date of birth.";
    if(form.allergies.some(a=>!a.allergen.trim()))return "Every allergy needs an allergen name, or remove the empty row.";
    if(form.allergies.length>30)return "At most 30 allergies may be recorded.";
    return "";
  }
  const save=async(e:FormEvent)=>{
    e.preventDefault();if(pending||busy)return;
    const problem=validate();if(problem){setError(problem);return;}
    const input:PatientIntakeInput={...form,fullName:form.fullName.trim(),preferredLanguage:nullable(form.preferredLanguage||""),
      phone:nullable(form.phone||""),address:nullable(form.address||""),
      emergencyContactName:nullable(form.emergencyContactName||""),emergencyContactPhone:nullable(form.emergencyContactPhone||""),
      allergies:form.allergies.map(a=>({...a,allergen:a.allergen.trim()}))};
    try{await run("Register patient",api.createIntake(input),response=>{
      if(!response.patient?.patientId)throw new Error("The clinic did not return a patient identifier.");
      dirty("intake",false);setTouched(false);onCreated(response.patient.patientId);
    });}catch(e){setError(errorText(e));}
  };
  return <section className="prPage">
    <div className="prHeading"><div><button type="button" className="prBack" onClick={cancel}><ArrowLeft size={15}/> Patient directory</button>
      <h2><UserPlus size={20}/> New patient registration</h2>
      <p>Record identity, contacts and clinical safety details before saving.</p></div>
      <div className="prRef">Next record: <strong>{context||"Assigned on save"}</strong></div></div>
    {contextError&&<p className="prHint" role="status">The next patient number could not be previewed; the clinic will assign it on save.</p>}
    <form onSubmit={save} className="prCard prIntake">
      <div className="prSteps" role="tablist" aria-label="Registration steps">
        {["Patient details","Medical history","Allergy & review"].map((label,i)=><button key={label} type="button" role="tab" aria-selected={stage===i}
          className={stage===i?"current":""} onClick={()=>setStage(i)}>{i+1}. {label}</button>)}</div>
      {stage===0&&<div className="prFormGrid">
        <FormField label="Full name *"><input autoFocus required maxLength={160} value={form.fullName} onChange={e=>change("fullName",e.target.value)}/></FormField>
        <FormField label="Registration date (AD) *"><input type="date" required max={today()} value={form.registeredOn} onChange={e=>change("registeredOn",e.target.value)}/></FormField>
        <FormField label="Date of birth (AD)"><input type="date" max={today()} value={form.dateOfBirth||""} onChange={e=>change("dateOfBirth",nullable(e.target.value))}/></FormField>
        <FormField label="Age (years)"><input type="number" min="0" max="130" value={form.ageYears??""} onChange={e=>change("ageYears",e.target.value===""?null:Number(e.target.value))}/></FormField>
        <FormField label="Sex"><select value={form.sex||""} onChange={e=>change("sex",(e.target.value||null) as PatientSex|null)}>
          <option value="">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="not_recorded">Prefer not to record</option></select></FormField>
        <FormField label="Preferred language"><input maxLength={80} value={form.preferredLanguage||""} onChange={e=>change("preferredLanguage",nullable(e.target.value))}/></FormField>
        <FormField label="Phone number"><input type="tel" maxLength={40} value={form.phone||""} onChange={e=>change("phone",nullable(e.target.value))}/></FormField>
        <FormField label="Address"><input maxLength={500} value={form.address||""} onChange={e=>change("address",nullable(e.target.value))}/></FormField>
        <FormField label="Emergency contact"><input maxLength={160} value={form.emergencyContactName||""} onChange={e=>change("emergencyContactName",nullable(e.target.value))}/></FormField>
        <FormField label="Emergency phone"><input type="tel" maxLength={40} value={form.emergencyContactPhone||""} onChange={e=>change("emergencyContactPhone",nullable(e.target.value))}/></FormField>
      </div>}
      {stage===1&&<div className="prFormGrid">
        <FormField label="Medical conditions"><textarea rows={3} maxLength={2000} value={form.medicalProfile.conditionsSummary||""} onChange={e=>medical("conditionsSummary",nullable(e.target.value))}/></FormField>
        <FormField label="Current medications"><textarea rows={3} maxLength={2000} value={form.medicalProfile.currentMedicationsSummary||""} onChange={e=>medical("currentMedicationsSummary",nullable(e.target.value))}/></FormField>
        <FormField label="Habits"><textarea rows={3} maxLength={1000} value={form.medicalProfile.habitsSummary||""} onChange={e=>medical("habitsSummary",nullable(e.target.value))}/></FormField>
        <FormField label="Medical notes"><textarea rows={3} maxLength={4000} value={form.medicalProfile.medicalNotes||""} onChange={e=>medical("medicalNotes",nullable(e.target.value))}/></FormField>
      </div>}
      {stage===2&&<div className="prMedical">
        <div className="prSectionHeading"><h3><ShieldCheck size={17}/> Documented allergies</h3>
          <button type="button" onClick={()=>{if(form.allergies.length<30)change("allergies",[...form.allergies,emptyAllergy()]);}}><Plus size={15}/> Add allergy</button></div>
        {!form.allergies.length&&<p className="prHint">No allergies entered. Confirm the safety review separately before treatment.</p>}
        {form.allergies.map((a,i)=><div className="prAllergy" key={i}>
          <FormField label="Allergen *"><input maxLength={160} value={a.allergen} onChange={e=>allergy(i,"allergen",e.target.value)}/></FormField>
          <FormField label="Reaction"><input maxLength={500} value={a.reaction||""} onChange={e=>allergy(i,"reaction",nullable(e.target.value))}/></FormField>
          <FormField label="Severity"><select value={a.severity} onChange={e=>allergy(i,"severity",e.target.value as AllergySeverity)}>
            {["unknown","mild","moderate","severe"].map(v=><option key={v} value={v}>{v}</option>)}</select></FormField>
          <button className="prIconButton" type="button" aria-label={"Remove allergy "+(i+1)} onClick={()=>change("allergies",form.allergies.filter((_,j)=>i!==j))}><Trash2 size={16}/></button>
        </div>)}
        <FormField label="Safety profile verified on (AD)"><input type="date" max={today()} value={form.medicalProfile.verifiedOn||""} onChange={e=>medical("verifiedOn",nullable(e.target.value))}/></FormField>
        <p className="prHint">The clinical profile belongs to the patient and will be available in future visits.</p>
      </div>}
      {error&&<Alert>{error}</Alert>}
      <div className="prFormActions"><button type="button" onClick={cancel}>Cancel</button>
        {stage>0&&<button type="button" onClick={()=>setStage(v=>v-1)}>Previous</button>}
        {stage<2?<button className="prPrimary" type="button" onClick={()=>setStage(v=>v+1)}>Continue</button>:
          <button className="prPrimary" type="submit" disabled={!!busy||pending}>{busy?"Saving…":"Save patient record"}</button>}</div>
    </form>
    {confirm&&<div className="prOverlay" role="dialog" aria-modal="true" aria-labelledby="discard-title">
      <div className="prDialog"><h3 id="discard-title">Discard patient draft?</h3><p>Unsaved registration details will be lost. No patient record has been submitted.</p>
        <div className="prFormActions"><button type="button" onClick={()=>setConfirm(false)}>Continue editing</button>
          <button type="button" className="prDanger" onClick={discard}>Discard draft</button></div></div></div>}
  </section>;
}
