import { ClinicClient, ClinicCommand, ClinicError } from "../../../../packages/app-sdk/src/clinicClient";
import type { AppSdk, Connection } from "../../../../electron/sdk/contracts";
import { bsMonthToADRange, todayBS } from "../../../../packages/dental-ui/src/shared/dates/bikramSambat";
import type {
  PatientCore, PatientDirectoryPage, PatientDirectoryCounts, PatientSummary, PatientIntakeInput,
  PatientProfileUpdateInput, PatientRegistrationContext, PatientTreatmentPlan, PatientTimelineEvent,
  PatientNote, PatientNoteCreateInput, PatientPrescription, PrescriptionCreateInput,
  PatientLedger, PatientPaymentInput, PatientPayment, PatientFollowUp, FollowUpCreateInput,
  PatientMediaAsset, PatientXrayType,
} from "./types";

export const APP_ID = "company.dental.patient-record.m17";
export const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};
export const dateValid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
export const monthBS = () => { const bs = todayBS(); return bs ? String(bs.year) + "-" + String(bs.month).padStart(2, "0") : ""; };
export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const check = (v: unknown, field: string): Record<string, unknown> => {
  if (!isObject(v)) throw new ClinicError("INVALID_RESPONSE", field + " returned an invalid response.");
  return v;
};
const field = <T>(value: unknown, name: string, validate: (x: unknown) => boolean): T => {
  const obj = check(value, name);
  if (!validate(obj[name])) throw new ClinicError("INVALID_RESPONSE", name + " is missing or invalid.");
  return obj[name] as T;
};
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isPatient = (v: unknown): v is PatientSummary => isObject(v) &&
  typeof v.patientId === "string" && typeof v.patientNumber === "string" &&
  typeof v.fullName === "string" && Number.isInteger(v.rowVersion as number);
const isCore = (v: unknown): v is PatientCore => {
  if (!isObject(v) || !isPatient(v)) return false;
  const record = v as unknown as Record<string, unknown>;
  const medicalProfile = record.medicalProfile;
  return isObject(medicalProfile) && Number.isInteger(medicalProfile.rowVersion as number)
    && Array.isArray(record.allergies);
};
const isReceipt = (key: string) => (v: unknown) => isObject(v) && isObject(v[key]);
const isList = (v: unknown) => Array.isArray(v);
export type Cohort = "all" | "new" | "regular";
export type PatientTreatmentProtocolReference = {
  id: string;
  name: string;
  recordCanals?: boolean;
  stages: Array<{ sourceProtocolStageId?: string; label: string; defaultCost?: number; toothScope?: string }>;
  grades?: Array<{ id: string; label: string; stages: Array<{ sourceProtocolStageId?: string; label: string; defaultCost?: number; toothScope?: string }> }>;
};
export type PatientLabSupplier = { supplierId: string; name: string; supplierType?: "lab" | "both" | "goods"; active: boolean };

