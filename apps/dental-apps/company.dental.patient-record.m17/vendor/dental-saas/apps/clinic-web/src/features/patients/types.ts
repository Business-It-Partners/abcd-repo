export type PatientSex = "female" | "male" | "other" | "not_recorded";
export type AllergySeverity = "mild" | "moderate" | "severe" | "unknown";

export type PatientMediaAssetType = "xray";
export type PatientMediaMimeType = "image/jpeg" | "image/png" | "image/webp";
export type PatientMediaStatus = "pending" | "active" | "withdrawn" | "rejected" | "cleanup_pending";
export type PatientXrayType = "IOPA" | "OPG" | "CBCT" | "Intraoral photo";
export type PatientMediaAsset = {
  mediaAssetId: string;
  patientId: string;
  branchId: string;
  chiefComplaintId: string | null;
  assetType: PatientMediaAssetType;
  xrayType: PatientXrayType | null;
  toothCode: string | null;
  clinicalNote: string | null;
  capturedOn: string | null;
  displayFilename: string;
  mimeType: PatientMediaMimeType;
  byteSize: number;
  checksum: string;
  status: PatientMediaStatus;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  replacesMediaAssetId: string | null;
};
export type PatientMediaReplacementInput = PatientMediaUploadIntentInput & { reason: string };
export type PatientMediaUploadIntentInput = {
  patientId: string;
  chiefComplaintId: string | null;
  assetType: "xray";
  xrayType: PatientXrayType;
  toothCode: string | null;
  clinicalNote: string | null;
  capturedOn: string | null;
  displayFilename: string;
  mimeType: PatientMediaMimeType;
  byteSize: number;
  checksum: string;
};

export type PatientPlanStageInput = {
  sourceProtocolStageId: string | null;
  stageName: string;
  price: number;
};

export type PatientPlanSelectionInput = {
  sourceProtocolId: string;
  toothCode: string | null;
  treatmentArea: string | null;
  stages: PatientPlanStageInput[];
};

export type PatientComplaintPlanInput = {
  chiefComplaint: string;
  openedOn: string;
  plans: PatientPlanSelectionInput[];
};
export type PatientCaseInput = { chiefComplaint: string; openedOn: string };
export type PatientCase = PatientCaseInput & { chiefComplaintId: string; patientId: string; branchId: string; status: "open" };

export type OdontogramSlot = "presence" | "structure" | "endodontics" | "prosthesis";
export type OdontogramValue =
  | "erupted" | "unerupted" | "impacted" | "extracted" | "shed" | "missing" | "implant" | "mobility"
  | "sound" | "decayed" | "filled" | "sealant"
  | "root-treated" | "retreated"
  | "crown" | "veneer" | "bridge";
export type OdontogramMark = { toothCode: string; slot: OdontogramSlot; value: OdontogramValue };
export type OdontogramSaveInput = { recordedOn: string; marks: OdontogramMark[]; removedMarks: OdontogramMark[] };
export type PeriodontalSite = "db" | "b" | "mb" | "dl" | "l" | "ml";
export type PeriodontalTooth = { toothCode: string; probingDepths: Record<PeriodontalSite, number>; recession: Pick<Record<PeriodontalSite, number>, "db" | "b" | "mb">; bleedingOnProbing: Record<PeriodontalSite, boolean>; mobilityGrade: 0 | 1 | 2 | 3 };
export type PatientPeriodontalChart = { patientId: string; lastChartedOn: string | null; teeth: PeriodontalTooth[] };
export type PeriodontalChartSaveInput = { patientId: string; chiefComplaintId: string | null; recordedOn: string; teeth: PeriodontalTooth[] };
export type CanalMeasurementRecord = { canalLabel: string; workingLengthMm: number; fileNumber: string | null; reference: string | null };
export type PatientCanalMeasurement = { canalMeasurementSessionId: string; patientId: string; chiefComplaintId: string; patientProtocolId: string; toothCode: string | null; recordedOn: string; recordedByStaffId: string | null; obturationMaterial: string | null; note: string | null; records: CanalMeasurementRecord[]; createdAt: string };
export type CanalMeasurementSaveInput = Omit<PatientCanalMeasurement, "canalMeasurementSessionId" | "patientProtocolId" | "toothCode" | "createdAt"> & {
  patientProtocolId: string | null;
  /** Supplied only when the first canal session must create its patient plan atomically. */
  plan: PatientPlanSelectionInput | null;
};

