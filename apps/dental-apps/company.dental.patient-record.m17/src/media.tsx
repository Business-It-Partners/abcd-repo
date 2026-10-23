import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload, RefreshCw, ZoomIn, RotateCw, ArrowLeftRight, X } from "lucide-react";
import type { PatientMediaAsset, PatientXrayType } from "./types";
import { dateValid, today, type MediaPending, readable } from "./api";
import { Alert, Empty, FormField, dateLabel, useApp, errorText } from "./main";

type Props={patientId:string;onEditing:(value:boolean)=>void};
type Selected = {asset:PatientMediaAsset;url:string};
const mimeTypes=["image/jpeg","image/png","image/webp"];
const allowed=["IOPA","OPG","CBCT","Intraoral photo"] as const;
const maxBytes=10*1024*1024;
/** All bytes flow via clinic.media.read/upload. The app never receives backend URLs,
 * storage keys or credentials. Blob URLs are revoked on close, refresh and unmount. */
export function XrayPanel({patientId,onEditing}:Props) {
  const {api,media,busy,pending:pendingWrite}=useApp();
  const [items,setItems]=useState<PatientMediaAsset[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [selected,setSelected]=useState<Selected|null>(null),[opening,setOpening]=useState("");
  const [zoom,setZoom]=useState(1),[angle,setAngle]=useState(0);
  const [file,setFile]=useState<File|null>(null),[kind,setKind]=useState<PatientXrayType>("IOPA");
  const [tooth,setTooth]=useState(""),[note,setNote]=useState(""),[captured,setCaptured]=useState(today());
  const [uploading,setUploading]=useState(false),[uploaded,setUploaded]=useState(0);
  const [transfer,setTransfer]=useState<MediaPending|null>(null),[unknown,setUnknown]=useState(false);
  const [replacing,setReplacing]=useState<PatientMediaAsset|null>(null),[replacementReason,setReplacementReason]=useState("");
  const currentUrl=useRef<string|null>(null),alive=useRef(true);
  const close=useCallback(()=>{if(currentUrl.current){URL.revokeObjectURL(currentUrl.current);currentUrl.current=null;}setSelected(null);setZoom(1);setAngle(0);},[]);
  const refresh=useCallback(async()=>{setLoading(true);setError("");
    try{setItems((await api.media(patientId)).filter(m=>m.status==="active"));}
    catch(e){setItems([]);setError(errorText(e));}
    finally{setLoading(false);}
  },[api,patientId]);
  useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);};},[refresh]);
  const open=async(asset:PatientMediaAsset)=>{
    setOpening(asset.mediaAssetId);setError("");close();
    try{const url=await media.view(patientId,asset.mediaAssetId);
      if(!alive.current){URL.revokeObjectURL(url);return;}
      currentUrl.current=url;setSelected({asset,url});}
    catch(e){setError(errorText(e));}
    finally{if(alive.current)setOpening("");}
  };
  const reset=()=>{setFile(null);setTooth("");setNote("");setCaptured(today());setKind("IOPA");setReplacing(null);setReplacementReason("");
    onEditing(false);setUploaded(0);};
  const selectFile=(incoming:File|null)=>{
    if(!incoming){setFile(null);return;}
    if(!mimeTypes.includes(incoming.type)||incoming.size<1||incoming.size>maxBytes){
      setFile(null);setError("Select a valid JPEG, PNG or WebP image, up to 10 MiB.");return;
    }
    setError("");setFile(incoming);onEditing(true);
  };
  const prepare=async()=>{
    if(!file)return;
    if(!dateValid(captured)){setError("Choose a valid X-ray capture date.");return;}
    if(!file.name||file.name.length>200){setError("The image filename is too long.");return;}
    if(replacing&&!replacementReason.trim()){setError("Replacement requires a clinical reason.");return;}
    setUploading(true);setError("");setUploaded(0);
    try{
      const pending=await media.begin(patientId,file,{chiefComplaintId:null,xrayType:kind,
        toothCode:tooth.trim()||null,clinicalNote:note.trim()||null,capturedOn:captured},
        replacing?{assetId:replacing.mediaAssetId,reason:replacementReason.trim()}:undefined);
      setTransfer(pending);
      try{
        const result=await media.transfer(pending,value=>{if(alive.current)setUploaded(Math.round(value/pending.total*100));});
        if(!result.committed)throw new Error("The host did not confirm the image upload.");
        setTransfer(null);setUnknown(false);reset();await refresh();
      }catch(e){setUnknown(true);setError("The image upload is unfinished or its outcome is uncertain. Reconcile the original transfer before leaving.");}
    }catch(e){setError(errorText(e));}
    finally{setUploading(false);}
  };
  const retry=async()=>{
    if(!transfer)return;
    setUploading(true);setError("");
    try{
      // If chunks did not finish, resume at the exact acknowledged offset.
      // If commit was attempted, this uses the original stable operation key.
      const result=await media.transfer(transfer,value=>setUploaded(Math.round(value/transfer.total*100)));
      if(!result.committed)throw new Error("The original upload is not confirmed.");
      setTransfer(null);setUnknown(false);reset();await refresh();
    }catch(e){setUnknown(true);setError(errorText(e));}
    finally{setUploading(false);}
  };
  const cancel=async()=>{
    if(!transfer)return;
    setUploading(true);setError("");
    try{
      const result=await media.cancel(transfer);
      if(result.committed){
        setTransfer(null);setUnknown(false);reset();await refresh();
        setError("The clinic already saved this image. The original upload cannot be undone by cancellation.");
      }else if(result.cancelled){
        setTransfer(null);setUnknown(false);reset();
      }else{setUnknown(true);setError("Cancellation is not confirmed; retry the original request.");}
    }catch(e){setUnknown(true);setError(errorText(e));}
    finally{setUploading(false);}
  };
  const currentIndex=selected?items.findIndex(m=>m.mediaAssetId===selected.asset.mediaAssetId):-1;
  const neighbour=(direction:number)=>{
    if(currentIndex<0||items.length<2)return;
    const item=items[(currentIndex+items.length+direction)%items.length];
    void open(item);
  };
  const downloadUnavailable=<p className="prHint">Images are private clinical records. Viewing and uploading use the Dental OS media broker; direct download URLs, withdrawal and deletion are not provided by this app.</p>;
  return <article className="prCard">
    <div className="prSectionHeading"><h3><ImageIcon size={17}/> Patient X-rays and clinical images</h3>
      <button type="button" disabled={!!transfer||uploading} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button></div>
    {error&&<Alert>{error}</Alert>}
    {loading?<p role="status">Loading private image metadata…</p>:items.length===0?<Empty>No patient X-rays uploaded yet.</Empty>:
      <div className="prMediaGrid">{items.map(m=><button type="button" className="prMediaTile" key={m.mediaAssetId} onClick={()=>void open(m)} disabled={!!opening||uploading}>
        <span className="prMediaGlyph"><ImageIcon size={26}/></span>
        <strong>{m.displayFilename}</strong><small>{m.xrayType||"Clinical image"} · {dateLabel(m.capturedOn)}</small>
        <span className="prHint">{m.toothCode?"Tooth "+m.toothCode+" · ":""}{(m.byteSize/1024).toFixed(0)} KB</span>
      </button>)}</div>}
    {selected&&<div className="prOverlay" role="dialog" aria-modal="true" aria-label="X-ray viewer">
      <div className="prImageDialog"><div className="prImageToolbar"><strong>{selected.asset.displayFilename}</strong>
        <button type="button" disabled={uploading||!!transfer||pendingWrite}
          onClick={()=>{setReplacing(selected.asset);setKind(selected.asset.xrayType||"IOPA");
            setTooth(selected.asset.toothCode||"");setNote(selected.asset.clinicalNote||"");
            setCaptured(selected.asset.capturedOn||today());onEditing(true);close();}}>Replace image</button>
        <button type="button" onClick={()=>neighbour(-1)} disabled={items.length<2} aria-label="Previous image"><ArrowLeftRight size={15}/> Previous</button>
        <button type="button" onClick={()=>neighbour(1)} disabled={items.length<2}>Next</button>
        <button type="button" onClick={()=>setZoom(v=>Math.min(v+0.25,4))} aria-label="Zoom in"><ZoomIn size={15}/></button>
        <button type="button" onClick={()=>setZoom(v=>Math.max(v-0.25,0.25))} aria-label="Zoom out">−</button>
        <button type="button" onClick={()=>{setZoom(1);setAngle(0);}}>Fit</button>
        <button type="button" onClick={()=>setAngle(v=>(v+90)%360)} aria-label="Rotate image"><RotateCw size={15}/></button>
        <button type="button" onClick={close} aria-label="Close image"><X size={17}/></button></div>
        <div className="prImageCanvas"><img alt={"Private patient image: "+selected.asset.displayFilename} src={selected.url}
          style={{transform:"scale("+zoom+") rotate("+angle+"deg)"}}/></div>
        <div className="prImageFooter"><span>{selected.asset.xrayType||"Image"} · {dateLabel(selected.asset.capturedOn)}</span>
          <span>{selected.asset.clinicalNote||""}</span></div></div></div>}
    {opening&&<p role="status">Opening verified image…</p>}
    <div className="prEditor"><h4>{replacing?"Replace patient X-ray":"Upload X-ray or clinical image"}</h4>
      <div className="prFormGrid">
        <FormField label="Image file (JPEG/PNG/WebP, max 10 MiB)"><input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={!!transfer||uploading||pendingWrite}
          onChange={e=>selectFile(e.target.files?.[0]||null)}/></FormField>
        <FormField label="X-ray type"><select value={kind} disabled={!!transfer||uploading} onChange={e=>{setKind(e.target.value as PatientXrayType);onEditing(true);}}>
          {allowed.map(v=><option key={v}>{v}</option>)}</select></FormField>
        <FormField label="Captured on (AD)"><input type="date" value={captured} max={today()} disabled={!!transfer||uploading} onChange={e=>{setCaptured(e.target.value);onEditing(true);}}/></FormField>
        <FormField label="Tooth code (optional)"><input maxLength={40} value={tooth} disabled={!!transfer||uploading} onChange={e=>{setTooth(e.target.value);onEditing(true);}}/></FormField>
        <FormField label="Clinical note"><textarea rows={2} maxLength={1000} value={note} disabled={!!transfer||uploading} onChange={e=>{setNote(e.target.value);onEditing(true);}}/></FormField>
      </div>
      {replacing&&<FormField label="Required replacement reason"><textarea maxLength={500} value={replacementReason} disabled={!!transfer||uploading}
        onChange={e=>{setReplacementReason(e.target.value);onEditing(true);}}/></FormField>}
      {transfer&&<section className="prWarning" role="alert"><strong>{unknown?"Transfer outcome requires reconciliation":"Image transfer is in progress"}</strong>
        <p>Transferred {uploaded}%. Keep the same selected image and original upload key until the clinic confirms its result.</p>
        <div className="prFormActions"><button type="button" disabled={uploading} onClick={()=>void cancel()}>Cancel original transfer</button>
          <button type="button" className="prPrimary" disabled={uploading} onClick={()=>void retry()}>Resume / reconcile original transfer</button></div></section>}
      {!transfer&&<div className="prFormActions"><button type="button" disabled={uploading} onClick={reset}>Clear</button>
        <button type="button" className="prPrimary" onClick={()=>void prepare()} disabled={!file||uploading||pendingWrite}><Upload size={14}/> {uploading?"Uploading…":replacing?"Replace image":"Upload image"}</button></div>}
    </div>
    {downloadUnavailable}
  </article>;
}
