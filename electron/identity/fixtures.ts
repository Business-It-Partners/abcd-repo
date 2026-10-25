/** Controlled test identity. Never selected outside private Linux / hosted Windows guards. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AuthFailure, type AuthClient, type Clinic, type Tokens } from './client';
export function identityFixtureSecretProvider() {
  // This fixed key exists only for private synthetic UI runs that reopen the same temporary test profile.
  const key = createHash('sha256').update('private-dental-os-identity-fixture-key-v1').digest();
  return {
    available: () => true,
    encrypt: async (value: string) => {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]);
    },
    decrypt: async (value: Buffer) => {
      if (value.length < 29) throw new Error('Invalid synthetic protected record');
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(-16));
      return Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]).toString();
    },
  };
}
export function identityFixtures(options: { failFirstRefresh?: boolean } = {}):AuthClient {
  const users=new Map<string,string>();let n=0;
  const tokens=(uid:string):Tokens=>{const refreshToken=`fixture-refresh-${Buffer.from(uid).toString('base64url')}-${++n}`;users.set(refreshToken,uid);return{idToken:'synthetic-fixture-credential',refreshToken,uid,expiresAt:Date.now()+3600_000};};
  let current='',failFirstRefresh=options.failFirstRefresh===true;
  return {
    signIn:async(email,password)=>{
      if(email==='unavailable@fixture.invalid')throw new AuthFailure('unavailable');
      if(!email.endsWith('@fixture.invalid')||email==='disabled@fixture.invalid'||password!=='fixture-pass')throw new AuthFailure('denied');
      current=email;return tokens(email);
    },
    refresh:async token=>{
      const match=/^fixture-refresh-([A-Za-z0-9_-]+)-\d+$/.exec(token);
      const uid=users.get(token)??(match?Buffer.from(match[1],'base64url').toString('utf8'):undefined);
      if(!uid||!uid.endsWith('@fixture.invalid'))throw new AuthFailure('denied',true);
      if(failFirstRefresh){failFirstRefresh=false;throw new AuthFailure('unavailable');}
      current=uid;return tokens(uid);
    },
    resolve:async()=>({userLabel:current,clinicLabel:'Synthetic clinic',role:'doctor',tenantId:'fixture-tenant',clinicUserId:current,capabilities:['appointments.access']} satisfies Clinic),
  };
}
