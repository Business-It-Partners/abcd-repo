import { describe, expect, it } from 'vitest';
import { appInfo, parseDentalAppMetadata } from '../electron/packages/appMetadata';
import type { VerifiedPackage } from '../electron/packages/format';

const finance = {
  format: 1,
  appId: 'company.dental.finance',
  title: 'Finance',
  description: 'Clinic financial records.',
  icon: 'assets/finance.png',
  anyCapabilities: ['finance.manage', 'patient_payments.outstanding.read'],
  excludedRoles: ['reception'],
  allowedRoles: [],
  modules: [
    { id: 'transaction-record', label: 'Transaction Record', tab: 'finance/transactions', capability: 'finance.manage' },
    { id: 'patient-payments', label: 'Patient payments', tab: 'finance/patient-payments', capability: 'patient_payments.outstanding.read' },
  ],
};

function packageFor(metadata: typeof finance, includeIcon = true): VerifiedPackage {
  const icon = Buffer.from('png');
  const files = new Map([['app.json', Buffer.from(JSON.stringify(metadata))]]);
  if (includeIcon) files.set(metadata.icon, icon);
  return {
    manifest: { appId: metadata.appId },
    files,
  } as unknown as VerifiedPackage;
}

describe('signed app module metadata', () => {
  it('filters modules by the verified clinic capabilities and excludes Reception from Finance', () => {
    const pkg = packageFor(finance);
    const metadata = parseDentalAppMetadata(pkg);
    expect(metadata).toBeDefined();
    expect(appInfo(pkg, metadata, 'admin', ['finance.manage'])?.modules.map(module => module.id)).toEqual(['transaction-record']);
    expect(appInfo(pkg, metadata, 'reception', ['finance.manage', 'patient_payments.outstanding.read'])).toBeUndefined();
  });

  it('rejects metadata whose icon is not part of the signed package', () => {
    const pkg = packageFor({ ...finance, icon: 'assets/missing.png' }, false);
    expect(() => parseDentalAppMetadata(pkg)).toThrow('App icon is missing');
  });
});
