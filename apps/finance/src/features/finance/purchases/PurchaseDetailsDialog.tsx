import { Modal, ModalBody } from "@/shared/ui/workspace-primitives";
import { formatDateShort } from "@/shared/dates/nepaliDate";
import { formatNpr } from "../internal/lib/domain";
import { Table, TableWrap, Td, Th, Tr } from "@/shared/ui/ClinicTable";
import type { ClinicPurchase } from "./types";

export function PurchaseDetailsDialog({ purchase, onClose }: { purchase: ClinicPurchase | null; onClose: () => void }) {
  if (!purchase) return null;

  return (
    <Modal title="Purchase details" onClose={onClose} maxWidth={860}>
      <ModalBody as="div">
        <section aria-label="Purchase summary" className="purchase-detail-summary">
          <div><span>Date</span><strong>{formatDateShort(purchase.purchaseDate)}</strong></div>
          <div><span>Invoice</span><strong>{purchase.invoiceNumber || "Not recorded"}</strong></div>
          <div className="purchase-detail-supplier"><span>Supplier</span><strong>{purchase.supplierName}</strong></div>
          <div className="purchase-detail-total"><span>Total amount</span><strong>{formatNpr(purchase.totalAmount)}</strong></div>
          {purchase.discountAmount > 0 ? <div className="purchase-detail-discount"><span>Discount</span><strong>{formatNpr(purchase.discountAmount)}</strong></div> : null}
          <div><span>Purchase type</span><strong>{purchase.purchaseType === "lab_service" ? "Lab service" : "Products"}</strong></div>
        </section>
        {purchase.correctsPurchaseId ? <p className="purchase-correction-notice">This invoice is a corrected replacement for a previous purchase record.</p> : null}
        <section className="purchase-detail-items">
          <div className="purchase-detail-heading"><h3>Purchased items</h3><span>{purchase.lines.length} {purchase.lines.length === 1 ? "item" : "items"}</span></div>
          <TableWrap>
            <Table minWidth={560}>
              <thead><Tr><Th>Product</Th><Th align="right">Qty</Th><Th align="right">Unit price</Th><Th align="right">Subtotal</Th></Tr></thead>
              <tbody>{purchase.lines.map((line) => (
                <Tr key={line.purchaseLineId}>
                  <Td style={{ fontWeight: 550 }}>{line.itemName}</Td>
                  <Td align="right">{line.quantity}{line.unit ? ` ${line.unit}` : ""}</Td>
                  <Td align="right">{formatNpr(line.rate)}</Td>
                  <Td align="right" style={{ fontWeight: 550 }}>{formatNpr(line.amount)}</Td>
                </Tr>
              ))}</tbody>
            </Table>
          </TableWrap>
        </section>
        {purchase.note ? <section className="purchase-detail-note"><h3>Notes</h3><p>{purchase.note}</p></section> : null}
      </ModalBody>
    </Modal>
  );
}
