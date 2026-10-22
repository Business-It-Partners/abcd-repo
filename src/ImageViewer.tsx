import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { inspectImageDimensions } from './filesPreview';
import './ImageViewer.css';

/** Only the trusted shell preload can receive these bytes; no native paths or app bridge. */
export type ViewerImage={sessionId:string;generation:number;name:string;index:number;count:number;bytes:Uint8Array;typeHint:string};
export function ImageViewer({image,active,busy,error,onStep}:{
  image:ViewerImage|null;active:boolean;busy:boolean;error:string;onStep:(direction:-1|1)=>void;
}){
  const [source,setSource]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const [zoom,setZoom]=useState(1);
  const [rotation,setRotation]=useState(0);
  const focus=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(active)focus.current?.focus({preventScroll:true});},[active,image?.sessionId]);
  useEffect(()=>{
    let revoked=false,url:string|undefined;
    setSource(null);setMessage('');setZoom(1);setRotation(0);
    if(!image)return;
    // Copy once into an immutable Blob and zero the renderer's IPC byte buffer.
    const dimensions=inspectImageDimensions(image.bytes,image.typeHint);
    if(!dimensions){image.bytes.fill(0);setMessage('This picture cannot be safely decoded.');return;}
    const payload=Uint8Array.from(image.bytes);image.bytes.fill(0);
    const blob=new Blob([payload],{type:dimensions.mime});payload.fill(0);
    void (async()=>{
      let bitmap:ImageBitmap|undefined;
      try{
        bitmap=await createImageBitmap(blob);
        const orientationMatches=(bitmap.width===dimensions.width&&bitmap.height===dimensions.height)
          ||(bitmap.width===dimensions.height&&bitmap.height===dimensions.width);
        if(!orientationMatches||bitmap.width*bitmap.height>25_000_000)throw Error('IMAGE_DIMENSIONS_CHANGED');
        if(revoked)return;
        // Flatten one decoded frame, cap rendered pixels and strip file metadata.
        // Animated files never enter a live multi-frame <img> decoder.
        const scale=Math.min(1,Math.sqrt(4_000_000/(bitmap.width*bitmap.height)));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.floor(bitmap.width*scale));
        canvas.height=Math.max(1,Math.floor(bitmap.height*scale));
        const context=canvas.getContext('2d',{alpha:true});
        if(!context)throw Error('IMAGE_RENDER_UNAVAILABLE');
        context.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const flattened=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
        canvas.width=0;canvas.height=0;
        if(!flattened||flattened.size>16*1024*1024)throw Error('IMAGE_RENDER_LIMIT');
        if(revoked)return;
        url=URL.createObjectURL(flattened);setSource(url);
      }catch{if(!revoked)setMessage('Unable to decode this picture.');}
      finally{bitmap?.close();}
    })();
    return()=>{revoked=true;if(url)URL.revokeObjectURL(url);};
  },[image]);
  const changeZoom=(delta:number)=>setZoom(value=>Math.max(.25,Math.min(4,Math.round((value+delta)*100)/100)));
  const keys=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();if(!busy)onStep(event.key==='ArrowLeft'?-1:1);}
    else if(event.key==='+'||event.key==='='){event.preventDefault();changeZoom(.25);}
    else if(event.key==='-'){event.preventDefault();changeZoom(-.25);}
    else if(event.key.toLowerCase()==='r'){event.preventDefault();setRotation(value=>(value+90)%360);}
  };
  return <div className="image-viewer" data-testid="image-viewer" data-app-focus tabIndex={-1} ref={focus} onKeyDown={keys}>
    <div className="image-viewer-tools">
      <div className="image-viewer-pages">
        <button aria-label="Previous picture" title="Previous picture" disabled={busy||!image||image.count<2} onClick={()=>onStep(-1)}><ChevronLeft size={18}/></button>
        <span aria-label="Picture position">{image?image.index+1:0} / {image?.count??0}</span>
        <button aria-label="Next picture" title="Next picture" disabled={busy||!image||image.count<2} onClick={()=>onStep(1)}><ChevronRight size={18}/></button>
      </div>
      <span className="image-viewer-filename" title={image?.name}>{image?.name??'Image Viewer'}</span>
      <div className="image-viewer-controls">
        <button aria-label="Zoom out" disabled={!source} onClick={()=>changeZoom(-.25)}><ZoomOut size={17}/></button>
        <span aria-label="Current zoom">{Math.round(zoom*100)}%</span>
        <button aria-label="Zoom in" disabled={!source} onClick={()=>changeZoom(.25)}><ZoomIn size={17}/></button>
        <button aria-label="Fit image to window" disabled={!source} onClick={()=>{setZoom(1);setRotation(0);}}><Maximize size={17}/></button>
        <button aria-label="Rotate picture left" disabled={!source} onClick={()=>setRotation(value=>(value+270)%360)}><RotateCcw size={17}/></button>
        <button aria-label="Rotate picture right" disabled={!source} onClick={()=>setRotation(value=>(value+90)%360)}><RotateCw size={17}/></button>
      </div>
    </div>
    <div className="image-viewer-canvas">
      {source&&<img src={source} alt={image?.name??'Picture'} draggable={false} style={{transform:`scale(${zoom}) rotate(${rotation}deg)`}}/>}
      {!source&&<div role="status" className="image-viewer-loading">{error||message||'Opening picture…'}</div>}
      {(error||message)&&source&&<div role="alert" className="image-viewer-alert">{error||message}</div>}
    </div>
  </div>;
}
