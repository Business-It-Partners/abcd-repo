// Reviewable local release assembly. No cloud calls or credential printing.
// node tools/app-packages/prepare-staging.mjs --staging-only <external-key> <increasing-sequence> <new-output-dir>
import fs from 'node:fs';import path from 'node:path';import {createPrivateKey,createPublicKey,sign} from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{buildPackage,canonical,sha256,verifyPackage}=require('../../dist-electron/packages/format.js'),{verifyCatalogue,noWatermark}=require('../../dist-electron/distribution/catalogue.js'),{stagingDistribution,stagingKeyId}=require('../../dist-electron/distribution/staging.js');
const [guard,keyPath,seq,out]=process.argv.slice(2),sequence=Number(seq);
if(guard!=='--staging-only'||!out||process.argv.length!==6||!Number.isSafeInteger(sequence)||sequence<1)throw Error('Explicit staging flag, external key, increasing sequence and new output directory required');
const root=path.resolve(import.meta.dirname,'../..'),absoluteKey=path.resolve(keyPath);if(absoluteKey.startsWith(root+path.sep))throw Error('Signing key must remain outside checkout');
const info=fs.lstatSync(absoluteKey);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>4096||process.platform!=='win32'&&(info.mode&0o077)!==0)throw Error('Unsafe key input');
const key=createPrivateKey(fs.readFileSync(absoluteKey)),publicKey=createPublicKey(key).export({type:'spki',format:'pem'}).toString();if(publicKey!==stagingDistribution.policy.keys[stagingKeyId].publicKey)throw Error('Key does not match pinned staging public key');
fs.mkdirSync(out,{mode:0o700});const files=new Map(['index.html','app.js','app.css'].map(name=>[name,fs.readFileSync(path.join(root,'fixtures/runtime-apps',name))])),releases=[];
for(const host of ['alpha','beta']){
 const id=`company.sample.${host}`,capabilities=[...stagingDistribution.policy.apps[id].capabilities],bytes=buildPackage({appId:id,publisher:'company',version:'1.0.0',entry:'index.html',sdkMajor:1,apiMajor:1,capabilities},files,stagingKeyId,key),verified=verifyPackage(bytes,stagingDistribution.policy),digest=sha256(bytes),objectKey=`releases/${id}/1.0.0/${digest}.dentalpkg`;
 fs.mkdirSync(path.join(out,path.dirname(objectKey)),{recursive:true,mode:0o700});fs.writeFileSync(path.join(out,objectKey),bytes,{flag:'wx',mode:0o600});
 releases.push({id,title:host==='alpha'?'Motion Studio':'Records',description:'Company sample with synthetic in-memory workflows.',version:'1.0.0',notes:'Signed staging sample. Clinical workflows are a separate delivery.',capabilities,platforms:['linux','win32'],sdkMajor:1,apiMajor:1,objectKey,packageSha256:digest,packageBytes:bytes.length,payloadDigest:verified.release.digest,status:'approved',minimumVersion:'1.0.0'});
}
const issuedAt=Date.now(),catalogue={format:1,environment:'cloudfare-staging',channel:'staging',sequence,issuedAt,expiresAt:issuedAt+86400000,releases},keyId=stagingKeyId;
const signed=Buffer.from(canonical({catalogue,keyId,signature:sign(null,Buffer.from(canonical({purpose:'dental-os-catalogue',keyId,catalogue})),key).toString('base64')}));verifyCatalogue(signed,stagingDistribution.policy,noWatermark,issuedAt);
fs.mkdirSync(path.join(out,'catalogue'),{mode:0o700});fs.writeFileSync(path.join(out,'catalogue/staging.json'),signed,{flag:'wx',mode:0o600});
fs.writeFileSync(path.join(out,'publication.json'),JSON.stringify({environment:'cloudfare-staging',bucket:'dentmitra-dental-os-releases-cloudfare-staging',sequence,catalogueSha256:sha256(signed),expiresAt:catalogue.expiresAt,releases:releases.map(({id,objectKey,packageSha256,packageBytes})=>({id,objectKey,packageSha256,packageBytes}))},null,2)+'\n',{flag:'wx',mode:0o600});
console.log('Prepared two signed staging packages and 24-hour catalogue. No cloud changes.');
