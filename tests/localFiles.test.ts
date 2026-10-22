import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, lstatSync, realpathSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalFileService, LocalFilesError, type FileRecipient } from '../electron/host/localFiles';

const directories: string[] = [];
const services: LocalFileService[] = [];
function fixture(now: () => number = Date.now) {
  const root = mkdtempSync(path.join(tmpdir(), 'dental-m16-files-'));
  directories.push(root);
  const svc = new LocalFileService([{ label: 'Synthetic root', path: root, kind: 'folder' }], now);
  services.push(svc);
  const id = svc.roots()[0]?.id;
  if (!id) {
    // Host-runner-safe diagnostics: no absolute file names or patient content.
    const absolute = path.resolve(root);
    let actual = '', linkedAncestor = false;
    try { actual = realpathSync.native(absolute); } catch { /* only test diagnostics */ }
    let cursor = path.parse(absolute).root;
    for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try { linkedAncestor ||= lstatSync(cursor).isSymbolicLink(); } catch { /* only test diagnostics */ }
    }
    throw Error('Missing synthetic root: host=' + process.platform + ', alias='
      + (actual.toLowerCase() !== absolute.toLowerCase()) + ', linkedAncestor=' + linkedAncestor);
  }
  return { root, svc, id };
}
function recipient(overrides: Partial<FileRecipient> = {}): FileRecipient {
  return { sender: {}, frame: {}, appId: 'company.dental.patient-record', appVersion: '1.0.0',
    windowId: 'records', generation: 1, requestId: 'pick-request-0001', authorized: () => true, ...overrides };
}
function selected(root: string, svc: LocalFileService, id: string, name = 'xray.png') {
  writeFileSync(path.join(root, name), 'synthetic-file');
  const found = svc.list(id).entries.find(x => x.name === name);
  if (!found) throw Error('Missing file');
  return found;
}
function expectCode(fn: () => unknown, code: LocalFilesError['code']) {
  try { fn(); throw new Error('Expected denial'); }
  catch (e) { expect(e).toBeInstanceOf(LocalFilesError); expect((e as LocalFilesError).code).toBe(code); }
}
afterEach(() => {
  for (const s of services.splice(0)) s.dispose();
  for (const p of directories.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe('M16.2 trusted read-only host files', () => {
  it('lists safe roots, nested folders and files without exposing absolute host paths', () => {
    const { root, svc, id } = fixture();
    mkdirSync(path.join(root, 'A')); writeFileSync(path.join(root, 'x.png'), 'a');
    expect(JSON.stringify(svc.roots())).not.toContain(root);
    const page = svc.list(id);
    expect(page.entries.map(x => x.name)).toEqual(['A', 'x.png']);
    expect(page.entries[0].kind).toBe('directory');
    expect(svc.list(page.entries[0].id).entries).toEqual([]);
    expect(JSON.stringify(page)).not.toContain(root);
  });
  it('hides dot-prefixed entries and returns bounded image bytes only by opaque file ID', () => {
    const { root, svc, id } = fixture();
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR42mP06FnCgA0wMeAAg1MCACmLAYglPyuxAAAAAElFTkSuQmCC', 'base64');
    writeFileSync(path.join(root, '.hidden-xray.png'), image);
    writeFileSync(path.join(root, 'visible-xray.png'), image);
    const page = svc.list(id);
    expect(page.entries.map(entry => entry.name)).toEqual(['visible-xray.png']);
    const preview = svc.previewBytes(page.entries[0].id);
    expect(preview?.typeHint).toBe('.png');
    expect(Buffer.from(preview?.bytes ?? [])).toEqual(image);
    expect(JSON.stringify(preview)).not.toContain(root);
    expectCode(() => svc.previewBytes('00000000-0000-0000-0000-000000000000'), 'NOT_FOUND');
  });
  it('declines unsupported picture formats and source images larger than the read bound', () => {
    const { root, svc, id } = fixture();
    writeFileSync(path.join(root, 'medical-image.dcm'), 'synthetic');
    writeFileSync(path.join(root, 'oversized.png'), '');
    truncateSync(path.join(root, 'oversized.png'), 16 * 1024 * 1024 + 1);
    const page = svc.list(id);
    const byName = new Map(page.entries.map(entry => [entry.name, entry]));
    expect(svc.previewBytes(byName.get('medical-image.dcm')!.id)).toBeNull();
    expect(svc.previewBytes(byName.get('oversized.png')!.id)).toBeNull();
  });
  it('rejects path injection, malformed cursor, file as directory and page bounds', () => {
    const { root, svc, id } = fixture();
    const file = selected(root, svc, id);
    expectCode(() => svc.list(root), 'INVALID_REQUEST');
    expectCode(() => svc.list('../etc'), 'INVALID_REQUEST');
    expectCode(() => svc.list(file.id), 'NOT_FOUND');
    expectCode(() => svc.list(id, 'bad-token'), 'INVALID_REQUEST');
    expectCode(() => svc.list(id, null, 0), 'INVALID_REQUEST');
    expectCode(() => svc.list(id, null, 201), 'INVALID_REQUEST');
  });
  it('paginates deterministically, binds opaque one-use cursors to directory state', () => {
    const { root, svc, id } = fixture();
    for (let i = 0; i < 12; i++) writeFileSync(path.join(root, 'file-' + String(i).padStart(2, '0') + '.txt'), 'x');
    const first = svc.list(id, null, 5);
    const second = svc.list(id, first.nextCursor, 5);
    const third = svc.list(id, second.nextCursor, 5);
    expect([...first.entries, ...second.entries, ...third.entries].map(x => x.name))
      .toEqual(Array.from({ length: 12 }, (_, i) => 'file-' + String(i).padStart(2, '0') + '.txt'));
    expect(third.nextCursor).toBeNull();
    expectCode(() => svc.list(id, first.nextCursor, 5), 'STALE_SELECTION');
  });
  it('invalidates a page cursor if directory contents change', () => {
    const { root, svc, id } = fixture();
    for (let i = 0; i < 4; i++) writeFileSync(path.join(root, 'f' + i + '.txt'), 'x');
    const cursor = svc.list(id, null, 2).nextCursor;
    writeFileSync(path.join(root, 'f4.txt'), 'x');
    expectCode(() => svc.list(id, cursor, 2), 'STALE_SELECTION');
  });
  it('refuses symlink files, linked directories and linked roots', () => {
    if (process.platform === 'win32') return;
    const { root, svc, id } = fixture();
    const other = mkdtempSync(path.join(tmpdir(), 'dental-m16-outside-')); directories.push(other);
    writeFileSync(path.join(other, 'secret.txt'), 'private');
    symlinkSync(path.join(other, 'secret.txt'), path.join(root, 'link.png'));
    symlinkSync(other, path.join(root, 'linked-folder'), 'dir');
    expect(svc.list(id).entries).toEqual([]);
    const linked = new LocalFileService([{ label: 'bad', path: path.join(root, 'linked-folder') }]);
    services.push(linked);
    expect(linked.roots()).toEqual([]);
  });
  it('issues only metadata receipts and rejects modified or replaced files', () => {
    const { root, svc, id } = fixture();
    const file = selected(root, svc, id), owner = recipient();
    const receipt = svc.select([file.id], owner, 'images');
    expect(receipt.files[0].name).toBe('xray.png');
    expect(svc.inspect(receipt.selectionId, receipt.files[0].receiptId, owner)).toEqual(receipt.files[0]);
    expect(JSON.stringify(receipt)).not.toContain(root);
    renameSync(path.join(root, 'xray.png'), path.join(root, 'old.png'));
    writeFileSync(path.join(root, 'xray.png'), 'different-file');
    expectCode(() => svc.inspect(receipt.selectionId, receipt.files[0].receiptId, owner), 'STALE_SELECTION');
  });
  it('binds a receipt to exact sender, frame, app, release, window and generation', () => {
    const { root, svc, id } = fixture();
    const file = selected(root, svc, id), owner = recipient();
    const receipt = svc.select([file.id], owner);
    for (const override of [
      { sender: {} }, { frame: {} }, { appId: 'company.dental.staff' },
      { appVersion: '2.0.0' }, { windowId: 'staff' }, { generation: 2 },
      { requestId: 'other-request' }, { authorized: () => false },
    ]) expectCode(
      () => svc.inspect(receipt.selectionId, receipt.files[0].receiptId, { ...owner, ...override }),
      'FORBIDDEN',
    );
    expectCode(() => svc.inspect(receipt.selectionId, '00000000-0000-0000-0000-000000000000', owner), 'FORBIDDEN');
  });
  it('requires active recipient authorization, safe file kinds and selection limits', () => {
    const { root, svc, id } = fixture();
    const file = selected(root, svc, id), owner = recipient();
    expectCode(() => svc.select([file.id], { ...owner, authorized: () => false }), 'FORBIDDEN');
    expectCode(() => svc.select([], owner), 'INVALID_REQUEST');
    expectCode(() => svc.select([file.id, file.id], owner), 'INVALID_REQUEST');
    expectCode(() => svc.select(Array(11).fill(file.id), owner), 'INVALID_REQUEST');
    expectCode(() => svc.select([file.id], owner, 'documents'), 'FORBIDDEN');
    const a = svc.select([file.id], owner, 'medical-images');
    svc.cancel(a.selectionId, owner);
    expectCode(() => svc.inspect(a.selectionId, a.files[0].receiptId, owner), 'STALE_SELECTION');
  });
  it('expires, revokes on recipient close/session change, and refuses post-dispose', () => {
    let clock = 1000000;
    const { root, svc, id } = fixture(() => clock);
    const file = selected(root, svc, id), owner = recipient();
    const first = svc.select([file.id], owner);
    clock += 600000;
    expectCode(() => svc.inspect(first.selectionId, first.files[0].receiptId, owner), 'STALE_SELECTION');
    const second = svc.select([file.id], owner);
    svc.revokeRecipient(owner.sender);
    expectCode(() => svc.inspect(second.selectionId, second.files[0].receiptId, owner), 'STALE_SELECTION');
    const third = svc.select([file.id], owner);
    svc.invalidateGeneration(2);
    expectCode(() => svc.inspect(third.selectionId, third.files[0].receiptId, owner), 'STALE_SELECTION');
    svc.dispose();
    expectCode(() => svc.roots(), 'FORBIDDEN');
  });
  it('invalidates nested handles and receipts after a session-generation change, then browses with fresh handles', () => {
    const { root, svc, id } = fixture();
    mkdirSync(path.join(root, 'X-rays'));
    writeFileSync(path.join(root, 'X-rays', 'synthetic-xray.png'), 'fake');
    const oldFolder = svc.list(id).entries[0];
    const oldFile = svc.list(oldFolder.id).entries[0];
    const oldOwner = recipient();
    const receipt = svc.select([oldFile.id], oldOwner);
    svc.invalidateGeneration(2);
    expectCode(() => svc.list(oldFolder.id), 'NOT_FOUND');
    expectCode(() => svc.select([oldFile.id], oldOwner), 'NOT_FOUND');
    expectCode(() => svc.inspect(receipt.selectionId, receipt.files[0].receiptId, oldOwner), 'STALE_SELECTION');
    const newFolder = svc.list(id).entries[0];
    expect(newFolder.id).not.toBe(oldFolder.id);
    const newFile = svc.list(newFolder.id).entries[0];
    const newOwner = recipient({ generation: 2 });
    const fresh = svc.select([newFile.id], newOwner);
    expect(svc.inspect(fresh.selectionId, fresh.files[0].receiptId, newOwner).name).toBe('synthetic-xray.png');
  });
  it('bounds outstanding file receipts and regains capacity on cancellation and expiry', () => {
    let clock = 1_000_000;
    const { root, svc, id } = fixture(() => clock);
    const file = selected(root, svc, id), owner = recipient();
    const leases = Array.from({ length: 64 }, () => svc.select([file.id], owner));
    expectCode(() => svc.select([file.id], owner), 'RESOURCE_LIMIT');
    svc.cancel(leases[0].selectionId, owner);
    expect(svc.select([file.id], owner).files).toHaveLength(1);
    clock += 600_001;
    expect(svc.select([file.id], owner).files).toHaveLength(1);
    expect(JSON.stringify(svc.roots())).not.toContain(root);
  });
  it('stops at a bounded directory scan instead of reading unlimited entries', () => {
    const { root, svc, id } = fixture();
    for (let i = 0; i < 2050; i++) writeFileSync(path.join(root, 'f' + i + '.txt'), '');
    expectCode(() => svc.list(id), 'RESOURCE_LIMIT');
  });
  it('handles disappeared roots without recreating or modifying user files', () => {
    const { root, svc, id } = fixture();
    rmSync(root, { recursive: true });
    expect(svc.roots()).toEqual([]);
    expectCode(() => svc.list(id), 'NOT_FOUND');
    expect(existsSync(root)).toBe(false);
  });
});
