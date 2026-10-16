// Internal deterministic assembly, never imported by the runtime. Build platform first.
// node tools/app-packages/build.mjs <manifest.json> <assets-dir> <key-id> <private-key-path> <output.dentalpkg>
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildPackage, limits, validPath } = require('../../dist-electron/packages/format.js');
const [manifestPath, assetsDir, keyId, keyPath, output] = process.argv.slice(2);
if (!output || process.argv.length !== 7) throw new Error('Expected manifest, assets directory, key ID, external private key and output');
const input = JSON.parse(fs.readFileSync(manifestPath, 'utf8')), files = new Map(); let total = 0;
function scan(dir, prefix = '') {
 if (fs.lstatSync(dir).isSymbolicLink() || !fs.lstatSync(dir).isDirectory()) throw new Error('Unsafe asset directory');
 for (const name of fs.readdirSync(dir).sort()) {
  const file = path.join(dir, name), relative = prefix + name, s = fs.lstatSync(file);
  if (s.isSymbolicLink()) throw new Error('Links forbidden');
  if (s.isDirectory()) { if (relative.split('/').length >= 8) throw new Error('Depth limit'); scan(file, relative + '/'); }
  else { validPath(relative); if (!s.isFile() || s.nlink !== 1 || s.size > limits.file || files.size >= limits.count || (total += s.size) > limits.expanded) throw new Error('Asset limits'); files.set(relative, fs.readFileSync(file)); }
 }
}
scan(path.resolve(assetsDir));
const key = createPrivateKey(fs.readFileSync(keyPath));
fs.writeFileSync(output, buildPackage(input, files, keyId, key), { flag: 'wx', mode: 0o600 });
console.log('Built verified-format package; signing key was not copied.');