export type PatientIntakeInput = {
  fullName: string;
  preferredLanguage?: string | null;
  dateOfBirth: string | null;
  /** Age captured at registration when the clinic chooses not to record a date of birth. */
  ageYears: number | null;
  sex: PatientSex | null;
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  registeredOn: string;
  medicalProfile: {
    conditionsSummary: string | null;
    currentMedicationsSummary: string | null;
    habitsSummary: string | null;
    medicalNotes: string | null;
    verifiedOn: string | null;
  };
  allergies: Array<{
    allergen: string;
    reaction: string | null;
    severity: AllergySeverity;
    note: string | null;
    recordedOn: string;
  }>;
  complaintPlan?: PatientComplaintPlanInput;
};

export type PatientProfileUpdateInput = {
  expectedPatientRowVersion: number;
  expectedMedicalProfileRowVersion: number;
  patient: Pick<PatientIntakeInput, "fullName" | "preferredLanguage" | "ageYears" | "sex" | "phone" | "address" | "emergencyContactName" | "emergencyContactPhone">;
  medicalProfile: PatientIntakeInput["medicalProfile"];
  allergies: PatientIntakeInput["allergies"];
};

export type PatientComplaintPlan = PatientComplaintPlanInput & {
  chiefComplaintId: string;
  patientId: string;
  branchId: string;
  status: "open";
};

export type PatientPaymentMethod = "cash" | "esewa" | "khalti" | "card" | "bank_transfer" | "cheque";

export type ClinicalWorkFinalisationInput = {
  patientId: string;
  chiefComplaintId: string;
  completedOn: string;
  completedStages: Array<{
    sourceProtocolId: string;
    sourceProtocolStageId: string;
    toothCode: string | null;
    treatmentArea: string | null;
    chargeAmount?: number;
  }>;
  /** A clinician-added stage already saved on this patient's treatment plan. */
  completedCustomStages?: Array<{
    patientProtocolStageId: string;
    chargeAmount?: number;
  }>;
  extraWork?: Array<{
    patientProtocolId: string;
    stageName: string;
    chargeAmount: number;
  }>;
  doctorStaffIds: string[];
};

export type ClinicalWorkFinalisation = {
  completedStageIds: string[];
  chargeAmount: number;
  currentDueAmount: number;
};

export type WorkEntryCommitInput = {
  patientId: string;
  chiefComplaintId: string;
  workDate: string;
  expectedCaseRowVersion: number;
  doctorStaffIds: string[];
  planSelections: PatientPlanSelectionInput[];
  plannedCompletedStages: Array<{ sourceProtocolId: string; sourceProtocolStageId: string; toothCode: string | null; treatmentArea: string | null; chargeAmount: number | null }>;
  completedStages: Array<{ patientProtocolStageId: string; expectedRowVersion: number; chargeAmount: number | null }>;
  addedStages: Array<{ patientProtocolId: string; expectedRowVersion: number; stageName: string; chargeAmount: number; completeToday: boolean }>;
  note: string | null;
  odontogram: OdontogramSaveInput | null;
  periodontalChart: PeriodontalTooth[] | null;
  canalMeasurements: Array<{
    sourceProtocolId: string;
    toothCode: string | null;
    treatmentArea: string | null;
    recordedOn: string;
    obturationMaterial: string | null;
    note: string | null;
    records: CanalMeasurementRecord[];
  }>;
  prescription: { note: string | null; items: PrescriptionItemInput[] } | null;
  labOrders: Array<{
    /** Null keeps the lab request pending until reception assigns a supplier. */
    supplierId: string | null;
    labWorkName: string;
    toothScope: string | null;
    shade: string | null;
    note: string | null;
  }>;
  followUp: Omit<FollowUpCreateInput, "patientId" | "chiefComplaintId"> | null;
  payment: Omit<PatientPaymentInput, "patientId"> | null;
  caseDisposition: { status: "closed"; reason: string | null } | null;
};

export type WorkEntryCommitResult = {
  completedStageIds: string[];
  addedPendingStageIds: string[];
  prescriptionId: string | null;
  labOrderIds: string[];
  followUpId: string | null;
  receiptNumber: string | null;
  chargeAmount: number;
  currentDueAmount: number;
  caseStatus: "open" | "completed" | "closed";
  caseRowVersion: number;
};

export type PatientPaymentInput = {
  patientId: string;
  paymentDate: string;
  amount: number;
  discountAmount: number;
  paymentMethod: PatientPaymentMethod;
};

export type PatientPayment = {
  patientLedgerEntryId: string;
  receiptNumber: string;
  amount: number;
  discountAmount: number;
  currentDueAmount: number;
};

export type PrescriptionItemInput = {
  medicineName: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string;
};

export type PrescriptionCreateInput = {
  patientId: string;
  chiefComplaintId: string | null;
  prescribedOn: string;
  note: string | null;
  items: PrescriptionItemInput[];
};

