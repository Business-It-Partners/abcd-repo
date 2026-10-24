import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = async (relative) => (await readFile(path.join(root, relative))).toString("utf8");
const readJson = async (relative) => JSON.parse(await readText(relative));

test("Staff M17 has its own 1.0.3 update package and exact first-party capability set", async () => {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("app.manifest.json");
  const app = await readJson("app.json");

  assert.equal(packageJson.name, "company.dental.staff.m17");
  assert.equal(packageJson.version, "1.0.3");
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.capabilities, [
    "clinic.app.staff",
    "clinic.api.request",
    "session.context",
    "clinic.media.read",
    "clinic.media.upload",
  ]);
  assert.equal(app.appId, packageJson.name);
  assert.equal(app.title, "Staff");
  assert.deepEqual(app.modules.map((module) => module.id), ["staff"]);
  assert.deepEqual(app.anyCapabilities, ["staff.manage"]);
});

test("Staff directory and filtered detail tables use Standard Window 1 without replacing other tabs", async () => {
  const directory = await readText("src/features/staff/components/StaffDirectory.tsx");
  const detail = await readText("src/features/staff/components/StaffDetailPage.tsx");
  assert.match(directory, /<Page sheet standardPage>/);
  assert.match(directory, /noun="staff members"[\s\S]*?standardPage[\s\S]*?filters=/);
  assert.match(detail, /standardPage=\{activeTab === "work" \|\| activeTab === "salary"\}/);
  assert.ok((detail.match(/standardPage/g) ?? []).length >= 3);
  assert.match(detail, /filters=\{/);
});

test("Staff screens remove redundant empty-state and summary captions", async () => {
  const directory = await readText("src/features/staff/components/StaffDirectory.tsx");
  const detail = await readText("src/features/staff/components/StaffDetailPage.tsx");

  assert.doesNotMatch(directory, /Build your care team|Start with the people who keep the clinic moving|staffEmptySteps/);
  assert.doesNotMatch(detail, /Current staff profile value|recorded payment\{|Included in recorded totals|Voided entries remain visible|Files attached to this staff profile/);
});

test("Staff profile detail uses shared app-window history with modal and dirty guards", async () => {
  const main = await readText("src/main.tsx");
  const directory = await readText("src/features/staff/components/StaffDirectory.tsx");
  const detail = await readText("src/features/staff/components/StaffDetailPage.tsx");

  assert.match(main, /clinicClient\.createHistory<StaffPage>/);
  assert.match(main, /history\.push\(\{ moduleId: "staff", screen: "profile", staffId \}\)/);
  assert.match(main, /!lifecycleRef\.current\.dirty && !lifecycleRef\.current\.modal/);
  assert.match(main, /history\.reset\(directoryPage\(\)\)/);
  assert.doesNotMatch(main, /window\.history|popstate|location\.hash/);
  assert.match(directory, /onOpenStaff/);
  assert.match(detail, /mediaCapabilities\.includes\("clinic\.media\.read"\)/);
  assert.match(detail, /mediaCapabilities\.includes\("clinic\.media\.upload"\)/);
});

test("Staff profile relies on window Back/Forward without a duplicate page Back button", async () => {
  const detail = await readText("src/features/staff/components/StaffDetailPage.tsx");
  assert.doesNotMatch(detail, /back=\{\{/);
  assert.doesNotMatch(detail, /Staff list/);
});

test("Staff reads and writes use ClinicClient and private documents use exact SDK media operations", async () => {
  const api = await readText("src/features/staff/api.ts");
  const media = await readText("src/features/staff/documentMedia.ts");
  const main = await readText("src/main.tsx");

  assert.match(api, /client\.read<unknown>\("\/v1\/clinic\/staff"\)/);
  assert.match(api, /client\.command\("POST", "\/v1\/clinic\/staff"/);
  assert.match(api, /\/clinical-work/);
  assert.match(api, /\/v1\/clinic\/salary-payouts/);
  assert.match(api, /\/documents/);
  assert.match(media, /"clinic\.media\.read" \| "clinic\.media\.upload"/);
  assert.match(media, /this\.request<unknown>\("clinic\.media\.read"/);
  assert.match(media, /this\.request<unknown>\("clinic\.media\.upload"/);
  assert.match(main, /initialize\(APP_ID\)/);
  assert.doesNotMatch(`${api}\n${media}\n${main}`, /\bfetch\s*\(|XMLHttpRequest|authorization|access_token|refresh_token|window\.desktop/);
});
