const fixedId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const samplePatient = {
  patientId: '11111111-1111-4111-8111-111111111111', patientNumber: 'DEMO-001', fullName: 'Asha Karki',
  dateOfBirth: null, ageYears: 32, sex: 'female', phone: '+977 9800000000', status: 'active', registeredOn: '2026-10-20', rowVersion: 1,
};
const sampleDoctor = {
  staffId: '22222222-2222-4222-8222-222222222222', fullName: 'Dr. Samir Shrestha', staffType: 'doctor', jobTitle: 'Dentist', status: 'active',
};
const sampleFollowUp = {
  followUpId: '33333333-3333-4333-8333-333333333333', patientId: samplePatient.patientId, chiefComplaintId: null,
  dueOn: '2026-10-28', dueTime: '10:30', reason: 'Post-treatment check-in', status: 'pending', rowVersion: 1,
  patientNumber: samplePatient.patientNumber, patientName: samplePatient.fullName, patientPhone: samplePatient.phone,
  requestedByStaffName: sampleDoctor.fullName, lastVisitOn: '2026-10-21', called: false, noAnswer: false,
};
const sampleAppointment = {
  appointmentId: '44444444-4444-4444-8444-444444444444', patientName: samplePatient.fullName, contactPhone: samplePatient.phone,
  doctorName: sampleDoctor.fullName, appointmentDate: new Date().toISOString().slice(0, 10), startMinute: 600, durationMinutes: 30,
  reason: 'Routine check-up', status: 'booked', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rowVersion: 1,
};
const sampleCalendarTask = {
  calendarTaskId: '55555555-5555-4555-8555-555555555555', taskDate: new Date().toISOString().slice(0, 10),
  title: 'Review today’s clinic schedule', category: 'admin', status: 'open', completedAt: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rowVersion: 1,
};

const workEntryPreviewAppId = 'company.dental.work-entry.m17';
const workEntryPatientId = '11111111-1111-4111-8111-111111111111';
const workEntryCaseId = '22222222-2222-4222-8222-222222222222';
const workEntryPatient = {
  patientId: workEntryPatientId, patientNumber: 'SYN-001', fullName: 'Synthetic Work Entry Patient',
  dateOfBirth: null, ageYears: 34, sex: 'female', phone: '+977-9800000000', status: 'active',
  registeredOn: '2026-10-01', rowVersion: 1,
};
const makeProtocol = (idPrefix, name, category, toothScope, recordsCanalMeasurements, stages) => ({
  protocolId: `${idPrefix}-0000-4000-8000-900000000001`, name, category, description: null, toothScope,
  recordsCanalMeasurements, usesMobilityGrade: false, active: true, starterTemplateCode: null,
  starterPackVersion: null, rowVersion: 1,
  totalPrice: stages.reduce((total, [, price]) => total + price, 0),
  stages: stages.map(([stageName, price], index) => ({
    protocolStageId: `${idPrefix}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    stageOrder: index + 1, stageName, price, active: true, rowVersion: 1,
  })),
});
const workEntryProtocols = [
  {
    patientProtocolId: 'b1000001-0000-4000-8000-900000000001', toothCode: '46', treatmentArea: null,
    protocol: makeProtocol('a1000001', 'Root canal treatment', 'Endodontics', 'tooth', true, [
      ['Clean and shape canals', 7500], ['Complete and restore', 5000],
    ]),
    completedStageIndexes: [0],
  },
  {
    patientProtocolId: 'b1000002-0000-4000-8000-900000000002', toothCode: '46', treatmentArea: null,
    protocol: makeProtocol('a1000002', 'Crown restoration', 'Restorative', 'tooth', false, [
      ['Prepare tooth', 12000], ['Take digital impression', 6500], ['Fit temporary crown', 4000],
      ['Check crown fit', 5000], ['Cement final crown', 18000],
    ]),
    completedStageIndexes: [],
  },
  {
    patientProtocolId: 'b1000003-0000-4000-8000-900000000003', toothCode: null, treatmentArea: 'Full mouth',
    protocol: makeProtocol('a1000003', 'Periodontal therapy', 'Periodontics', 'full_mouth', false, [
      ['Full-mouth scaling', 5000], ['Root planing — upper right', 4000], ['Root planing — upper left', 4000],
      ['Root planing — lower left', 4000], ['Root planing — lower right', 4000], ['Periodontal review', 3500],
    ]),
    completedStageIndexes: [],
  },
  {
    patientProtocolId: 'b1000004-0000-4000-8000-900000000004', toothCode: '48', treatmentArea: null,
    protocol: makeProtocol('a1000004', 'Surgical extraction', 'Oral surgery', 'tooth', false, [
      ['Pre-operative assessment', 2500], ['Prepare and anesthetize', 4500], ['Remove tooth', 12000],
      ['Clean and close socket', 5500], ['Post-operative review', 3500],
    ]),
    completedStageIndexes: [],
  },
];
const workEntryCase = {
  chiefComplaintId: workEntryCaseId, patientId: workEntryPatientId, patientNumber: workEntryPatient.patientNumber,
  patientName: workEntryPatient.fullName, chiefComplaint: 'Molar pain · tooth 46', openedOn: '2026-10-22',
  status: 'open', outcomeNote: null, closedOn: null, rowVersion: 1, caseDoctorStaffIds: [sampleDoctor.staffId],
  protocols: workEntryProtocols.map(({ patientProtocolId, toothCode, treatmentArea, protocol, completedStageIndexes }) => ({
    patientProtocolId, rowVersion: 1, sourceProtocolId: protocol.protocolId, protocolName: protocol.name,
    toothCode, treatmentArea, status: 'active',
    stages: protocol.stages.map((stage, index) => ({
      stageId: `d${protocol.protocolId.slice(1, 8)}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      rowVersion: 1, sourceProtocolStageId: stage.protocolStageId, stageName: stage.stageName,
      stageOrder: stage.stageOrder, price: stage.price,
      status: completedStageIndexes.includes(index) ? 'done' : 'pending',
    })),
  })),
};
const workEntryCaseListItem = {
  chiefComplaintId: workEntryCaseId, chiefComplaint: workEntryCase.chiefComplaint, openedOn: workEntryCase.openedOn,
  status: 'open', rowVersion: 1, treatmentProtocolCount: workEntryCase.protocols.length, worklistStatus: 'in_progress',
};

