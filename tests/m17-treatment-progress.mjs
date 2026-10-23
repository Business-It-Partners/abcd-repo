import { profileArgs } from "./profile.mjs";
import { assertStandardPageScroll } from "./standard-page-scroll-test.mjs";
import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const hostApp = path.join(root, "tests/fixtures/m17-treatment-progress-app.cjs");
const appUrlPrefix = "dental-fixture://company.dental.treatment-progress.m17/";
const env = { ...process.env };
for (const key of ["ELECTRON_RUN_AS_NODE", "DEBUG", "PWDEBUG", "M17_DENY_ROLE"]) delete env[key];
const stamp = new Date().toISOString().replaceAll(":", "-");
const reportPath = path.join(root, "artifacts", "m17-treatment-progress-private-" + stamp + ".json");
const screenshotPath = path.join(root, "artifacts", "m17-treatment-progress-private-" + stamp + ".png");
const checks = [];
const errors = [];
const hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log("PASS", label); };
let app;
let deniedApp;
let deniedProfile;
let failure;
let packageInfo;
let screenshotWritten = false;
let passed = false;

const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith(appUrlPrefix));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Treatment Progress guest did not open. Pages: " + target.context().pages().map(item => item.url()).join(", "));
};

const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17.calls.map(({ path, method }) => ({ path, method })),
  effects: globalThis.m17.effects(),
  rows: globalThis.m17.rows.map(row => ({ patientNumber: row.patientNumber, completedStages: row.completedStages, totalStages: row.totalStages })),
  moduleAcks: globalThis.m17.moduleAcks.slice(),
  moduleSelectionResult: globalThis.m17.moduleSelectionResult(),
  package: globalThis.m17.package,
}));

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on("data", chunk => hostLogs.push(String(chunk)));
  const page = await waitForGuest(app);
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await page.getByRole("heading", { name: "Treatment Progress", exact: true }).waitFor();
  const tableMetrics = await page.locator("[data-sajilo-standard-table]").evaluate(table => {
    const wrap = table.parentElement;
    return wrap ? { clientWidth: wrap.clientWidth, scrollWidth: wrap.scrollWidth, tableWidth: table.getBoundingClientRect().width } : null;
  });
  check("Treatment Progress table fits the viewport without horizontal scrolling",
    !!tableMetrics && tableMetrics.clientWidth > 0 && tableMetrics.scrollWidth <= tableMetrics.clientWidth + 1 && tableMetrics.tableWidth <= tableMetrics.clientWidth + 1);
  await assertStandardPageScroll(page, check, "Treatment Progress");
  await page.getByText("Sita Rai", { exact: true }).waitFor();
  await page.getByRole("status", { name: "Opening treatment progress…" }).waitFor({ state: "detached" });
  check("initial loading overlay clears after the server projection is ready");
  packageInfo = (await inspect(app)).package;
  check("ephemeral package signature carries the app ID and version 1.0.5", packageInfo.appId === "company.dental.treatment-progress.m17" && packageInfo.version === "1.0.5");
  check("renderer receives only the current SDK bridge methods and no credential getter", await page.evaluate(() => Object.keys(window.dentalApp).sort().join(",") === "cancel,connect,getAppInfo,navigation,onFilesReceived,onModuleSelected,openAppExplorer,report,request"));
  const initial = await inspect(app);
  check("initial projection uses only the permitted GET treatment-progress route", initial.calls.length === 1 && initial.calls[0].path === "/v1/treatment-progress" && initial.calls[0].method === "GET");
  const sitaRow = page.getByRole("row").filter({ hasText: "Sita Rai" });
  const mayaRow = page.getByRole("row").filter({ hasText: "Maya Gurung" });
  check("Doctors is removed from the table while the doctor filter remains available",
    await page.getByRole("columnheader", { name: "Doctors", exact: true }).count() === 0 &&
    await page.getByRole("combobox", { name: "Filter by doctor" }).isVisible());
  check("long treatment plans wrap to two lines and stay clamped there", await sitaRow.locator(".tprogressPlan").evaluate(element => {
    const style = getComputedStyle(element);
    const height = element.getBoundingClientRect().height;
    const lineHeight = parseFloat(style.lineHeight);
    return style.webkitLineClamp === "2" && height > lineHeight * 1.4 && height <= lineHeight * 2.1;
  }));
  check("partial completion, balance, and next return render from the server projection",
    await sitaRow.getByText("1 / 3 done", { exact: true }).isVisible() &&
    await sitaRow.getByText("2 remaining", { exact: true }).count() === 0 &&
    await sitaRow.locator("progress").count() === 0 &&
    await sitaRow.getByText(/1,500/).isVisible() &&
    await sitaRow.getByText("25 Oct 2026", { exact: true }).isVisible());
  check("completed work is shown inside an incomplete plan and zero balance is cleared",
    await mayaRow.getByText("3 / 4 done", { exact: true }).isVisible() &&
    await mayaRow.getByText("Cleared", { exact: true }).isVisible());
  check("patients remain worklist rows and do not expose an unapproved patient-detail action",
    await page.getByRole("row").filter({ hasText: "Sita Rai" }).getByRole("button").count() === 0);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: "wx" });
  screenshotWritten = true;

  await app.evaluate(() => globalThis.m17.module());
  for (let attempt = 0; attempt < 40 && !(await inspect(app)).moduleAcks.length; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  const module = await inspect(app);
  check("Treatment Progress module selection is acknowledged after app readiness", module.moduleSelectionResult?.ok === true && module.moduleAcks.length === 1);

  const search = page.getByRole("searchbox", { name: "Search patients, record IDs, treatment plans, or doctors" });
  await search.fill("TP-0002");
  check("search matches patient record IDs", await page.getByRole("row").filter({ hasText: "Maya Gurung" }).isVisible() && !(await page.getByRole("row").filter({ hasText: "Sita Rai" }).isVisible()));
  await search.fill("Dr. Bimal");
  check("search also matches assigned doctor names", await page.getByRole("row").filter({ hasText: "Sita Rai" }).isVisible());
  await search.fill("");
  const doctor = page.getByRole("combobox", { name: "Filter by doctor" });
  await doctor.selectOption({ label: "Dr. Anisha Rai" });
  check("doctor filter keeps rows assigned to the selected clinician", await page.getByRole("row").filter({ hasText: "Maya Gurung" }).isVisible() && !(await page.getByRole("row").filter({ hasText: "Nabin Lama" }).isVisible()));
  await doctor.selectOption("all");

  check("table pagination bounds the rendered rows while retaining all 12 projection rows",
    await page.getByRole("row").count() === 11 && (await page.getByRole("button", { name: "Next" }).isEnabled()));
  await page.getByRole("button", { name: "Next" }).click();
  check("second page renders the remaining two records", await page.getByRole("row").filter({ hasText: "Synthetic Patient 12" }).isVisible() && await page.getByRole("row").filter({ hasText: "Synthetic Patient 03" }).count() === 0);

  await app.evaluate(() => globalThis.m17.updateFirstRow());
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByText("Treatment Progress is up to date.", { exact: true }).waitFor();
  check("refresh reloads the server projection and replaces stage counts", (await inspect(app)).calls.length === 2);
  await page.getByRole("button", { name: "Previous" }).click();
  check("refreshed projection reflects a corrected stage count and return date",
    await page.getByText("2 / 3 done", { exact: true }).isVisible() &&
    await page.getByText("30 Oct 2026", { exact: true }).isVisible());

  await app.evaluate(() => globalThis.m17.setEmpty());
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByText("Treatment Progress is up to date.", { exact: true }).waitFor();
  check("empty server projection shows a clear no-incomplete-plans state", await page.getByText("No active, incomplete treatment plans were found.", { exact: true }).isVisible());

  await app.evaluate(() => globalThis.m17.restoreRows());
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByText("Treatment Progress is up to date.", { exact: true }).waitFor();
  await page.getByRole("row").filter({ hasText: "Sita Rai" }).waitFor();
  await app.evaluate(() => globalThis.m17.failNext());
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByRole("alert").getByText(/temporarily unavailable|unavailable|invalid response|could not/i).waitFor();
  check("failed refresh clears the old projection so stale patient rows are not presented as current",
    await page.getByRole("row").filter({ hasText: "Sita Rai" }).count() === 0);
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByText("Treatment Progress is up to date.", { exact: true }).waitFor();
  check("a later successful refresh recovers from the Worker error", await page.getByRole("row").filter({ hasText: "Sita Rai" }).isVisible());

  await app.evaluate(() => globalThis.m17.invalidNext());
  await page.getByRole("button", { name: "Refresh Treatment Progress", exact: true }).click();
  await page.getByRole("alert").getByText(/invalid patient row/i).waitFor();
  check("malformed projection is rejected without rendering a partial clinic worklist", await page.getByRole("row").filter({ hasText: "Sita Rai" }).count() === 0);
  check("all successful data requests stayed read-only on the one approved route",
    (await inspect(app)).calls.every(call => call.method === "GET" && call.path === "/v1/treatment-progress"));
  check("all renderer errors stayed clear during the accepted workflow", errors.length === 0);
  await app.close();
  app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), "electron-os-m17-treatment-progress-role-"));
  const deniedEnv = { ...env, M17_DENY_ROLE: "1" };
  deniedApp = await electron.launch({ args: [hostApp, "--ozone-platform=wayland", "--user-data-dir=" + deniedProfile], env: deniedEnv, timeout: 30000 });
  deniedApp.process().stderr?.on("data", chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp);
  deniedPage.setDefaultTimeout(15000);
  deniedPage.on("pageerror", error => errors.push(error.message));
  await deniedPage.getByRole("heading", { name: "Treatment Progress unavailable", exact: true }).waitFor();
  check("host denies a session without treatment_progress.access before the business route is called",
    (await inspect(deniedApp)).calls.length === 0 && (await deniedPage.locator("[role=alert]").innerText()).includes("not available for the current clinic role"));
  check("role-denied view contains no patient data or renderer errors", !(await deniedPage.locator("body").innerText()).includes("Sita Rai") && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? error.name + ": " + error.message : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17Diagnostic ?? null, calls: globalThis.m17?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith(appUrlPrefix));
      if (targetPage) diagnostic.body = await targetPage.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? null);
      if (diagnostic.host) failure += "\nPrivate host: " + diagnostic.host;
      failure += "\nPrivate page diagnostic: " + JSON.stringify(diagnostic);
    } catch {}
  }
  if (hostLogs.length) failure += "\nPrivate host stderr: " + hostLogs.join("").slice(-6000);
  throw error;
} finally {
  if (app) await app.close();
  if (deniedApp) await deniedApp.close();
  if (deniedProfile) rmSync(deniedProfile, { recursive: true, force: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    passed,
    failure: failure ?? null,
    checks,
    errors,
    package: packageInfo,
    scope: "Private headless Electron acceptance with ephemeral test-only package signatures and synthetic in-memory projection. No clinic records, live staging, or publication.",
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null,
  }, null, 2), { flag: "wx" });
  console.log("ARTIFACT", reportPath);
  if (screenshotWritten) console.log("ARTIFACT", screenshotPath);
}
