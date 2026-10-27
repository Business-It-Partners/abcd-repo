import type { LabOrderInput } from "@/features/work-entry/model/caseData";

/** Only browser drafts belong in the final transaction; historical orders are read elsewhere. */
export function unpersistedLabOrderDrafts(orders: LabOrderInput[]): LabOrderInput[] {
  return orders.filter((order) => !order.labOrderId);
}
