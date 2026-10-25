import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appIds = [
  'company.dental.followups.m17', 'company.dental.appointments.m17', 'company.dental.work-entry.m17',
  'company.dental.patient-record.m17', 'company.dental.treatment-progress.m17', 'company.dental.lab-tracker.m17',
  'company.dental.finance.m17', 'company.dental.staff.m17', 'company.dental.m17.treatment-protocols',
  'company.dental.calendar.m17',
];

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

const appId = option('--app');
if (!appIds.includes(appId)) {
  console.error(`Choose one first-party app with --app. Available: ${appIds.join(', ')}`);
  process.exit(2);
}

const sourceRoot = fs.realpathSync(path.resolve(option('--source-root') || root));
const sourcePackage = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
if (sourcePackage.name !== 'electron-desktop-prototype') throw new Error('--source-root must point to a Dental OS checkout');

function defaultUserDataDirectory() {
  if (process.env.DENTAL_OS_USER_DATA_DIR) return path.resolve(process.env.DENTAL_OS_USER_DATA_DIR);
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), 'electron-desktop-prototype');
  if (process.platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support', 'electron-desktop-prototype');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'electron-desktop-prototype');
}

const userData = path.resolve(option('--user-data-dir') || defaultUserDataDirectory());
const appRoot = path.join(sourceRoot, 'apps', 'dental-apps', appId);
if (!fs.existsSync(path.join(appRoot, 'package.json')) || !fs.existsSync(path.join(appRoot, 'app.manifest.json'))) {
  throw new Error(`This checkout does not contain the first-party app source for ${appId}`);
}

console.log(`Building ${appId} from ${sourceRoot}…`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (process.env.npm_execpath) execFileSync(process.execPath, [process.env.npm_execpath, '--prefix', appRoot, 'run', 'build'], { cwd: sourceRoot, stdio: 'inherit' });
else execFileSync(npm, ['--prefix', appRoot, 'run', 'build'], { cwd: sourceRoot, stdio: 'inherit', shell: process.platform === 'win32' });

console.log('Compiling the local development-store publisher…');
execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', path.join(root, 'tsconfig.electron.json')], { cwd: root, stdio: 'inherit' });

const { DevelopmentAppService } = await import(path.join(root, 'dist-electron', 'developmentApps.js'));
const service = new DevelopmentAppService(sourceRoot, path.join(userData, 'development-apps'), true);
const published = service.publishBuild(appId);
console.log(`Published ${published.appId} ${published.version} to ${path.join(userData, 'development-apps')}`);
console.log(`Build snapshot: ${published.buildId}`);
console.log('This is a local Dental OS development snapshot. It was not signed, bundled, or sent to Cloudflare.');
