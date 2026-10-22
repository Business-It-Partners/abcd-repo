/** Called ONLY after bootstrap verifies its private-display/Windows CI fixture guard. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { apiOperations, operations, type Operation } from '../sdk/contracts';
import { verifyUpdatePolicy } from '../distribution/updatePolicy';
import { PackageRegistry } from './registry';
import { buildPackage, canonical, type Manifest, type TrustPolicy } from './format';
export function fixtureRegistry(root: string, fixtureRoot: string, appCount = 2, modulePreviewFixture = false, slowModuleAckFixture = false, launchFeedbackFixture = false, filePickerFixture = false) {
  if (!Number.isInteger(appCount) || appCount < 2 || appCount > 16) throw new Error('Invalid runtime fixture app count');
  const publicKey = readFileSync(path.join(fixtureRoot, 'public-key.txt'), 'utf8');
  const keys: Record<string, { publicKey: string; publisher: string }> = { 'test-only-m06': { publicKey, publisher: 'company' } };
  const policy: TrustPolicy = { keys, apps: {
    'company.sample.alpha': { publisher: 'company', capabilities: operations },
    'company.sample.beta': { publisher: 'company', capabilities: operations.filter(op => op !== 'appointments.setStatus') },
    ...(filePickerFixture ? { 'company.dental.patient-record': { publisher: 'company', capabilities: ['clinic.app.patient-record','local.files.pick'] as Operation[] } } : {}),
  }, ...(appCount > 2 || launchFeedbackFixture ? { companyApps: { publisher: 'company', capabilities: [] } } : {}) };
  const registry = new PackageRegistry(root, policy); registry.initialize();
  // This registry is created only by the guarded private UI/CI fixture path.
  registry.setApiGrantResolver(value => apiOperations.filter(operation => value.capabilities.includes(operation)));
  for (const host of ['alpha', 'beta']) registry.install(readFileSync(path.join(fixtureRoot, `${host}.dentalpkg`)));
  if (launchFeedbackFixture) {
    const pair = generateKeyPairSync('ed25519'), keyId = 'test-launch-feedback';
    keys[keyId] = { publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' };
    const apps=[
      ['company.dental.followups','Follow-ups'],['company.dental.appointments','Appointments'],['company.dental.work-entry','Work Entry'],
      ['company.dental.patient-record','Patient Record'],['company.dental.treatment-progress','Treatment Progress'],['company.dental.lab-tracker','Lab Tracker'],
      ['company.dental.finance','Finance'],['company.dental.patient-payments','Patient payments'],['company.dental.staff','Staff'],
      ['company.dental.treatment-protocols','Treatment Protocols'],['company.dental.calendar','Calendar'],['company.future.billing','Future Billing'],
    ] as const;
    const appRoot=path.resolve(fixtureRoot,'../../apps/dental-apps');
    const collect=(folder:string,relative='')=>{
      const files=new Map<string,Buffer>();
      for(const entry of readdirSync(path.join(folder,relative),{withFileTypes:true})){
        const name=path.posix.join(relative,entry.name);
        if(entry.isDirectory())for(const [file,bytes] of collect(folder,name))files.set(file,bytes);
        else files.set(name,readFileSync(path.join(folder,name)));
      }
      return files;
    };
    for(const [appId,title] of apps){
      const sourceRoot=path.join(appRoot,appId);
      if(existsSync(path.join(sourceRoot,'app.manifest.json'))){
        const manifest=JSON.parse(readFileSync(path.join(sourceRoot,'app.manifest.json'),'utf8')) as Omit<Manifest,'format'|'assets'>;
        const metadata=JSON.parse(readFileSync(path.join(sourceRoot,'app.json'),'utf8')) as {allowedRoles?:string[]};
        // The OS launch-flow fixture tests shell behavior rather than clinic authorization.
        if(appId==='company.dental.patient-payments')metadata.allowedRoles=[];
        const files=new Map<string,Buffer>([['app.json',Buffer.from(JSON.stringify(metadata))]]);
        for(const folder of ['src','assets'])for(const [file,bytes] of collect(sourceRoot,folder))files.set(file,bytes);
        registry.install(buildPackage(manifest,files,keyId,pair.privateKey));
      }else{
        const capability=appId==='company.dental.followups'?'followups.access':'future_billing.access';
        const moduleId=appId==='company.dental.followups'?'followups':'billing';
        const metadata={format:1,appId,title,description:'Private launch feedback fixture.',icon:'assets/launch.svg',anyCapabilities:[capability],excludedRoles:[],allowedRoles:[],modules:[{id:moduleId,label:title,tab:moduleId,capability}]};
        const html=Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title><main><h1>${title}</h1></main></html>`);
        const icon=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#246d86"/></svg>');
        const files=new Map<string,Buffer>([['index.html',html],['app.json',Buffer.from(JSON.stringify(metadata))],['assets/launch.svg',icon]]);
        registry.install(buildPackage({appId,publisher:'company',version:'1.0.0',entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:[]},files,keyId,pair.privateKey));
      }
    }
  }
  if (appCount > 2) {
    const pair = generateKeyPairSync('ed25519'), keyId = 'test-resource-runtime';
    keys[keyId] = { publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' };
    const source = Buffer.from('<!doctype html><meta charset="utf-8"><title>Resource fixture</title><main><h1>Resource fixture</h1></main>');
    for (let index = 1; index <= appCount - 2; index++) {
      const appId = `company.resource.app-${String(index).padStart(2, '0')}`;
      const files = new Map([['index.html', source]]);
      if (modulePreviewFixture && index <= 2) {
        const sourceApp = index === 1 ? 'company.dental.finance' : 'company.dental.lab-tracker';
        const sourceRoot = path.resolve(fixtureRoot, '../../apps/dental-apps', sourceApp);
        const metadata = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8')) as { appId: string; icon: string; anyCapabilities: string[]; modules: { capability: string }[] };
        metadata.appId = appId;
        metadata.anyCapabilities = ['fixture.module-preview'];
        for (const module of metadata.modules) module.capability = 'fixture.module-preview';
        for (const file of ['src/index.html', 'src/app.js', 'src/app.css', metadata.icon]) {
          const source=readFileSync(path.join(sourceRoot,file));
          const delayedAck=slowModuleAckFixture&&file==='src/app.js'?Buffer.from('\nlet firstModuleAck=true;window.dentalApp.onModuleSelected(()=>{if(!firstModuleAck)return;firstModuleAck=false;const deadline=performance.now()+2200;while(performance.now()<deadline){}});\n'):Buffer.alloc(0);
          files.set(file,delayedAck.length?Buffer.concat([source,delayedAck]):source);
        }
        files.set('app.json', Buffer.from(JSON.stringify(metadata)));
      }
      registry.install(buildPackage({ appId, publisher: 'company', version: '1.0.0', entry: modulePreviewFixture && index <= 2 ? 'src/index.html' : 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: [] }, files, keyId, pair.privateKey));
    }
  }
  if(filePickerFixture){
    // Synthetic, ephemeral company-signed release + company-signed app-level
    // policy. Only enabled behind private CI or isolated-display launch flags.
    const appId='company.dental.patient-record', keyId='test-m16-file-picker';
    const pair=generateKeyPairSync('ed25519');
    keys[keyId]={publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),publisher:'company'};
    const policyValue={format:1,environment:'cloudfare-staging',channel:'staging',sequence:1,
      issuedAt:Date.now()-1000,expiresAt:Date.now()+3600_000,revokedKeys:[],
      apps:[{id:appId,capabilities:['clinic.app.patient-record','local.files.pick'],minimumVersion:'1.0.0',revokedDigests:[],rollback:null}]};
    const signature=sign(null,Buffer.from(canonical({purpose:'dental-os-update-policy',keyId,policy:policyValue})),pair.privateKey).toString('base64');
    const verified=verifyUpdatePolicy(Buffer.from(canonical({policy:policyValue,keyId,signature})),policy,{sequence:0,digest:'',observedAt:0}).policy;
    registry.setUpdateGuards(value=>{
      if(value.manifest.appId!==appId)return;
      const row=verified.apps.find(x=>x.id===appId);
      if(!row||verified.expiresAt<=Date.now()||value.capabilities.some(x=>!row.capabilities.includes(x))
        ||value.manifest.version!=='1.0.0'||value.release.keyId!==keyId)throw Error('Signed M16 fixture policy denied');
    },()=>false);
    const metadata={format:1,appId,title:'Synthetic Records Picker',
      description:'Company signed file selection fixture; no real patient records.',icon:'assets/picker.svg',
      anyCapabilities:['patient_record.access'],excludedRoles:[],allowedRoles:[],
      modules:[{id:'records',label:'Records',tab:'records',capability:'patient_record.access'}]};
    const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic Records Picker</title>
      <h1>Synthetic Records Picker</h1><button id="connect-sdk">Connect SDK</button><button id="pick-local">Choose local X-ray</button>
      <button id="try-synthetic">Programmatic picker request</button><pre id="pick-result" role="status">Connecting</pre>
      <script>let current;const result=document.getElementById('pick-result');
      function connectSdk(){window.dentalApp.connect({major:1,minor:5}).then(value=>{current=value.ok?value.value:null;
      result.textContent=value.ok?'SDK connected':'Connection denied';});}
      async function choose(){if(!current){result.textContent='Not connected';return;}
      const response=await window.dentalApp.request({version:1,connection:current.connection,generation:current.generation,
      requestId:crypto.randomUUID(),operation:'local.files.pick',
      input:{purpose:'patient-attachment',fileTypes:'medical-images',maxSelections:1}});
      result.textContent=JSON.stringify(response);}
      document.getElementById('connect-sdk').addEventListener('click',connectSdk);
      document.getElementById('pick-local').addEventListener('click',choose);
      document.getElementById('try-synthetic').addEventListener('click',()=>setTimeout(choose,1100));
      </script>`;
    const icon=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#276579"/></svg>');
    const files=new Map<string,Buffer>([['index.html',Buffer.from(html)],
      ['app.json',Buffer.from(JSON.stringify(metadata))],['assets/picker.svg',icon]]);
    registry.install(buildPackage({appId,publisher:'company',version:'1.0.0',
      entry:'index.html',sdkMajor:1,apiMajor:1,
      capabilities:['clinic.app.patient-record','local.files.pick']},files,keyId,pair.privateKey));
  }
  return registry;
}
