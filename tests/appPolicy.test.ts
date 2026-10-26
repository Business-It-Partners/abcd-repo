import { describe, expect, it } from 'vitest';
import { allowedClinicApiPath, appAllowed, clinicAppFamily, containsPresignedHandle } from '../electron/sdk/appPolicy';

describe('first-party clinic app API policy', () => {
  it('selects one supported app family from signed package capabilities', () => {
    expect(clinicAppFamily(['clinic.app.followups', 'clinic.api.request'])).toBe('clinic.app.followups');
    expect(clinicAppFamily(['clinic.app.followups', 'clinic.app.appointments'])).toBeUndefined();
    expect(clinicAppFamily(['clinic.api.request'])).toBeUndefined();
  });

  it('limits Follow-ups to the methods and exact records its screen uses', () => {
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/follow-ups', 'GET')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/follow-ups', 'POST')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/follow-ups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/toggle', 'PATCH')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/follow-ups/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/schedule', 'PATCH')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/patients?q=Udayaraj&limit=8', 'GET')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/clinic/staff-references', 'GET')).toBe(true);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/patients', 'GET')).toBe(false);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/patients?q=Udayaraj&limit=100', 'GET')).toBe(false);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/patients/123', 'GET')).toBe(false);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/appointments/123/status', 'PATCH')).toBe(false);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/follow-ups-elsewhere', 'GET')).toBe(false);
    expect(allowedClinicApiPath('clinic.app.followups', '/v1/dental-os/catalogue', 'GET')).toBe(false);
  });

  it('allows Finance for users with finance or patient-payment capability', () => {
    expect(appAllowed('clinic.app.finance', 'admin', ['finance.manage'])).toBe(true);
    expect(appAllowed('clinic.app.finance', 'reception', ['patient_payments.outstanding.read'])).toBe(true);
    expect(appAllowed('clinic.app.finance', 'reception', [])).toBe(false);
    expect(appAllowed('clinic.app.patient-payments', 'reception', ['patient_payments.outstanding.read'])).toBe(true);
    expect(appAllowed('clinic.app.patient-payments', 'doctor', ['patient_payments.outstanding.read'])).toBe(false);
  });

  it('rejects broker responses that contain upload handles or credentials', () => {
    expect(containsPresignedHandle({ upload: { uploadUrl: 'https://signed.example/temporary' } })).toBe(true);
    expect(containsPresignedHandle({ profile: { refreshToken: 'secret' } })).toBe(true);
    expect(containsPresignedHandle({ payment: { amount: 50, status: 'received' } })).toBe(false);
    let deep: unknown = { authorization: 'secret' };
    for (let i = 0; i < 14; i++) deep = { nested: deep };
    expect(containsPresignedHandle(deep)).toBe(true);
  });
});
