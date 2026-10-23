import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readText = async (relative) => (await readFile(path.join(root, relative))).toString("utf8");
const readJson = async (relative) => JSON.parse(await readText(relative));

const modules = [
  "transaction-record",
  "patient-payments",
  "general-expenses",
  "salary-payments",
  "product-list",
  "purchases",
  "supplier-list",
  "supplier-payments",
];

test("Finance M17 has one 1.7.0 package with all eight ordered Finance modules", async () => {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("app.manifest.json");
  const app = await readJson("app.json");

  assert.equal(packageJson.name, "company.dental.finance.m17");
  assert.equal(packageJson.version, "1.7.0");
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.capabilities, ["clinic.app.finance", "clinic.api.request", "session.context"]);
  assert.equal(app.appId, packageJson.name);
  assert.equal(app.title, "Finance");
  assert.deepEqual(app.modules.map((module) => module.id), modules);
  assert.deepEqual(app.anyCapabilities, ["finance.manage", "patient_payments.outstanding.read"]);
});

test("only Product and Supplier detail pages enter shared app-window history", async () => {
  const main = await readText("src/main.tsx");
  const product = await readText("src/features/finance/product-list/ProductListWorkspace.tsx");
  const supplier = await readText("src/features/finance/supplier-list/SupplierListWorkspace.tsx");

  assert.match(main, /sdk\.createHistory<FinancePage>/);
  assert.match(main, /history\.push\(\{ moduleId: "product-list", screen: "product-detail", productId \}\)/);
  assert.match(main, /history\.push\(\{ moduleId: "supplier-list", screen: "supplier-detail", supplierId \}\)/);
  assert.match(main, /history\.reset\(mainPage\(selected\)\)/);
  assert.match(main, /financeNavigationLocked/);
  assert.doesNotMatch(main, /window\.history|popstate|location\.hash/);
  assert.match(product, /onOpenProduct/);
  assert.match(supplier, /onOpenSupplier/);
});

test("Finance business API adapters stay behind ClinicClient and the supported SDK", async () => {
  const features = path.join(root, "src/features/finance");
  const sourceFiles = [];
  const visit = async (directory) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name);
      if (item.isDirectory()) await visit(full);
      else if (item.isFile() && item.name.endsWith("api.ts")) sourceFiles.push(full);
    }
  };
  await visit(features);
  assert.equal(sourceFiles.length, 7);

  const sources = await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")));
  const combined = sources.join("\n");
  assert.match(combined, /client\.read/);
  assert.match(combined, /client\.command/);
  assert.match(combined, /\/v1\/clinic\/transaction-record/);
  assert.match(combined, /\/v1\/patient-payments/);
  assert.match(combined, /\/v1\/clinic\/operating-expenses/);
  assert.match(combined, /\/v1\/clinic\/salary-payouts/);
  assert.match(combined, /\/v1\/clinic\/products/);
  assert.match(combined, /\/v1\/clinic\/purchases/);
  assert.match(combined, /\/v1\/clinic\/suppliers/);
  assert.match(combined, /\/v1\/clinic\/supplier-payments/);
  assert.doesNotMatch(combined, /\bfetch\s*\(|XMLHttpRequest|authorization|access_token|refresh_token/);
});
