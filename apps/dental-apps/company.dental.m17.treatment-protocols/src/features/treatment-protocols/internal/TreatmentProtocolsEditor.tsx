"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import type { TreatmentProtocol, TreatmentProtocolInput } from "@/shell/session/types";
import { Card, CardBody, CardHeader, DataTable, Field, InlineCheck, Input, Modal, ModalBody, ModalError, Page, PageHeader, SearchBox, Table, TableWrap, Td, Th, Tr } from "@/shared/ui/workspace-primitives";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";
import type { AppHistory } from "../../../../../../../packages/app-sdk/src/appHistory";

type DraftStage = { key: number; protocolStageId?: string; stageName: string; price: string; active: boolean };
type Draft = Omit<TreatmentProtocolInput, "stages"> & { protocolId?: string; rowVersion?: number; stages: DraftStage[] };

const npr = (value: number) => `Rs ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 0 }).format(value)}`;
const blankStage = (key: number): DraftStage => ({ key, stageName: "", price: "", active: true });
// A newly named protocol is deliberately a draft. It becomes active when its first stage is
// added and saved, so it cannot accidentally appear in patient-plan selection half-finished.
const emptyDraft = (): Draft => ({ name: "", category: "Custom", description: null, toothScope: "tooth", recordsCanalMeasurements: false, usesMobilityGrade: false, active: false, stages: [] });
const fromProtocol = (protocol: TreatmentProtocol): Draft => ({
  protocolId: protocol.protocolId, rowVersion: protocol.rowVersion, name: protocol.name, category: protocol.category,
  description: protocol.description, toothScope: protocol.toothScope, recordsCanalMeasurements: protocol.recordsCanalMeasurements,
  usesMobilityGrade: protocol.usesMobilityGrade, active: protocol.active,
  // Keep inactive saved rows in the draft so the Worker can preserve referential
  // history, but do not expose them in the clinic UI.
  stages: protocol.stages.map((stage, index) => ({ key: index + 1, protocolStageId: stage.protocolStageId, stageName: stage.stageName, price: String(stage.price), active: stage.active })),
});
const toInput = (draft: Draft): TreatmentProtocolInput => {
  const stages = draft.stages.filter((stage) => stage.stageName.trim());
  const ordered = [...stages.filter((stage) => stage.active), ...stages.filter((stage) => !stage.active)];
  return {
    name: draft.name.trim(), category: draft.category.trim() || "Custom", description: draft.description?.trim() || null,
    toothScope: draft.toothScope, recordsCanalMeasurements: draft.recordsCanalMeasurements, usesMobilityGrade: draft.usesMobilityGrade, active: draft.active,
    stages: ordered.map((stage, index) => ({ protocolStageId: stage.protocolStageId, stageOrder: index + 1, stageName: stage.stageName.trim(), price: Number(stage.price.replace(/[^\d]/g, "")) || 0, active: stage.active })),
  };
};

