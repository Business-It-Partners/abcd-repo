import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, FileText, ClipboardList, Trash2, Pencil } from "lucide-react";
import { today } from "./api";
import type { PatientNote, PatientPrescription, PatientTimelineEvent, PrescriptionItemInput } from "./types";
import { Alert, Empty, FormField, dateLabel, useApp, errorText } from "./main";

type Props={patientId:string;onEditing:(value:boolean)=>void};
const blank=():PrescriptionItemInput=>({medicineName:"",dose:null,frequency:null,duration:null,instructions:""});
export function NotesPanel({patientId,onEditing}:Props){
  const {api,run,pending,busy}=useApp();
  const [notes,setNotes]=useState<PatientNote[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [body,setBody]=useState(""),[noteDate,setNoteDate]=useState(today()),[reason,setReason]=useState(""),[target,setTarget]=useState<string|null>(null);
  const refresh=useCallback(()=>{setLoading(true);setError("");api.notes(patientId).then(setNotes).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();},[refresh]);
  const draft=(value:boolean)=>onEditing(value);
  const create=async()=>{
    if(!body.trim()){setError("Enter a clinical note before saving.");return;}
    try{await run("Save clinical note",api.createNote({patientId,chiefComplaintId:null,noteType:"general",noteDate,body:body.trim()}),()=>{
      setBody("");draft(false);refresh();
    });}catch(e){setError(errorText(e));}
  };
  const withdraw=async()=>{
    if(!target||!reason.trim())return;
    try{await run("Withdraw patient note",api.withdrawNote(target,reason.trim()),()=>{setTarget(null);setReason("");draft(false);refresh();});}
    catch(e){setError(errorText(e));}
  };
  return <article className="prCard"><div className="prSectionHeading"><h3>Patient notes</h3><button type="button" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div>
    <div className="prNoteEditor"><FormField label="Record a note"><textarea rows={3} maxLength={4000} value={body}
      placeholder="Document a relevant clinical observation…" onChange={e=>{setBody(e.target.value);draft(Boolean(e.target.value));}}/></FormField>
      <FormField label="Note date (AD)"><input type="date" value={noteDate} onChange={e=>{setNoteDate(e.target.value);draft(true);}}/></FormField>
      <div className="prFormActions">{body&&<button type="button" onClick={()=>{setBody("");draft(false);}}>Discard</button>}
        <button type="button" className="prPrimary" disabled={!body.trim()||pending||!!busy} onClick={()=>void create()}><Plus size={14}/> Save note</button></div></div>
    {error&&<Alert>{error}</Alert>}
    {loading?<p role="status">Loading patient notes…</p>:notes.length===0?<Empty>No clinical notes have been recorded.</Empty>:
      notes.map(n=><div className="prListItem" key={n.patientNoteId}><div><strong>{dateLabel(n.noteDate)} · {n.noteType}</strong>
        <p className="prPrewrap">{n.body}</p><small>Status: {n.status}</small></div>
        {n.status==="active"&&<button type="button" disabled={pending} onClick={()=>{setTarget(n.patientNoteId);draft(true);}}>Withdraw</button>}</div>)}
    {target&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>Withdraw note</h3>
      <p>The original note remains in clinical history with a withdrawal record.</p>
      <FormField label="Required reason"><textarea rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></FormField>
      <div className="prFormActions"><button type="button" onClick={()=>{setTarget(null);setReason("");draft(false);}}>Cancel</button>
        <button type="button" className="prDanger" disabled={!reason.trim()||!!busy||pending} onClick={()=>void withdraw()}>Confirm withdrawal</button></div>
    </div></div>}
  </article>;
}
export function TimelinePanel({patientId}:{patientId:string}){
  const {api}=useApp();const [items,setItems]=useState<PatientTimelineEvent[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=useCallback(()=>{setLoading(true);setError("");api.timeline(patientId).then(setItems).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();},[refresh]);
  return <article className="prCard"><div className="prSectionHeading"><h3>Longitudinal clinical timeline</h3><button type="button" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<Alert>{error}</Alert>}
    {loading?<p role="status">Loading clinical timeline…</p>:items.length===0?<Empty>No clinical activities have been recorded.</Empty>:
      <ol className="prTimeline">{items.map(item=><li key={item.eventId}><span className="prTimelineDate">{dateLabel(item.occurredOn)}</span>
        <div><strong>{item.title}</strong><small>{item.eventType.replaceAll("_"," ")}{item.doctors.length?" · "+item.doctors.join(", "):""}</small>
          {item.detail&&<p className="prPrewrap">{item.detail}</p>}
          {(item.protocolName||item.toothCode)&&<p className="prHint">{[item.protocolName,item.toothCode,item.treatmentArea].filter(Boolean).join(" · ")}</p>}</div></li>)}</ol>}
  </article>;
}
export function PrescriptionsPanel({patientId,onEditing}:Props){
  const {api,run,pending,busy}=useApp();const [items,setItems]=useState<PatientPrescription[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [editor,setEditor]=useState(false),[date,setDate]=useState(today()),[note,setNote]=useState("");
  const [drugs,setDrugs]=useState<PrescriptionItemInput[]>([blank()]),[correcting,setCorrecting]=useState<PatientPrescription|null>(null);
  const [reason,setReason]=useState(""),[withdrawTarget,setWithdrawTarget]=useState<PatientPrescription|null>(null);
  const [caseId,setCaseId]=useState(""),[cases,setCases]=useState<{chiefComplaintId:string;chiefComplaint:string}[]>([]);
  const refresh=useCallback(()=>{setLoading(true);setError("");api.prescriptions(patientId).then(setItems)
    .catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();api.plans(patientId).then(v=>setCases(v.map(p=>({chiefComplaintId:p.chiefComplaintId,chiefComplaint:p.chiefComplaint})))).catch(()=>undefined);},[api,patientId,refresh]);
  const close=()=>{setEditor(false);setCorrecting(null);setWithdrawTarget(null);setReason("");setNote("");setDate(today());setDrugs([blank()]);setCaseId("");onEditing(false);setError("");};
  const edit=(p?:PatientPrescription)=>{setEditor(true);setCorrecting(p||null);setNote(p?.note||"");setDate(p?.prescribedOn||today());
    setCaseId(p?.chiefComplaintId||"");setDrugs(p? p.items.map(i=>({...i})): [blank()]);setReason("");onEditing(true);};
  const save=async()=>{
    const valid=drugs.every(d=>d.medicineName.trim()&&d.instructions.length<=1000);
    if(!valid||!drugs.length){setError("Enter every medicine name and review its dose and instructions.");return;}
    if(correcting&&!reason.trim()){setError("Provide a reason for this prescription correction.");return;}
    const input={patientId,chiefComplaintId:caseId||null,prescribedOn:date,note:note.trim()||null,items:drugs.map(d=>({...d,medicineName:d.medicineName.trim()}))};
    try{await run(correcting?"Correct prescription":"Save prescription",
      correcting?api.correctPrescription(correcting.prescriptionId,{...input,reason:reason.trim(),expectedRowVersion:correcting.rowVersion}):
        api.createPrescription(input),()=>{close();refresh();});}catch(e){setError(errorText(e));}
  };
  const withdraw=async()=>{
    if(!withdrawTarget||!reason.trim())return;
    try{await run("Withdraw prescription",api.withdrawPrescription(withdrawTarget.prescriptionId,withdrawTarget.rowVersion,reason.trim()),
      ()=>{close();refresh();});}catch(e){setError(errorText(e));}
  };
  const patchDrug=(idx:number,key:keyof PrescriptionItemInput,value:string)=>{setDrugs(v=>v.map((r,i)=>i===idx?{...r,[key]:value|| (key==="medicineName"||key==="instructions"?"":null)}:r));};
  return <article className="prCard"><div className="prSectionHeading"><h3>Prescription history</h3><div><button type="button" onClick={refresh}>Refresh</button>
    {!editor&&!withdrawTarget&&<button type="button" className="prPrimary" disabled={pending} onClick={()=>edit()}><Plus size={14}/> New prescription</button>}</div></div>
    {error&&<Alert>{error}</Alert>}
    {editor&&<div className="prEditor"><h4>{correcting?"Correct issued prescription":"New prescription"}</h4>
      <div className="prFormGrid"><FormField label="Prescribed on (AD)"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></FormField>
        <FormField label="Chief complaint"><select value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">General / no complaint</option>
          {cases.map(c=><option key={c.chiefComplaintId} value={c.chiefComplaintId}>{c.chiefComplaint}</option>)}</select></FormField>
        <FormField label="Prescription note"><textarea rows={2} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/></FormField></div>
      <h4>Medicines</h4>
      {drugs.map((d,i)=><div className="prDrugRow" key={i}>
        <FormField label="Medicine *"><input maxLength={200} value={d.medicineName} onChange={e=>patchDrug(i,"medicineName",e.target.value)}/></FormField>
        <FormField label="Dose"><input maxLength={100} value={d.dose||""} onChange={e=>patchDrug(i,"dose",e.target.value)}/></FormField>
        <FormField label="Frequency"><input maxLength={120} value={d.frequency||""} onChange={e=>patchDrug(i,"frequency",e.target.value)}/></FormField>
        <FormField label="Duration"><input maxLength={120} value={d.duration||""} onChange={e=>patchDrug(i,"duration",e.target.value)}/></FormField>
        <FormField label="Instructions"><input maxLength={1000} value={d.instructions} onChange={e=>patchDrug(i,"instructions",e.target.value)}/></FormField>
        <button className="prIconButton" type="button" disabled={drugs.length<2} onClick={()=>setDrugs(v=>v.filter((_,j)=>i!==j))} aria-label="Remove medicine"><Trash2 size={15}/></button>
      </div>)}
      <button type="button" onClick={()=>setDrugs(v=>[...v,blank()])} disabled={drugs.length>=30}><Plus size={14}/> Add medicine</button>
      {correcting&&<FormField label="Required correction reason"><textarea rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></FormField>}
      <div className="prFormActions"><button type="button" onClick={close}>Cancel</button>
        <button type="button" className="prPrimary" disabled={pending||!!busy} onClick={()=>void save()}>Save prescription</button></div>
    </div>}
    {loading?<p role="status">Loading prescriptions…</p>:items.length===0?<Empty>No prescriptions have been recorded.</Empty>:
      items.map(p=><div className="prListItem" key={p.prescriptionId}><div><strong>{dateLabel(p.prescribedOn)} · {p.status}</strong>
        {p.note&&<p>{p.note}</p>}
        <ul className="prCompactList">{p.items.map((item,i)=><li key={i}><b>{item.medicineName}</b>
          {" — "+[item.dose,item.frequency,item.duration,item.instructions].filter(Boolean).join(" · ")}</li>)}</ul>
        {p.withdrawalReason&&<small>Withdrawal: {p.withdrawalReason}</small>}</div>
        {p.status!=="withdrawn"&&!editor&&!withdrawTarget&&<div className="prRowButtons"><button type="button" disabled={pending} onClick={()=>edit(p)}><Pencil size={14}/> Correct</button>
          <button type="button" disabled={pending} onClick={()=>{setWithdrawTarget(p);setReason("");onEditing(true);}}>Withdraw</button></div>}</div>)}
    {withdrawTarget&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>Withdraw prescription</h3>
      <p>Withdrawal is recorded in clinical history; it does not erase the original.</p>
      <FormField label="Required reason"><textarea maxLength={500} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></FormField>
      <div className="prFormActions"><button type="button" onClick={close}>Cancel</button>
        <button type="button" className="prDanger" disabled={!reason.trim()||pending||!!busy} onClick={()=>void withdraw()}>Withdraw</button></div></div></div>}
  </article>;
}
