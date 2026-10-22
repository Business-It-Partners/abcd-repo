"use client";

import { followUpsApi } from "@/features/follow-ups/api";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FollowUpWorklistItem } from "@/features/patients/types";
import { addDaysISO, dueLabelFor, type FollowUp } from "@/features/patients/model/domain";

export type FollowUpBucket = "today" | "week" | "upcoming" | "missed";
export interface FollowUpCounts { missed: number; today: number; upcoming: number; week: number; }
export interface PagedFollowUps {
  counts: FollowUpCounts | null;
  followUps: FollowUp[];
  hasMore: boolean;
  loadError: string | null;
  loadedCount: number;
  loading: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  patchFollowUp: (followUpId: string, patch: Partial<FollowUp>) => void;
  refreshCounts: () => Promise<void>;
  reload: () => Promise<void>;
}

function toFollowUp(row: FollowUpWorklistItem, today: string): FollowUp {
  const status = row.dueOn < today ? "overdue" : row.dueOn === today ? "due-today" : "upcoming";
  const remainingDays = Math.round(
    (Date.parse(`${row.dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  return {
    id: row.followUpId,
    rowVersion: row.rowVersion,
    patient: row.patientName,
    patientId: row.patientId,
    phone: row.patientPhone ?? "",
    reason: row.reason,
    lastVisit: row.lastVisitOn ?? "",
    dueLabel: dueLabelFor(remainingDays),
    dueDate: row.dueOn,
    time: row.dueTime ?? undefined,
    status,
    doctor: row.requestedByStaffName ?? "Not recorded",
    called: row.called,
    noAnswer: row.noAnswer,
    active: row.status === "pending",
    caught: row.status === "caught",
  };
}

export function usePagedFollowUps(input: { bucket: FollowUpBucket; selectedDate?: string; today: string; pageSize?: number }): PagedFollowUps {
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentRead = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    currentRead.current?.abort();
    const controller = new AbortController();
    currentRead.current = controller;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await followUpsApi.listFollowUps(controller.signal);
      if (controller.signal.aborted) return;
      setRows(data.map((row) => toFollowUp(row, input.today)));
    } catch (cause) {
      if (controller.signal.aborted) return;
      setRows([]);
      setLoadError(cause instanceof Error ? cause.message : "Follow-ups could not be loaded.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [input.today]);

  useEffect(() => { void reload(); return () => currentRead.current?.abort(); }, [reload]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (input.selectedDate) return row.dueDate === input.selectedDate;
    if (input.bucket === "today") return row.dueDate === input.today;
    if (input.bucket === "week") return row.dueDate >= input.today && row.dueDate <= addDaysISO(input.today, 6);
    if (input.bucket === "upcoming") return row.dueDate > addDaysISO(input.today, 6);
    return row.dueDate < input.today;
  }), [input.bucket, input.selectedDate, input.today, rows]);
  const counts = useMemo<FollowUpCounts>(() => ({
    // Summary cards describe how many records belong to each due-date bucket.
    // Contact/outcome ticks change the row state, but must not make an existing
    // follow-up disappear from the bucket total shown above the same table.
    today: rows.filter((row) => row.dueDate === input.today).length,
    week: rows.filter((row) => row.dueDate >= input.today && row.dueDate <= addDaysISO(input.today, 6)).length,
    upcoming: rows.filter((row) => row.dueDate > addDaysISO(input.today, 6)).length,
    missed: rows.filter((row) => row.dueDate < input.today).length,
  }), [input.today, rows]);
  const patchFollowUp = useCallback((followUpId: string, patch: Partial<FollowUp>) => setRows((current) => current.map((row) => row.id === followUpId ? { ...row, ...patch } : row)), []);
  return { counts, followUps: filtered, hasMore: false, loadError, loadedCount: filtered.length, loading, loadingMore: false, loadMore: async () => {}, patchFollowUp, refreshCounts: reload, reload };
}
