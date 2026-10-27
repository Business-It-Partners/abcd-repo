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

test("Finance M17 has one 1.7.16 package with all eight ordered Finance modules", async () => {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("app.manifest.json");
  const app = await readJson("app.json");

  assert.equal(packageJson.name, "company.dental.finance.m17");
  assert.equal(packageJson.version, "1.7.16");
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.capabilities, ["clinic.app.finance", "clinic.api.request", "session.context"]);
  assert.equal(app.appId, packageJson.name);
  assert.equal(app.title, "Finance");
  assert.deepEqual(app.modules.map((module) => module.id), modules);
  assert.deepEqual(app.anyCapabilities, ["finance.manage", "patient_payments.outstanding.read"]);
  assert.deepEqual(app.excludedRoles, []);
  assert.deepEqual(app.allowedRoles, []);
  assert.equal(app.modules.find((module) => module.id === "patient-payments").capability, "patient_payments.outstanding.read");
});

test("purchase invoice lines omit pagination and support row-based keyboard entry", async () => {
  const purchaseForm = await readText("src/features/finance/purchases/PurchaseForm.tsx");
  const styles = await readText("src/styles.css");

  assert.match(purchaseForm, /paginate=\{false\}/);
  assert.match(purchaseForm, /<PageHeader title=\{purchase \? "Correct purchase invoice" : "New purchase"\} \/>/);
  assert.doesNotMatch(purchaseForm, /purchase-add-line|Add item line/);
  assert.match(purchaseForm, /aria-label="Add invoice line"/);
  assert.match(purchaseForm, /ArrowDown[\s\S]*options\.length \+ 1/);
  assert.match(purchaseForm, /onAdvance=\{\(\) => focusLineField\(line\.key, "quantity"\)\}/);
  assert.match(purchaseForm, /if \(field === "quantity"\) \{ focusLineField\(key, "unit"\); return; \}/);
  assert.match(purchaseForm, /if \(field === "unit"\) \{ focusLineField\(key, "rate"\); return; \}/);
  assert.match(purchaseForm, /else addLine\(\);/);
  assert.match(styles, /\.purchase-add-row[^\n]*background: #16a34a/);
});

test("Finance delegates module identity and switching to the Dental OS window title bar", async () => {
  const main = await readText("src/main.tsx");
  const styles = await readText("src/styles.css");
  assert.doesNotMatch(main, /finance-app-toolbar|finance-active-module|finance-more-apps|openAppExplorer/);
  assert.doesNotMatch(styles, /\.finance-app-toolbar|#finance-active-module|\.finance-more-apps/);
  assert.match(main, /onModuleSelected/);
});

test("filterable Finance tables use the Standard Window 1 list-page contract", async () => {
  const views = [
    "src/features/finance/internal/components/TransactionRecordView.tsx",
    "src/features/finance/patient-payments/PatientPaymentsView.tsx",
    "src/features/finance/general-expenses/GeneralExpensesView.tsx",
    "src/features/finance/salary-payments/SalaryPaymentsView.tsx",
    "src/features/finance/product-list/ProductListView.tsx",
    "src/features/finance/product-list/ProductDrawer.tsx",
    "src/features/finance/purchases/PurchasesView.tsx",
    "src/features/finance/supplier-list/SupplierListView.tsx",
    "src/features/finance/supplier-list/SupplierDetailView.tsx",
    "src/features/finance/supplier-payments/SupplierPaymentsView.tsx",
  ];

  for (const view of views) {
    const source = await readText(view);
    assert.match(source, /<Page\s+sheet\s+standardPage/ , `${view} opts into Standard Window page scrolling`);
    assert.ok((source.match(/\bstandardPage\b/g) ?? []).length >= 2, `${view} renders its data table with pinned pagination`);
    assert.match(source, /filters=/, `${view} keeps its existing filters with the table`);
  }
});

test("Finance pages keep operational states but omit redundant page and summary captions", async () => {
  const purchases = await readText("src/features/finance/purchases/PurchasesView.tsx");
  const patientPayments = await readText("src/features/finance/patient-payments/PatientPaymentsView.tsx");
  const productDetail = await readText("src/features/finance/product-list/ProductDrawer.tsx");
  const supplierDetail = await readText("src/features/finance/supplier-list/SupplierDetailView.tsx");
  const transactionRecord = await readText("src/features/finance/internal/components/TransactionRecordView.tsx");

  assert.doesNotMatch(purchases, /purchase-loaded-count|full purchase list|response limit/);
  assert.doesNotMatch(patientPayments, /patientPaymentReportNote|Financial totals are intentionally not calculated/);
  assert.doesNotMatch(productDetail, /Across \{filteredPurchases\.length\}|All time total|Selected month total/);
  assert.doesNotMatch(supplierDetail, /<StatTile[^>]+\bhint=/);
  assert.doesNotMatch(transactionRecord, /Revenue, spending and outstanding balances|All dates/);
});

test("purchase form and review use shared app-window history with draft-safe Back", async () => {
  const main = await readText("src/main.tsx");
  assert.match(main, /sdk\.createHistory<FinancePage>/);
  assert.match(main, /screen: "purchase-form"/);
  assert.match(main, /screen: "purchase-review"/);
  assert.match(main, /screen === "purchase-review"/);
  assert.match(main, /screen === "main"/);
  assert.match(main, /onReviewPurchase=\{reviewPurchase\}/);
  assert.match(main, /history\.reset\(mainPage\(selected\)\)/);
  assert.match(main, /financeModuleNavigationLocked/);
  assert.doesNotMatch(main, /window\.history|popstate|location\.hash/);
});

test("purchase list removes its subtitle and category while constraining scan columns", async () => {
  const purchases = await readText("src/features/finance/purchases/PurchasesView.tsx");
  const styles = await readText("src/styles.css");
  assert.doesNotMatch(purchases, /purchase-notice|header: "Category"/);
  assert.match(purchases, /join\("  \|  "\)/);
  assert.match(purchases, /purchase-item-separator/);
  assert.match(purchases, /purchase-invoice-summary/);
  assert.match(purchases, /purchase-supplier-summary/);
  assert.match(purchases, /key: "invoice"[^\n]*width: 100/);
  assert.doesNotMatch(purchases, /key: "invoice"[^\n]*nowrap: true/);
  assert.match(purchases, /key: "supplier"[^\n]*width: 170/);
  assert.match(purchases, /key: "items"[^\n]*width: 185/);
  assert.match(purchases, /minWidth=\{925\}/);
  assert.match(purchases, /purchase-total-single-line/);
  assert.match(styles, /\.purchase-invoice-summary,[\s\S]*-webkit-line-clamp: 2/);
  assert.match(styles, /\.purchase-supplier-summary \{ max-width: 165px; \}/);
  assert.match(styles, /\.purchase-items-summary \{ max-width: 100%; \}/);
  assert.match(styles, /\.purchase-item-separator \{ display: inline-block; margin-inline: \.5em; \}/);
  assert.match(styles, /\.purchase-total-single-line\s*\{[^}]*white-space: nowrap/);
});

test("Product and Supplier details remain in their shared app-window history", async () => {
  const main = await readText("src/main.tsx");
  const product = await readText("src/features/finance/product-list/ProductListWorkspace.tsx");
  const supplier = await readText("src/features/finance/supplier-list/SupplierListWorkspace.tsx");
  assert.match(main, /history\.push\(\{ moduleId: "product-list", screen: "product-detail", productId \}\)/);
  assert.match(main, /history\.push\(\{ moduleId: "supplier-list", screen: "supplier-detail", supplierId \}\)/);
  assert.match(product, /onOpenProduct/);
  assert.match(supplier, /onOpenSupplier/);
});

test("Finance detail pages rely on window Back/Forward without duplicate page Back buttons", async () => {
  const product = await readText("src/features/finance/product-list/ProductDrawer.tsx");
  const supplier = await readText("src/features/finance/supplier-list/SupplierDetailView.tsx");
  assert.doesNotMatch(product, /back=\{\{/);
  assert.doesNotMatch(supplier, /back=\{\{/);
});

test("Finance provides shared snackbar context to refresh and feature providers", async () => {
  const main = await readText("src/main.tsx");
  assert.match(main, /import \{ ClinicSnackbarProvider \} from "@\/shared\/ui\/ClinicSnackbar"/);
  assert.match(main, /<ClinicSnackbarProvider>[\s\S]*<ClinicPageRefreshProvider>/);
  assert.match(main, /<\/ClinicPageRefreshProvider>[\s\S]*<\/ClinicSnackbarProvider>/);
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
