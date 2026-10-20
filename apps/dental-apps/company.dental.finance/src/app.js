const modules = new Map([
  ['transaction-record', 'Transaction Record'],
  ['patient-payments', 'Patient payments'],
  ['general-expenses', 'General expenses'],
  ['salary-payments', 'Salary payments'],
  ['product-list', 'Product list'],
  ['purchases', 'Purchases'],
  ['supplier-list', 'Supplier list'],
  ['supplier-payments', 'Supplier payments'],
]);

const heading = document.querySelector('#app-title');
const activeModule = document.querySelector('#active-module');
const moreApps = document.querySelector('#more-apps');

moreApps.addEventListener('click', () => {
  void window.dentalApp.openAppExplorer();
});

window.dentalApp.onModuleSelected(({ moduleId }) => {
  const label = modules.get(moduleId);
  if (!label) return;
  heading.textContent = label;
  activeModule.textContent = label;
  document.title = label;
  heading.focus({ preventScroll: true });
});
