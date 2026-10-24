import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appJson = JSON.parse(fs.readFileSync(path.join(app, "app.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(app, "app.manifest.json"), "utf8"));
const source = JSON.parse(fs.readFileSync(path.join(app, "SOURCE_IMPORT.json"), "utf8"));

test("M17 package has its own first-release identity and one Treatment Progress family", () => {
  assert.equal(appJson.appId, "company.dental.treatment-progress.m17");
  assert.equal(manifest.appId, appJson.appId);
  assert.equal(manifest.version, "1.0.6");
  assert.equal(JSON.parse(fs.readFileSync(path.join(app, "package.json"), "utf8")).version, manifest.version);
  assert.deepEqual(manifest.capabilities, [
    "clinic.app.treatment-progress",
    "clinic.api.request",
    "session.context",
  ]);
  assert.deepEqual(appJson.anyCapabilities, ["treatment_progress.access"]);
});

test("source ledger pins the SaaS workflow and projection before implementation", () => {
  assert.equal(source.repository, "Business-It-Partners/dental-saas");
  assert.equal(source.revision, "f0d059d36540b4b6907cace089085ce0df62d454");
  assert.ok(source.imports.some((item) => item.source.endsWith("TreatmentProgressWorkspace.tsx")));
  assert.ok(source.contractSources.some((item) => item.source.endsWith("patientCare.repository.ts")));
});

test("app uses the brokered route and keeps patient record navigation outside this app", () => {
  const main = fs.readFileSync(path.join(app, "src/main.tsx"), "utf8");
  assert.match(main, /\/v1\/treatment-progress/);
  assert.doesNotMatch(main, /header: "Doctors"/);
  assert.match(main, /new ClinicClient/);
  assert.doesNotMatch(main, /window\.fetch|fetch\s*\(/);
  assert.doesNotMatch(main, /onOpenPatient|navigateToPatient/);
});

test("long treatment plan labels wrap within a two-line clamp", () => {
  const styles = fs.readFileSync(path.join(app, "src/styles.css"), "utf8");
  assert.match(styles, /\.tprogressPlan\s*\{[^}]*-webkit-line-clamp:\s*2/s);
  assert.match(styles, /\.tprogressPlan\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});
