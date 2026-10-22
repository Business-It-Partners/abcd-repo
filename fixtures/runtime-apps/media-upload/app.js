const dateInput = document.querySelector('#captured-on');
const selectImageButton = document.querySelector('#select-image');
const imageInput = document.querySelector('#image-file');
const connectButton = document.querySelector('#connect');
const createButton = document.querySelector('#create-patient');
const uploadButton = document.querySelector('#upload');
const reconcileButton = document.querySelector('#reconcile');
const cancelButton = document.querySelector('#cancel-transfer');
const connectionStatus = document.querySelector('#connection');
const patientStatus = document.querySelector('#patient');
const progressStatus = document.querySelector('#progress');
const resultStatus = document.querySelector('#result');
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumImageBytes = 10 * 1024 * 1024;

dateInput.value = new Date().toISOString().slice(0, 10);
let connection;
let patientId;
let selectedFile;
let pending;
let busy = false;
const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');

function setBusy(value) {
  busy = value;
  connectButton.disabled = value || !!connection;
  createButton.disabled = value || !connection || !!patientId;
  selectImageButton.disabled = value || !patientId || !!selectedFile || !!pending;
  uploadButton.disabled = value || !patientId || !selectedFile || !!pending;
  reconcileButton.hidden = !pending || !pending.unknown || value;
  cancelButton.hidden = !pending || !pending.unknown || value;
}

async function request(operation, input) {
  return window.dentalApp.request({
    version: 1,
    ...connection,
    requestId: crypto.randomUUID(),
    operation,
    input,
  });
}

connectButton.addEventListener('click', async () => {
  setBusy(true);
  const result = await window.dentalApp.connect({ major: 1, minor: 0 });
  if (!result.ok) {
    connectionStatus.textContent = `SDK connection failed: ${result.error.code}`;
  } else if (!result.value.capabilities.includes('clinic.media.upload') || !result.value.capabilities.includes('clinic.api.request')) {
    connectionStatus.textContent = 'The private media test grant is unavailable for this session.';
  } else {
    connection = { connection: result.value.connection, generation: result.value.generation };
    connectionStatus.textContent = 'Connected through the Dental OS host broker.';
  }
  setBusy(false);
});

createButton.addEventListener('click', async () => {
  if (!connection || !dateInput.value) return;
  setBusy(true);
  const marker = `Synthetic Dental OS media test ${crypto.randomUUID().slice(0, 8)}`;
  const result = await request('clinic.api.request', {
    method: 'POST',
    path: '/v1/patient-intakes',
    body: JSON.stringify({ fullName: marker, registeredOn: dateInput.value, medicalProfile: {}, allergies: [] }),
    idempotencyKey: crypto.randomUUID(),
  });
  if (!result.ok || result.value.status !== 201 || !result.value.body?.patient?.patientId) {
    patientStatus.textContent = `Synthetic patient creation failed: ${result.ok ? `HTTP ${result.value.status}` : result.error.code}`;
  } else {
    patientId = result.value.body.patient.patientId;
    patientStatus.textContent = `Synthetic patient ready: ${patientId}`;
  }
  setBusy(false);
});

selectImageButton.addEventListener('click', () => {
  if (!patientId || selectedFile || pending) return;
  imageInput.click();
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  if (!allowedImageTypes.has(file.type) || file.size < 1 || file.size > maximumImageBytes) {
    imageInput.value = '';
    progressStatus.textContent = 'Choose a valid JPG, PNG, or WebP image no larger than 10 MiB.';
    return;
  }
  selectedFile = file;
  progressStatus.textContent = `${file.name} selected · ${file.size} bytes`;
  setBusy(false);
});

