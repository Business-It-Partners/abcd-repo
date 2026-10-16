/** Synthetic host-only services. Created solely by the guarded M03 test runtime. */
import type { Identity, Transport } from './broker';
import { staging } from './environment';
export const sampleAppointment = {
  appointmentId: '11111111-1111-4111-8111-111111111111', patientName: 'Synthetic patient', contactPhone: null,
  doctorName: 'Sample doctor', appointmentDate: '2026-10-16', startMinute: 540, durationMinutes: 30,
  reason: 'Synthetic contract proof', status: 'booked', createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z', rowVersion: 1,
};
export function fixtureServices(): { identity: Identity; transport: Transport } {
  const receipts = new Map<string, unknown>(); let current = { ...sampleAppointment };
  const identity: Identity = {
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic' }),
    credential: async () => 'synthetic-fixture-credential',
  };
  const transport: Transport = async (url, init) => {
    const u = new URL(url);
    if (u.origin !== staging.apiBase) throw new Error('Fixture cannot call another destination');
    const headers = new Headers(init.headers);
    if (headers.get('authorization') !== 'Bearer synthetic-fixture-credential') return Response.json({}, { status: 401 });
    if (init.method === 'GET' && u.pathname === '/v1/appointments') return Response.json({ appointments: [current] });
    if (init.method === 'POST' && u.pathname === `/v1/appointments/${sampleAppointment.appointmentId}/status`) {
      const key = headers.get('idempotency-key')!;
      if (receipts.has(key)) return Response.json(receipts.get(key));
      const input = JSON.parse(init.body as string) as { status: string; expectedRowVersion: number };
      if (input.expectedRowVersion !== current.rowVersion) return Response.json({}, { status: 409 });
      current = { ...current, status: input.status, rowVersion: current.rowVersion + 1 };
      const result = { appointment: current }; receipts.set(key, result); return Response.json(result);
    }
    return Response.json({}, { status: 404 });
  };
  return { identity, transport };
}
