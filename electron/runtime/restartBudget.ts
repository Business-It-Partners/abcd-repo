/** Manual recovery only; a close/reopen must not bypass a repeated failure limit. */
export class RestartBudget {
 private failures = new Map<string,number[]>();
 constructor(private now=Date.now,private windowMs=60000,private limit=3){}
 private recent(id:string){const now=this.now(),values=(this.failures.get(id)??[]).filter(t=>now-t<this.windowMs);this.failures.set(id,values);return values;}
 failed(id:string){const times=this.recent(id);if(times.length<this.limit)times.push(this.now());}
 remaining(id:string){const times=this.recent(id);return times.length<this.limit?0:Math.max(1,times[0]+this.windowMs-this.now());}
}
