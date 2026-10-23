// Private synthetic M17 Treatment Progress host. Never packaged or used by normal Dental OS.
const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { generateKeyPairSync, sign } = require("node:crypto");

process.on("uncaughtException", error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); });
process.on("unhandledRejection", error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY ||
  path.join(process.env.XDG_RUNTIME_DIR || "", process.env.WAYLAND_DISPLAY || "") !== process.env.ELECTRON_OS_TEST_DISPLAY) {
  throw Error("Private display required");
}

const root = path.resolve(__dirname, "../..");
const { FixtureRuntime } = require(path.join(root, "dist-electron/runtime/manager.js"));
const { PackageRegistry } = require(path.join(root, "dist-electron/packages/registry.js"));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, "dist-electron/packages/format.js"));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, "dist-electron/distribution/updatePolicy.js"));
const { verifyCatalogue, noWatermark } = require(path.join(root, "dist-electron/distribution/catalogue.js"));
const { clinicRequestAllowed } = require(path.join(root, "dist-electron/sdk/appPolicy.js"));
protocol.registerSchemesAsPrivileged([{ scheme: "dental-fixture", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = "company.dental.treatment-progress.m17";
const tenantId = "11111111-1111-4111-8111-111111111111";
const appFamily = "clinic.app.treatment-progress";
const rows = [
  { patientId: tenantId, patientNumber: "TP-0001", fullName: "Sita Rai", planTitle: "Root canal, crown restoration, and follow-up treatment plan", completedStages: 1, totalStages: 3, doctorNames: ["Dr. Anisha Rai", "Dr. Bimal Shrestha"], outstandingDue: 1500, nextReturnOn: "2026-10-25" },
  { patientId: "22222222-2222-4222-8222-222222222222", patientNumber: "TP-0002", fullName: "Maya Gurung", planTitle: "Crown restoration", completedStages: 3, totalStages: 4, doctorNames: ["Dr. Anisha Rai"], outstandingDue: 0, nextReturnOn: null },
  { patientId: "33333333-3333-4333-8333-333333333333", patientNumber: "TP-0003", fullName: "Nabin Lama", planTitle: "Dental review", completedStages: 0, totalStages: 2, doctorNames: [], outstandingDue: 2500, nextReturnOn: "2026-10-28" },
  ...Array.from({ length: 9 }, (_, index) => ({
    patientId: (index + 4).toString().padStart(8, "0") + "-4444-4444-8444-444444444444",
    patientNumber: "TP-" + (index + 4).toString().padStart(4, "0"),
    fullName: "Synthetic Patient " + (index + 4).toString().padStart(2, "0"),
    planTitle: "Routine treatment plan",
    completedStages: index % 2,
    totalStages: 2,
    doctorNames: index % 2 ? ["Dr. Bimal Shrestha"] : ["Dr. Anisha Rai"],
    outstandingDue: index % 2 ? 0 : 1000,
    nextReturnOn: index % 2 ? null : "2026-11-02",
  })),
];

const calls = [];
const generation = { value: 1 };
const active = { value: true };
const deniedRole = process.env.M17_DENY_ROLE === "1";
const capabilities = deniedRole ? [] : ["treatment_progress.access"];
let responseRows = rows.map(row => ({ ...row, doctorNames: [...row.doctorNames] }));
let failNext = false;
let invalidNext = false;
let effects = 0;
let runtime;
let win;
const moduleAcks = [];
let moduleSelectionResult;

global.fetch = async (url, init) => {
  const parsed = new URL(url);
  const headers = new Headers(init.headers);
  if (headers.get("authorization") !== "Bearer synthetic-m17-treatment-progress") throw Error("Missing host credential");
  calls.push({ path: parsed.pathname + parsed.search, method: init.method });
  if (init.method !== "GET" || parsed.pathname !== "/v1/treatment-progress") {
    return Response.json({ code: "not_found" }, { status: 404 });
  }
  effects++;
  if (failNext) {
    failNext = false;
    return Response.json({ code: "synthetic_unavailable" }, { status: 503 });
  }
  if (invalidNext) {
    invalidNext = false;
    return Response.json({ patients: [{ patientId: tenantId, fullName: "Malformed row" }] });
  }
  return Response.json({ patients: responseRows.map(row => ({ ...row, doctorNames: [...row.doctorNames] })) });
};

function collect(dir, relative = "") {
  const files = new Map();
  for (const item of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, item.name);
    if (item.isDirectory()) {
      for (const [file, data] of collect(dir, name)) files.set(file, data);
    } else {
      files.set(name, fs.readFileSync(path.join(dir, name)));
    }
  }
  return files;
}

app.whenReady().then(async () => {
  const source = path.join(root, "apps/dental-apps", appId);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "app.manifest.json"), "utf8"));
  const keys = generateKeyPairSync("ed25519");
  const keyId = "test-only-m17-treatment-progress";
  const trust = {
    keys: { [keyId]: { publisher: "company", publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString() } },
    apps: {},
    companyApps: { publisher: "company", capabilities: require(path.join(root, "dist-electron/sdk/contracts.js")).operations },
  };
  const bytes = buildPackage(manifest, collect(path.join(source, "dist")), keyId, keys.privateKey);
  const verifiedPackage = verifyPackage(bytes, trust);
  const digest = sha256(bytes);
  const now = Date.now();
  const stamp = { environment: "cloudfare-staging", channel: "staging", sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: verifiedPackage.release.digest, apiOperations: ["clinic.api.request"] };
  const catalogue = {
    format: 1,
    ...stamp,
    releases: [{
      id: appId, title: "Treatment Progress", description: "Private synthetic fixture", version: manifest.version,
      notes: "Test only", capabilities: manifest.capabilities, platforms: ["linux", "win32"], sdkMajor: 1, apiMajor: 1,
      objectKey: "releases/" + appId + "/" + manifest.version + "/" + digest + ".dentalpkg",
      packageSha256: digest, packageBytes: bytes.length, payloadDigest: verifiedPackage.release.digest,
      status: "approved", minimumVersion: "1.0.0",
    }],
  };
  const policy = {
    format: 2,
    ...stamp,
    revokedKeys: [],
    apps: [{ id: appId, capabilities: manifest.capabilities, minimumVersion: "1.0.0", revokedDigests: [], rollback: null, releases: [grant] }],
  };
  function signed(field, value, purpose) {
    return Buffer.from(canonical({
      [field]: value,
      keyId,
      signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), keys.privateKey).toString("base64"),
    }));
  }
  const verifiedCatalogue = verifyCatalogue(signed("catalogue", catalogue, "dental-os-catalogue"), trust, noWatermark, now).catalogue;
  const verifiedPolicy = verifyUpdatePolicy(signed("policy", policy, "dental-os-update-policy"), trust, noWatermark, now).policy;
  const registry = new PackageRegistry(path.join(app.getPath("userData"), "packages"), trust);
  registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue), () => true);
  registry.setApiGrantResolver(value => {
    const match = apiReleaseGrantForPackage(value, verifiedPolicy);
    return match && apiReleaseGrantMatchesCatalogue(value.manifest.appId, match, verifiedCatalogue)
      ? apiOperationsForPackage(value, verifiedPolicy)
      : [];
  });
  registry.install(bytes);
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL("data:text/html,<title>Private M17 Treatment Progress host</title>");

  const identity = {
    allowed: () => active.value,
    allowedClinicRequest: (family, route, method) => active.value && clinicRequestAllowed(family, deniedRole ? "reception" : "admin", capabilities, route, method),
    snapshot: () => ({
      generation: generation.value,
      active: active.value,
      userLabel: "Synthetic user",
      clinicLabel: "Synthetic clinic",
      clinicSession: {
        clinicUser: { clinicUserId: tenantId, displayName: "Synthetic user", role: deniedRole ? "reception" : "admin", capabilities: [...capabilities] },
        clinic: { tenantId, displayName: "Synthetic clinic", timezone: "Asia/Kathmandu", currency: "NPR", defaultBranchId: tenantId, hasActiveTrial: false },
        branches: [{ branchId: tenantId, branchCode: "SYN", name: "Synthetic branch" }],
      },
    }),
    credential: async () => "synthetic-m17-treatment-progress",
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, "dist-electron/runtime/appPreload.js"), identity, () => {}, { transport: "staging" });
  for (const kind of ["connect", "request", "cancel"]) {
    ipcMain.handle("sdk:" + kind, (event, input) => runtime.sdk(kind, event, input));
  }
  ipcMain.handle("runtime:app-info", event => runtime.appInfo(event));
  ipcMain.handle("runtime:open-explorer", event => runtime.openExplorer(event));
  ipcMain.on("runtime:report", (event, value) => runtime.report(event, value));
  ipcMain.on("runtime:module-selection-ack", (event, value) => {
    moduleAcks.push(value);
    runtime.acknowledgeModule(event, value);
  });
  global.m17 = {
    calls,
    rows: responseRows,
    effects: () => effects,
    failNext: () => { failNext = true; },
    invalidNext: () => { invalidNext = true; },
    setEmpty: () => { responseRows = []; },
    restoreRows: () => { responseRows = rows.map(row => ({ ...row, doctorNames: [...row.doctorNames] })); },
    updateFirstRow: () => {
      responseRows = responseRows.map((row, index) => index === 0
        ? { ...row, completedStages: 2, nextReturnOn: "2026-10-30" }
        : row);
    },
    module: async () => {
      moduleSelectionResult = await runtime.selectModule(appId, "treatment-progress");
      return moduleSelectionResult;
    },
    moduleAcks,
    moduleSelectionResult: () => moduleSelectionResult,
    package: {
      version: manifest.version,
      appId: manifest.appId,
      packageSha256: digest,
      payloadDigest: verifiedPackage.release.digest,
      wireBytes: bytes.length,
      assetCount: verifiedPackage.files.size,
    },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => {
  global.__m17Diagnostic = error instanceof Error ? error.stack : String(error);
  console.error("M17 PRIVATE HOST FAILED", global.__m17Diagnostic);
});

app.on("before-quit", () => runtime?.dispose());
app.on("window-all-closed", () => app.quit());
