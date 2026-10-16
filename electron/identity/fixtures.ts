/** Controlled test identity. Never selected outside private Linux / hosted Windows guards. */
import { AuthFailure, type AuthClient, type Clinic, type Tokens } from './client';
export function identityFixtures():AuthClient {
  const users=new Map<string,string>();let n=0;
  const tokens=(uid:string):Tokens=>{const refreshToken=`fixture-refresh-${++n}`;users.set(refreshToken,uid);return{idToken:'synthetic-fixture-credential',refreshToken,uid,expiresAt:Date.now()+3600_000};};
  let current='';
  return {
    signIn:async(email,password)=>{
      if(email==='unavailable@fixture.invalid')throw new AuthFailure('unavailable');
      if(!email.endsWith('@fixture.invalid')||email==='disabled@fixture.invalid'||password!=='fixture-pass')throw new AuthFailure('denied');
      current=email;return tokens(email);
    },
    refresh:async token=>{const uid=users.get(token);if(!uid)throw new AuthFailure('denied');current=uid;return tokens(uid);},
    resolve:async()=>({userLabel:current,clinicLabel:'Synthetic clinic',role:'doctor',tenantId:'fixture-tenant',clinicUserId:current,capabilities:['appointments.access']} satisfies Clinic),
  };
}
