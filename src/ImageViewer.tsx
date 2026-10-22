import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { inspectImageDimensions } from './filesPreview';
import './ImageViewer.css';

/** Only the trusted shell preload can receive these bytes; no native paths or app bridge. */
export type ViewerImage={sessionId:string;generation:number;name:string;index:number;count:number;bytes:Uint8Array;typeHint:string};
type FitLayout={width:number;height:number;scale:number};
function fitLayout(width:number,height:number,viewportWidth:number,viewportHeight:number,rotation:number):FitLayout{
  if(width<1||height<1||viewportWidth<1||viewportHeight<1)return{width,height,scale:1};
  const rotated=rotation%180!==0;
  const fit=Math.min(1,viewportWidth/(rotated?height:width),viewportHeight/(rotated?width:height));
  return{width:width*fit,height:height*fit,scale:fit};
}
export function ImageViewer({image,active,busy,error,onStep}:{
  image:ViewerImage|null;active:boolean;busy:boolean;error:string;onStep:(direction:-1|1)=>void;
}){
  const [message,setMessage]=useState('');
  const [zoom,setZoom]=useState(1);
  const [fitScale,setFitScale]=useState(1);
  const [fitSize,setFitSize]=useState({width:0,height:0});
  const [rotation,setRotation]=useState(0);
  const [pan,setPan]=useState({x:0,y:0});
  const [panning,setPanning]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const panStart=useRef<{pointerId:number;clientX:number;clientY:number;x:number;y:number}|null>(null);
  const [ready,setReady]=useState(false);
  const focus=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(active)focus.current?.focus({preventScroll:true});},[active,image?.sessionId]);
  useEffect(()=>{
    let cancelled=false;
    panStart.current=null;setPanning(false);setReady(false);setMessage('');setZoom(1);setFitScale(1);setFitSize({width:0,height:0});setRotation(0);setPan({x:0,y:0});
    if(canvas.current){canvas.current.width=0;canvas.current.height=0;}
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
        if(cancelled)return;
        // Draw one decoded frame directly into a bounded canvas. This avoids an
        // object URL lifetime race and strips source metadata from the display.
        // Animated files never enter a live multi-frame <img> decoder.
        const scale=Math.min(1,Math.sqrt(4_000_000/(bitmap.width*bitmap.height)));
        const surface=canvas.current;
        if(!surface)throw Error('IMAGE_RENDER_UNAVAILABLE');
        surface.width=Math.max(1,Math.floor(bitmap.width*scale));
        surface.height=Math.max(1,Math.floor(bitmap.height*scale));
        const context=surface.getContext('2d',{alpha:true});
        if(!context)throw Error('IMAGE_RENDER_UNAVAILABLE');
        context.drawImage(bitmap,0,0,surface.width,surface.height);
        const viewport=surface.parentElement;
        const layout=fitLayout(surface.width,surface.height,viewport?.clientWidth??0,viewport?.clientHeight??0,0);
        setFitSize({width:layout.width,height:layout.height});setFitScale(layout.scale);
        if(!cancelled)setReady(true);
      }catch{if(!cancelled){if(canvas.current){canvas.current.width=0;canvas.current.height=0;}setMessage('Unable to decode this picture.');}}
      finally{bitmap?.close();}
    })();
    return()=>{cancelled=true;if(canvas.current){canvas.current.width=0;canvas.current.height=0;}};
  },[image]);
  const measureFit=useCallback((nextRotation=rotation)=>{
    const surface=canvas.current,viewport=surface?.parentElement;
    if(!surface||!viewport)return;
    const layout=fitLayout(surface.width,surface.height,viewport.clientWidth,viewport.clientHeight,nextRotation);
    setFitSize({width:layout.width,height:layout.height});setFitScale(layout.scale);
  },[rotation]);
  const clampPan=useCallback((x:number,y:number,nextZoom=zoom,nextRotation=rotation)=>{
    const surface=canvas.current,viewport=surface?.parentElement;
    if(!ready||!surface||!viewport)return{x:0,y:0};
    const width=surface.offsetWidth,height=surface.offsetHeight,swapped=nextRotation%180!==0;
    const renderedWidth=(swapped?height:width)*nextZoom;
    const renderedHeight=(swapped?width:height)*nextZoom;
    const bounds=viewport.getBoundingClientRect();
    const centerX=bounds.left+viewport.clientLeft+viewport.clientWidth/2;
    const centerY=bounds.top+viewport.clientTop+viewport.clientHeight/2;
    const minX=renderedWidth>viewport.clientWidth?bounds.right-centerX-renderedWidth/2:0;
    const maxX=renderedWidth>viewport.clientWidth?bounds.left-centerX+renderedWidth/2:0;
    const minY=renderedHeight>viewport.clientHeight?bounds.bottom-centerY-renderedHeight/2:0;
    const maxY=renderedHeight>viewport.clientHeight?bounds.top-centerY+renderedHeight/2:0;
    return{x:Math.max(minX,Math.min(maxX,x)),y:Math.max(minY,Math.min(maxY,y))};
  },[ready,zoom,rotation]);
  useEffect(()=>{
    const viewport=canvas.current?.parentElement;
    if(!ready||!viewport)return;
    const resize=()=>measureFit();
    resize();
    const observer=new ResizeObserver(resize);observer.observe(viewport);
    return()=>observer.disconnect();
  },[measureFit,ready]);
  useEffect(()=>{if(ready)setPan(current=>clampPan(current.x,current.y));},[clampPan,fitSize,ready]);
  const beginPan=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(event.button!==0||!ready||zoom<=1)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    panStart.current={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY,x:pan.x,y:pan.y};setPanning(true);
  };
  const movePan=(event:PointerEvent<HTMLCanvasElement>)=>{
    const start=panStart.current;if(!start||start.pointerId!==event.pointerId)return;
    event.preventDefault();setPan(clampPan(start.x+event.clientX-start.clientX,start.y+event.clientY-start.clientY));
  };
  const endPan=(event:PointerEvent<HTMLCanvasElement>)=>{
    if(panStart.current?.pointerId!==event.pointerId)return;
    panStart.current=null;setPanning(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const changeZoom=(delta:number)=>setZoom(value=>Math.max(.25,Math.min(4,Math.round((value+delta)*100)/100)));
  const rotate=(direction:-1|1)=>{
    const next=(rotation+(direction===1?90:270))%360;
    setRotation(next);setPan({x:0,y:0});measureFit(next);
  };
  const fitToWindow=()=>{setZoom(1);setRotation(0);setPan({x:0,y:0});measureFit(0);};
  const keys=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();if(!busy)onStep(event.key==='ArrowLeft'?-1:1);}
    else if(event.key==='+'||event.key==='='){event.preventDefault();changeZoom(.25);}
    else if(event.key==='-'){event.preventDefault();changeZoom(-.25);}
    else if(event.key.toLowerCase()==='r'){event.preventDefault();rotate(1);}
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
        <button aria-label="Zoom out" disabled={!ready} onClick={()=>changeZoom(-.25)}><ZoomOut size={17}/></button>
        <span aria-label="Current zoom">{Math.round(zoom*fitScale*100)}%</span>
        <button aria-label="Zoom in" disabled={!ready} onClick={()=>changeZoom(.25)}><ZoomIn size={17}/></button>
        <button aria-label="Fit image to window" disabled={!ready} onClick={fitToWindow}><Maximize size={17}/></button>
        <button aria-label="Rotate picture left" disabled={!ready} onClick={()=>rotate(-1)}><RotateCcw size={17}/></button>
        <button aria-label="Rotate picture right" disabled={!ready} onClick={()=>rotate(1)}><RotateCw size={17}/></button>
      </div>
    </div>
    <div className="image-viewer-canvas">
      <canvas ref={canvas} aria-label={image?.name??'Picture'} role="img"
        className={ready&&zoom>1?`is-zoomed${panning?' is-panning':''}`:''}
        onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}
        onLostPointerCapture={()=>{panStart.current=null;setPanning(false);}}
        style={{visibility:ready?'visible':'hidden',...(fitSize.width>0?{width:fitSize.width,height:fitSize.height}:{}),transform:`translate(-50%, -50%) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`}}/>
      {!ready&&<div role="status" className="image-viewer-loading">{error||message||'Opening picture…'}</div>}
      {(error||message)&&ready&&<div role="alert" className="image-viewer-alert">{error||message}</div>}
    </div>
  </div>;
}
