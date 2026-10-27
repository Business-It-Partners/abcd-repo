import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { ClinicDataTable } from "@/shared/ui/ClinicDataTable";
import { Page, PageHeader } from "@/shared/ui/workspace-primitives";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import { formatBSShort } from "@/shared/dates/nepaliDate";
import type { ClinicClient, ClinicCommand } from "../../../../../../../packages/app-sdk/src/clinicClient";
import { ClinicError } from "../../../../../../../packages/app-sdk/src/clinicClient";
import { executeStaffCommand } from "../../../sdk/commands";
import { StaffApi } from "../api";
import type { StaffProfile, StaffType, StaffWriteInput } from "../types";
import { AddStaffModal } from "./AddStaffModal";
import { StaffDetailPage } from "./StaffDetailPage";
import type { StaffDocumentMediaSdk } from "../documentMedia";

const formatNpr = (amount: number | null) => "Rs " + new Intl.NumberFormat("en-NP").format(amount ?? 0);
const staffTypeLabel = (type: StaffType) =>
  ({ doctor: "Doctor", helper: "Support", receptionist: "Reception", other: "Other" })[type];
const staffGroup = (type: StaffType) => type === "doctor" ? "Clinician" : "Support staff";
const typeOptions: Array<{ value: "all" | StaffType; label: string }> = [
  { value: "all", label: "All staff types" },
  { value: "doctor", label: "Clinicians" },
  { value: "helper", label: "Support staff" },
  { value: "receptionist", label: "Reception" },
  { value: "other", label: "Other" },
];
type LifecycleState = { dirty: boolean; modal: boolean };
type StaffReceipt = { staff: StaffProfile };

function friendly(cause: unknown, fallback: string) {
  if (cause instanceof ClinicError) return cause.message;
  return cause instanceof Error ? cause.message : fallback;
}

