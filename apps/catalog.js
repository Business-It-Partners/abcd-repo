const appIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const appVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const capabilityPattern = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
const iconPathPattern = /^\/assets\/dock\/[a-z0-9-]+\.webp$/;
const appAssetPathPattern = /^\/apps\/[a-z0-9.-]+\.(?:html|js|css)$/;
const apiTemplatePattern = /^\/v1\/(?:[a-z0-9-]+|\{uuid\})(?:\/(?:[a-z0-9-]+|\{uuid\}))*$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[a-f0-9]{64}$/;
const apiPathBase = "https://dental-os.invalid";

export const financeSessionCapabilities = Object.freeze([
  "finance.manage",
  "patient_payments.outstanding.read",
  "patient_payments.received.read",
  "patient_billing_ledger.read",
  "patient_payments.collect",
  "staff.manage",
]);

export const financeApiGrants = Object.freeze([
  { method: "GET", path: "/v1/clinic/transaction-record" },
  { method: "GET", path: "/v1/patient-payments" },
  { method: "GET", path: "/v1/patients/{uuid}/ledger" },
  { method: "POST", path: "/v1/patients/{uuid}/payments" },
  { method: "GET", path: "/v1/clinic/operating-expenses" },
  { method: "POST", path: "/v1/clinic/operating-expenses" },
  { method: "POST", path: "/v1/clinic/operating-expenses/{uuid}/correct" },
  { method: "POST", path: "/v1/clinic/operating-expenses/{uuid}/void" },
  { method: "GET", path: "/v1/clinic/salary-payouts" },
  { method: "POST", path: "/v1/clinic/salary-payouts" },
  { method: "POST", path: "/v1/clinic/salary-payouts/{uuid}/correct" },
  { method: "POST", path: "/v1/clinic/salary-payouts/{uuid}/void" },
  { method: "GET", path: "/v1/clinic/staff" },
  { method: "GET", path: "/v1/clinic/products" },
  { method: "POST", path: "/v1/clinic/products" },
  { method: "PATCH", path: "/v1/clinic/products/{uuid}" },
  { method: "GET", path: "/v1/clinic/purchases" },
  { method: "POST", path: "/v1/clinic/purchases" },
  { method: "POST", path: "/v1/clinic/purchases/{uuid}/correct" },
  { method: "POST", path: "/v1/clinic/purchases/{uuid}/void" },
  { method: "GET", path: "/v1/clinic/suppliers" },
  { method: "POST", path: "/v1/clinic/suppliers" },
  { method: "PATCH", path: "/v1/clinic/suppliers/{uuid}" },
  { method: "GET", path: "/v1/clinic/suppliers/{uuid}/statement" },
  { method: "GET", path: "/v1/clinic/supplier-payments" },
  { method: "POST", path: "/v1/clinic/supplier-payments" },
  { method: "POST", path: "/v1/clinic/supplier-payments/{uuid}/correct" },
  { method: "POST", path: "/v1/clinic/supplier-payments/{uuid}/void" },
]);

export const treatmentProgressApiGrants = Object.freeze([
  { method: "GET", path: "/v1/treatment-progress" },
]);

export const calendarApiGrants = Object.freeze([
  { method: "GET", path: "/v1/calendar-tasks" },
  { method: "POST", path: "/v1/calendar-tasks" },
  { method: "PATCH", path: "/v1/calendar-tasks/{uuid}" },
  { method: "POST", path: "/v1/calendar-tasks/{uuid}/archive" },
]);

