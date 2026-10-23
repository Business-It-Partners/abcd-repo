import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FileText, FolderLock, Pencil, Stethoscope, Upload, UsersRound, WalletCards,
} from "lucide-react";
import { ClinicDataTable } from "@/shared/ui/ClinicDataTable";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import {
  Field, FieldPair, Input, ModalBody, ModalError, Select,
  Page, PageHeader, RowActions, StatTile, Tabs, TileGrid,
} from "@/shared/ui/workspace-primitives";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import MonthPicker from "@/shared/dates/MonthPicker";
import { bsMonthToADRange, formatBSMonthYear, formatBSShort } from "@/shared/dates/nepaliDate";
import type { ClinicClient, ClinicCommand } from "../../../../../../../packages/app-sdk/src/clinicClient";
import { ClinicError } from "../../../../../../../packages/app-sdk/src/clinicClient";
import { executeStaffCommand } from "../../../sdk/commands";
import { StaffApi } from "../api";
import {
  type ClinicSalaryPayout, type StaffClinicalWorkRow, type StaffDocument,
  type StaffProfile, type StaffType, type StaffWriteInput,
} from "../types";
import type { PendingStaffDocumentUpload, StaffDocumentMediaSdk } from "../documentMedia";

type Tab = "profile" | "work" | "salary" | "documents";
type Draft = {
  fullName: string;
  staffType: StaffType;
  jobTitle: string;
  phone: string;
  email: string;
  joinedOn: string;
  baseSalaryAmount: string;
  status: "active" | "inactive";
};
type LifecycleState = { dirty: boolean; modal: boolean };
type Preview = { url: string; mimeType: string; filename: string };
const allowedDocumentTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const salaryTypeLabels = { advance: "Advance", salary: "Salary", adjustment: "Adjustment", other: "Other" } as const;
const salaryMethodLabels = { cash: "Cash", bank_transfer: "Bank transfer", other: "Other" } as const;

const asDraft = (staff: StaffProfile): Draft => ({
  fullName: staff.fullName,
  staffType: staff.staffType,
  jobTitle: staff.jobTitle ?? "",
  phone: staff.phone ?? "",
  email: staff.email ?? "",
  joinedOn: staff.joinedOn,
  baseSalaryAmount: staff.baseSalaryAmount?.toString() ?? "",
  status: staff.status,
});
const asInput = (draft: Draft): StaffWriteInput => ({
  fullName: draft.fullName.trim(),
  staffType: draft.staffType,
  jobTitle: draft.jobTitle.trim() || null,
  phone: draft.phone.trim() || null,
  email: draft.email.trim() || null,
  joinedOn: draft.joinedOn,
  baseSalaryAmount: draft.baseSalaryAmount === "" ? null : Number(draft.baseSalaryAmount),
  status: draft.status,
});
const formatNpr = (amount: number | null) => "Rs " + new Intl.NumberFormat("en-NP").format(amount ?? 0);
const labelForType = (type: StaffType) =>
  type === "doctor" ? "Clinician" : type === "receptionist" ? "Reception" : type === "helper" ? "Support staff" : "Other staff";
const isDraftDirty = (draft: Draft, profile: StaffProfile) =>
  JSON.stringify(asInput(draft)) !== JSON.stringify({
    fullName: profile.fullName,
    staffType: profile.staffType,
    jobTitle: profile.jobTitle,
    phone: profile.phone,
    email: profile.email,
    joinedOn: profile.joinedOn,
    baseSalaryAmount: profile.baseSalaryAmount,
    status: profile.status,
  });

function friendly(cause: unknown, fallback: string) {
  if (cause instanceof ClinicError) return cause.message;
  return cause instanceof Error ? cause.message : fallback;
}

function formatPayPeriod(value: string) {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  return match ? formatBSMonthYear(Number(match[1]), Number(match[2])) : value;
}

