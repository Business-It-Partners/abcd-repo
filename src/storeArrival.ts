/** A connected handoff. Dock slot positions are supplied by the shared dock field. */
export const STORE_ARRIVAL_DURATION = 2050;
export function celebrateStoreArrival(source: HTMLImageElement, target: HTMLElement, complete: () => void) {
  const from=source.getBoundingClientRect(),to=target.getBoundingClientRect();
  const animations:Animation[]=[];
  let disposed=false;
  const layer=document.createElement('div');layer.className='store-celebration';layer.setAttribute('aria-hidden','true');document.body.append(layer);
  source.classList.add('store-source-separated');
  function dispose(){if(disposed)return;disposed=true;source.classList.remove('store-source-separated');animations.forEach(a=>a.cancel());layer.remove();}
  function element(name:string,x:number,y:number,w:number,h:number,src?:string){const node=document.createElement(src?'img':'div');node.className=name;if(node instanceof HTMLImageElement)node.src=src!;Object.assign(node.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});layer.append(node);return node;}
  function animate(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions){const a=node.animate(frames,{fill:'both',...options});animations.push(a);return a;}
  try {
    const dx=to.left-from.left,dy=to.top-from.top,scale=to.width/from.width;
    const distance=Math.hypot(dx,dy),height=Math.min(110,Math.max(35,distance*.16));
    const lift=Math.max(-24,48-from.top),apex=Math.max(36-from.top,lift-height);
    const point=(t:number)=>{const u=1-t;return {x:3*u*u*t*dx*.12+3*u*t*t*dx*.88+t*t*t*dx,y:u*u*u*lift+3*u*u*t*apex+3*u*t*t*(dy-height*.75)+t*t*t*dy};};
    // Arc-length remapping separates the geometric curve from its velocity envelope.
    const samples=[{t:0,length:0,...point(0)}];
    for(let i=1;i<=100;i++){const p=point(i/100),prev=samples[i-1];samples.push({t:i/100,length:prev.length+Math.hypot(p.x-prev.x,p.y-prev.y),...p});}
    const total=samples[100].length;
    const frames:Keyframe[]=[];
    for(let i=0;i<=14;i++){const t=i/14,s=t*t*(3-2*t);frames.push({offset:t*.14,transform:`translate(0,${lift*s}px) scale(${1+.07*s}) rotate(${-5*s}deg)`});}
    const ribbonFrames:Keyframe[]=[{offset:0,opacity:0},{offset:.14,opacity:0}];
    for(let i=1;i<=64;i++){
      const t=i/64,s=t*t*(3-2*t),length=s*total;
      const index=Math.max(1,samples.findIndex(p=>p.length>=length));const a=samples[index-1],b=samples[index];
      const fraction=(length-a.length)/Math.max(.001,b.length-a.length),p=point(a.t+(b.t-a.t)*fraction);
      const size=1.07+(scale-1.07)*s,rotation=-5*(1-s)+Math.sin(Math.PI*t)*4*Math.sign(dx),offset=.14+t*.58;
      frames.push({offset,transform:`translate(${p.x}px,${p.y}px) scale(${size}) rotate(${rotation}deg)`});
      const tangent=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      ribbonFrames.push({offset,opacity:Math.sin(Math.PI*t)*.5,transform:`translate(${p.x+from.width*size/2}px,${p.y+from.height*size/2}px) rotate(${tangent}deg) scaleX(${1+Math.sin(Math.PI*t)})`});
    }
    // A damped impact response: short compression, one rebound, then rest.
    for(let i=1;i<=30;i++){const t=i/30,wave=Math.sin(t*Math.PI*3)*Math.exp(-5*t);frames.push({offset:.72+t*.28,transform:`translate(${dx}px,${dy+7*wave}px) scale(${scale*(1+.09*wave)},${scale*(1-.12*wave)}) rotate(0deg)`});}
    frames[frames.length-1]={offset:1,transform:`translate(${dx}px,${dy}px) scale(${scale}) rotate(0deg)`};
    const well=element('store-landing-well',to.left-9,to.top-7,to.width+18,to.height+14);
    animate(well,[{opacity:0,transform:'scale(1.3)'},{opacity:.6,offset:.5,transform:'scale(1)'},{opacity:.8,offset:.72},{opacity:0,transform:'scale(.8)'}],{duration:2050});
    const shadow=element('store-flight-shadow',from.left,from.top+from.height*.9,from.width,18);
    animate(shadow,[{opacity:.12,transform:'scale(.8)'},{opacity:.22,offset:.14,transform:'translateY(16px) scale(1.15)'},{opacity:0,offset:.3},{opacity:0}],{duration:2050});
    for(let i=0;i<3;i++){const ribbon=element('store-arrival-trail',from.left-22,from.top,24,3-i*.5);animate(ribbon,[...ribbonFrames,{offset:1,opacity:0}],{duration:2050,delay:i*18});}
    const shine=element('store-arrival-shine',from.left,from.top,from.width,from.height);
    animate(shine,[{opacity:0,transform:'translateX(-12px)'},{opacity:.7,offset:.4},{opacity:0,transform:'translateX(12px)'}],{duration:300});
    const flying=element('store-arrival',from.left,from.top,from.width,from.height,source.src);
    const main=animate(flying,frames,{duration:STORE_ARRIVAL_DURATION,easing:'linear'});
    // Effects are triggered at contact, rather than appearing before the app arrives.
    const contact=STORE_ARRIVAL_DURATION*.72;
    const glow=element('store-arrival-glow',to.left-18,to.top-18,to.width+36,to.height+36);
    animate(glow,[{opacity:0,transform:'scale(.7)'},{opacity:.85,offset:.2},{opacity:0,transform:'scale(1.7)'}],{delay:contact,duration:574});
    const ring=element('store-arrival-ring',to.left,to.top,to.width,to.height);
    animate(ring,[{opacity:0,transform:'scale(.5)'},{opacity:.7,offset:.12},{opacity:0,transform:'scale(2.5)'}],{duration:574,delay:contact});
    for(let i=0;i<20;i++){
      const angle=-Math.PI*.95+(i/19)*Math.PI*.9,d=42+(i%4)*15;
      const spark=element('store-arrival-spark',to.left+to.width/2-2,to.top+to.height*.5,4,i%2?7:10);
      spark.style.background=['#479fff','#53caa6','#ffc65c'][i%3];spark.style.color=spark.style.background;
      animate(spark,[{opacity:0,transform:'translate(0,0) scale(.3)'},{opacity:1,offset:.15},{opacity:.8,offset:.55},{opacity:0,transform:`translate(${Math.cos(angle)*d}px,${Math.sin(angle)*d}px) rotate(${angle*180/Math.PI+90}deg) scale(.4)`}],{delay:contact,duration:574,easing:'cubic-bezier(.15,.5,.3,1)'});
    }
    main.onfinish=()=>{dispose();complete();};
  } catch(error) {dispose();throw error;}
  return dispose;
}
