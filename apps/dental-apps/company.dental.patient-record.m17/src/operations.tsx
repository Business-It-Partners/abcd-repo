import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Wallet, Activity, FlaskConical, CalendarClock } from "lucide-react";
import type { PatientFollowUp, PatientLedger, OdontogramMark, OdontogramSlot, OdontogramValue, PatientPeriodontalChart, PatientCanalMeasurement } from "./types";
import { today, dateValid, isObject } from "./api";
import { Alert, Empty, FormField, dateLabel, currency, useApp, errorText } from "./main";
type Props={patientId:string;onEditing:(dirty:boolean)=>void};

export function FollowUpsPanel({patientId,onEditing}:Props){
  const {api,run,busy,pending}=useApp();
  const [rows,setRows]=useState<PatientFollowUp[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [dueOn,setDueOn]=useState(today()),[dueTime,setDueTime]=useState(""),[reason,setReason]=useState(""),[caseId,setCaseId]=useState("");
  const [cases,setCases]=useState<{chiefComplaintId:string;chiefComplaint:string}[]>([]);
  const refresh=useCallback(()=>{setLoading(true);setError("");void api.followUps(patientId).then(setRows).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();void api.plans(patientId).then(v=>setCases(v.map(p=>({chiefComplaintId:p.chiefComplaintId,chiefComplaint:p.chiefComplaint})))).catch(()=>undefined);},[api,patientId,refresh]);
  const clear=()=>{setDueOn(today());setDueTime("");setReason("");setCaseId("");onEditing(false);};
  const save=async()=>{
    if(!reason.trim()||!dateValid(dueOn)){setError("Enter a follow-up date and reason.");return;}
    try{await run("Schedule follow-up",api.createFollowUp({patientId,chiefComplaintId:caseId||null,dueOn,dueTime:dueTime||null,reason:reason.trim(),requestedByStaffId:null}),()=>{
      clear();refresh();});}catch(e){setError(errorText(e));}
  };
  return <article className="prCard"><div className="prSectionHeading"><h3><CalendarClock size={17}/> Patient follow-ups</h3><button type="button" onClick={refresh}><RefreshCw size={15}/> Refresh</button></div>
    {error&&<Alert>{error}</Alert>}
    <div className="prEditor"><h4>Schedule follow-up</h4><div className="prFormGrid">
      <FormField label="Due date (AD)"><input type="date" value={dueOn} onChange={e=>{setDueOn(e.target.value);onEditing(true);}}/></FormField>
      <FormField label="Time (optional)"><input type="time" value={dueTime} onChange={e=>{setDueTime(e.target.value);onEditing(true);}}/></FormField>
      <FormField label="Chief complaint"><select value={caseId} onChange={e=>{setCaseId(e.target.value);onEditing(true);}}>
        <option value="">General</option>{cases.map(c=><option key={c.chiefComplaintId} value={c.chiefComplaintId}>{c.chiefComplaint}</option>)}</select></FormField>
      <FormField label="Reason *"><input maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);onEditing(Boolean(e.target.value));}}/></FormField>
    </div><div className="prFormActions"><button type="button" onClick={clear}>Clear</button>
      <button type="button" className="prPrimary" disabled={!reason.trim()||!!busy||pending} onClick={()=>void save()}><Plus size={14}/> Schedule</button></div></div>
    {loading?<p role="status">Loading follow-up history…</p>:rows.length===0?<Empty>No follow-up history recorded.</Empty>:
      rows.map(row=><div className="prListItem" key={row.followUpId}><div><strong>{dateLabel(row.dueOn)} · {row.dueTime||"No time"}</strong><p>{row.reason}</p></div>
        <span className={"prStatus "+row.status}>{row.status}</span></div>)}
  </article>;
}

