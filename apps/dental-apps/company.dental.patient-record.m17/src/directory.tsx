import { useCallback, useEffect, useRef, useState } from "react";
import { Search, UserRoundPlus, RefreshCw, UsersRound, ChevronRight, ChevronLeft } from "lucide-react";
import { Cohort, monthBS, readable } from "./api";
import type { PatientDirectoryCounts, PatientSummary } from "./types";
import { Alert, Empty, dateLabel, useApp } from "./main";

type Props={onSelect:(id:string)=>boolean;onCreate:()=>boolean};
export function PatientDirectory({onSelect,onCreate}:Props){
  const {api,pending}=useApp();
  const [input,setInput]=useState(""),[term,setTerm]=useState("");
  const [cohort,setCohort]=useState<Cohort>("all"),[month,setMonth]=useState(monthBS);
  const [cursors,setCursors]=useState<Array<string|null>>([null]),[page,setPage]=useState(0);
  const [rows,setRows]=useState<PatientSummary[]>([]),[total,setTotal]=useState(0);
  const [counts,setCounts]=useState<PatientDirectoryCounts>({all:0,new:0,regular:0});
  const [next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[version,setVersion]=useState(0);
  const current=useRef(0);
  useEffect(()=>{const timer=setTimeout(()=>setTerm(input.trim()),300);return()=>clearTimeout(timer);},[input]);
  useEffect(()=>{setCursors([null]);setPage(0);},[term,cohort,month]);
  useEffect(()=>{
    let active=true;const seq=++current.current;
    setLoading(true);setError("");
    void api.directory({query:term,cohort,month,cursor:cursors[page]??null,limit:10})
      .then(result=>{
        if(!active||seq!==current.current)return;
        setRows(result.patients);setCounts(result.counts);setTotal(result.total);setNext(result.nextCursor);
      }).catch(e=>{
        if(active&&seq===current.current){setRows([]);setCounts({all:0,new:0,regular:0});setTotal(0);setNext(null);setError(readable(e));}
      }).finally(()=>{if(active&&seq===current.current)setLoading(false);});
    return()=>{active=false;};
  },[api,term,cohort,month,page,cursors,version]);
  const forward=useCallback(()=>{
    if(!next||loading)return;
    setCursors(list=>[...list.slice(0,page+1),next]);setPage(i=>i+1);
  },[next,loading,page]);
  return <section className="prPage">
    <div className="prHeading"><div><h2><UsersRound size={19}/> Patient Record Directory</h2>
      <p>{loading?"Loading the patient directory…":error?"Patient directory unavailable":total+" registered or matching record"+(total===1?"":"s")}</p></div>
      <button type="button" className="prPrimary" onClick={onCreate} disabled={pending}><UserRoundPlus size={16}/> New patient</button></div>
    <div className="prCard">
      <div className="prDirectoryFilters">
        <div className="prSegments" role="group" aria-label="Patient activity filter">
          {(["all","new","regular"] as Cohort[]).map(c=><button key={c} type="button" aria-pressed={cohort===c}
            className={cohort===c?"selected":""} onClick={()=>setCohort(c)}>
            {c==="all"?"All":c==="new"?"New":"Regular"} <span>{counts[c]??0}</span></button>)}
        </div>
        <label className="prInline">BS month <input type="month" value={month} onChange={e=>setMonth(e.target.value)} min="2070-01" max="2096-12"/></label>
        <label className="prSearch"><Search size={16}/><input aria-label="Search patients" value={input} maxLength={120}
          onChange={e=>setInput(e.target.value)} placeholder="Search name, phone or record ID"/></label>
        <button className="prIconButton" type="button" aria-label="Refresh patient directory" title="Refresh" onClick={()=>setVersion(v=>v+1)} disabled={loading}><RefreshCw size={16}/></button>
      </div>
      {term&&<p className="prHint">Searching across all records. Month and activity filters resume when search is cleared.</p>}
      {error?<div className="prErrorArea"><Alert>{error}</Alert><button type="button" onClick={()=>setVersion(v=>v+1)}>Try again</button></div>:
      <>
        <div className="prTableWrap"><table className="prTable"><thead><tr><th>Patient</th><th>Record ID</th><th>Registered</th><th>Age / Sex</th><th>Status</th><th>Open</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.patientId}>
            <td><div className="prPatientName"><span className="prAvatar">{r.fullName.slice(0,1).toLocaleUpperCase()}</span><div>
              <strong>{r.fullName}</strong><small>{r.phone||"Phone not recorded"}</small></div></div></td>
            <td className="prMono">{r.patientNumber}</td><td>{dateLabel(r.registeredOn)}</td>
            <td>{r.ageYears??"—"} · {r.sex==="male"?"Male":r.sex==="female"?"Female":r.sex==="other"?"Other":"Not recorded"}</td>
            <td><span className={"prStatus "+r.status}>{r.status}</span></td>
            <td><button type="button" className="prLink" onClick={()=>onSelect(r.patientId)} disabled={pending}>View <ChevronRight size={14}/></button></td>
          </tr>)}</tbody></table></div>
        {loading&&<p className="prStatusLine" role="status">Loading patient records…</p>}
        {!loading&&rows.length===0&&<Empty><UsersRound size={30}/><h3>{term?"No matching patients":cohort!=="all"?"No patients in this group":"Your patient directory is ready"}</h3>
          <p>{term?"Try another name, number or phone.":"Register a patient to begin their longitudinal clinical record."}</p>
          {total===0&&!term&&<button type="button" className="prPrimary" onClick={onCreate}>Register first patient</button>}</Empty>}
        <div className="prPagination"><span>{total?(`${page*10+1}–${Math.min(total,page*10+rows.length)} of ${total}`):"0 records"}</span>
          <div><button type="button" disabled={page===0||loading} onClick={()=>setPage(i=>Math.max(0,i-1))}><ChevronLeft size={15}/> Previous</button>
            <span>Page {page+1}</span>
            <button type="button" disabled={!next||loading} onClick={forward}>Next <ChevronRight size={15}/></button></div></div>
      </>}
    </div>
  </section>;
}