export function StaffDetailPage({
  staff,
  api,
  client,
  clinicCapabilities,
  mediaCapabilities,
  media,
  onBack,
  onUpdated,
  onLifecycle,
}: {
  staff: StaffProfile;
  api: StaffApi;
  client: ClinicClient;
  clinicCapabilities: string[];
  mediaCapabilities: string[];
  media: StaffDocumentMediaSdk;
  onBack: () => void;
  onUpdated: (staff: StaffProfile) => void;
  onLifecycle: (state: LifecycleState) => void;
}) {
  const { showSuccess } = useClinicSnackbar();
  const [profile, setProfile] = useState(staff);
  const [draft, setDraft] = useState<Draft>(() => asDraft(staff));
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState<ClinicCommand<{ staff: StaffProfile }> | null>(null);
  const [latestAfterConflict, setLatestAfterConflict] = useState<StaffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [clinicalWork, setClinicalWork] = useState<StaffClinicalWorkRow[]>([]);
  const [clinicalWorkLoading, setClinicalWorkLoading] = useState(false);
  const [clinicalWorkMonth, setClinicalWorkMonth] = useState("all");
  const [salaryPayouts, setSalaryPayouts] = useState<ClinicSalaryPayout[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState("all");
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingStaffDocumentUpload | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [withdrawTarget, setWithdrawTarget] = useState<StaffDocument | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState<ClinicCommand<null> | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [queuedNavigation, setQueuedNavigation] = useState<Tab | "back" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const canManageStaff = clinicCapabilities.includes("staff.manage");
  const canReadDocuments = mediaCapabilities.includes("clinic.media.read");
  const canUploadDocuments = mediaCapabilities.includes("clinic.media.upload");
  const canReadSalary = clinicCapabilities.includes("finance.manage");
  const changedDraft = isDraftDirty(draft, profile);
  const activeDocuments = useMemo(() => documents.filter((item) => item.status === "active"), [documents]);

  useEffect(() => {
    setProfile(staff);
    setDraft(asDraft(staff));
    setEditing(false);
    setPendingSave(null);
    setLatestAfterConflict(null);
    setActiveTab("profile");
    setClinicalWork([]);
    setClinicalWorkMonth("all");
    setSalaryPayouts([]);
    setSalaryMonth("all");
    setDocuments([]);
    setError(null);
  }, [staff]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    onLifecycle({
      dirty: (editing && changedDraft) || saving || !!pendingSave || uploadBusy || !!pendingUpload || withdrawing || !!pendingWithdraw,
      modal: !!withdrawTarget || !!preview || confirmDiscard,
    });
  }, [
    changedDraft, confirmDiscard, editing, onLifecycle, pendingSave, pendingUpload,
    pendingWithdraw, preview, saving, uploadBusy, withdrawing, withdrawTarget,
  ]);

  const loadProfile = useCallback(async () => {
    if (editing && changedDraft) throw new Error("Save or cancel your profile changes before refreshing.");
    setLoadingProfile(true);
    try {
      const latest = await api.getStaff(profile.staffId);
      setProfile(latest);
      setDraft(asDraft(latest));
      onUpdated(latest);
    } finally {
      setLoadingProfile(false);
    }
  }, [api, changedDraft, editing, onUpdated, profile.staffId]);

  const loadClinicalWork = useCallback(async () => {
    if (profile.staffType !== "doctor") {
      setClinicalWork([]);
      return;
    }
    const parts = clinicalWorkMonth === "all" ? null : clinicalWorkMonth.split("-").map(Number);
    const range = parts ? bsMonthToADRange(parts[0], parts[1]) : null;
    if (parts && !range) throw new Error("Choose a valid report month.");
    setClinicalWorkLoading(true);
    setError(null);
    try {
      setClinicalWork(await api.listClinicalWork(profile.staffId, range ?? undefined));
    } catch (cause) {
      setError(friendly(cause, "Clinical work could not be loaded."));
      throw cause;
    } finally {
      setClinicalWorkLoading(false);
    }
  }, [api, clinicalWorkMonth, profile.staffId, profile.staffType]);

  const loadSalary = useCallback(async () => {
    if (!canReadSalary) {
      setSalaryPayouts([]);
      return;
    }
    setSalaryLoading(true);
    setError(null);
    try {
      const payouts = await api.listSalaryPayouts();
      setSalaryPayouts(payouts.filter((payout) => payout.staffId === profile.staffId));
    } catch (cause) {
      setError(friendly(cause, "Salary information could not be loaded."));
      throw cause;
    } finally {
      setSalaryLoading(false);
    }
  }, [api, canReadSalary, profile.staffId]);

  const loadDocuments = useCallback(async () => {
    if (!canManageStaff) {
      setDocuments([]);
      return;
    }
    setDocumentsLoading(true);
    setError(null);
    try {
      setDocuments(await api.listDocuments(profile.staffId));
    } catch (cause) {
      setError(friendly(cause, "Private documents could not be loaded."));
      throw cause;
    } finally {
      setDocumentsLoading(false);
    }
  }, [api, canManageStaff, profile.staffId]);

  useEffect(() => {
    if (activeTab !== "work" || profile.staffType !== "doctor") return;
    void loadClinicalWork().catch(() => {});
  }, [activeTab, loadClinicalWork, profile.staffType]);
  useEffect(() => {
    if (activeTab !== "salary" || !canReadSalary) return;
    void loadSalary().catch(() => {});
  }, [activeTab, canReadSalary, loadSalary]);
  useEffect(() => {
    if (activeTab !== "documents" || !canManageStaff) return;
    void loadDocuments().catch(() => {});
  }, [activeTab, canManageStaff, loadDocuments]);

  const refresh = useCallback(async () => {
    if (activeTab === "profile") return loadProfile();
    if (activeTab === "work") return loadClinicalWork();
    if (activeTab === "salary") return loadSalary();
    return loadDocuments();
  }, [activeTab, loadClinicalWork, loadDocuments, loadProfile, loadSalary]);
  useClinicPageRefresh(useMemo(() => ({
    key: "staff-profile-" + profile.staffId + "-" + activeTab,
    label: "Staff",
    refresh,
    successMessage: "Staff information is up to date.",
    busy: loadingProfile || clinicalWorkLoading || salaryLoading || documentsLoading,
    placement: "page-action" as const,
  }), [activeTab, clinicalWorkLoading, documentsLoading, loadingProfile, profile.staffId, refresh, salaryLoading]));
  useClinicPageLoading("Staff", loadingProfile, {
    title: "Opening staff profile…",
    message: "Loading employment details.",
  });

  const requestNavigation = (target: Tab | "back") => {
    if (pendingSave || saving || pendingWithdraw || withdrawing || pendingUpload || uploadBusy) return;
    if (editing && changedDraft) {
      setQueuedNavigation(target);
      setConfirmDiscard(true);
      return;
    }
    if (editing) {
      setEditing(false);
      setDraft(asDraft(profile));
    }
    if (target === "back") onBack();
    else setActiveTab(target);
  };

  const discardAndContinue = () => {
    const target = queuedNavigation;
    setConfirmDiscard(false);
    setQueuedNavigation(null);
    setEditing(false);
    setDraft(asDraft(profile));
    setError(null);
    setLatestAfterConflict(null);
    if (target === "back") onBack();
    else if (target) setActiveTab(target);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || pendingSave) return;
    const command = api.updateStaff(profile.staffId, { ...asInput(draft), expectedRowVersion: profile.rowVersion });
    await executeSave(command);
  };

  const executeSave = async (command: ClinicCommand<{ staff: StaffProfile }>) => {
    setSaving(true);
    setError(null);
    setLatestAfterConflict(null);
    try {
      const result = await executeStaffCommand(client, command);
      setPendingSave(null);
      setProfile(result.staff);
      setDraft(asDraft(result.staff));
      setEditing(false);
      onUpdated(result.staff);
      showSuccess("Staff profile updated.");
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setPendingSave(command);
        setError("The save outcome is uncertain. Retry the original save to confirm it.");
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        setPendingSave(null);
        setError("This profile changed elsewhere. Your edits are still here. Load the latest profile before trying again.");
        try {
          setLatestAfterConflict(await api.getStaff(profile.staffId));
        } catch {
          setLatestAfterConflict(null);
        }
      } else {
        setPendingSave(null);
        setError(friendly(cause, "The staff profile could not be saved."));
      }
    } finally {
      setSaving(false);
    }
  };

  const useLatestProfile = () => {
    if (!latestAfterConflict) return;
    setProfile(latestAfterConflict);
    setDraft(asDraft(latestAfterConflict));
    onUpdated(latestAfterConflict);
    setLatestAfterConflict(null);
    setEditing(false);
    setError(null);
  };

  const updateDraft = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const uploadDocument = async (file: File | undefined) => {
    if (!file || uploadBusy) return;
    if (!canUploadDocuments) {
      setError("Private document upload is unavailable for this Staff release. An exact clinic.media.upload grant is required.");
      return;
    }
    if (!allowedDocumentTypes.includes(file.type) || file.size < 1 || file.size > 25 * 1024 * 1024) {
      setError("Choose a PDF, PNG, JPG, or WebP file up to 25 MB.");
      return;
    }
    setError(null);
    setUploadBusy(true);
    setUploadProgress(pendingUpload?.offset ?? 0);
    let pending = pendingUpload;
    try {
      if (!pending) {
        pending = await media.begin(profile.staffId, file);
        setPendingUpload(pending);
      }
      await media.transfer(pending, (sent) => setUploadProgress(sent));
      setPendingUpload(null);
      pending = null;
      setUploadProgress(file.size);
      showSuccess("Staff document uploaded.");
      await loadDocuments().catch(() => {});
    } catch (cause) {
      if (pending && !pending.commitStarted && !(cause instanceof ClinicError && cause.outcome === "unknown")) {
        try {
          const receipt = await media.cancel(pending);
          if (receipt.committed) {
            setPendingUpload(null);
            showSuccess("Staff document uploaded.");
            await loadDocuments().catch(() => {});
            return;
          } else {
            setPendingUpload(null);
          }
        } catch {
          setPendingUpload(pending);
        }
      } else if (pending) {
        setPendingUpload(pending);
      }
      setError(friendly(cause, "The private document could not be uploaded."));
    } finally {
      setUploadBusy(false);
    }
  };

  const retryUpload = async () => {
    if (!pendingUpload || uploadBusy) return;
    setUploadBusy(true);
    setError(null);
    try {
      await media.transfer(pendingUpload, (sent) => setUploadProgress(sent));
      setPendingUpload(null);
      setUploadProgress(pendingUpload.total);
      showSuccess("Staff document uploaded.");
      await loadDocuments().catch(() => {});
    } catch (cause) {
      setError(friendly(cause, "The original document transfer remains unresolved."));
    } finally {
      setUploadBusy(false);
    }
  };

  const cancelUpload = async () => {
    if (!pendingUpload || uploadBusy) return;
    if (pendingUpload.commitStarted) {
      setError("This upload is awaiting confirmation. Retry the original transfer to check whether it finished.");
      return;
    }
    setUploadBusy(true);
    setError(null);
    try {
      const result = await media.cancel(pendingUpload);
      setPendingUpload(null);
      if (result.committed) {
        showSuccess("Staff document uploaded.");
        await loadDocuments().catch(() => {});
      } else {
        showSuccess("Document transfer cancelled.");
      }
    } catch (cause) {
      setError(friendly(cause, "The document transfer could not be cancelled."));
    } finally {
      setUploadBusy(false);
    }
  };

  const openDocument = async (document: StaffDocument) => {
    if (!canReadDocuments) {
      setError("Private document viewing is unavailable for this Staff release. An exact clinic.media.read grant is required.");
      return;
    }
    if (document.status !== "active") return;
    setError(null);
    try {
      const content = await media.read(profile.staffId, document.staffDocumentId);
      const blobBytes = new ArrayBuffer(content.bytes.byteLength);
      new Uint8Array(blobBytes).set(content.bytes);
      const url = URL.createObjectURL(new Blob([blobBytes], { type: content.mimeType }));
      setPreview({ url, mimeType: content.mimeType, filename: document.displayFilename });
    } catch (cause) {
      setError(friendly(cause, "The private document could not be opened."));
    }
  };

  const beginWithdraw = (document: StaffDocument) => {
    setWithdrawTarget(document);
    setWithdrawReason("");
    setPendingWithdraw(null);
    setError(null);
  };

  const withdrawDocument = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!withdrawTarget || !withdrawReason.trim() || withdrawing) return;
    const command = pendingWithdraw ?? api.withdrawDocument(
      profile.staffId, withdrawTarget.staffDocumentId, withdrawReason.trim(),
    );
    setWithdrawing(true);
    setError(null);
    try {
      await executeStaffCommand(client, command);
      setPendingWithdraw(null);
      setWithdrawTarget(null);
      setWithdrawReason("");
      showSuccess("Staff document withdrawn.");
      await loadDocuments().catch(() => {});
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") setPendingWithdraw(command);
      else setPendingWithdraw(null);
      setError(friendly(cause, "The staff document could not be withdrawn."));
    } finally {
      setWithdrawing(false);
    }
  };

  const visibleSalaryPayouts = useMemo(
    () => salaryPayouts.filter((payout) => salaryMonth === "all" || payout.payPeriod === salaryMonth),
    [salaryMonth, salaryPayouts],
  );
  const recordedSalaryPayouts = useMemo(
    () => visibleSalaryPayouts.filter((payout) => payout.status === "recorded"),
    [visibleSalaryPayouts],
  );
  const salaryPaidTotal = useMemo(
    () => recordedSalaryPayouts.reduce((sum, payout) => sum + payout.amount, 0),
    [recordedSalaryPayouts],
  );
  const salaryBonusTotal = useMemo(
    () => recordedSalaryPayouts.reduce((sum, payout) => sum + payout.bonusAmount, 0),
    [recordedSalaryPayouts],
  );
  const clinicalWorkTotal = useMemo(
    () => clinicalWork.reduce((sum, row) => sum + row.chargeAmount, 0),
    [clinicalWork],
  );
  const staffSubtitle = [profile.jobTitle || labelForType(profile.staffType), profile.phone, profile.email]
    .filter(Boolean).join(" · ");
  const neutralTone = { tone: "#8b8b9a", toneBg: "#f1f0f5", toneNum: "var(--ink-1)" };
  const statusTone = profile.status === "active"
    ? { tone: "var(--ok)", toneBg: "#eaf7f0", toneNum: "var(--ok)" }
    : { tone: "var(--warn)", toneBg: "#fff7ed", toneNum: "var(--warn)" };
  const tabs = [
    { key: "profile", label: "Staff info" },
    { key: "work", label: "Work done", icon: <Stethoscope aria-hidden="true" size={14} /> },
    ...(canReadSalary ? [{ key: "salary", label: "Salary info", icon: <WalletCards aria-hidden="true" size={14} /> }] : []),
    ...(canManageStaff ? [{ key: "documents", label: "Private documents (" + activeDocuments.length + ")" }] : []),
  ];

  return (
    <Page sheet>
      <PageHeader
        back={{ label: "Staff list", onClick: () => requestNavigation("back") }}
        icon={<UsersRound aria-hidden="true" size={17} className="staffHeaderIcon" />}
        subtitle={staffSubtitle}
        title={profile.fullName}
      >
        {!editing && canManageStaff ? (
          <button className="staffPrimary staffEditButton" onClick={() => { setError(null); setEditing(true); }} type="button">
            <Pencil aria-hidden="true" size={15} /> Edit profile
          </button>
        ) : null}
      </PageHeader>
      <Tabs
        active={activeTab}
        onChange={(tab) => requestNavigation(tab as Tab)}
        tabs={tabs}
      />
      {error ? <p className="staffError" role="alert">{error}</p> : null}
      {activeTab === "profile" && !editing ? (
        <TileGrid>
          <StatTile label="Staff type" tone={neutralTone} value={labelForType(profile.staffType)} />
          <StatTile label="Joined date" tone={neutralTone} value={formatBSShort(profile.joinedOn)} />
          <StatTile label="Base salary" tone={neutralTone} value={formatNpr(profile.baseSalaryAmount)} />
          <StatTile label="Status" tone={statusTone} value={profile.status === "active" ? "Active" : "Inactive"} />
        </TileGrid>
      ) : null}

      {activeTab === "profile" && editing ? (
        <form className="staffEditForm" onSubmit={(event) => void save(event)}>
          {latestAfterConflict ? (
            <div className="staffConflict" role="alert">
              <div>
                <strong>Latest server version: {latestAfterConflict.rowVersion}</strong>
                <span>Your draft remains unchanged. Reloading replaces it with the latest profile.</span>
              </div>
              <button className="staffSecondary" onClick={useLatestProfile} type="button">Load latest profile</button>
            </div>
          ) : null}
          <fieldset className="staffEditFields" disabled={saving || !!pendingSave}>
            <Field label="Full name" required htmlFor="staff-edit-name">
              <Input id="staff-edit-name" required maxLength={160} onChange={(event) => updateDraft({ fullName: event.target.value })} value={draft.fullName} />
            </Field>
            <Field label="Staff type" required htmlFor="staff-edit-type">
              <Select id="staff-edit-type" onChange={(event) => updateDraft({ staffType: event.target.value as StaffType })} value={draft.staffType}>
                <option value="doctor">Doctor (Clinician)</option>
                <option value="helper">Support staff</option>
                <option value="receptionist">Reception</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Role designation" htmlFor="staff-edit-title">
              <Input id="staff-edit-title" maxLength={120} placeholder="e.g. Orthodontist, Lead Receptionist" onChange={(event) => updateDraft({ jobTitle: event.target.value })} value={draft.jobTitle} />
            </Field>
            <Field label="Monthly base salary (NPR)" htmlFor="staff-edit-salary">
              <Input id="staff-edit-salary" min="0" step="1" type="number" onChange={(event) => updateDraft({ baseSalaryAmount: event.target.value })} value={draft.baseSalaryAmount} />
            </Field>
            <Field label="Joined date" required>
              <DatePicker fluid onChange={(joinedOn) => updateDraft({ joinedOn })} value={draft.joinedOn} />
            </Field>
            <Field label="Phone" htmlFor="staff-edit-phone">
              <Input id="staff-edit-phone" maxLength={40} placeholder="+977 …" onChange={(event) => updateDraft({ phone: event.target.value })} value={draft.phone} />
            </Field>
            <Field label="Email (optional)" htmlFor="staff-edit-email">
              <Input id="staff-edit-email" maxLength={254} type="email" onChange={(event) => updateDraft({ email: event.target.value })} value={draft.email} />
            </Field>
            <Field label="Status" required htmlFor="staff-edit-status">
              <Select id="staff-edit-status" onChange={(event) => updateDraft({ status: event.target.value as Draft["status"] })} value={draft.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </fieldset>
          <div className="staffFormActions">
            <button
              className="staffSecondary"
              disabled={saving || !!pendingSave}
              onClick={() => { setDraft(asDraft(profile)); setEditing(false); setError(null); setLatestAfterConflict(null); }}
              type="button"
            >Cancel</button>
            {pendingSave ? (
              <button className="staffPrimary" disabled={saving} onClick={() => void executeSave(pendingSave)} type="button">
                {saving ? "Checking save…" : "Retry original save"}
              </button>
            ) : (
              <button className="staffPrimary" disabled={saving || !changedDraft} type="submit">
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </form>
      ) : null}

      {activeTab === "work" ? profile.staffType !== "doctor" ? (
        <section className="staffNoClinicalWork">
          <span><Stethoscope aria-hidden="true" size={20} /></span>
          <div>
            <h2>Clinical work is recorded for doctors only.</h2>
            <p>This staff member’s operational activity is not part of treatment-stage reporting.</p>
          </div>
        </section>
      ) : (
        <section className="staffWorkReport" aria-label={"Completed clinical work for " + profile.fullName}>
          <ClinicDataTable<StaffClinicalWorkRow>
            rows={clinicalWork}
            rowKey={(work) => work.stageId}
            noun="completed stages"
            minWidth={1120}
            loading={clinicalWorkLoading}
            loadingLabel="Loading completed clinical work…"
            title={<div className="staffWorkTableTitle">
              <span className="staffWorkTableIcon"><Stethoscope aria-hidden="true" size={17} /></span>
              <div><h3>Completed treatment stages</h3><p>Clinical work attributed to this doctor.</p></div>
            </div>}
            filters={<div className="staffWorkFilters">
              <MonthPicker allowAll allLabel="All months" value={clinicalWorkMonth} onChange={setClinicalWorkMonth} />
              <span className="staffCountTile"><strong>{clinicalWork.length}</strong><small>Completed stages</small></span>
              <span className="staffWorkTotal"><strong>{formatNpr(clinicalWorkTotal)}</strong><small>Total clinical work value</small></span>
              <small className="staffWorkHint">Clinical work value is not salary or commission.</small>
            </div>}
            empty={<p className="staffEmptyTable">No completed treatment stages are attributed to this doctor for the selected month.</p>}
            columns={[
              { key: "completedOn", header: "Date", width: "10%", sortable: true, value: (work) => work.completedOn, render: (work) => <span className="staffWorkDate">{formatBSShort(work.completedOn)}</span>, nowrap: true },
              { key: "patient", header: "Patient", width: "16%", sortable: true, value: (work) => work.patientName, render: (work) => <span className="staffPatientCell"><strong>{work.patientName}</strong><small>{work.patientNumber}</small></span> },
              { key: "complaint", header: "Chief complaint / case", width: "18%", sortable: true, value: (work) => work.chiefComplaint, render: (work) => <span className="staffCaseCell">{work.chiefComplaint}</span> },
              { key: "protocol", header: "Treatment protocol", width: "15%", sortable: true, value: (work) => work.protocolName, render: (work) => <span className="staffProtocolCell">{work.protocolName}</span> },
              { key: "stage", header: "Completed stage", width: "16%", sortable: true, value: (work) => work.stageName, render: (work) => <span className="staffStageBadge">{work.stageName}</span> },
              { key: "tooth", header: "Tooth", width: "8%", value: (work) => work.toothScope, render: (work) => work.toothScope ? <span className="staffToothBadge">{work.toothScope}</span> : "—", nowrap: true },
              { key: "chargeAmount", header: "Stage value", width: "10%", align: "right", sortable: true, value: (work) => work.chargeAmount, render: (work) => <strong className="staffWorkValue">{formatNpr(work.chargeAmount)}</strong>, nowrap: true },
              { key: "supportingDoctors", header: "Supporting doctor(s)", width: "16%", value: (work) => work.supportingDoctors.join(" "), render: (work) => work.supportingDoctors.length ? <span className="staffSupportingDoctors">{work.supportingDoctors.join(" · ")}</span> : <span className="staffMutedValue">None</span> },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "salary" && canReadSalary ? (
        <section className="staffSalaryReport" aria-label={"Salary information for " + profile.fullName}>
          <div className="staffSalarySummary">
            <article><span>Monthly base salary</span><strong>{formatNpr(profile.baseSalaryAmount)}</strong><small>Current staff profile value</small></article>
            <article><span>Paid in selection</span><strong>{formatNpr(salaryPaidTotal)}</strong><small>{recordedSalaryPayouts.length} recorded payment{recordedSalaryPayouts.length === 1 ? "" : "s"}</small></article>
            <article><span>Bonus / adjustment</span><strong>{formatNpr(salaryBonusTotal)}</strong><small>Included in recorded totals</small></article>
          </div>
          <ClinicDataTable<ClinicSalaryPayout>
            rows={visibleSalaryPayouts}
            rowKey={(payout) => payout.salaryPayoutId}
            noun="salary payments"
            minWidth={1050}
            loading={salaryLoading}
            loadingLabel="Loading salary information…"
            title={<div className="staffWorkTableTitle">
              <span className="staffSalaryTableIcon"><WalletCards aria-hidden="true" size={17} /></span>
              <div><h3>Salary payment history</h3><p>Recorded payroll entries for this staff member.</p></div>
            </div>}
            filters={<div className="staffSalaryFilters">
              <MonthPicker allowAll allLabel="All salary months" value={salaryMonth} onChange={setSalaryMonth} />
              <small>Voided entries remain visible for audit history.</small>
            </div>}
            empty={<p className="staffEmptyTable">No salary payments have been recorded for this staff member in the selected month.</p>}
            columns={[
              { key: "payPeriod", header: "Salary month", width: "15%", sortable: true, value: (payout) => payout.payPeriod, render: (payout) => <strong className="staffSalaryPeriod">{formatPayPeriod(payout.payPeriod)}</strong> },
              { key: "paidOn", header: "Paid on", width: "11%", sortable: true, value: (payout) => payout.paidOn, render: (payout) => formatBSShort(payout.paidOn), nowrap: true },
              { key: "payoutType", header: "Type", width: "10%", sortable: true, value: (payout) => payout.payoutType, render: (payout) => <span className="staffSalaryType">{salaryTypeLabels[payout.payoutType]}</span> },
              { key: "baseAmount", header: "Base", width: "10%", align: "right", sortable: true, value: (payout) => payout.baseAmount, render: (payout) => formatNpr(payout.baseAmount), nowrap: true },
              { key: "bonusAmount", header: "Bonus / adjustment", width: "13%", align: "right", sortable: true, value: (payout) => payout.bonusAmount, render: (payout) => formatNpr(payout.bonusAmount), nowrap: true },
              { key: "amount", header: "Total paid", width: "11%", align: "right", sortable: true, value: (payout) => payout.amount, render: (payout) => <strong className="staffWorkValue">{formatNpr(payout.amount)}</strong>, nowrap: true },
              { key: "paymentMethod", header: "Method", width: "11%", sortable: true, value: (payout) => payout.paymentMethod, render: (payout) => salaryMethodLabels[payout.paymentMethod] },
              { key: "status", header: "Status", width: "9%", sortable: true, value: (payout) => payout.status, render: (payout) => <span className={"staffSalaryStatus " + (payout.status === "voided" ? "voided" : "")}>{payout.status === "recorded" ? "Recorded" : "Voided"}</span> },
              { key: "details", header: "Reference / note", width: "18%", value: (payout) => [payout.paymentReference, payout.note, payout.voidReason].filter(Boolean).join(" "), render: (payout) => <span className="staffSalaryDetails">{payout.paymentReference || payout.note || payout.voidReason || "—"}</span> },
            ]}
          />
        </section>
      ) : null}

      {activeTab === "documents" && canManageStaff ? (
        <section className="staffDocuments">
          <header className="staffDocumentHeader">
            <div>
              <span className="staffDocumentKicker"><FolderLock aria-hidden="true" size={15} /> Private files</span>
              <h2>Private documents</h2>
              <p>PDF or image (PNG, JPG, WebP), up to 25 MB. These files remain private to this clinic and are not visible in the staff directory.</p>
            </div>
            <div className="staffUploadControls">
              <label className={"staffUploadButton " + (!canUploadDocuments || uploadBusy || !!pendingUpload ? "disabled" : "")}>
                <Upload aria-hidden="true" size={15} /> {uploadBusy ? "Uploading…" : "Upload document"}
                <input
                  accept={allowedDocumentTypes.join(",")}
                  disabled={!canUploadDocuments || uploadBusy || !!pendingUpload}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    void uploadDocument(file);
                  }}
                  type="file"
                />
              </label>
            </div>
          </header>
          {!canReadDocuments || !canUploadDocuments ? (
            <div className="staffMediaGrantNotice" role="status">
              <strong>Private document access is awaiting this release’s exact media grants.</strong>
              <span>
                {!canReadDocuments ? "Viewing requires clinic.media.read. " : ""}
                {!canUploadDocuments ? "Uploading requires clinic.media.upload." : ""}
              </span>
            </div>
          ) : null}
          {pendingUpload ? (
            <div className="staffPendingUpload" role="status">
              <div>
                <strong>{pendingUpload.file.name}</strong>
                <span>{Math.round((uploadProgress / Math.max(1, pendingUpload.total)) * 100)}% transferred. {pendingUpload.commitStarted ? "Retry the original transfer to confirm whether it finished." : "Retry or cancel this transfer to resolve its outcome."}</span>
              </div>
              <div className="staffPendingActions">
                <button className="staffSecondary" disabled={uploadBusy} onClick={() => void retryUpload()} type="button">
                  {uploadBusy ? "Checking…" : "Retry original transfer"}
                </button>
                <button
                  className="staffSecondary staffWithdrawAction"
                  disabled={uploadBusy || pendingUpload.commitStarted}
                  onClick={() => void cancelUpload()}
                  title={pendingUpload.commitStarted ? "Retry the original transfer to confirm its outcome." : undefined}
                  type="button"
                >
                  Cancel transfer
                </button>
              </div>
            </div>
          ) : null}
          <ClinicDataTable<StaffDocument>
            rows={documents}
            rowKey={(document) => document.staffDocumentId}
            noun="private documents"
            minWidth={680}
            loading={documentsLoading}
            loadingLabel="Loading private documents…"
            title={<div className="staffWorkTableTitle">
              <span className="staffWorkTableIcon"><FileText aria-hidden="true" size={17} /></span>
              <div><h3>Document register</h3><p>Files attached to this staff profile.</p></div>
            </div>}
            action={<span className="staffDocumentCount">{activeDocuments.length} active</span>}
            empty={<p className="staffEmptyTable">No private documents have been added for this staff member.</p>}
            columns={[
              { key: "document", header: "Document", sortable: true, value: (document) => document.displayFilename, render: (document) => <strong>{document.displayFilename}</strong> },
              { key: "status", header: "Status", sortable: true, value: (document) => document.status, render: (document) => document.status },
              { key: "actions", header: "Actions", align: "right", render: (document) => <RowActions>
                <button
                  className="staffSecondary staffDocumentAction"
                  disabled={!canReadDocuments || document.status !== "active"}
                  onClick={() => void openDocument(document)}
                  title={!canReadDocuments ? "This release has no clinic.media.read grant." : undefined}
                  type="button"
                >Open</button>
                {document.status === "active" ? (
                  <button className="staffSecondary staffWithdrawAction" onClick={() => beginWithdraw(document)} type="button">Withdraw</button>
                ) : null}
              </RowActions> },
            ]}
          />
        </section>
      ) : null}

      {withdrawTarget ? (
        <ClinicModal
          closeDisabled={withdrawing || !!pendingWithdraw}
          description="The file will no longer be active, but the original document and withdrawal reason remain in the clinic audit history."
          onClose={() => {
            if (!withdrawing && !pendingWithdraw) {
              setWithdrawTarget(null);
              setWithdrawReason("");
              setError(null);
            }
          }}
          size="small"
          title="Withdraw private document"
        >
          <ModalBody as="form" onSubmit={(event) => void withdrawDocument(event)}>
            <label className="staffWithdrawLabel">
              Reason for withdrawal
              <Input
                autoFocus
                disabled={!!pendingWithdraw || withdrawing}
                maxLength={500}
                onChange={(event) => setWithdrawReason(event.target.value)}
                placeholder="Why is this document being withdrawn?"
                required
                value={withdrawReason}
              />
            </label>
            {error ? <ModalError>{error}</ModalError> : null}
            <div className="staffFormActions">
              <button
                className="staffSecondary"
                disabled={withdrawing || !!pendingWithdraw}
                onClick={() => { setWithdrawTarget(null); setWithdrawReason(""); setError(null); }}
                type="button"
              >Cancel</button>
              {pendingWithdraw ? (
                <button className="staffPrimary" disabled={withdrawing} onClick={() => void withdrawDocument()} type="button">
                  {withdrawing ? "Checking…" : "Retry original withdrawal"}
                </button>
              ) : (
                <button className="staffPrimary staffDanger" disabled={!withdrawReason.trim() || withdrawing} type="submit">
                  {withdrawing ? "Withdrawing…" : "Withdraw document"}
                </button>
              )}
            </div>
          </ModalBody>
        </ClinicModal>
      ) : null}

      {preview ? (
        <ClinicModal
          maxWidth={980}
          onClose={() => setPreview(null)}
          size="large"
          title={preview.filename}
        >
          <div className="staffPreviewActions">
            <a className="staffSecondary" href={preview.url} download={preview.filename}>Download</a>
          </div>
          <div className="staffPreviewBody">
            {preview.mimeType === "application/pdf" ? (
              <iframe title={preview.filename} src={preview.url} />
            ) : (
              <img alt={preview.filename} src={preview.url} />
            )}
          </div>
        </ClinicModal>
      ) : null}

      {confirmDiscard ? (
        <ClinicModal
          description="Your unsaved staff profile edits will be discarded."
          onClose={() => { setConfirmDiscard(false); setQueuedNavigation(null); }}
          size="small"
          title="Discard profile changes?"
        >
          <div className="staffDiscardActions">
            <button className="staffSecondary" onClick={() => { setConfirmDiscard(false); setQueuedNavigation(null); }} type="button">Keep editing</button>
            <button className="staffPrimary staffDanger" onClick={discardAndContinue} type="button">Discard changes</button>
          </div>
        </ClinicModal>
      ) : null}
    </Page>
  );
}