export function LedgerPanel({patientId,onEditing}:Props){
  const {api,run,capabilities,pending,busy}=useApp();
  const [ledger,setLedger]=useState<PatientLedger|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [month,setMonth]=useState(""),[cursor,setCursor]=useState("");
  const [amount,setAmount]=useState(""),[discount,setDiscount]=useState("0"),[method,setMethod]=useState("cash"),[paymentDate,setPaymentDate]=useState(today());
  const [edit,setEdit]=useState<{id:string;version:number;kind:"correct"|"reverse";amount:number}|null>(null),[reason,setReason]=useState(""),[adjusted,setAdjusted]=useState("0");
  const refresh=useCallback(()=>{setLoading(true);setError("");void api.ledger(patientId,month,cursor).then(setLedger).catch(e=>{setLedger(null);setError(errorText(e));}).finally(()=>setLoading(false));},[api,patientId,month,cursor]);
  useEffect(()=>{refresh();},[refresh]);
  const pay=async()=>{
    const a=Number(amount),d=Number(discount);
    if(!dateValid(paymentDate)||!Number.isFinite(a)||!Number.isFinite(d)||a<0||d<0||a+d<=0||Math.round(a*100)!==a*100||Math.round(d*100)!==d*100){setError("Enter a valid date and non-negative two-decimal NPR amounts.");return;}
    try{await run("Collect patient payment",api.collect({patientId,paymentDate,amount:a,discountAmount:d,
      paymentMethod:method as "cash"|"esewa"|"khalti"|"card"|"bank_transfer"|"cheque"}),()=>{
      setAmount("");setDiscount("0");setPaymentDate(today());onEditing(false);refresh();});
    }catch(e){setError(errorText(e));}
  };
  const saveCorrection=async()=>{
    if(!edit||!reason.trim())return;
    const value=Number(adjusted);
    if(edit.kind==="correct"&&(!Number.isFinite(value)||value<0||Math.round(value*100)!==value*100)){setError("Enter a valid corrected amount.");return;}
    const input={expectedRowVersion:edit.version,entryDate:today(),reason:reason.trim()};
    const complete=()=>{setEdit(null);setReason("");onEditing(false);refresh();};
    try{
      if(edit.kind==="correct")await run("Correct patient ledger",api.correctLedger(edit.id,{...input,amount:value}),complete);
      else await run("Reverse patient ledger entry",api.reverseLedger(edit.id,input),complete);
    }catch(e){setError(errorText(e));}
  };
  return <article className="prCard"><div className="prSectionHeading"><h3><Wallet size={17}/> Billing ledger</h3><button type="button" onClick={refresh}>Refresh</button></div>
    {error&&<Alert>{error}</Alert>}
    {ledger&&<div className="prMetrics">{[
      ["Total billed",ledger.summary.totalBilled],["Collected",ledger.summary.totalCollected],
      ["Discount",ledger.summary.totalDiscount],["Outstanding",ledger.summary.outstandingDue]
    ].map(([label,value])=><div key={label}><span>{label}</span><strong>{currency(value as number)}</strong></div>)}</div>}
    {capabilities.has("patient_payments.collect")&&<div className="prEditor"><h4>Record a payment</h4><div className="prFormGrid">
      <FormField label="Date (AD)"><input type="date" value={paymentDate} onChange={e=>{setPaymentDate(e.target.value);onEditing(true);}}/></FormField>
      <FormField label="Amount (NPR)"><input type="number" step="0.01" min="0" value={amount} onChange={e=>{setAmount(e.target.value);onEditing(Boolean(e.target.value));}}/></FormField>
      <FormField label="Discount (NPR)"><input type="number" step="0.01" min="0" value={discount} onChange={e=>{setDiscount(e.target.value);onEditing(true);}}/></FormField>
      <FormField label="Payment method"><select value={method} onChange={e=>{setMethod(e.target.value);onEditing(true);}}>
        {["cash","esewa","khalti","card","bank_transfer","cheque"].map(m=><option key={m} value={m}>{m.replace("_"," ")}</option>)}</select></FormField>
    </div><div className="prFormActions"><button type="button" onClick={()=>{setAmount("");setDiscount("0");setPaymentDate(today());onEditing(false);}}>Clear</button>
      <button type="button" className="prPrimary" disabled={!!busy||pending||!amount} onClick={()=>void pay()}>Record payment</button></div></div>}
    <div className="prDirectoryFilters"><FormField label="Month (AD)"><input type="month" value={month} onChange={e=>{setMonth(e.target.value);setCursor("");}}/></FormField>
      <button type="button" onClick={()=>{setMonth("");setCursor("");}}>All months</button></div>
    {loading?<p role="status">Loading ledger…</p>:ledger?.entries.length?
      <div className="prTableWrap"><table className="prTable"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th><th>Balance</th><th>Action</th></tr></thead>
      <tbody>{ledger.entries.map(e=><tr key={e.patientLedgerEntryId}><td>{dateLabel(e.entryDate)}</td><td>{e.entryType}</td>
        <td>{e.forLabel||e.receiptNumber||"—"}{e.correctionReason&&<small>{e.correctionReason}</small>}</td>
        <td>{currency(e.amount)}</td><td>{currency(e.runningBalance)}</td>
        <td>{capabilities.has("finance.manage")&&e.entryType!=="reversal"&&<div className="prRowButtons">
          <button type="button" disabled={pending} onClick={()=>{setEdit({id:e.patientLedgerEntryId,version:e.rowVersion,kind:"correct",amount:e.amount});setAdjusted(String(e.amount));onEditing(true);}}>Correct</button>
          <button type="button" disabled={pending} onClick={()=>{setEdit({id:e.patientLedgerEntryId,version:e.rowVersion,kind:"reverse",amount:e.amount});onEditing(true);}}>Reverse</button>
        </div>}</td></tr>)}</tbody></table></div>:<Empty>No ledger entries recorded for this filter.</Empty>}
    {ledger?.nextCursor&&<button type="button" disabled={loading} onClick={()=>setCursor(ledger.nextCursor||"")}>Next ledger page</button>}
    {edit&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>{edit.kind==="correct"?"Correct ledger entry":"Reverse ledger entry"}</h3>
      {edit.kind==="correct"&&<FormField label="Corrected amount"><input type="number" step="0.01" min="0" value={adjusted} onChange={e=>setAdjusted(e.target.value)}/></FormField>}
      <FormField label="Required reason"><textarea rows={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></FormField>
      <p className="prHint">Original entries remain in the audit history. Conflicting row versions are rejected.</p>
      <div className="prFormActions"><button type="button" onClick={()=>{setEdit(null);setReason("");onEditing(false);}}>Cancel</button>
        <button type="button" className="prDanger" disabled={!reason.trim()||!!busy||pending} onClick={()=>void saveCorrection()}>Confirm</button></div></div></div>}
  </article>;
}
const allowed:Record<OdontogramSlot,OdontogramValue[]>={
  presence:["erupted","unerupted","impacted","extracted","shed","missing","implant","mobility"],
  structure:["sound","decayed","filled","sealant"],endodontics:["root-treated","retreated"],
  prosthesis:["crown","veneer","bridge"]
};
export function ChartsPanel({patientId,onEditing}:Props){
  const {api,run,capabilities,pending,busy}=useApp();
  const [marks,setMarks]=useState<OdontogramMark[]>([]),[removed,setRemoved]=useState<OdontogramMark[]>([]);
  const [perio,setPerio]=useState<PatientPeriodontalChart|null>(null),[canals,setCanals]=useState<PatientCanalMeasurement[]>([]);
  const [tooth,setTooth]=useState(""),[slot,setSlot]=useState<OdontogramSlot>("structure"),[value,setValue]=useState<OdontogramValue>("decayed");
  const [draft,setDraft]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    const res=await Promise.allSettled([api.odontogram(patientId),api.periodontal(patientId),api.canals(patientId)]);
    if(res[0].status==="fulfilled"&&isObject(res[0].value)&&Array.isArray(res[0].value.marks))setMarks(res[0].value.marks as OdontogramMark[]);
    if(res[1].status==="fulfilled"&&isObject(res[1].value)&&isObject(res[1].value.chart))setPerio(res[1].value.chart as PatientPeriodontalChart);
    if(res[2].status==="fulfilled"&&isObject(res[2].value)&&Array.isArray(res[2].value.sessions))setCanals(res[2].value.sessions as PatientCanalMeasurement[]);
    if(res.some(r=>r.status==="rejected"))setError("Some clinical chart sections could not load. Check permissions or refresh.");
    setLoading(false);
  },[api,patientId]);
  useEffect(()=>{void refresh();},[refresh]);
  const mark=()=>{setDraft(true);onEditing(true);};
  const add=()=>{
    if(!/^[1-8][1-8]$/.test(tooth)){setError("Use a valid two-digit FDI permanent tooth code.");return;}
    setMarks(rows=>[...rows.filter(x=>!(x.toothCode===tooth&&x.slot===slot)),{toothCode:tooth,slot,value}]);mark();
  };
  const remove=(m:OdontogramMark)=>{setMarks(rows=>rows.filter(x=>x!==m));setRemoved(rows=>[...rows,m]);mark();};
  const save=async()=>{
    try{await run("Save odontogram",api.saveOdontogram(patientId,{recordedOn:today(),marks,removedMarks:removed}),()=>{
      setRemoved([]);setDraft(false);onEditing(false);void refresh();
    });}catch(e){setError(errorText(e));}
  };
  return <article className="prCard"><div className="prSectionHeading"><h3><Activity size={17}/> Dental chart history</h3>
    <button type="button" disabled={draft} onClick={()=>void refresh()}>Refresh</button></div>
    {error&&<Alert>{error}</Alert>}{loading?<p role="status">Loading dental charts…</p>:<>
      <h4>Odontogram</h4><div className="prFormGrid compact">
        <FormField label="FDI tooth"><input maxLength={2} value={tooth} placeholder="16" onChange={e=>setTooth(e.target.value)}/></FormField>
        <FormField label="Category"><select value={slot} onChange={e=>{const s=e.target.value as OdontogramSlot;setSlot(s);setValue(allowed[s][0]);}}>
          {Object.keys(allowed).map(s=><option key={s}>{s}</option>)}</select></FormField>
        <FormField label="Finding"><select value={value} onChange={e=>setValue(e.target.value as OdontogramValue)}>
          {allowed[slot].map(v=><option key={v}>{v}</option>)}</select></FormField>
        {capabilities.has("work_entry.access")&&<div className="prField"><span>&nbsp;</span><button type="button" disabled={pending} onClick={add}><Plus size={14}/> Add</button></div>}
      </div>
      <div className="prTagList">{marks.map((m,i)=><span className="prTag" key={i}>{m.toothCode} · {m.slot}: {m.value}
        {capabilities.has("work_entry.access")&&<button type="button" onClick={()=>remove(m)} aria-label="Remove finding">×</button>}</span>)}
        {!marks.length&&<p className="prHint">No odontogram findings documented.</p>}</div>
      {draft&&<div className="prFormActions"><button type="button" onClick={()=>{setDraft(false);setRemoved([]);onEditing(false);void refresh();}}>Discard</button>
        <button type="button" className="prPrimary" disabled={pending||!!busy} onClick={()=>void save()}>Save odontogram</button></div>}
      <h4>Periodontal chart</h4>
      {perio?.teeth.length?<div className="prTableWrap"><table className="prTable"><thead><tr><th>Tooth</th><th>Probing depths</th><th>Mobility</th><th>Bleeding</th></tr></thead>
        <tbody>{perio.teeth.map(t=><tr key={t.toothCode}><td>{t.toothCode}</td><td>{["db","b","mb","dl","l","ml"].map(site=>t.probingDepths[site as keyof typeof t.probingDepths]).join(" / ")} mm</td>
          <td>{t.mobilityGrade}</td><td>{Object.values(t.bleedingOnProbing).filter(Boolean).length} / 6</td></tr>)}</tbody></table></div>:
        <Empty>No periodontal chart saved.</Empty>}
      <p className="prHint">Last periodontal chart: {dateLabel(perio?.lastChartedOn)}. Detailed site-entry correction is not available in this first implementation.</p>
      <h4>Canal measurement history</h4>
      {canals.length?canals.map(c=><div className="prListItem" key={c.canalMeasurementSessionId}><div>
        <strong>{dateLabel(c.recordedOn)} · Tooth {c.toothCode||"General"}</strong>
        <ul className="prCompactList">{c.records.map((r,i)=><li key={i}>{r.canalLabel}: {r.workingLengthMm} mm{r.fileNumber?" · File "+r.fileNumber:""}</li>)}</ul>
      </div></div>):<Empty>No canal measurements yet.</Empty>}
    </>}
  </article>;
}
type LabOrder={labOrderId:string;labWorkName:string;chiefComplaintId:string;toothScope:string|null;labNameSnapshot:string|null;
  status:"pending_assignment"|"sent"|"received"|"fitted"|"cancelled";rowVersion:number;sentOn:string|null;receivedOn:string|null;fittedOn:string|null};
