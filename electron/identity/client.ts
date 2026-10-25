import { staging } from '../sdk/environment';
import { text } from '../sdk/contracts';
import type { ClinicSessionContext } from '../sdk/contracts';
export type { ClinicSessionContext } from '../sdk/contracts';
// Firebase client API key is public project configuration, not an administrative credential.
export const firebaseApiKey = 'AIzaSyDA9f3oRA07zV4YdtF7P7ZUVY6iScEku1c';
export type Tokens = { idToken: string; refreshToken: string; uid: string; expiresAt: number };
export type Clinic = { userLabel: string; clinicLabel: string; role: 'admin' | 'doctor' | 'reception'; tenantId: string; clinicUserId: string; capabilities: string[]; clinicSession?: ClinicSessionContext };
export interface AuthClient {
  signIn(email: string, password: string, signal: AbortSignal): Promise<Tokens>;
  refresh(token: string, signal: AbortSignal): Promise<Tokens>;
  resolve(token: string, signal: AbortSignal): Promise<Clinic>;
  clinicLogo?(token: string, signal: AbortSignal): Promise<string | undefined>;
}
export class AuthFailure extends Error { constructor(readonly kind: 'denied' | 'unavailable') { super(kind === 'denied' ? 'Sign-in or clinic access denied.' : 'Staging identity service unavailable.'); } }
export class FirebaseClient implements AuthClient {
  constructor(private transport: typeof fetch = fetch, private now = Date.now) {}
  private async json(url: string, init: RequestInit, signal: AbortSignal): Promise<Record<string, unknown>> {
    const allowed = [staging.apiBase, 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'];
    if (!allowed.includes(new URL(url).origin)) throw new AuthFailure('unavailable');
    try {
      const response = await this.transport(url, { ...init, signal, redirect: 'manual', credentials: 'omit', cache: 'no-store' });
      if (response.redirected || response.status >= 300 && response.status < 400 || !response.headers.get('content-type')?.includes('application/json')) { void response.body?.cancel(); throw new AuthFailure('unavailable'); }
      if (!response.ok) { void response.body?.cancel(); throw new AuthFailure([400,401,403].includes(response.status) ? 'denied' : 'unavailable'); }
      if (Number(response.headers.get('content-length') ?? 0) > 65_536 || !response.body) { void response.body?.cancel(); throw new AuthFailure('unavailable'); }
      const reader=response.body.getReader();let length=0;const chunks:Uint8Array[]=[];
      try {
        while(true){const c=await reader.read();if(c.done)break;length+=c.value.length;if(length>65_536)throw new AuthFailure('unavailable');chunks.push(c.value);}
        const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
        const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        if(!result||typeof result!=='object'||Array.isArray(result))throw new AuthFailure('unavailable');return result;
      } finally { void reader.cancel().catch(()=>{});reader.releaseLock(); }
    } catch(error) { if(error instanceof AuthFailure)throw error;throw new AuthFailure('unavailable'); }
  }
  private tokens(v: Record<string, unknown>, refresh: boolean): Tokens {
    const idToken=v[refresh?'id_token':'idToken'],refreshToken=v[refresh?'refresh_token':'refreshToken'],uid=v[refresh?'user_id':'localId'];
    const expires=Number(v[refresh?'expires_in':'expiresIn']);
    if(!text(idToken,16_384)||!idToken||!text(refreshToken,16_384)||!refreshToken||!text(uid,128)||!uid||!Number.isFinite(expires)||expires<1||expires>7200)throw new AuthFailure('unavailable');
    try {
      const claims=JSON.parse(Buffer.from(idToken.split('.')[1],'base64url').toString('utf8'));
      if(claims.aud!==staging.firebaseProject||claims.iss!==`https://securetoken.google.com/${staging.firebaseProject}`||claims.sub!==uid||!Number.isFinite(claims.exp)||claims.exp*1000<=this.now())throw new Error('Project/expiry mismatch');
      // Decoding is a configuration guard, not signature verification. /v1/me verifies authority.
      return {idToken,refreshToken,uid,expiresAt:Math.min(this.now()+expires*1000,claims.exp*1000)};
    }catch{throw new AuthFailure('denied');}
  }
  async signIn(email: string,password: string,signal: AbortSignal) {
    return this.tokens(await this.json(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})},signal),false);
  }
  async refresh(token:string,signal:AbortSignal) {
    return this.tokens(await this.json(`https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:token}).toString()},signal),true);
  }
  async clinicLogo(token: string, signal: AbortSignal): Promise<string | undefined> {
    const endpoint = new URL('/v1/clinic/branding/logo/view', staging.apiBase);
    if (endpoint.origin !== new URL(staging.apiBase).origin) return undefined;
    try {
      const response = await this.transport(endpoint.toString(), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal,
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
      });
      const discard = () => { void response.body?.cancel().catch(() => {}); };
      if (response.status === 404) { discard(); return undefined; }
      if (response.redirected || response.status >= 300 && response.status < 400 || !response.ok) { discard(); return undefined; }

      const mimeType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      if (!mimeType || !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType) || !response.body) { discard(); return undefined; }
      const contentLength = response.headers.get('content-length');
      if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 2_000_000)) { discard(); return undefined; }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.length;
          if (length > 2_000_000) return undefined;
          chunks.push(chunk.value);
        }
      } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (!length) return undefined;
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
      return undefined;
    }
  }
  async resolve(token:string,signal:AbortSignal):Promise<Clinic> {
    const data=await this.json(staging.apiBase+'/v1/me',{method:'GET',headers:{authorization:`Bearer ${token}`}},signal);
    const s=data.session as Record<string,unknown>|undefined,u=s?.clinicUser as Record<string,unknown>|undefined,c=s?.clinic as Record<string,unknown>|undefined,rawBranches=s?.branches;
    if(!u||!c||!text(u.displayName,160)||!text(c.displayName,160)||!['admin','doctor','reception'].includes(u.role as string)||!text(u.clinicUserId,128)||!text(c.tenantId,128)||!Array.isArray(u.capabilities)||u.capabilities.length>200||!u.capabilities.every(v=>text(v,100)))throw new AuthFailure('denied');
    let clinicSession:ClinicSessionContext|undefined;
    if(text(c.timezone,100)&&text(c.currency,8)&&(c.defaultBranchId===null||text(c.defaultBranchId,128))&&typeof c.hasActiveTrial==='boolean'&&Array.isArray(rawBranches)&&rawBranches.length<=100&&rawBranches.every(v=>!!v&&typeof v==='object'&&text((v as Record<string,unknown>).branchId,128)&&text((v as Record<string,unknown>).branchCode,40)&&text((v as Record<string,unknown>).name,160))){
      clinicSession={clinicUser:{clinicUserId:u.clinicUserId,displayName:u.displayName,role:u.role as ClinicSessionContext['clinicUser']['role'],capabilities:[...u.capabilities] as string[]},clinic:{tenantId:c.tenantId,displayName:c.displayName,timezone:c.timezone,currency:c.currency,defaultBranchId:c.defaultBranchId as string|null,hasActiveTrial:c.hasActiveTrial},branches:rawBranches.map(v=>{const b=v as Record<string,unknown>;return{branchId:b.branchId as string,branchCode:b.branchCode as string,name:b.name as string};})};
    }
    return {userLabel:u.displayName,clinicLabel:c.displayName,role:u.role as Clinic['role'],clinicUserId:u.clinicUserId,tenantId:c.tenantId,capabilities:u.capabilities as string[],...(clinicSession?{clinicSession}:{})};
  }
}
