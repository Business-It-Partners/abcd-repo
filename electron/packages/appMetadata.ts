import type { VerifiedPackage } from './format';

export type DentalAppModule = Readonly<{ id: string; label: string; tab: string; capability: string }>;
export type DentalAppMetadata = Readonly<{
  format: 1;
  appId: string;
  title: string;
  description: string;
  icon: string;
  anyCapabilities: readonly string[];
  excludedRoles: readonly ('admin' | 'doctor' | 'reception')[];
  allowedRoles: readonly ('admin' | 'doctor' | 'reception')[];
  modules: readonly DentalAppModule[];
  /** App content width needed to show its widest primary table without horizontal scrolling. */
  preferredContentWidth?: number;
}>;
export type DentalAppInfo = Readonly<{
  appId: string;
  title: string;
  description: string;
  iconDataUrl: string;
  modules: readonly DentalAppModule[];
  preferredContentWidth?: number;
}>;

const roles = ['admin', 'doctor', 'reception'];
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const list = (value: unknown, allowed: readonly string[], max: number) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(item => typeof item === 'string' && allowed.includes(item));

type AppContent = Pick<VerifiedPackage, 'manifest' | 'files'>;

export function parseDentalAppMetadata(pkg: AppContent): DentalAppMetadata | undefined {
  const source = pkg.files.get('app.json');
  if (!source) return undefined;
  let value: any;
  try { value = JSON.parse(source.toString('utf8')); } catch { throw new Error('Invalid app metadata JSON'); }
  const keys = ['format', 'appId', 'title', 'description', 'icon', 'anyCapabilities', 'excludedRoles', 'allowedRoles', 'modules'].sort();
  const keysWithWidth = [...keys, 'preferredContentWidth'].sort();
  const actualKeys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort().join() : '';
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (actualKeys !== keys.join() && actualKeys !== keysWithWidth.join())) throw new Error('Invalid app metadata shape');
  if (value.format !== 1 || value.appId !== pkg.manifest.appId || !text(value.title, 80) || !text(value.description, 300) || !text(value.icon, 120) || !/^assets\/[a-z0-9][a-z0-9._/-]*\.(png|svg)$/.test(value.icon)) throw new Error('Invalid app metadata identity');
  if (value.preferredContentWidth !== undefined && (!Number.isSafeInteger(value.preferredContentWidth) || value.preferredContentWidth < 520 || value.preferredContentWidth > 2400)) throw new Error('Invalid app content width');
  if (!Array.isArray(value.anyCapabilities) || value.anyCapabilities.length < 1 || value.anyCapabilities.length > 10 || new Set(value.anyCapabilities).size !== value.anyCapabilities.length || !value.anyCapabilities.every((v: unknown) => text(v, 100) && /^[a-z][a-z0-9_.-]*$/.test(v))) throw new Error('Invalid app visibility policy');
  if (!list(value.excludedRoles, roles, 3) || !list(value.allowedRoles, roles, 3) || value.excludedRoles.some((v: string) => value.allowedRoles.includes(v))) throw new Error('Invalid app role policy');
  if (!Array.isArray(value.modules) || value.modules.length < 1 || value.modules.length > 8) throw new Error('Invalid app modules');
  const seen = new Set<string>();
  for (const module of value.modules) {
    if (!module || typeof module !== 'object' || Array.isArray(module) || Object.keys(module).sort().join() !== 'capability,id,label,tab' || !text(module.id, 64) || !/^[a-z0-9][a-z0-9-]*$/.test(module.id) || !text(module.label, 80) || !text(module.tab, 80) || !/^[a-z0-9/-]+$/.test(module.tab) || !text(module.capability, 100) || !/^[a-z][a-z0-9_.-]*$/.test(module.capability) || seen.has(module.id)) throw new Error('Invalid app module');
    seen.add(module.id);
  }
  if (!pkg.files.has(value.icon)) throw new Error('App icon is missing');
  return value as DentalAppMetadata;
}

export function appInfo(pkg: AppContent, metadata = parseDentalAppMetadata(pkg), role?: string, capabilities: readonly string[] = []): DentalAppInfo | undefined {
  if (!metadata) return undefined;
  if (metadata.allowedRoles.length && (!role || !metadata.allowedRoles.includes(role as 'admin' | 'doctor' | 'reception'))) return undefined;
  if (metadata.excludedRoles.includes(role as 'admin' | 'doctor' | 'reception') || !metadata.anyCapabilities.some(capability => capabilities.includes(capability))) return undefined;
  const modules = metadata.modules.filter(module => capabilities.includes(module.capability));
  if (!modules.length) return undefined;
  const icon = pkg.files.get(metadata.icon)!;
  const mime = metadata.icon.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  return { appId: metadata.appId, title: metadata.title, description: metadata.description, iconDataUrl: `data:${mime};base64,${icon.toString('base64')}`, modules,
    ...(metadata.preferredContentWidth !== undefined ? { preferredContentWidth: metadata.preferredContentWidth } : {}) };
}