export function LabsPanel({patientId,onEditing}:Props){
  const {api,run,capabilities,pending,busy}=useApp();
  const [rows,setRows]=useState<LabOrder[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [target,setTarget]=useState<LabOrder|null>(null),[status,setStatus]=useState<LabOrder["status"]>("sent");
  const [creating,setCreating]=useState(false),[caseId,setCaseId]=useState(""),[work,setWork]=useState(""),[tooth,setTooth]=useState("");
  const [cases,setCases]=useState<{chiefComplaintId:string;chiefComplaint:string}[]>([]);
  const refresh=useCallback(()=>{setLoading(true);setError("");
    void api.labOrders(patientId).then(v=>{if(!isObject(v)||!Array.isArray(v.labOrders))throw new Error("Invalid lab order response.");setRows(v.labOrders as LabOrder[]);})
      .catch(e=>{setRows([]);setError(errorText(e));}).finally(()=>setLoading(false));},[api,patientId]);
  useEffect(()=>{refresh();void api.plans(patientId).then(v=>setCases(v.map(p=>({chiefComplaintId:p.chiefComplaintId,chiefComplaint:p.chiefComplaint})))).catch(()=>undefined);},[api,patientId,refresh]);
  const close=()=>{setTarget(null);setCreating(false);setError("");onEditing(false);};
  const create=async()=>{
    if(!caseId||!work.trim()){setError("Choose a complaint and enter the lab work.");return;}
    try{await run("Save patient lab request",api.createLabRequest({patientId,chiefComplaintId:caseId,labWorkName:work.trim(),
      toothScope:tooth.trim()||null,shade:null,clinicalNote:null}),()=>{setWork("");setTooth("");setCaseId("");close();refresh();});}
    catch(e){setError(errorText(e));}
  };
  const update=async()=>{
    if(!target)return;
    try{await run("Update lab status",api.updateLab(target.labOrderId,{expectedRowVersion:target.rowVersion,status,
      ...(status==="received"?{receivedOn:today()}:{}),...(status==="fitted"?{fittedOn:today()}:{} )}),()=>{close();refresh();});}
    catch(e){setError(errorText(e));}
  };
  return <article className="prCard"><div className="prSectionHeading"><h3><FlaskConical size={17}/> Patient lab work</h3><div>
    <button type="button" onClick={refresh}>Refresh</button>
    {capabilities.has("lab_requests.create")&&<button type="button" className="prPrimary" onClick={()=>{setCreating(true);onEditing(true);}} disabled={pending}><Plus size={14}/> New request</button>}
    </div></div>
    {error&&<Alert>{error}</Alert>}
    {loading?<p role="status">Loading lab orders…</p>:rows.length===0?<Empty>No lab orders recorded for this patient.</Empty>:
      <div className="prTableWrap"><table className="prTable"><thead><tr><th>Work</th><th>Tooth</th><th>Supplier</th><th>Status</th><th>Sent on</th><th>Action</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.labOrderId}><td><strong>{row.labWorkName}</strong></td><td>{row.toothScope||"—"}</td>
          <td>{row.labNameSnapshot||"Unassigned"}</td><td><span className={"prStatus "+row.status}>{row.status.replace("_"," ")}</span></td><td>{dateLabel(row.sentOn)}</td>
          <td>{capabilities.has("lab_tracker.access")&&<button type="button" disabled={pending} onClick={()=>{setTarget(row);setStatus(row.status);onEditing(true);}}>Update</button>}</td></tr>)}</tbody></table></div>}
    {target&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>Update lab work</h3>
      <p>{target.labWorkName}</p>
      <FormField label="Status"><select value={status} onChange={e=>setStatus(e.target.value as LabOrder["status"])}>
        {["pending_assignment","sent","received","fitted","cancelled"].map(v=><option key={v} value={v}>{v.replace("_"," ")}</option>)}</select></FormField>
      <div className="prFormActions"><button type="button" onClick={close}>Cancel</button>
        <button type="button" className="prPrimary" disabled={pending||!!busy} onClick={()=>void update()}>Save change</button></div></div></div>}
    {creating&&<div className="prOverlay" role="dialog" aria-modal="true"><div className="prDialog"><h3>New lab request</h3>
      <FormField label="Chief complaint"><select value={caseId} onChange={e=>setCaseId(e.target.value)}><option value="">Select</option>
        {cases.map(c=><option key={c.chiefComplaintId} value={c.chiefComplaintId}>{c.chiefComplaint}</option>)}</select></FormField>
      <FormField label="Lab work"><input value={work} maxLength={200} onChange={e=>setWork(e.target.value)}/></FormField>
      <FormField label="Tooth scope"><input value={tooth} maxLength={40} onChange={e=>setTooth(e.target.value)}/></FormField>
      <div className="prFormActions"><button type="button" onClick={close}>Cancel</button>
        <button type="button" className="prPrimary" disabled={!caseId||!work.trim()||!!busy||pending} onClick={()=>void create()}>Create request</button></div></div></div>}
  </article>;
}