export type PatientPrescription = PrescriptionCreateInput & {
  prescriptionId: string;
  status: "draft" | "issued" | "withdrawn";
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  supersedesPrescriptionId: string | null;
};
export type PrescriptionWithdrawalInput = { reason: string; expectedRowVersion: number };
export type PrescriptionCorrectionInput = PrescriptionCreateInput & { reason: string; expectedRowVersion: number };
export type PatientLedgerCorrectionInput = { reason: string; expectedRowVersion: number; amount: number; entryDate: string };
export type PatientLedgerReversalInput = { reason: string; expectedRowVersion: number; entryDate: string };

export type PatientNote = {
  patientNoteId: string;
  patientId: string;
  chiefComplaintId: string | null;
  noteType: "general" | "visit";
  noteDate: string;
  body: string;
  status: "active" | "withdrawn";
  createdAt: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
};

export type PatientNoteCreateInput = {
  patientId: string;
  chiefComplaintId: string | null;
  noteType: "general" | "visit";
  noteDate: string;
  body: string;
};

export type PatientTimelineEvent = {
  eventId: string;
  occurredOn: string;
  recordedAt: string;
  eventType: "clinical_work" | "note" | "prescription" | "lab_order" | "follow_up" | "media";
  title: string;
  detail: string | null;
  chiefComplaintId: string | null;
  doctors: string[];
  patientProtocolId: string | null;
  protocolName: string | null;
  toothCode: string | null;
  treatmentArea: string | null;
};

/** Worker-calculated statement for the Patient Record Billing Ledger tab. */
export type PatientLedgerEntry = {
  patientLedgerEntryId: string;
  entryDate: string;
  recordedAt: string;
  entryType: "charge" | "payment" | "correction" | "reversal";
  amount: number;
  discountAmount: number;
  paymentMethod: PatientPaymentMethod | null;
  receiptNumber: string | null;
  forLabel: string | null;
  note: string | null;
  reversesEntryId: string | null;
  supersedesEntryId: string | null;
  correctionReason: string | null;
  rowVersion: number;
  runningBalance: number;
};

export type PatientLedger = {
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalDiscount: number;
    outstandingDue: number;
  };
  entries: PatientLedgerEntry[];
  nextCursor: string | null;
};

export type PatientTreatmentPlan = {
  chiefComplaintId: string;
  chiefComplaint: string;
  openedOn: string;
  status: "open" | "completed" | "closed";
  rowVersion: number;
  outcomeNote: string | null;
  closedOn: string | null;
  protocols: Array<{
    patientProtocolId: string;
    rowVersion: number;
    protocolName: string;
    toothCode: string | null;
    treatmentArea: string | null;
    status: "active" | "completed" | "cancelled";
    stages: Array<{
      stageId: string;
      stageName: string;
      stageOrder: number;
      price: number;
      status: "pending" | "done" | "cancelled";
      completedOn: string | null;
      completedAt: string | null;
      completedBy: string[];
    }>;
  }>;
};

/** Worker-calculated clinic-wide Treatment Progress row. */
export type TreatmentProgressRow = {
  patientId: string;
  patientNumber: string;
  fullName: string;
  planTitle: string;
  completedStages: number;
  totalStages: number;
  doctorNames: string[];
  outstandingDue: number;
  nextReturnOn: string | null;
};

export type PatientPaymentsReport = {
  received: Array<{
    patientLedgerEntryId: string;
    patientId: string;
    patientNumber: string;
    patientName: string;
    paymentDate: string;
    recordedAt: string;
    amount: number;
    discountAmount: number;
    paymentMethod: PatientPaymentMethod;
    receiptNumber: string | null;
  }>;
  outstanding: Array<{
    patientId: string;
    patientNumber: string;
    patientName: string;
    planTitle: string;
    currentDueAmount: number;
  }>;
};

export type FollowUpCreateInput = {
  patientId: string;
  chiefComplaintId: string | null;
  dueOn: string;
  dueTime: string | null;
  reason: string;
  requestedByStaffId: string | null;
};

export type PatientFollowUp = {
  followUpId: string;
  patientId: string;
  chiefComplaintId: string | null;
  dueOn: string;
  dueTime: string | null;
  reason: string;
  status: "pending" | "caught" | "missed" | "cancelled";
};

export type FollowUpWorklistItem = PatientFollowUp & {
  rowVersion: number;
  patientNumber: string;
  patientName: string;
  patientPhone: string | null;
  requestedByStaffName: string | null;
  lastVisitOn: string | null;
  called: boolean;
  noAnswer: boolean;
};