export class PatientApi {
  constructor(private readonly sdk: ClinicClient) {}
  async directory(input: {query: string; cohort: Cohort; month: string; cursor: string | null; limit: number;}): Promise<PatientDirectoryPage> {
    const search = new URLSearchParams();
    const q = input.query.trim().slice(0, 120);
    search.set("limit", String(input.limit));
    if (q) search.set("q", q);
    else {
      if (input.cohort !== "all") search.set("cohort", input.cohort);
      const [year, month] = input.month.split("-").map(Number);
      const range = Number.isInteger(year) && Number.isInteger(month) ? bsMonthToADRange(year, month) : null;
      if (input.month && !range) throw new ClinicError("VALIDATION", "Select a valid Nepali month.");
      if (range) { search.set("monthStart", range.start); search.set("monthEnd", range.end); }
    }
    if (input.cursor) search.set("cursor", input.cursor);
    const raw = check(await this.sdk.read("/v1/patients?" + search.toString()), "Patient directory");
    if (!Array.isArray(raw.patients) || !raw.patients.every(isPatient) ||
        !Number.isInteger(raw.total as number) || (raw.total as number) < 0 ||
        !(raw.nextCursor === null || typeof raw.nextCursor === "string")) {
      throw new ClinicError("INVALID_RESPONSE", "The patient directory returned an invalid page.");
    }
    const counts = isObject(raw.counts) && ["all", "new", "regular"].every(key => Number.isInteger((raw.counts as Record<string, unknown>)[key] as number))
      ? raw.counts as PatientDirectoryCounts : { all: 0, new: 0, regular: 0, [q ? "all" : input.cohort]: raw.total } as PatientDirectoryCounts;
    return { patients: raw.patients as PatientSummary[], total: raw.total as number, counts, nextCursor: raw.nextCursor as string | null };
  }
  context() { return this.sdk.read("/v1/patient-intakes/context").then(v => field<PatientRegistrationContext>(v, "context", isObject)); }
  core(id: string) { return this.sdk.read("/v1/patients/" + id + "/core").then(v => field<PatientCore>(v, "patient", isCore)); }
  plans(id: string) { return this.sdk.read("/v1/patients/" + id + "/treatment-plans").then(v => field<PatientTreatmentPlan[]>(v, "treatmentPlans", isArray)); }
  timeline(id: string) { return this.sdk.read("/v1/patients/" + id + "/timeline").then(v => field<PatientTimelineEvent[]>(v, "timeline", isArray)); }
  notes(id: string) { return this.sdk.read("/v1/patients/" + id + "/notes").then(v => field<PatientNote[]>(v, "notes", isArray)); }
  prescriptions(id: string) { return this.sdk.read("/v1/patients/" + id + "/prescriptions").then(v => field<PatientPrescription[]>(v, "prescriptions", isArray)); }
  followUps(id: string) { return this.sdk.read("/v1/patients/" + id + "/follow-ups").then(v => field<PatientFollowUp[]>(v, "followUps", isArray)); }
  ledger(id: string, month = "", cursor = "") {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (cursor) params.set("cursor", cursor);
    return this.sdk.read("/v1/patients/" + id + "/ledger" + (params.size ? "?" + params : ""))
      .then(v => field<PatientLedger>(v, "ledger", x => isObject(x) && isObject(x.summary) && Array.isArray(x.entries)));
  }
  media(id: string) { return this.sdk.read("/v1/patients/" + id + "/media").then(v => field<PatientMediaAsset[]>(v, "media", isArray)); }
  withdrawMedia(id: string, reason: string) {
    return this.sdk.command<unknown>("POST", "/v1/patient-media/" + id + "/withdraw", { reason }, isObject);
  }
  odontogram(id: string) { return this.sdk.read("/v1/patients/" + id + "/odontogram"); }
  periodontal(id: string) { return this.sdk.read("/v1/patients/" + id + "/periodontal-chart"); }
  canals(id: string) { return this.sdk.read("/v1/patients/" + id + "/canal-measurements"); }
  labOrders(id: string) { return this.sdk.read("/v1/patients/" + id + "/lab-orders"); }
  staffReferences() { return this.sdk.read("/v1/clinic/staff-references"); }
  workEntryCase(id: string) { return this.sdk.read<{ case: import("./types").WorkEntryCase }>("/v1/chief-complaints/" + id + "/work-entry").then(v => field<import("./types").WorkEntryCase>(v, "case", isObject)); }
  treatmentProtocols() { return this.sdk.read<{ treatmentProtocols: PatientTreatmentProtocolReference[] }>("/v1/treatment-protocols").then(v => field<PatientTreatmentProtocolReference[]>(v, "treatmentProtocols", isArray)); }
  addWorkEntryProtocol(id: string, input: import("./types").WorkEntryProtocolAddInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols", input, x => isObject(x) && isObject(x.case));
  }
  cancelWorkEntryProtocol(id: string, protocolId: string, input: import("./types").WorkEntryProtocolCancelInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/cancel", input, x => isObject(x) && isObject(x.case));
  }
  addWorkEntryStage(id: string, protocolId: string, input: import("./types").WorkEntryStageAddInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/stages", input, x => isObject(x) && isObject(x.case));
  }
  cancelWorkEntryStage(id: string, protocolId: string, stageId: string, input: import("./types").WorkEntryStageCancelInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/stages/" + stageId + "/cancel", input, x => isObject(x) && isObject(x.case));
  }
  labSuppliers() { return this.sdk.read<{ suppliers: PatientLabSupplier[] }>("/v1/clinic/suppliers?scope=lab").then(v => field<PatientLabSupplier[]>(v, "suppliers", isArray)); }
  assignLabOrder(id: string, input: { supplierId: string; labWorkName: string; toothScope: string | null; shade: string | null; sentOn: string; receptionNote: string | null; expectedRowVersion: number }) {
    return this.sdk.command<{ labOrder: unknown }>("POST", "/v1/lab-orders/" + id + "/assign", input, isReceipt("labOrder"));
  }
  createIntake(input: PatientIntakeInput) {
    return this.sdk.command<{patient: PatientCore}>("POST", "/v1/patient-intakes", input, isReceipt("patient"));
  }
  updateProfile(id: string, input: PatientProfileUpdateInput) {
    return this.sdk.command<{patient: PatientCore}>("PUT", "/v1/patients/" + id + "/profile", input, isReceipt("patient"));
  }
  createCase(id: string, chiefComplaint: string, openedOn: string) {
    return this.sdk.command<{case: unknown}>("POST", "/v1/patients/" + id + "/cases", {chiefComplaint, openedOn}, isReceipt("case"));
  }
  createNote(input: PatientNoteCreateInput) { return this.sdk.command<{note: PatientNote}>("POST", "/v1/patient-notes", input, isReceipt("note")); }
  withdrawNote(id: string, reason: string) { return this.sdk.command<{note: PatientNote}>("POST", "/v1/patient-notes/" + id + "/withdraw", {reason}, isReceipt("note")); }
  createPrescription(input: PrescriptionCreateInput) { return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions", input, isReceipt("prescription")); }
  correctPrescription(id: string, input: PrescriptionCreateInput & {reason: string; expectedRowVersion: number}) {
    return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions/" + id + "/correct", input, isReceipt("prescription"));
  }
  withdrawPrescription(id: string, rowVersion: number, reason: string) {
    return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions/" + id + "/withdraw", {expectedRowVersion: rowVersion, reason}, isReceipt("prescription"));
  }
  collect(input: PatientPaymentInput) { return this.sdk.command<{payment: PatientPayment}>("POST", "/v1/patients/" + input.patientId + "/payments", input, isReceipt("payment")); }
  correctLedger(id: string, input: {expectedRowVersion: number; amount: number; entryDate: string; reason: string}) {
    return this.sdk.command<{correction: unknown}>("POST", "/v1/patient-ledger/" + id + "/correct", input, isReceipt("correction"));
  }
  reverseLedger(id: string, input: {expectedRowVersion: number; entryDate: string; reason: string}) {
    return this.sdk.command<{reversal: unknown}>("POST", "/v1/patient-ledger/" + id + "/reverse", input, isReceipt("reversal"));
  }
  createFollowUp(input: FollowUpCreateInput) {
    return this.sdk.command<{followUp: PatientFollowUp}>("POST", "/v1/follow-ups", input, isReceipt("followUp"));
  }
  updateCaseStatus(id: string, input: {patientId: string; expectedRowVersion: number; status: "open" | "completed" | "closed"; reason: string | null}) {
    return this.sdk.command<{case: unknown}>("POST", "/v1/chief-complaints/" + id + "/status", input, x => isObject(x));
  }
  saveOdontogram(id: string, input: {recordedOn:string;marks:import("./types").OdontogramMark[];removedMarks:import("./types").OdontogramMark[]}) {
    return this.sdk.command<{marks:import("./types").OdontogramMark[]}>("PUT","/v1/patients/"+id+"/odontogram",input,
      x=>isObject(x)&&Array.isArray(x.marks));
  }
  savePeriodontal(id: string, input: import("./types").PeriodontalChartSaveInput) {
    return this.sdk.command<{chart:import("./types").PatientPeriodontalChart}>("PUT","/v1/patients/"+id+"/periodontal-chart",input,isReceipt("chart"));
  }
  saveCanal(id: string, input: import("./types").CanalMeasurementSaveInput) {
    return this.sdk.command<{session:import("./types").PatientCanalMeasurement}>("POST","/v1/patients/"+id+"/canal-measurements",input,isReceipt("session"));
  }
  createLabRequest(input:{patientId:string;chiefComplaintId:string;labWorkName:string;toothScope:string|null;shade:string|null;clinicalNote:string|null}) {
    return this.sdk.command<{labOrder:unknown}>("POST","/v1/lab-requests",input,isReceipt("labOrder"));
  }
  updateLab(id:string,input:{expectedRowVersion:number;status?:"pending_assignment"|"sent"|"received"|"fitted"|"cancelled";clearAssignment?:boolean;receivedOn?:string|null;fittedOn?:string|null;receptionNote?:string|null}) {
    return this.sdk.command<{labOrder:unknown}>("PATCH","/v1/lab-orders/"+id,input,isReceipt("labOrder"));
  }
  // No SDK route exists for generic binary fetches, signed URLs, or native print/export.
}

type MediaResponse = {status: number; contentType: string; body: Uint8Array};
type MediaReceipt = {transferId: string; received: number; total: number};
export type XrayMetadata = {chiefComplaintId: string | null; xrayType: PatientXrayType; toothCode: string | null; clinicalNote: string | null; capturedOn: string; displayFilename: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; byteSize: number};
export class PatientMediaSdk {
  private connection?: Promise<Connection>;
  constructor(private readonly bridge: AppSdk) {}
  private connect() { this.connection ??= this.bridge.connect({major:1, minor:4}).then(x => {
    if (!x.ok) throw new ClinicError(x.error.code, x.error.message, x.error.outcome);
    if (!x.value.capabilities.includes("clinic.media.read") && !x.value.capabilities.includes("clinic.media.upload")) throw new ClinicError("FORBIDDEN","Private image permissions are unavailable.");
    return x.value;
  }); return this.connection; }
  private async request<T>(op: "clinic.media.read" | "clinic.media.upload", input: Record<string, unknown>): Promise<T> {
    const c = await this.connect();
    if (!c.capabilities.includes(op)) throw new ClinicError("FORBIDDEN", "This signed release does not have " + op + " permission.");
    const response = await this.bridge.request({version:1,connection:c.connection,generation:c.generation,requestId:crypto.randomUUID(),operation:op,input});
    if (!response.ok) throw new ClinicError(response.error.code,response.error.message,response.error.outcome,response.error.operationId);
    return response.value as T;
  }
  async view(patientId: string, assetId: string): Promise<string> {
    const result = await this.request<MediaResponse>("clinic.media.read",{kind:"patient_media",recordId:patientId,assetId});
    if (result.status !== 200 || !["image/jpeg","image/png","image/webp"].includes(result.contentType) || !(result.body instanceof Uint8Array))
      throw new ClinicError("INVALID_RESPONSE","The private image could not be verified.");
    const bytes = new Uint8Array(result.body);
    return URL.createObjectURL(new Blob([bytes],{type:result.contentType}));
  }
  async begin(patientId: string, file: File, metadata: Omit<XrayMetadata,"displayFilename"|"mimeType"|"byteSize">, replacement?: {assetId:string;reason:string}): Promise<MediaPending> {
    if (file.size < 1 || file.size > 10 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(file.type) || !dateValid(metadata.capturedOn))
      throw new ClinicError("VALIDATION","Choose a JPEG, PNG or WebP up to 10 MiB and a valid capture date.");
    const key = crypto.randomUUID();
    const fields = {displayFilename:file.name.slice(0,200),mimeType:file.type,byteSize:file.size,...metadata};
    const input: Record<string,unknown> = {action:"begin",kind:"patient_media",recordId:patientId,metadata:fields,idempotencyKey:key};
    if (replacement) input.replacement = replacement;
    const receipt = await this.request<MediaReceipt>("clinic.media.upload",input);
    if (!receipt.transferId || receipt.total !== file.size) throw new ClinicError("INVALID_RESPONSE","The image transfer receipt is invalid.");
    return {transferId:receipt.transferId,key,file,offset:0,total:file.size,patientId};
  }
  async transfer(pending: MediaPending, onProgress?: (sent:number)=>void): Promise<{committed:boolean;assetId:string}> {
    const bytes = new Uint8Array(await pending.file.arrayBuffer());
    if (bytes.length !== pending.total) throw new ClinicError("VALIDATION","The selected file changed. Re-select the same file.");
    for (let i = pending.offset; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
      const data = btoa(Array.from(chunk, x => String.fromCharCode(x)).join(""));
      const receipt = await this.request<MediaReceipt>("clinic.media.upload",{action:"chunk",transferId:pending.transferId,offset:i,data});
      if (receipt.received !== i + chunk.length) throw new ClinicError("UNKNOWN_OUTCOME","The image transfer state is uncertain.","unknown");
      pending.offset = receipt.received;
      onProgress?.(receipt.received);
    }
    return this.commit(pending);
  }
  commit(pending: MediaPending) { return this.request<{committed:boolean;assetId:string}>("clinic.media.upload",{action:"commit",transferId:pending.transferId,idempotencyKey:pending.key}); }
  cancel(pending: MediaPending) { return this.request<{cancelled:boolean;committed:boolean;assetId?:string}>("clinic.media.upload",{action:"cancel",transferId:pending.transferId,idempotencyKey:pending.key}); }
}
export type MediaPending = {transferId:string;key:string;file:File;offset:number;total:number;patientId:string};
export type WriteCommand<T> = ClinicCommand<T>;
export function readable(cause: unknown): string { return cause instanceof Error ? cause.message : "Patient Record could not complete this request."; }
export function isUnknown(cause: unknown) { return cause instanceof ClinicError && (cause.outcome === "unknown" || cause.code === "UNKNOWN_OUTCOME" || cause.code === "TIMEOUT"); }
