import { describe, expect, it } from 'vitest';
import { allowedClinicApiPath, appAllowed, containsPresignedHandle } from '../electron/sdk/appPolicy';

describe('first-party clinic app API policy', () => {
  it('limits Follow-ups to the methods and exact records its screen uses', () => {
    expect(allowedClinicApiPath('company.dental.followups', '/v1/follow-ups', 'GET')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/follow-ups', 'POST')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/follow-ups/abc_123/toggle', 'PATCH')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/follow-ups/abc_123/schedule', 'PATCH')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/patients?q=Udayaraj&limit=8', 'GET')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/clinic/staff-references', 'GET')).toBe(true);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/patients', 'GET')).toBe(false);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/patients?q=Udayaraj&limit=100', 'GET')).toBe(false);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/patients/123', 'GET')).toBe(false);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/appointments/123/status', 'PATCH')).toBe(false);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/follow-ups-elsewhere', 'GET')).toBe(false);
    expect(allowedClinicApiPath('company.dental.followups', '/v1/dental-os/catalogue', 'GET')).toBe(false);
  });

  it('keeps finance and reception payment access separate', () => {
    expect(appAllowed('company.dental.finance', 'admin', ['finance.manage'])).toBe(true);
    expect(appAllowed('company.dental.finance', 'reception', ['finance.manage'])).toBe(false);
    expect(appAllowed('company.dental.patient-payments', 'reception', ['patient_payments.outstanding.read'])).toBe(true);
    expect(appAllowed('company.dental.patient-payments', 'doctor', ['patient_payments.outstanding.read'])).toBe(false);
  });

  it('rejects broker responses that contain upload handles or credentials', () => {
    expect(containsPresignedHandle({ upload: { uploadUrl: 'https://signed.example/temporary' } })).toBe(true);
    expect(containsPresignedHandle({ profile: { refreshToken: 'secret' } })).toBe(true);
    expect(containsPresignedHandle({ payment: { amount: 50, status: 'received' } })).toBe(false);
  });
});