function sampleBody(url, apiResponses, appId) {
  const pathname = url.pathname;
  // Work Entry has a dedicated multi-protocol synthetic case for this preview.
  // Resolve it before generic saved samples: an older api-responses.json may
  // still be loaded by a preview server that was started before that file was
  // removed, and would otherwise shadow this case with its single RCT plan.
  if (appId === workEntryPreviewAppId) {
    if (pathname === '/v1/work-entry/cases') return { cases: [{ ...workEntryPatient, cases: [workEntryCaseListItem], latestCase: workEntryCaseListItem }] };
    if (pathname === `/v1/chief-complaints/${workEntryCaseId}/work-entry`) return { case: structuredClone(workEntryCase) };
    if (pathname === '/v1/treatment-protocols') return { treatmentProtocols: workEntryProtocols.map(({ protocol }) => structuredClone(protocol)) };
    if (pathname === `/v1/patients/${workEntryPatientId}/core`) return { patient: {
      ...workEntryPatient, address: null, preferredLanguage: null, emergencyContactName: null, emergencyContactPhone: null,
      chiefComplaintId: workEntryCaseId,
      medicalProfile: { conditionsSummary: null, currentMedicationsSummary: null, habitsSummary: null, medicalNotes: null, verifiedOn: null, rowVersion: 1 },
      allergies: [{ patientAllergyId: 'e1000001-0000-4000-8000-000000000001', allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate', note: null, recordedOn: '2026-10-01', status: 'active', rowVersion: 1 }],
    } };
    if (pathname === `/v1/patients/${workEntryPatientId}/ledger`) return { ledger: { summary: { totalBilled: 0, totalCollected: 0, totalDiscount: 0, outstandingDue: 0 }, entries: [], nextCursor: null } };
    if (pathname === `/v1/patients/${workEntryPatientId}/odontogram`) return { marks: [] };
    if (pathname === `/v1/patients/${workEntryPatientId}/periodontal-chart`) return { chart: { patientId: workEntryPatientId, lastChartedOn: null, teeth: [] } };
    if (pathname === `/v1/patients/${workEntryPatientId}/canal-measurements`) return { sessions: [] };
    if (pathname === '/v1/follow-ups') return { followUps: [] };
  }
  const exact = `GET ${pathname}${url.search}`;
  if (Object.hasOwn(apiResponses, exact)) return structuredClone(apiResponses[exact]);
  const pathOnly = `GET ${pathname}`;
  if (Object.hasOwn(apiResponses, pathOnly)) return structuredClone(apiResponses[pathOnly]);
  if (pathname === '/v1/clinic/staff-references') return { staff: [sampleDoctor] };
  if (pathname === '/v1/follow-ups') return { followUps: [sampleFollowUp] };
  if (pathname === '/v1/patients') return { patients: [samplePatient], total: 1, counts: { all: 1, new: 1, regular: 0 }, nextCursor: null };
  if (/^\/v1\/patients\/[^/]+\/media$/.test(pathname)) return { media: [] };
  if (pathname === '/v1/appointments/summary') return { summary: { todayBooked: 1, thisWeekBooked: 3, upcomingBooked: 4, cancelled: 0 } };
  if (pathname === '/v1/appointments') return { appointments: [sampleAppointment] };
  if (pathname === '/v1/calendar-tasks') return { calendarTasks: [sampleCalendarTask] };
  if (pathname === '/v1/treatment-progress') return { patients: [] };
  if (pathname === '/v1/work-entry/cases') return { cases: [] };
  if (pathname === '/v1/lab-orders') return { labOrders: [] };
  if (pathname === '/v1/clinic/suppliers') return { suppliers: [] };
  if (pathname === '/v1/clinic/supplier-payments') return { supplierPayments: [] };
  if (pathname === '/v1/clinic/products') return { products: [] };
  if (pathname === '/v1/clinic/purchases') return { purchases: [] };
  if (pathname === '/v1/clinic/salary-payouts') return { salaryPayouts: [] };
  if (pathname === '/v1/clinic/operating-expenses') return { operatingExpenses: [] };
  if (/^\/v1\/clinic\/staff\/[^/]+\/clinical-work$/.test(pathname)) return { work: [] };
  if (/^\/v1\/clinic\/staff\/[^/]+\/documents$/.test(pathname)) return { documents: [] };
  if (pathname === '/v1/clinic/staff') return { staff: [] };
  if (pathname === '/v1/treatment-protocols') return { treatmentProtocols: [] };
  if (pathname === '/v1/patient-intakes/context') return { context: { branches: [], doctors: [], defaultBranchId: null } };
  return {};
}

export function installBrowserPreviewBridge(config) {
  const app = config.app;
  const manifest = config.manifest;
  const packageMetadata = config.packageMetadata;
  const capabilities = [...new Set([
    ...manifest.capabilities,
    ...(packageMetadata.anyCapabilities ?? []),
    ...(packageMetadata.modules ?? []).map(module => module.capability),
  ])];
  const connection = crypto.randomUUID();
  const context = {
    clinicUser: { clinicUserId: 'browser-demo-user', displayName: 'Demo Dentist', role: 'admin', capabilities },
    clinic: { tenantId: 'browser-demo-clinic', displayName: 'Sample Dental Clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: 'browser-demo-branch', hasActiveTrial: false },
    branches: [{ branchId: 'browser-demo-branch', branchCode: 'DEMO', name: 'Main Branch' }],
  };
  const appInfo = {
    appId: manifest.appId, title: packageMetadata.title, description: packageMetadata.description,
    iconDataUrl: config.iconDataUrl, modules: packageMetadata.modules ?? [],
    ...(Number.isFinite(packageMetadata.preferredContentWidth) ? { preferredContentWidth: packageMetadata.preferredContentWidth } : {}),
  };
  const moduleListeners = new Set();
  const navigationListeners = new Set();
  const previewError = message => ({ ok: false, error: { code: 'UNAVAILABLE', message, outcome: 'not_sent' } });

  window.dentalPreview = Object.freeze({ kind: 'browser-source-preview', appId: manifest.appId, dataIsSynthetic: true });
  window.dentalApp = {
    async connect(input) {
      if (input?.major !== 1 || !Number.isSafeInteger(input.minor) || input.minor < 0 || input.minor > 6) return previewError('This browser preview uses SDK 1.x.');
      return { ok: true, value: { connection, generation: 1, appId: manifest.appId, appVersion: manifest.version, sdk: { major: 1, minor: 6 }, capabilities: manifest.capabilities } };
    },
    async getAppInfo() { return { ok: true, value: appInfo }; },
    async request(request) {
      if (request?.operation === 'session.context') return { ok: true, value: { clinicSession: context } };
      if (request?.operation === 'clinic.api.request') {
        const input = request.input ?? {};
        const url = new URL(input.path ?? '/', 'https://browser-preview.invalid');
        if (input.method === 'GET') return { ok: true, value: { status: 200, body: sampleBody(url, config.apiResponses ?? {}, manifest.appId) } };
        return { ok: true, value: { status: 403, body: { message: 'Writes are disabled in Browser Preview.' } } };
      }
      if (request?.operation === 'local.files.pick') return previewError('Device file selection is available in Dental OS Preview.');
      if (request?.operation === 'clinic.media.read' || request?.operation === 'clinic.media.upload' || request?.operation === 'clinic.api.blob.read') {
        return previewError('Clinic file storage is available in Dental OS Preview.');
      }
      return previewError('This host operation is not part of Browser Preview.');
    },
    async cancel() { return { ok: true, value: null }; },
    async openAppExplorer() { return previewError('App navigation is available in Dental OS Preview.'); },
    onModuleSelected(listener) { moduleListeners.add(listener); return () => moduleListeners.delete(listener); },
    navigation: {
      report() {},
      onRequest(listener) { navigationListeners.add(listener); return () => navigationListeners.delete(listener); },
    },
    report() {},
  };
}

if (typeof window !== 'undefined' && window.__DENTAL_BROWSER_PREVIEW__) {
  installBrowserPreviewBridge(window.__DENTAL_BROWSER_PREVIEW__);
}
