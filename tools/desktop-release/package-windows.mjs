import { createRequire } from 'node:module';
import path from 'node:path';
import { build, Platform, Arch } from 'electron-builder';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'../..');
// The pinned packager uses this same native parser on macOS Catalina. Use it on
// Linux too: reconstruct the embedded NSIS uninstaller without executing Wine.
// Fail closed for any other VM invocation; do not patch files in node_modules.
if(process.platform==='linux') {
 const {WineVmManager}=require('app-builder-lib/out/vm/WineVm.js');
 const {UninstallerReader}=require('app-builder-lib/out/targets/nsis/nsisUtil.js');
 const version=require(path.join(root,'package.json')).version;
 const expected=path.join(root,`release/windows/Sajilo-Dental-Setup-${version}-x64.exe`);
 WineVmManager.prototype.exec=async function(file,args,options) {
  if(path.resolve(file)!==expected||args.length!==0||options?.env?.__COMPAT_LAYER!=='RunAsInvoker')throw new Error('Unexpected Windows helper invocation refused.');
  const output=path.join(path.dirname(file),`${path.basename(file,'exe')}__uninstaller.exe`);
  await UninstallerReader.exec(file,output);
  console.log('Native NSIS uninstaller extraction completed; no Windows helper executed.');
 };
}
await build({
 targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),
 config:path.join(root,'tools/desktop-release/windows-preview.cjs'),
 publish:'never',
 ...(process.argv.includes('--prepackaged')?{prepackaged:path.join(root,'release/windows/win-unpacked')}:{})
});