export function TreatmentProtocolsEditor({ protocols, loading, saving, pendingSave, error, onReload, onSave, onRetrySave, onLifecycleChange, history }: {
  protocols: TreatmentProtocol[]; loading: boolean; saving: boolean; error: string | null; onReload: () => void;
  history: AppHistory<Record<string, string>>;
  pendingSave: boolean;
  onSave: (protocol: TreatmentProtocolInput, protocolId?: string, rowVersion?: number) => Promise<TreatmentProtocol>;
  onRetrySave: () => Promise<TreatmentProtocol>;
  onLifecycleChange: (state: { dirty: boolean; modal: boolean }) => void;
}) {
  const { route, openDetail, closeDetail, patch } = useClinicRouteState(history);
  const [selected, setSelected] = useState<Draft | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [saveIntent, setSaveIntent] = useState<'create' | 'update' | 'retire' | null>(null);
  const selectedId = route.params.protocolId;
  useEffect(() => { onLifecycleChange({ dirty: draftDirty, modal: newOpen }); }, [draftDirty, newOpen, onLifecycleChange]);
  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    const protocol = protocols.find((item) => item.protocolId === selectedId);
    if (protocol) setSelected(fromProtocol(protocol));
    else if (!loading) patch({ protocolId: null }, "replace");
  }, [loading, patch, protocols, selectedId]);
  async function persist(draft: Draft) {
    setSaveError(null);
    setSaveIntent(draft.protocolId ? 'update' : 'create');
    const input = toInput(draft);
    if (!input.name || (input.active && !input.stages.length)) { setSaveError("Enter a protocol name and at least one stage before making it available for treatment plans."); return; }
    try {
      const saved = await onSave(input, draft.protocolId, draft.rowVersion);
      setSelected(fromProtocol(saved)); setNewOpen(false);
      setDraftDirty(false); setSaveIntent(null);
      if (saved.protocolId) openDetail("protocolId", saved.protocolId, draft.protocolId ? "replace" : "push");
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "Protocol could not be saved."); }
  }
  async function retryPendingSave() {
    if (!pendingSave || !saveIntent) return;
    setSaveError(null);
    try {
      const saved = await onRetrySave();
      if (saveIntent === 'retire') closeDetail("protocolId");
      else {
        setSelected(fromProtocol(saved));
        setNewOpen(false);
        if (saved.protocolId) openDetail("protocolId", saved.protocolId, saveIntent === 'create' ? "push" : "replace");
      }
      setDraftDirty(false); setSaveIntent(null);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "The original save could not be confirmed."); }
  }
  const visibleProtocols = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return protocols;
    return protocols.filter((protocol) => [protocol.name, protocol.category, protocol.description ?? "", ...protocol.stages.map((stage) => stage.stageName)]
      .some((value) => value.toLocaleLowerCase().includes(term)));
  }, [protocols, search]);
  if (selected) return <ProtocolDetail draft={selected} saving={saving} pendingSave={pendingSave} error={saveError ?? error} onRetrySave={() => void retryPendingSave()} onBack={() => { if (pendingSave) return; closeDetail("protocolId"); setSaveError(null); setDraftDirty(false); }} onChange={(next) => { if (pendingSave) return; setSelected(next); setDraftDirty(true); }} onSave={() => void persist(selected)} onRetire={() => {
    if (pendingSave) return;
    if (!selected.protocolId || selected.rowVersion === undefined) return;
    if (!window.confirm(`Remove "${selected.name}" from future treatment plans? Existing patient plans remain unchanged.`)) return;
    setSaveIntent('retire');
    void (async () => {
      const saved = await onSave({ ...toInput(selected), active: false }, selected.protocolId, selected.rowVersion);
      closeDetail("protocolId");
      setSaveError(null);
      setDraftDirty(false); setSaveIntent(null);
      return saved;
    })().catch((cause) => setSaveError(cause instanceof Error ? cause.message : "Protocol could not be removed."));
  }} />;
  return <Page sheet standardPage>
    <PageHeader title="Treatment Protocols">
      <ClinicActionButton onClick={() => { setNewOpen(true); setDraftDirty(false); setSaveError(null); }}><Plus size={14} /> New protocol</ClinicActionButton>
    </PageHeader>
    {error && protocols.length > 0 ? <div role="alert" className="formError">{error} <button type="button" className="btn btn-secondary btn-sm" onClick={onReload}>Retry</button></div> : null}
    <DataTable<TreatmentProtocol>
      rows={visibleProtocols}
      standardPage
      rowKey={(protocol) => protocol.protocolId}
      noun="treatment protocols"
      pageSize={10}
      minWidth={820}
      loading={loading}
      loadingLabel="Loading treatment protocols…"
      error={!loading && protocols.length === 0 ? error : null}
      errorHint="Try again to reconnect to the clinic workspace."
      filters={<><SearchBox aria-label="Search treatment protocols" placeholder="Search protocols or stages…" value={search} onChange={(event) => setSearch(event.target.value)} /><span style={{ marginLeft: "auto", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{visibleProtocols.length} {visibleProtocols.length === 1 ? "protocol" : "protocols"}</span></>}
      onRowClick={(protocol) => openDetail("protocolId", protocol.protocolId)}
      empty={<div style={{ padding: "40px 16px", color: "var(--ink-3)", textAlign: "center" }}>{search ? "No treatment protocols match this search." : <>No treatment protocols found. Click <strong>+ New protocol</strong> to create one.</>}</div>}
      columns={[
        { key: "sn", header: "S.N.", align: "center", width: 60, render: (_protocol, index) => index + 1 },
        { key: "name", header: "Protocol name & stage workflow", sortable: true, value: (protocol) => protocol.name, render: (protocol) => { const stages = protocol.stages.filter((stage) => stage.active); return <div><div>{protocol.name}{protocol.recordsCanalMeasurements ? <span data-table-tone="semantic" style={{ display: "inline-block", marginLeft: "8px", padding: "2px 7px", borderRadius: "999px", color: "var(--acc)", background: "var(--acc-soft)", verticalAlign: "middle" }}>Canal tracking</span> : null}</div><div data-table-secondary style={{ marginTop: "4px" }}>{stages.map((stage) => stage.stageName).join(" → ") || "No active stages"}</div></div>; } },
        { key: "stages", header: "Stages count", align: "right", value: (protocol) => protocol.stages.filter((stage) => stage.active).length, render: (protocol) => { const count = protocol.stages.filter((stage) => stage.active).length; return `${count} ${count === 1 ? "stage" : "stages"}`; } },
        { key: "price", header: "Total price (NPR)", align: "right", sortable: true, value: (protocol) => protocol.totalPrice, render: (protocol) => <span style={{ fontWeight: "var(--fw-bold)", color: "var(--acc)", fontSize: "var(--fs-14)" }}>{npr(protocol.totalPrice)}</span> },
        { key: "actions", header: "Action", align: "center", width: 110, render: (protocol) => <span onClick={(event) => event.stopPropagation()}><ClinicActionButton size="compact" onClick={() => openDetail("protocolId", protocol.protocolId)}>Detail</ClinicActionButton></span> },
      ]}
    />
    {newOpen ? <NewProtocolModal saving={saving} pendingSave={pendingSave} error={saveError} onClose={() => { if (pendingSave) return; setNewOpen(false); setDraftDirty(false); }} onDraftChange={() => setDraftDirty(true)} onRetrySave={() => void retryPendingSave()} onSave={persist} /> : null}
  </Page>;
}

function ProtocolDetail({ draft, saving, pendingSave, error, onBack, onChange, onSave, onRetire, onRetrySave }: { draft: Draft; saving: boolean; pendingSave: boolean; error: string | null; onBack: () => void; onChange: (next: Draft) => void; onSave: () => void; onRetire: () => void; onRetrySave: () => void }) {
  const activeStages = useMemo(() => draft.stages.filter((stage) => stage.active), [draft.stages]);
  const total = useMemo(() => activeStages.reduce((sum, stage) => sum + (Number(stage.price.replace(/[^\d]/g, "")) || 0), 0), [activeStages]);
  const stageNameRefs = useRef(new Map<number, HTMLInputElement>());
  const stagePriceRefs = useRef(new Map<number, HTMLInputElement>());
  const [stageToFocus, setStageToFocus] = useState<number | null>(null);
  useEffect(() => {
    if (stageToFocus === null) return;
    const target = stageNameRefs.current.get(stageToFocus);
    if (!target) return;
    target.focus();
    setStageToFocus(null);
  }, [activeStages, stageToFocus]);
  const setStage = (key: number, patch: Partial<DraftStage>) => { if (!pendingSave) onChange({ ...draft, stages: draft.stages.map((stage) => stage.key === key ? { ...stage, ...patch } : stage) }); };
  const addStage = (focus = false) => {
    if (pendingSave) return;
    const key = Math.max(0, ...draft.stages.map((stage) => stage.key)) + 1;
    onChange({ ...draft, active: true, stages: [...draft.stages, blankStage(key)] });
    if (focus) setStageToFocus(key);
  };
  const advanceStage = (event: KeyboardEvent<HTMLInputElement>, key: number, field: "name" | "price", index: number) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (field === "name") {
      stagePriceRefs.current.get(key)?.focus();
      return;
    }
    const next = activeStages[index + 1];
    if (next) {
      stageNameRefs.current.get(next.key)?.focus();
      return;
    }
    addStage(true);
  };
  const removeStage = (key: number) => {
    if (pendingSave || activeStages.length === 1) return;
    const target = draft.stages.find((stage) => stage.key === key);
    onChange({
      ...draft,
      stages: target?.protocolStageId
        ? draft.stages.map((stage) => stage.key === key ? { ...stage, active: false } : stage)
        : draft.stages.filter((stage) => stage.key !== key),
    });
  };
  return <Page sheet><PageHeader title={draft.name || "New treatment protocol"} subtitle="Define the ordered clinical stages and default pricing for this reusable protocol." icon={<ListChecks size={17} style={{ color: "var(--acc)" }} />}>
    {draft.protocolId ? <button type="button" className="btn btn-danger btn-sm" onClick={onRetire} disabled={saving || pendingSave}><Trash2 size={14} /> Delete protocol</button> : null}
  </PageHeader>
    <Card square><CardHeader title="Stage workflow"><span style={{ color: "var(--ink-3)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>{activeStages.length ? `${activeStages.length} ${activeStages.length === 1 ? "stage" : "stages"}` : "Draft protocol"}</span></CardHeader><CardBody>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}><p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--fs-13)" }}>Press Enter to move through a stage, then to the next stage. At the final cost, a new stage is added automatically.</p><div style={{ color: "var(--acc)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", whiteSpace: "nowrap" }}>{npr(total)}</div></div>
      {activeStages.length ? <TableWrap><Table><thead><tr><Th align="center" style={{ width: "62px" }}>Order</Th><Th>Stage description</Th><Th align="right" style={{ width: "176px" }}>Cost (NPR)</Th><Th align="center" style={{ width: "70px" }}>Action</Th></tr></thead><tbody>{activeStages.map((stage, index) => <Tr key={stage.key}><Td align="center"><span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--acc-soft)", color: "var(--acc)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span></Td><Td><Input aria-label={`Stage ${index + 1} description`} ref={(element) => { if (element) stageNameRefs.current.set(stage.key, element); else stageNameRefs.current.delete(stage.key); }} value={stage.stageName} placeholder="Stage name" disabled={pendingSave} onChange={(event) => setStage(stage.key, { stageName: event.target.value })} onKeyDown={(event) => advanceStage(event, stage.key, "name", index)} style={{ fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }} /></Td><Td align="right"><div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}><span style={{ fontSize: "var(--fs-13)", color: "var(--ink-3)", fontWeight: "var(--fw-medium)" }}>Rs</span><Input aria-label={`Stage ${index + 1} cost in NPR`} ref={(element) => { if (element) stagePriceRefs.current.set(stage.key, element); else stagePriceRefs.current.delete(stage.key); }} inputMode="numeric" value={stage.price} placeholder="0" disabled={pendingSave} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} onChange={(event) => setStage(stage.key, { price: event.target.value.replace(/[^\d]/g, "") })} onKeyDown={(event) => advanceStage(event, stage.key, "price", index)} style={{ textAlign: "right", fontWeight: "var(--fw-bold)", width: "110px", fontSize: "var(--fs-14)" }} /></div></Td><Td align="center"><button type="button" onClick={() => removeStage(stage.key)} disabled={pendingSave || activeStages.length === 1} aria-label={`Remove stage ${index + 1}`} title="Remove stage" style={{ background: "none", border: "none", color: activeStages.length === 1 ? "#cbd5e1" : "#ef4444", cursor: pendingSave || activeStages.length === 1 ? "default" : "pointer" }}><Trash2 size={15} /></button></Td></Tr>)}</tbody></Table></TableWrap> : <div style={{ padding: "var(--sp-5)", border: "1px dashed var(--line-strong)", color: "var(--ink-3)", background: "var(--surface-alt)", textAlign: "center", fontSize: "var(--fs-14)" }}><strong style={{ display: "block", color: "var(--ink-2)", marginBottom: "var(--sp-1)" }}>This protocol has no stages yet.</strong>Add the first clinical stage when you are ready.</div>}
      <button type="button" onClick={() => addStage(true)} disabled={pendingSave} className="btn btn-primary btn-sm" style={{ marginTop: "var(--sp-3)" }}><Plus size={14} /> Add stage</button>
      <div style={{ marginTop: "var(--sp-5)", paddingTop: "var(--sp-4)", borderTop: "1px dashed #e2e8f0", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}><InlineCheck label="Record canal measurements for this treatment" checked={draft.recordsCanalMeasurements} onChange={(recordsCanalMeasurements) => { if (!pendingSave) onChange({ ...draft, recordsCanalMeasurements }); }} /><InlineCheck label="Grade this treatment (I / II / III)" checked={draft.usesMobilityGrade} onChange={(usesMobilityGrade) => { if (!pendingSave) onChange({ ...draft, usesMobilityGrade }); }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--sp-5)", paddingTop: "var(--sp-4)", borderTop: "1px solid #e2e8f0" }}><div><span style={{ fontSize: "11px", fontWeight: "var(--fw-bold)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Protocol Total Cost</span><div style={{ fontSize: "var(--fs-22)", fontWeight: "var(--fw-bold)", color: "var(--acc)", fontVariantNumeric: "tabular-nums" }}>{npr(total)}</div></div><div style={{ display: "flex", gap: "var(--sp-3)" }}><button type="button" className="btn btn-secondary" onClick={onBack} disabled={saving || pendingSave}>Cancel</button><button type="button" onClick={onSave} disabled={saving || pendingSave} className="btn btn-primary">{saving ? <><Loader2 size={14} className="spin-icon" /> Saving…</> : "Save changes"}</button></div></div>
      {error ? <div role="alert" style={{ marginTop: "var(--sp-3)", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{error}{pendingSave ? <div style={{ marginTop: "var(--sp-2)" }}><button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onRetrySave}>Check original save</button></div> : null}</div> : null}
    </CardBody></Card></Page>;
}

function NewProtocolModal({ saving, pendingSave, error, onClose, onDraftChange, onRetrySave, onSave }: { saving: boolean; pendingSave: boolean; error: string | null; onClose: () => void; onDraftChange: () => void; onRetrySave: () => void; onSave: (draft: Draft) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  return <Modal title="New treatment protocol" onClose={onClose} maxWidth={560}><ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}>
    <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--fs-13)", lineHeight: 1.5 }}>Start with the protocol name. You can add stages, prices, and clinical settings from its detail page.</p>
    <Field label="Protocol name" required htmlFor="treatment-protocol-name"><Input id="treatment-protocol-name" autoFocus required placeholder="e.g. Single Implant" value={draft.name} disabled={pendingSave} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); onDraftChange(); }} /></Field>
    {error ? <ModalError>{error}</ModalError> : null}<div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)" }}>{pendingSave ? <button type="button" className="btn btn-secondary" onClick={onRetrySave} disabled={saving}>Check original save</button> : null}<button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving || pendingSave}>Cancel</button><button type="submit" disabled={saving || pendingSave} className="btn btn-primary">{saving ? <><Loader2 size={14} className="spin-icon" /> Saving…</> : <><Plus size={15} /> Create protocol</>}</button></div>
  </ModalBody></Modal>;
}