export function StaffDirectory({
  client,
  api,
  media,
  clinicCapabilities,
  mediaCapabilities,
  onLifecycle,
  selectedStaffId,
  onOpenStaff,
  onInvalidStaff,
}: {
  client: ClinicClient;
  api: StaffApi;
  media: StaffDocumentMediaSdk;
  clinicCapabilities: string[];
  mediaCapabilities: string[];
  onLifecycle: (state: LifecycleState) => void;
  selectedStaffId: string | null;
  onOpenStaff: (staffId: string) => void;
  onInvalidStaff: () => void;
}) {
  const { showSuccess } = useClinicSnackbar();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | StaffType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<ClinicCommand<StaffReceipt> | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useClinicPageLoading("Staff", loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listStaff();
      setStaff(result);
    } catch (cause) {
      setError(friendly(cause, "The staff directory could not be loaded."));
      throw cause instanceof Error ? cause : new Error("The staff directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load().catch(() => {}); }, [load]);
  useClinicPageRefresh(useMemo(() => ({
    key: "staff-directory",
    label: "Staff",
    refresh: load,
    successMessage: "Staff directory is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [load, loading]));

  const selectedStaff = staff.find((member) => member.staffId === selectedStaffId) ?? null;
  useEffect(() => {
    if (!loading && !error && selectedStaffId && !selectedStaff) onInvalidStaff();
  }, [error, loading, onInvalidStaff, selectedStaff, selectedStaffId]);
  const visibleStaff = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return staff.filter((member) => {
      const matchesType = typeFilter === "all" || member.staffType === typeFilter;
      const searchable = [
        member.fullName, member.jobTitle, member.phone, member.email, staffTypeLabel(member.staffType),
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return matchesType && (!search || searchable.includes(search));
    });
  }, [query, staff, typeFilter]);

  const createWith = useCallback(async (command: ClinicCommand<StaffReceipt>) => {
    setSaving(true);
    setCreateError(null);
    try {
      const receipt = await executeStaffCommand(client, command);
      setStaff((current) => [receipt.staff, ...current.filter((member) => member.staffId !== receipt.staff.staffId)]);
      setPendingCreate(null);
      setShowCreate(false);
      showSuccess("Staff member added.");
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") setPendingCreate(command);
      else setPendingCreate(null);
      setCreateError(friendly(cause, "The staff member could not be added."));
    } finally {
      setSaving(false);
    }
  }, [client, showSuccess]);

  const createStaff = useCallback((input: StaffWriteInput) => createWith(api.createStaff(input)), [api, createWith]);
  const retryCreate = useCallback(async () => {
    if (pendingCreate) await createWith(pendingCreate);
  }, [createWith, pendingCreate]);
  const beginCreate = () => { setCreateError(null); setPendingCreate(null); setShowCreate(true); };
  const selectedType = typeFilter;

  if (selectedStaff) {
    return (
      <StaffDetailPage
        api={api}
        client={client}
        clinicCapabilities={clinicCapabilities}
        media={media}
        mediaCapabilities={mediaCapabilities}
        onLifecycle={onLifecycle}
        onUpdated={(updated) => setStaff((current) =>
          current.map((member) => member.staffId === updated.staffId ? updated : member))}
        staff={selectedStaff}
      />
    );
  }

  const isEmptyDirectory = !loading && !error && staff.length === 0;
  return (
    <Page sheet standardPage>
      <PageHeader title="Your clinic team">
        <button className="staffPrimary staffAddButton" onClick={beginCreate} type="button">
          <Plus aria-hidden="true" size={16} /> Add staff member
        </button>
      </PageHeader>
        {error && staff.length > 0 ? <p className="staffError" role="alert">{error}</p> : null}
          <ClinicDataTable<StaffProfile>
            rows={visibleStaff}
            rowKey={(member) => member.staffId}
            noun="staff members"
            standardPage
            minWidth={1040}
            loading={loading}
            loadingLabel="Loading staff directory…"
            error={!loading && staff.length === 0 ? error : null}
            errorHint="Try refreshing the page or check the clinic connection."
            filters={staff.length > 0 ? (
              <div aria-label="Staff filters" className="staffToolbar">
                <label className="staffSearchField">
                  <Search aria-hidden="true" size={15} />
                  <span className="staffSrOnly">Search staff</span>
                  <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, role, phone, or email…"
                    type="search"
                    value={query}
                  />
                </label>
                <label className="staffTypeFilter">
                  <span className="staffSrOnly">Filter by staff type</span>
                  <select onChange={(event) => setTypeFilter(event.target.value as typeof selectedType)} value={selectedType}>
                    {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            ) : undefined}
            empty={loading || error ? null : isEmptyDirectory ? (
              <p className="staffEmptyTable">No staff members yet.</p>
            ) : (
              <div className="staffNoResults">
                <strong>No staff match these filters.</strong>
                <button className="staffSecondary" onClick={() => { setQuery(""); setTypeFilter("all"); }} type="button">Clear filters</button>
              </div>
            )}
            columns={[
              {
                key: "member", header: "Staff member", width: "28%", sortable: true,
                value: (member) => member.fullName,
                render: (member) => <div className="staffMemberCell">
                  <span className="staffAvatar">{member.fullName.split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase()}</span>
                  <span><strong>{member.fullName}</strong>{member.email || member.phone ? <small>{member.email ?? member.phone}</small> : null}</span>
                </div>,
              },
              {
                key: "role", header: "Role / title", width: "18%", sortable: true,
                value: (member) => member.jobTitle ?? staffTypeLabel(member.staffType),
                render: (member) => member.jobTitle ?? staffTypeLabel(member.staffType),
              },
              {
                key: "type", header: "Staff type", width: "13%",
                render: (member) => <span className={"staffTypeBadge " + (member.staffType === "doctor" ? "clinician" : "support")}>{staffGroup(member.staffType)}</span>,
              },
              {
                key: "joined", header: "Joined date", width: "13%", sortable: true,
                value: (member) => member.joinedOn,
                render: (member) => formatBSShort(member.joinedOn),
              },
              {
                key: "salary", header: "Base salary", width: "13%", align: "right", sortable: true,
                value: (member) => member.baseSalaryAmount ?? 0,
                render: (member) => formatNpr(member.baseSalaryAmount),
              },
              {
                key: "status", header: "Status", width: "9%",
                render: (member) => <span className={"staffStatus " + member.status}>{member.status}</span>,
              },
              {
                key: "actions", header: "", width: "6%", align: "right",
                render: (member) => <button className="staffDetailButton" onClick={() => onOpenStaff(member.staffId)} type="button">
                  View <ArrowRight aria-hidden="true" size={14} />
                </button>,
              },
            ]}
          />
      {showCreate ? (
        <AddStaffModal
          busy={saving}
          pending={!!pendingCreate}
          error={createError}
          onClose={() => { setShowCreate(false); setCreateError(null); }}
          onCreate={createStaff}
          onRetry={retryCreate}
          onLifecycle={onLifecycle}
        />
      ) : null}
    </Page>
  );
}
