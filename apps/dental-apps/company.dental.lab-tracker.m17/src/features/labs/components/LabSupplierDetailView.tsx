"use client";

import { useMemo } from "react";
import { Briefcase, Truck } from "lucide-react";
import { formatDateShort, type LabOrder, type LabSupplier } from "@/features/labs/model/domain";
import {
  Page,
  PageHeader,
  DataTable,
  EmptyState,
  Chip,
} from "@/shared/ui/workspace-primitives";

interface LabSupplierDetailViewProps {
  lab: LabSupplier;
  orders: LabOrder[];
  loading: boolean;
  onBack: () => void;
}

/**
 * Lab supplier records are an operational view. Finance owns every monetary
 * fact and statement, while this page shows only work sent to the laboratory.
 */
export default function LabSupplierDetailView({
  lab,
  orders,
  loading,
  onBack,
}: LabSupplierDetailViewProps) {
  const sentOrders = useMemo(
    () => orders
      .filter((order) => order.labId === lab.id)
      .sort((a, b) => b.sentDate.localeCompare(a.sentDate)),
    [lab.id, orders],
  );

  return (
    <Page sheet>
      <PageHeader
        title={lab.name}
        icon={<Truck size={17} style={{ color: "var(--acc)" }} />}
        subtitle={[lab.contactPerson, lab.phone, lab.address].filter(Boolean).join(" · ") || undefined}
        back={{ label: "Lab supplier record", onClick: onBack }}
      />

      <DataTable<LabOrder>
        rows={sentOrders}
        rowKey={(order) => order.id}
        noun="lab orders"
        pageSize={25}
        loading={loading}
        loadingLabel="Loading lab orders…"
        empty={<EmptyState icon={<Briefcase size={26} />} message="No lab orders have been sent to this supplier." />}
        columns={[
          {
            key: "sn",
            header: "S.N.",
            align: "center",
            width: 44,
            render: (_order, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span>,
          },
          {
            key: "sentDate",
            header: "Sent Date",
            sortable: true,
            nowrap: true,
            value: (order) => order.sentDate,
            render: (order) => formatDateShort(order.sentDate),
          },
          {
            key: "patientName",
            header: "Patient",
            sortable: true,
            value: (order) => order.patientName,
            render: (order) => <strong>{order.patientName}</strong>,
          },
          {
            key: "procedure",
            header: "Work",
            sortable: true,
            value: (order) => order.procedure,
            render: (order) => (
              <div>
                <span style={{ color: "var(--acc)", fontWeight: "500" }}>{order.procedure}</span>
                {(order.tooth || order.shade) && (
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {order.tooth ? `Tooth ${order.tooth}` : ""}{order.tooth && order.shade ? " · " : ""}{order.shade ? `Shade ${order.shade}` : ""}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            sortable: true,
            value: (order) => order.status,
            render: (order) => <Chip tone={order.status === "Fitted" ? "neutral" : "accent"}>{order.status}</Chip>,
          },
        ]}
      />
    </Page>
  );
}