export type FollowUpContactEventInput = {
  eventType: "called" | "no_answer";
  note: string | null;
  expectedRowVersion: number;
};

export type FollowUpToggleInput = {
  field: "called" | "no_answer" | "caught";
  checked: boolean;
  expectedRowVersion: number;
};

export type FollowUpToggleResult = {
  followUpId: string;
  field: FollowUpToggleInput["field"];
  checked: boolean;
  status: "pending" | "caught" | "missed" | "cancelled";
  rowVersion: number;
};

export type FollowUpScheduleInput = {
  dueOn: string;
  dueTime: string | null;
  reason: string;
  expectedRowVersion: number;
};
export type FollowUpUpdateInput = FollowUpScheduleInput;

export type PatientSummary = {
  patientId: string;
  patientNumber: string;
  fullName: string;
  dateOfBirth: string | null;
  ageYears: number | null;
  sex: PatientSex | null;
  phone: string | null;
  status: "active" | "inactive";
  registeredOn: string;
  rowVersion: number;
};

export type PatientDirectoryCohort = "all" | "new" | "regular";

export type PatientDirectoryCounts = Record<PatientDirectoryCohort, number>;

export type PatientDirectoryRequest = {
  query?: string;
  cursor?: string;
  limit?: number;
  cohort?: PatientDirectoryCohort;
  monthStart?: string;
  monthEnd?: string;
};

export type PatientDirectoryPage = {
  patients: PatientSummary[];
  nextCursor: string | null;
  total: number;
  counts: PatientDirectoryCounts;
};

export type PatientRegistrationContext = {
  patientNumberPrefix: string;
  currentCounter: number;
  nextPatientNumber: string;
};

export type PatientCore = PatientSummary & {
  chiefComplaintId?: string;
  address: string | null;
  preferredLanguage: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalProfile: PatientIntakeInput["medicalProfile"] & { rowVersion: number };
  allergies: Array<PatientIntakeInput["allergies"][number] & {
    patientAllergyId: string;
    status: "active" | "resolved";
    rowVersion: number;
  }>;
};

export type WorkEntryCaseRow = PatientSummary & {
  cases: Array<{
    chiefComplaintId: string;
    chiefComplaint: string;
    openedOn: string;
    status: "open" | "completed" | "closed";
    rowVersion: number;
    treatmentProtocolCount: number;
    worklistStatus: "open" | "in_progress" | "complete";
  }>;
  latestCase: {
    chiefComplaintId: string;
    chiefComplaint: string;
    openedOn: string;
    status: "open" | "completed" | "closed";
    rowVersion: number;
    treatmentProtocolCount: number;
    worklistStatus: "open" | "in_progress" | "complete";
  } | null;
};

export type WorkEntryCase = {
  chiefComplaintId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  chiefComplaint: string;
  openedOn: string;
  status: "open" | "completed" | "closed";
  outcomeNote: string | null;
  closedOn: string | null;
  rowVersion: number;
  caseDoctorStaffIds: string[];
  protocols: Array<{
    patientProtocolId: string;
    rowVersion: number;
    sourceProtocolId: string;
    protocolName: string;
    toothCode: string | null;
    treatmentArea: string | null;
    status: "active" | "completed" | "cancelled";
    stages: Array<{ stageId: string; rowVersion: number; sourceProtocolStageId: string | null; stageName: string; stageOrder: number; price: number; status: "pending" | "done" | "cancelled" }>;
  }>;
};

export type WorkEntryProtocolAddInput = { patientId: string; plan: PatientPlanSelectionInput };
export type WorkEntryProtocolCancelInput = { patientId: string; expectedRowVersion: number; reason: string };
export type WorkEntryStageAddInput = { patientId: string; expectedRowVersion: number; stageName: string; price: number };
export type CaseStatusUpdateInput = {
  patientId: string;
  expectedRowVersion: number;
  status: "open" | "completed" | "closed";
  reason: string | null;
};
export type WorkEntryStageCancelInput = { patientId: string; expectedRowVersion: number; reason: string };

/** Editable patient and case details captured before planning treatment in Work Entry. */
export type WorkEntryCaseUpdateInput = {
  patientId: string;
  expectedPatientRowVersion: number;
  expectedMedicalProfileRowVersion: number;
  expectedCaseRowVersion: number;
  patient: Pick<PatientIntakeInput, "fullName" | "ageYears" | "sex" | "phone" | "address" | "emergencyContactName" | "emergencyContactPhone">;
  medicalProfile: PatientIntakeInput["medicalProfile"];
  allergies: PatientIntakeInput["allergies"];
  chiefComplaint: string;
  openedOn: string;
  caseDoctorStaffIds: string[];
};