async function uploadSelectedFile() {
  const file = selectedFile;
  if (!connection || !patientId || !file) return;
  if (!allowedImageTypes.has(file.type) || file.size < 1 || file.size > maximumImageBytes || !dateInput.value) {
    resultStatus.textContent = 'The selected image or its capture date is invalid.';
    return;
  }
  const selectedDigest = hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  if (!pending) {
    pending = {
      key: crypto.randomUUID(),
      file,
      checksum: selectedDigest,
      transferId: undefined,
      unknown: false,
    };
  }
  setBusy(true);
  resultStatus.textContent = '';
  if (!pending.transferId) {
    const begun = await request('clinic.media.upload', {
      action: 'begin',
      kind: 'patient_media',
      recordId: patientId,
      metadata: {
        displayFilename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        chiefComplaintId: null,
        xrayType: 'OPG',
        toothCode: null,
        clinicalNote: 'Public CC BY 4.0 sample for Dental OS staging transport verification only.',
        capturedOn: dateInput.value,
      },
      idempotencyKey: pending.key,
    });
    if (!begun.ok) {
      resultStatus.textContent = `Upload could not begin: ${begun.error.code}`;
      pending = undefined;
      setBusy(false);
      return;
    }
    pending.transferId = begun.value.transferId;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const chunk = bytes.subarray(offset, Math.min(offset + 8192, bytes.length));
    let binary = '';
    for (const byte of chunk) binary += String.fromCharCode(byte);
    const supplied = await request('clinic.media.upload', {
      action: 'chunk', transferId: pending.transferId, offset, data: btoa(binary),
    });
    if (!supplied.ok) {
      resultStatus.textContent = `Upload chunk was refused: ${supplied.error.code}`;
      await request('clinic.media.upload', { action: 'cancel', transferId: pending.transferId, idempotencyKey: pending.key });
      pending = undefined;
      setBusy(false);
      return;
    }
    progressStatus.textContent = `Preparing ${Math.min(offset + chunk.length, bytes.length)} of ${bytes.length} bytes in the host.`;
  }
  const committed = await request('clinic.media.upload', {
    action: 'commit', transferId: pending.transferId, idempotencyKey: pending.key,
  });
  if (!committed.ok) {
    pending.unknown = committed.error.outcome === 'unknown';
    resultStatus.textContent = pending.unknown
      ? 'The upload outcome is unknown. Keep this window open and explicitly reconcile the same operation.'
      : `Upload failed: ${committed.error.code}`;
    if (!pending.unknown) {
      await request('clinic.media.upload', { action: 'cancel', transferId: pending.transferId, idempotencyKey: pending.key });
      pending = undefined;
    }
    setBusy(false);
    return;
  }
  if (!committed.value.committed || !committed.value.assetId) {
    resultStatus.textContent = 'The Worker did not confirm an active media asset.';
    pending = undefined;
    setBusy(false);
    return;
  }
  progressStatus.textContent = 'Reading the private staged image through the host broker…';
  const read = await request('clinic.media.read', {
    kind: 'patient_media', recordId: patientId, assetId: committed.value.assetId,
  });
  if (!read.ok || !(read.value.body instanceof Uint8Array)) {
    resultStatus.textContent = `Staged readback failed: ${read.ok ? 'INVALID_RESPONSE' : read.error.code}`;
    pending = undefined;
    setBusy(false);
    return;
  }
  const readHash = hex(await crypto.subtle.digest('SHA-256', read.value.body));
  const match = read.value.body.byteLength === file.size && readHash === pending.checksum;
  progressStatus.textContent = match ? 'Private staged image read back.' : 'Readback did not match the selected file.';
  resultStatus.textContent = match
    ? `Verified ${file.size} bytes by SHA-256 through the Dental OS host broker.`
    : 'The staged image size or SHA-256 did not match.';
  pending = undefined;
  setBusy(false);
}

uploadButton.addEventListener('click', () => void uploadSelectedFile());
reconcileButton.addEventListener('click', () => {
  if (!pending?.unknown) return;
  pending.unknown = false;
  void uploadSelectedFile();
});
cancelButton.addEventListener('click', async () => {
  if (!pending?.unknown) return;
  setBusy(true);
  const result = await request('clinic.media.upload', {
    action: 'cancel', transferId: pending.transferId, idempotencyKey: pending.key,
  });
  resultStatus.textContent = !result.ok
    ? `Cleanup needs an explicit retry: ${result.error.code}`
    : result.value.committed
      ? 'The Worker had already committed this upload. The staging verifier will withdraw the synthetic image.'
      : 'The pending synthetic upload was cancelled.';
  if (result.ok) pending = undefined;
  setBusy(false);
});
setBusy(false);
window.dentalApp.report({ dirty: false, modal: false });