const financeGrantKeys = new Set(financeApiGrants.map(({ method, path }) => `${method} ${path}`));
const treatmentProgressGrantKeys = new Set(treatmentProgressApiGrants.map(({ method, path }) => `${method} ${path}`));
const calendarGrantKeys = new Set(calendarApiGrants.map(({ method, path }) => `${method} ${path}`));
const protocolGrantKeys = new Set([
  "GET /v1/treatment-protocols",
  "POST /v1/treatment-protocols",
  "PUT /v1/treatment-protocols/{uuid}",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function hasRequiredAndOptionalKeys(value, required, optional = []) {
  return isRecord(value) && required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

function isLocalPath(path, pattern, baseOrigin) {
  if (typeof path !== "string" || !pattern.test(path) || path.includes("..") || path.includes("\\")) return false;
  try {
    const resolved = new URL(path, baseOrigin);
    return resolved.origin === new URL(baseOrigin).origin && resolved.pathname === path
      && !resolved.search && !resolved.hash;
  } catch {
    return false;
  }
}

function pathMatchesTemplate(template, pathname) {
  const expected = template.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => segment === "{uuid}"
    ? uuidPattern.test(actual[index])
    : segment === actual[index]);
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseRequestPath(path) {
  if (typeof path !== "string" || path.length < 1 || path.length > 1_024
    || !path.startsWith("/v1/") || path.includes("\\") || path.includes("#")) return null;
  const queryIndex = path.indexOf("?");
  if (queryIndex !== -1 && (queryIndex === path.length - 1 || path.indexOf("?", queryIndex + 1) !== -1)) return null;
  const rawPathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  try {
    const url = new URL(path, apiPathBase);
    if (url.origin !== apiPathBase || url.pathname !== rawPathname || url.hash) return null;
    return { pathname: url.pathname, searchParams: url.searchParams, hasQuery: queryIndex !== -1 };
  } catch {
    return null;
  }
}

function validFinanceQuery(grant, parsed) {
  const entries = [...parsed.searchParams.entries()];
  if (!parsed.hasQuery) return true;
  if (!entries.length || grant.method !== "GET") return false;
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) return false;
  const values = new Map(entries);
  if (grant.path === "/v1/clinic/transaction-record" || grant.path === "/v1/patient-payments") {
    return values.size === 2 && values.has("from") && values.has("to")
      && validIsoDate(values.get("from")) && validIsoDate(values.get("to"));
  }
  if (grant.path === "/v1/patients/{uuid}/ledger") {
    if ([...values.keys()].some((key) => !["month", "cursor"].includes(key))) return false;
    if (values.has("month") && !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(values.get("month"))) return false;
    if (values.has("cursor") && (values.get("cursor").length < 1 || values.get("cursor").length > 512
      || /[\u0000-\u001f\u007f]/.test(values.get("cursor")))) return false;
    return values.size > 0;
  }
  return false;
}

function validCalendarQuery(grant, parsed) {
  if (!parsed.hasQuery) return grant.method !== "GET";
  if (grant.method !== "GET" || grant.path !== "/v1/calendar-tasks") return false;
  const entries = [...parsed.searchParams.entries()];
  if (entries.length !== 2 || new Set(entries.map(([key]) => key)).size !== 2) return false;
  const values = new Map(entries);
  if (values.size !== 2 || !values.has("from") || !values.has("to")
    || !validIsoDate(values.get("from")) || !validIsoDate(values.get("to"))) return false;
  const start = Date.parse(`${values.get("from")}T00:00:00.000Z`);
  const end = Date.parse(`${values.get("to")}T00:00:00.000Z`);
  return start <= end && (end - start) / 86_400_000 <= 45;
}

function isAllowedGrantForApp(appId, method, path) {
  const key = `${method} ${path}`;
  if (appId === "finance") return financeGrantKeys.has(key);
  if (appId === "treatment") return treatmentProgressGrantKeys.has(key);
  if (appId === "calendar") return calendarGrantKeys.has(key);
  if (appId === "protocols") return protocolGrantKeys.has(key);
  return method === "GET" && !path.includes("{");
}

export function isValidAppDescriptor(app, baseOrigin) {
  const required = ["id", "title", "icon", "version", "capabilities", "bundle", "apiGrants"];
  if (!hasRequiredAndOptionalKeys(app, required, ["sessionCapabilities"])) return false;
  if (typeof app.id !== "string" || !appIdPattern.test(app.id)) return false;
  if (typeof app.title !== "string" || app.title.trim() !== app.title || app.title.length < 1 || app.title.length > 64) return false;
  if (!isLocalPath(app.icon, iconPathPattern, baseOrigin)) return false;
  if (typeof app.version !== "string" || !appVersionPattern.test(app.version)) return false;
  if (!Array.isArray(app.capabilities) || app.capabilities.length < 1 || app.capabilities.length > 16
    || !app.capabilities.every((capability) => typeof capability === "string" && capabilityPattern.test(capability))
    || new Set(app.capabilities).size !== app.capabilities.length) return false;
  if (Object.hasOwn(app, "sessionCapabilities")) {
    if (app.id !== "finance" || !Array.isArray(app.sessionCapabilities) || app.sessionCapabilities.length > 16
      || !app.sessionCapabilities.every((capability) => typeof capability === "string" && capabilityPattern.test(capability))
      || !app.sessionCapabilities.every((capability) => financeSessionCapabilities.includes(capability))
      || new Set(app.sessionCapabilities).size !== app.sessionCapabilities.length) return false;
  } else if (app.id === "finance") return false;
  if (!isRecord(app.bundle)) return false;
  const bundleKeys = Object.keys(app.bundle);
  const requiredBundleKeys = ["entry", "entrySha256", "script", "scriptSha256"];
  if (!requiredBundleKeys.every((key) => Object.hasOwn(app.bundle, key))
    || bundleKeys.some((key) => ![...requiredBundleKeys, "style", "styleSha256"].includes(key))
    || (Object.hasOwn(app.bundle, "style") !== Object.hasOwn(app.bundle, "styleSha256"))) return false;
  if (!isLocalPath(app.bundle.entry, appAssetPathPattern, baseOrigin)
    || !app.bundle.entry.endsWith(".html")) return false;
  if (!isLocalPath(app.bundle.script, appAssetPathPattern, baseOrigin)
    || !app.bundle.script.endsWith(".js")) return false;
  if (typeof app.bundle.entrySha256 !== "string" || !sha256Pattern.test(app.bundle.entrySha256)
    || typeof app.bundle.scriptSha256 !== "string" || !sha256Pattern.test(app.bundle.scriptSha256)) return false;
  if (Object.hasOwn(app.bundle, "style")
    && (!isLocalPath(app.bundle.style, appAssetPathPattern, baseOrigin) || !app.bundle.style.endsWith(".css")
      || typeof app.bundle.styleSha256 !== "string" || !sha256Pattern.test(app.bundle.styleSha256))) return false;
  if (!Array.isArray(app.apiGrants) || app.apiGrants.length > 32) return false;
  const seenGrants = new Set();
  for (const grant of app.apiGrants) {
    if (!hasOnlyKeys(grant, ["method", "path"]) || !["GET", "POST", "PUT", "PATCH"].includes(grant.method)
      || typeof grant.path !== "string" || !apiTemplatePattern.test(grant.path)
      || grant.path.includes("..") || grant.path.includes("\\")
      || !isAllowedGrantForApp(app.id, grant.method, grant.path)) return false;
    const key = `${grant.method} ${grant.path}`;
    if (seenGrants.has(key)) return false;
    seenGrants.add(key);
  }
  return true;
}

export function isValidAppCatalog(appCatalog, baseOrigin) {
  if (!Array.isArray(appCatalog) || appCatalog.length < 1 || appCatalog.length > 32) return false;
  const ids = new Set();
  for (const app of appCatalog) {
    if (!isValidAppDescriptor(app, baseOrigin) || ids.has(app.id)) return false;
    ids.add(app.id);
  }
  return true;
}

export function visibleAppsForCapabilities(appCatalog, rawCapabilities) {
  if (!Array.isArray(rawCapabilities)) return [];
  const capabilities = new Set(rawCapabilities.filter((capability) => typeof capability === "string"));
  return appCatalog.filter((app) => Array.isArray(app.capabilities)
    && app.capabilities.some((capability) => capabilities.has(capability)));
}

export function findAppApiGrant(app, method, path) {
  if (typeof method !== "string") return null;
  const parsed = parseRequestPath(path);
  if (!parsed) return null;
  const grant = app?.apiGrants?.find((candidate) => candidate.method === method
    && pathMatchesTemplate(candidate.path, parsed.pathname));
  if (!grant) return null;
  if (app.id === "finance" && !validFinanceQuery(grant, parsed)) return null;
  if (app.id === "calendar" && !validCalendarQuery(grant, parsed)) return null;
  if (!['finance', 'calendar'].includes(app.id) && parsed.hasQuery) return null;
  return grant;
}
