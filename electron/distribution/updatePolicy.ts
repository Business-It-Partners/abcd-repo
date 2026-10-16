import { createPublicKey, verify } from 'node:crypto';
import { parseCanonical, canonical, sha256, type TrustPolicy, type VerifiedPackage } from '../packages/format';
import { compareVersion, type Catalogue, type Watermark } from './catalogue';
export type AppUpdatePolicy = { id: string; minimumVersion: string; revokedDigests: string[]; rollback: null | { from: string; to: string } };
export type UpdatePolicy = { format: 1; environment: 'cloudfare-staging'; channel: 'staging'; sequence: number; issuedAt: number; expiresAt: number; revokedKeys: string[]; apps: AppUpdatePolicy[] };
const keys=(v:any,expected:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==expected.sort().join())throw Error('Update policy schema');};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const version=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(v);
export function verifyUpdatePolicy(bytes:Buffer,trust:TrustPolicy,watermark:Watermark,now=Date.now()) {
 if(!bytes.length||bytes.length>65536)throw Error('Update policy size');const e=parseCanonical(bytes);keys(e,['policy','keyId','signature']);
 if(typeof e.keyId!=='string'||!Object.hasOwn(trust.keys,e.keyId)||typeof e.signature!=='string'||(!/^[A-Za-z0-9+/]{86}==$/.test(e.signature)||Buffer.from(e.signature,'base64').toString('base64')!==e.signature))throw Error('Update policy key');
 const publicKey=createPublicKey(trust.keys[e.keyId].publicKey);if(publicKey.asymmetricKeyType!=='ed25519'||!verify(null,Buffer.from(canonical({purpose:'dental-os-update-policy',keyId:e.keyId,policy:e.policy})),publicKey,Buffer.from(e.signature,'base64')))throw Error('Update policy signature');
 const p=e.policy;keys(p,['format','environment','channel','sequence','issuedAt','expiresAt','revokedKeys','apps']);
 if(p.format!==1||p.environment!=='cloudfare-staging'||p.channel!=='staging'||!Number.isSafeInteger(p.sequence)||p.sequence<1||!Number.isSafeInteger(p.issuedAt)||p.issuedAt<1||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now+300000||p.expiresAt<=now||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>86400000||now<watermark.observedAt-300000)throw Error('Update policy freshness');
 const digest=sha256(bytes);if(p.sequence<watermark.sequence||p.sequence===watermark.sequence&&digest!==watermark.digest)throw Error('Update policy replay');
 if(!Array.isArray(p.revokedKeys)||p.revokedKeys.length>16||new Set(p.revokedKeys).size!==p.revokedKeys.length||p.revokedKeys.some((k:unknown)=>typeof k!=='string'||!Object.hasOwn(trust.keys,k))||p.revokedKeys.includes(e.keyId))throw Error('Update policy revocation');
 if(!Array.isArray(p.apps)||p.apps.length!==Object.keys(trust.apps).length||p.apps.length>16)throw Error('Update policy app count');const seen=new Set();
 for(const a of p.apps){keys(a,['id','minimumVersion','revokedDigests','rollback']);if(typeof a.id!=='string'||!Object.hasOwn(trust.apps,a.id)||seen.has(a.id)||trust.apps[a.id].publisher!==trust.keys[e.keyId].publisher||!version(a.minimumVersion)||!Array.isArray(a.revokedDigests)||a.revokedDigests.length>16||new Set(a.revokedDigests).size!==a.revokedDigests.length||!a.revokedDigests.every(hash))throw Error('Update policy app');if(a.rollback!==null){keys(a.rollback,['from','to']);if(!hash(a.rollback.from)||!hash(a.rollback.to)||a.rollback.from===a.rollback.to||a.revokedDigests.includes(a.rollback.to))throw Error('Update policy rollback');}seen.add(a.id);}
 return {policy:p as UpdatePolicy,watermark:{sequence:p.sequence,digest,observedAt:Math.max(now,watermark.observedAt)}};
}
export function allowUpdatedPackage(value:VerifiedPackage,policy:UpdatePolicy|undefined,catalogue:Catalogue|undefined,now=Date.now()) {
 const id=value.manifest.appId,a=policy?.apps.find(a=>a.id===id),r=catalogue?.releases.find(r=>r.id===id);
 if(!policy||!catalogue||policy.expiresAt<=now||catalogue.expiresAt<=now||now<policy.issuedAt-300000||now<catalogue.issuedAt-300000||!a||!r||r.status!=='approved'||!r.platforms.includes(process.platform as 'linux'|'win32')||policy.revokedKeys.includes(value.release.keyId)||a.revokedDigests.includes(value.release.digest)||compareVersion(value.manifest.version,a.minimumVersion)<0||compareVersion(value.manifest.version,r.minimumVersion)<0)throw Error('App needs a current safe update policy');
}
