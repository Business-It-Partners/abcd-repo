"use client";

import { useState, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  UserRound,
  ShoppingBag,
  Landmark,
  Package,
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
  Card,
  CardHeader,
  CardBody,
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
  const { patientOutstandingDueAmount: totalPatientOutstanding, generalExpenseAmount: totalGeneralExpenses, purchaseAmount: totalPurchases, supplierPayoutAmount: totalSupplierPayments, salaryPayoutAmount: totalSalaryPaid, currentSupplierOutstandingAmount: totalSupplierOutstanding, labPurchaseAmount: totalLabPurchases, labPayoutAmount: totalLabPayments, currentLabOutstandingAmount: totalLabOutstanding } = workerOverview;

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
      <PageHeader title="Transaction Record" icon={<Wallet size={17} style={{ color: "var(--acc)" }} />} />

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
      {/* One financial-overview compartment. The tiles are status cues inside this
          section; they do not float independently on the page canvas. */}
      <Card square>
        <CardHeader title="Financial overview" style={{ padding: "var(--sp-3) var(--sp-4)" }} />
        <CardBody>
      {/* 10 Financial Summary KPI Cards arranged in a responsive grid */}
      <div className="finance-metric-grid">
        {/* ROW 1: Macro Summary Cards */}
        {/* 1. Total Revenue (Money IN) */}
        <Card square style={{ background: "#bbf7d0", borderColor: "#86efac" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#166534" }}>
                Total Revenue (Money IN)
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#15803d",
                }}
              >
                <ArrowDownLeft size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#15803d", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalRevenue)}
            </div>
          </CardBody>
        </Card>

        {/* 2. Total Spend (Money OUT) */}
        <Card square style={{ background: "#fecaca", borderColor: "#fca5a5" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#991b1b" }}>
                Total Spend (Money OUT)
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#b91c1c",
                }}
              >
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalSpend)}
            </div>
          </CardBody>
        </Card>

        {/* 3. Net Cash Flow */}
        <Card square style={{ background: netCashFlow >= 0 ? "#d4d4d8" : "#fecdd3", borderColor: netCashFlow >= 0 ? "#a1a1aa" : "#fda4af" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "var(--ink-1)" }}>
                Net Cash Flow
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: netCashFlow >= 0 ? "#e4e4e7" : "#ffe4e6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: netCashFlow >= 0 ? "var(--acc)" : "#e11d48",
                }}
              >
                {netCashFlow >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              </div>
            </div>
            <div
              style={{
                fontSize: "var(--fs-16)",
                fontWeight: "var(--fw-bold)",
                color: netCashFlow >= 0 ? "var(--acc)" : "#e11d48",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatNpr(netCashFlow)}
            </div>
          </CardBody>
        </Card>

        {/* 4. Patient Outstanding Dues */}
        <Card square style={{ background: "#fde68a", borderColor: "#fcd34d" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "var(--ink-1)" }}>
                Patient Outstanding Dues
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#d97706",
                }}
              >
                <Receipt size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#b45309", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalPatientOutstanding)}
            </div>
          </CardBody>
        </Card>

        {/* ROW 2: Detailed Finance Sub-Books Breakdown */}
        {/* 5. General Expenses */}
        <Card square style={{ background: "#fed7aa", borderColor: "#fdba74" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#9a3412" }}>
                General Expenses
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#ffedd5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c2410c",
                }}
              >
                <ShoppingBag size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#c2410c", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalGeneralExpenses)}
            </div>
          </CardBody>
        </Card>

        {/* 6. Purchases */}
        <Card square style={{ background: "#fde68a", borderColor: "#facc15" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#854d0e" }}>
                Purchases
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#fef08a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a16207",
                }}
              >
                <Package size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#a16207", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalPurchases)}
            </div>
          </CardBody>
        </Card>

        {/* 7. Supplier payments */}
        <Card square style={{ background: "#ddd6fe", borderColor: "#c4b5fd" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#6b21a8" }}>
                Supplier Payouts
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#e9d5ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7e22ce",
                }}
              >
                <Landmark size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#7e22ce", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalSupplierPayments)}
            </div>
          </CardBody>
        </Card>

        {/* 8. Staff & Doctor Payroll */}
        <Card square style={{ background: "#bae6fd", borderColor: "#7dd3fc" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#075985" }}>
                Salary Payouts
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#bae6fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0284c7",
                }}
              >
                <UserRound size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#0284c7", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalSalaryPaid)}
            </div>
          </CardBody>
        </Card>

        {/* 9. Supplier Outstanding */}
        <Card square style={{ background: "#d8b4fe", borderColor: "#c084fc" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#6b21a8" }}>
                Current Supplier Outstanding
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#e9d5ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7e22ce",
                }}
              >
                <Landmark size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#7e22ce", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalSupplierOutstanding)}
            </div>
          </CardBody>
        </Card>

        {/* 10. Lab purchases */}
        <Card square style={{ background: "#f5d0fe", borderColor: "#f0abfc" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#86198f" }}>
                Lab Purchases
              </span>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#fae8ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a21caf",
                }}
              >
                <Package size={16} />
              </div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", color: "#a21caf", fontVariantNumeric: "tabular-nums" }}>
              {formatNpr(totalLabPurchases)}
            </div>
          </CardBody>
        </Card>

        {/* 11. Lab payouts */}
        <Card square style={{ background: "#f5d0fe", borderColor: "#f0abfc" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>Lab Payouts</span>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#fae8ff", display: "flex", alignItems: "center", justifyContent: "center" }}><Landmark size={16} /></div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums" }}>{formatNpr(totalLabPayments)}</div>
          </CardBody>
        </Card>

        {/* 12. Lab outstanding */}
        <Card square style={{ background: "#e9d5ff", borderColor: "#c4b5fd" }}>
          <CardBody>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>Current Lab Outstanding</span>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#ddd6fe", display: "flex", alignItems: "center", justifyContent: "center" }}><Landmark size={16} /></div>
            </div>
            <div style={{ fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums" }}>{formatNpr(totalLabOutstanding)}</div>
          </CardBody>
        </Card>
      </div>
        </CardBody>
      </Card>

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
