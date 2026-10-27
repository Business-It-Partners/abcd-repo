"use client";

import { useState, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import {
  formatNpr,
  formatDateShort,
  todayISO,
} from "@/features/finance/internal/lib/domain";
import { isInBSMonth, todayBSMonth } from "@/shared/dates/nepaliDate";
import type { CashTransaction } from "../lib/financeTruth";
import type { ClinicFinanceOverview } from "@/features/finance/transaction-record/types";
import MonthPicker from "@/shared/dates/MonthPicker";
import {
  Page,
  PageHeader,
  Tabs,
  type TabDef,
  DataTable,
  ErrorState,
  EmptyState,
} from "@/shared/ui/workspace-primitives";

export type MasterTransaction = CashTransaction;

interface TransactionRecordViewProps {
  workerTransactions: CashTransaction[];
  workerSummary: { totalRevenue: number; totalSpend: number; netCashFlow: number };
  workerOverview: ClinicFinanceOverview;
  monthFilter?: string;
  onMonthFilterChange?: (value: string) => void;
  loading?: boolean;
  loadError?: string | null;
  hasSuccessfulReport?: boolean;
}

export default function TransactionRecordView({
  workerTransactions, workerSummary, workerOverview,
  monthFilter: controlledMonthFilter, onMonthFilterChange, loading = false, loadError = null,
  hasSuccessfulReport = false,
}: TransactionRecordViewProps) {
  const [localMonthFilter, setLocalMonthFilter] = useState<string>(() => todayBSMonth());
  const monthFilter = controlledMonthFilter ?? localMonthFilter;
  const setMonthFilter = onMonthFilterChange ?? setLocalMonthFilter;
  const [activeTab, setActiveTab] = useState<"all" | "in" | "out">("all");
  const masterTransactions = workerTransactions;

  // Apply month filter
  const monthFiltered = useMemo(() => {
    if (monthFilter === "all") return masterTransactions;
    return masterTransactions.filter((t) => t.date && isInBSMonth(t.date, monthFilter));
  }, [masterTransactions, monthFilter]);

  // Apply flow tab filter (all / in / out)
  const tabFiltered = useMemo(() => {
    if (activeTab === "all") return monthFiltered;
    return monthFiltered.filter((t) => t.flow === activeTab);
  }, [monthFiltered, activeTab]);

  // The report is delivered newest-first. Reverse that stable ledger order so a
  // row's balance is the signed total after its cash movement. The Worker query
  // is scoped to the selected reporting period, therefore the period opens at 0.
  const runningBalanceByTransactionId = useMemo(() => {
    let balance = 0;
    const balances = new Map<string, number>();
    for (const transaction of [...masterTransactions].reverse()) {
      balance += transaction.flow === "in" ? transaction.amount : -transaction.amount;
      balances.set(transaction.id, balance);
    }
    return balances;
  }, [masterTransactions]);

  const { totalRevenue, totalSpend, netCashFlow } = workerSummary;
  const { patientOutstandingDueAmount: totalPatientOutstanding } = workerOverview;

  const primaryMetrics = [
    { label: "Revenue", value: totalRevenue, hint: "Money received", Icon: ArrowDownLeft, tone: undefined },
    { label: "Spend", value: totalSpend, hint: "Money paid out", Icon: ArrowUpRight, tone: undefined },
    { label: "Net cash flow", value: netCashFlow, hint: "Revenue minus spend", Icon: netCashFlow >= 0 ? TrendingUp : TrendingDown, tone: netCashFlow < 0 ? "negative" : "positive" },
    { label: "Patient outstanding", value: totalPatientOutstanding, hint: "Unpaid patient balances", Icon: Receipt, tone: undefined },
  ];
  const tabs: TabDef[] = [
    { key: "all", label: `All Transactions (${monthFiltered.length})` },
    { key: "in", label: `Money IN (${monthFiltered.filter((t) => t.flow === "in").length})` },
    { key: "out", label: `Money OUT (${monthFiltered.filter((t) => t.flow === "out").length})` },
  ];
  const transactionFilters = <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
    <Tabs tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as "all" | "in" | "out")} />
    <MonthPicker value={monthFilter} onChange={setMonthFilter} allowAll allLabel="All months" max={todayISO().slice(0, 7)} />
  </div>;

  return (
    <Page sheet standardPage>
      <PageHeader title="Financial overview" icon={<Wallet size={17} style={{ color: "var(--acc)" }} />} />

      {loadError && !loading && (
        <ErrorState
          message={hasSuccessfulReport
            ? "Refresh failed. Showing the last successful report."
            : "The transaction record could not be loaded. Summary values are unavailable."}
          hint={loadError}
        />
      )}

      {(!loadError || hasSuccessfulReport) && (
      <>
      <section className="finance-overview" aria-label="Financial overview">
        <div className="finance-primary-grid">
          {primaryMetrics.map(({ label, value, hint, Icon, tone }) => <article className={`finance-primary-card${tone ? ` is-${tone}` : ""}`} key={label}>
            <div className="finance-primary-copy">
              <span>{label}</span>
              <strong>{formatNpr(value)}</strong>
              <small>{hint}</small>
            </div>
            <span className="finance-primary-icon" aria-hidden="true"><Icon size={18} /></span>
          </article>)}
        </div>
      </section>

      {/* Separate ledger compartment */}
      <DataTable<MasterTransaction>
        square
        standardPage
        rows={tabFiltered}
        rowKey={(t) => t.id}
        noun="transactions"
        loading={loading}
        loadingLabel="Loading the transaction record…"
        filters={transactionFilters}
        empty={<EmptyState message="No transactions found for the selected period." />}
        columns={[
          {
            key: "sn",
            header: "S.N.",
            align: "center",
            width: 50,
            render: (_r, i) => <span style={{ color: "var(--ink-3)" }}>{i + 1}</span>,
          },
          {
            key: "date",
            header: "DATE",
            sortable: true,
            value: (t) => t.date,
            render: (t) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateShort(t.date)}</span>,
          },
          {
            key: "type",
            header: "TYPE",
            render: (t) => {
              const isIncome = t.flow === "in";
              return (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "var(--fw-medium)",
                    padding: "2px 8px",
                    borderRadius: "var(--r-xs)",
                    background: isIncome ? "#dcfce7" : "#fee2e2",
                    color: isIncome ? "#15803d" : "#b91c1c",
                    display: "inline-block",
                  }}
                >
                  {isIncome ? "Income (+IN)" : `${t.categoryLabel} (-OUT)`}
                </span>
              );
            },
          },
          {
            key: "payee",
            header: "DESCRIPTION / PAYEE",
            render: (t) => (
              <div>
                <span style={{ fontWeight: "var(--fw-normal)", color: "var(--ink-1)" }}>{t.payeeOrPatient}</span>
                {t.noteOrDetails && (
                  <span style={{ display: "block", fontSize: "var(--fs-12)", color: "var(--ink-3)" }}>
                    {t.noteOrDetails}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "method",
            header: "METHOD",
            width: 110,
            render: (t) => (
              <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-2)" }}>{t.method || "—"}</span>
            ),
          },
          {
            key: "amount",
            header: "AMOUNT",
            align: "right",
            sortable: true,
            value: (t) => (t.flow === "in" ? t.amount : -t.amount),
            render: (t) => (
              <span
                style={{
                  fontWeight: "var(--fw-bold)",
                  color: t.flow === "in" ? "#15803d" : "#b91c1c",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {t.flow === "in" ? `+${formatNpr(t.amount)}` : `-${formatNpr(t.amount)}`}
              </span>
            ),
          },
          ...(activeTab === "all" ? [{
            key: "runningBalance",
            header: "RUNNING BALANCE",
            align: "right" as const,
            width: 160,
            value: (transaction: MasterTransaction) => runningBalanceByTransactionId.get(transaction.id) ?? 0,
            render: (transaction: MasterTransaction) => {
              const balance = runningBalanceByTransactionId.get(transaction.id) ?? 0;
              return (
                <span
                  style={{
                    fontWeight: "var(--fw-bold)",
                    color: balance >= 0 ? "#15803d" : "#b91c1c",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatNpr(balance)}
                </span>
              );
            },
          }] : []),
        ]}
      />
      </>
      )}
    </Page>
  );
}
