import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SDK, parseRequest } from '../electron/sdk/contracts';
import { ApiBroker, type Identity } from '../electron/sdk/broker';
import { staging } from '../electron/sdk/environment';
import { FilePickerCoordinator, FilePickerCancelled } from '../electron/host/filePicker';
import { validPickInput } from '../electron/host/filePickerContract';
import { LocalFileService, type FileRecipient } from '../electron/host/localFiles';
import { dialog, type BrowserWindow } from 'electron';

vi.mock('electron', () => ({ dialog: { showOpenDialog: vi.fn() } }));
const dirs: string[] = [];
const services: LocalFileService[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'native-device-picker-'));
  dirs.push(root);
  const filePath = path.join(root, 'sample.png');
  writeFileSync(filePath, 'synthetic-only');
  const files = new LocalFileService();
  services.push(files);
  const win = { isDestroyed: () => false } as unknown as BrowserWindow;
  const coordinator = new FilePickerCoordinator(win, files, () => 1, () => true);
  const owner: FileRecipient = {
    sender: {}, frame: {}, appId: 'company.dental.patient-record', appVersion: '1.0.0',
    windowId: 'records', generation: 1, requestId: 'request_1234', authorized: () => true,
  };
  return { root, filePath, files, coordinator, owner };
}
const opts = { purpose: 'patient-attachment' as const, fileTypes: 'medical-images' as const, maxSelections: 2 };
afterEach(() => {
  vi.clearAllMocks();
  for (const service of services.splice(0)) service.dispose();
  for (const directory of dirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('native device file picker', () => {
  it('validates the closed SDK request without paths or shell-browser response fields', () => {
    expect(SDK.minor).toBe(6);
    expect(validPickInput(opts)).toBe(true);
    const envelope = { version: 1, connection: '11111111-1111-4111-8111-111111111111', generation: 1,
      requestId: 'request_1234', operation: 'local.files.pick', input: opts };
    expect(parseRequest(envelope)).toBeDefined();
    for (const input of [{ ...opts, path: '/etc/passwd' }, { ...opts, appId: 'company.malicious' },
      { ...opts, maxSelections: 0 }, { ...opts, maxSelections: 11 }, { ...opts, maxSelections: 1.5 },
      { ...opts, fileTypes: 'executable' }, { ...opts, purpose: 'read-all' }, null, {}, []]) {
      expect(validPickInput(input)).toBe(false);
    }
    expect(parseRequest({ ...envelope, input: { ...opts, path: 'C:\\' } })).toBeUndefined();
  });

  it('still requires the separate local-pick capability and trusted host authorization', async () => {
    const identity: Identity = { snapshot: () => ({ generation: 1, active: true, userLabel: 'test', clinicLabel: 'test' }),
      credential: async () => { throw Error('no remote access'); } };
    const broker = new ApiBroker(staging, identity);
    const sender = {}, frame = {}, origin = 'dental-fixture://alpha/index.html';
    const register = (allow: boolean) => broker.register({ sender, frame, origin, appId: 'company.sample.alpha', appVersion: '1.0.0',
      capabilities: ['local.files.pick', 'clinic.api.request'], authorizeApiOperation: () => true,
      authorizeLocalPick: () => allow, pickLocal: async () => ({ selectionId: 'opaque', files: [], expiresAt: 0 }), report: () => {} });
    register(false);
    const caller = { sender, frame, url: origin };
    let connection = broker.connect(caller, { major: 1, minor: 0 });
    if (!connection.ok) throw Error('connect');
    expect(connection.value.capabilities).not.toContain('local.files.pick');
    const request = { version: 1, connection: connection.value.connection, generation: 1, requestId: 'request_1234', operation: 'local.files.pick', input: opts };
    expect((await broker.request(caller, request)).ok).toBe(false);
    register(true);
    connection = broker.connect(caller, { major: 1, minor: 0 });
    if (!connection.ok) throw Error('connect');
    expect(connection.value.capabilities).toContain('local.files.pick');
    expect((await broker.request(caller, { ...request, connection: connection.value.connection })).ok).toBe(true);
    broker.dispose();
  });

  it('opens the device-native chooser directly and returns opaque, recipient-bound metadata', async () => {
    const { root, filePath, files, coordinator, owner } = fixture();
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [filePath] });
    const result = await coordinator.pick(opts, owner, 'Dental Records', new AbortController().signal);
    expect(result.files.map(file => file.name)).toEqual(['sample.png']);
    expect(JSON.stringify(result)).not.toContain(root);
    expect(files.inspect(result.selectionId, result.files[0].receiptId, owner)).toEqual(result.files[0]);
    expect(() => files.inspect(result.selectionId, result.files[0].receiptId, { ...owner, sender: {} })).toThrow();
    expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledOnce();
    const call = vi.mocked(dialog.showOpenDialog).mock.calls[0] as unknown as [BrowserWindow, Electron.OpenDialogOptions];
    expect(call[1]).toMatchObject({
      title: 'Choose files for Dental Records', buttonLabel: 'Choose', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Medical images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'dcm', 'dicom'] }],
    });
  });

  it('cancels on native-dialog cancellation and rejects unauthorized calls before opening it', async () => {
    const { coordinator, owner } = fixture();
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(coordinator.pick(opts, owner, 'Dental Records', new AbortController().signal))
      .rejects.toMatchObject({ code: 'CANCELLED' });
    expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledOnce();
    vi.mocked(dialog.showOpenDialog).mockClear();
    const denied = { ...owner, authorized: () => false };
    await expect(coordinator.pick(opts, denied, 'Dental Records', new AbortController().signal))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(vi.mocked(dialog.showOpenDialog)).not.toHaveBeenCalled();
  });

  it('keeps the native picker busy until an aborted operating-system dialog closes', async () => {
    const { coordinator, owner } = fixture();
    let closeDialog!: (value: Electron.OpenDialogReturnValue) => void;
    vi.mocked(dialog.showOpenDialog).mockReturnValue(new Promise(resolve => { closeDialog = resolve; }));
    const abort = new AbortController();
    const pending = coordinator.pick(opts, owner, 'Dental Records', abort.signal);
    await Promise.resolve();
    expect(coordinator.busy).toBe(true);
    abort.abort();
    await expect(pending).rejects.toBeInstanceOf(FilePickerCancelled);
    expect(coordinator.busy).toBe(true);
    closeDialog({ canceled: true, filePaths: [] });
    await Promise.resolve();
    await Promise.resolve();
    expect(coordinator.busy).toBe(false);
  });

  it('rejects native symlink selections', async () => {
    if (process.platform === 'win32') return;
    const { root, coordinator, owner } = fixture();
    const outside = mkdtempSync(path.join(tmpdir(), 'native-picker-outside-'));
    dirs.push(outside);
    const secret = path.join(outside, 'secret.png');
    const link = path.join(root, 'linked.png');
    writeFileSync(secret, 'synthetic-only');
    symlinkSync(secret, link);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: [link] });
    await expect(coordinator.pick({ ...opts, maxSelections: 1 }, owner, 'Dental Records', new AbortController().signal))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(coordinator.busy).toBe(false);
  });
});
