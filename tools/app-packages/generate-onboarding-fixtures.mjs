// Test-only first-party app packages. The ephemeral signing key is never written.
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {buildPackage}=require('../../dist-electron/packages/format.js');
if(process.argv[2]!=='--test-only')throw Error('Use --test-only; never creates a production release key');
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'fixtures/packages');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
fs.writeFileSync(path.join(out,'onboarding-public-key.txt'),publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});
for(const version of ['1.0.0','1.1.0','1.2.0']){
  const folder=path.join(root,'fixtures/runtime-apps/onboarding',version);
  const files=new Map(['index.html','app.css'].map(name=>[name,fs.readFileSync(path.join(folder,name))]));
  const bytes=buildPackage({appId:'company.sample.preview',publisher:'company',version,entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:[]},files,'test-only-onboarding',privateKey);
  fs.writeFileSync(path.join(out,`preview-${version}.dentalpkg`),bytes,{flag:'wx',mode:0o600});
}
console.log('Generated three TEST ONLY onboarding packages; no signing private key saved.');
