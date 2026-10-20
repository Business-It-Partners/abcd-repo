/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OsStateStore } from '../electron/storage/osState';
const roots: string[] = [];
const root = () => { const p = mkdtempSync(path.join(tmpdir(), 'dental-state-')); roots.push(p); return p; };
const host = { privateModes: process.platform !== 'win32', availableBytes: () => 10 * 1024 * 1024 };
afterEach(() => { for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });
describe('OS-only durable state', () => {
 it('persists only allowlisted preferences and creates private files', () => {
  const p = root(); const s = new OsStateStore(p, host); expect(s.load().overviewShortcutEnabled).toBe(true);
  s.update({ overviewShortcutEnabled: false }); expect(new OsStateStore(p, host).load().overviewShortcutEnabled).toBe(false);
  expect(() => s.update({ overviewShortcutEnabled: true, patient: 'forbidden' })).toThrow();
  if (process.platform !== 'win32') expect(statSync(path.join(p, 'preferences.json')).mode & 0o777).toBe(0o600);
 });
 for (const point of ['journal', 'state'] as const) it(`recovers interrupted commit after ${point}`, () => {
  const p = root(); new OsStateStore(p, host).load();
  const s = new OsStateStore(p, host, phase => { if (phase === point) throw new Error('power failure'); });
  expect(() => s.update({ overviewShortcutEnabled: false })).toThrow();
  expect(new OsStateStore(p, host).load().overviewShortcutEnabled).toBe(false);
 });
 it('migrates legacy preferences transactionally', () => {
  const p = root(); writeFileSync(path.join(p,'preferences.json'), JSON.stringify({ version: 0, overviewShortcutEnabled: false }));
  expect(new OsStateStore(p,host).load().overviewShortcutEnabled).toBe(false);
  expect(JSON.parse(readFileSync(path.join(p,'preferences.json'),'utf8')).version).toBe(1);
 });
 it('opens version 2 workspace preferences and preserves favorites when legacy settings change', () => {
  const p = root(), favorites = ['company.sample.alpha', 'company.sample.beta'];
  writeFileSync(path.join(p,'preferences.json'), JSON.stringify({ version: 2, preferences: { overviewShortcutEnabled: true, favoriteAppIds: favorites } }));
  const store = new OsStateStore(p, host);
  expect(store.load()).toEqual({ overviewShortcutEnabled: true, favoriteAppIds: favorites });
  store.update({ overviewShortcutEnabled: false });
  expect(JSON.parse(readFileSync(path.join(p,'preferences.json'),'utf8'))).toEqual({ version: 2, preferences: { overviewShortcutEnabled: false, favoriteAppIds: favorites } });
  expect(new OsStateStore(p, host).load()).toEqual({ overviewShortcutEnabled: false, favoriteAppIds: favorites });
 });
 it('preserves invalid version 2 preferences for recovery without guessing', () => {
  const p = root(), file = path.join(p, 'preferences.json');
  const raw = JSON.stringify({ version: 2, preferences: { overviewShortcutEnabled: true, favoriteAppIds: ['not a valid app id'] } });
  writeFileSync(file, raw);
  expect(() => new OsStateStore(p, host).load()).toThrow('OS_STATE_RECOVERY_REQUIRED');
  expect(readFileSync(file, 'utf8')).toBe(raw);
 });
 for (const raw of ['{broken', '{"version":99}', 'x'.repeat(17000)]) it('preserves unsafe state for recovery', () => {
  const p=root(); const f=path.join(p,'preferences.json');writeFileSync(f,raw);
  expect(()=>new OsStateStore(p,host).load()).toThrow('OS_STATE_RECOVERY_REQUIRED');expect(readFileSync(f,'utf8')).toBe(raw);
 });
 it('refuses insufficient capacity without replacing current state', () => {
  const p=root();new OsStateStore(p,host).load();const before=readFileSync(path.join(p,'preferences.json'),'utf8');
  const s=new OsStateStore(p,{...host,availableBytes:()=>0});expect(()=>s.update({overviewShortcutEnabled:false})).toThrow();
  expect(readFileSync(path.join(p,'preferences.json'),'utf8')).toBe(before);
 });
 it('rejects conflicting journal and preserves both records', () => {
  const p=root();new OsStateStore(p,host).load();
  const raw=JSON.stringify({from:'0'.repeat(64),next:JSON.stringify({version:1,preferences:{overviewShortcutEnabled:false}})});
  writeFileSync(path.join(p,'pending.json'),raw);expect(()=>new OsStateStore(p,host).load()).toThrow();expect(readFileSync(path.join(p,'pending.json'),'utf8')).toBe(raw);
 });
 it.skipIf(process.platform === 'win32')('rejects linked files without touching their target', () => {
  const p=root(),outside=path.join(root(),'outside');writeFileSync(outside,'preserve');symlinkSync(outside,path.join(p,'preferences.json'));
  expect(()=>new OsStateStore(p,host).load()).toThrow();expect(readFileSync(outside,'utf8')).toBe('preserve');
 });
 it('rejects a linked state directory without modifying the target', () => {
  const parent=root(), target=root(), link=path.join(parent,'linked');
  symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  expect(()=>new OsStateStore(link,host)).toThrow();
 });
});
