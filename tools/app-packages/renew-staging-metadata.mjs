// Offline staging metadata preparation. This tool has no network or package-writing path.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey } from 'node:crypto';
import { createRequire } from 'node:module';

const [guard, cataloguePath, policyPath, watermarkPath, keyPath, catalogueSeq, policySeq, output] = process.argv.slice(2);
if (guard !== '--staging-metadata-only' || process.argv.length !== 10) {
  throw Error('Expected --staging-metadata-only <catalogue> <policy> <watermarks> <external-key> <catalogue-sequence> <policy-sequence> <new-output-dir>');
}
const root = path.resolve(import.meta.dirname, '../..');
const absoluteKey = path.resolve(keyPath);
if (absoluteKey === root || absoluteKey.startsWith(root + path.sep)) throw Error('Signing key must remain outside checkout');
const keyInfo = fs.lstatSync(absoluteKey);
if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size > 4096
  || process.platform !== 'win32' && (keyInfo.mode & 0o077) !== 0) throw Error('Protected external signing key required');
const read = (file, maximum) => {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maximum) throw Error('Invalid bounded metadata input');
  return fs.readFileSync(file);
};
const require = createRequire(import.meta.url);
const { prepareMetadataRenewal } = require('../../dist-electron/distribution/renewal.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');
const result = prepareMetadataRenewal({
  catalogue: read(cataloguePath, 65_536), updatePolicy: read(policyPath, 65_536),
  watermarks: JSON.parse(read(watermarkPath, 4096).toString('utf8')),
  privateKey: createPrivateKey(fs.readFileSync(absoluteKey)), trust: stagingDistribution.policy,
  catalogueSequence: Number(catalogueSeq), policySequence: Number(policySeq), now: Date.now(),
});
fs.mkdirSync(output, { mode: 0o700 }); // Refuse reuse/overwrite of a prior reviewed output.
for (const [name, bytes] of [['catalogue/staging.json', result.catalogue], ['update-policy/staging.json', result.updatePolicy],
  ['renewal-review.json', Buffer.from(JSON.stringify(result.review, null, 2) + '\n')]]) {
  fs.mkdirSync(path.dirname(path.join(output, name)), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(output, name), bytes, { flag: 'wx', mode: 0o600 });
}
console.log('Prepared signed staging metadata only. Review hashes, sequences and unchanged authority before publication. Package writes: 0.');
