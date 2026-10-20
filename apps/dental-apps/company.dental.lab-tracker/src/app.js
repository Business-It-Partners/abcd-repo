const modules = new Map([
  ['lab-tracker', 'Lab Tracker'],
  ['lab-supplier-record', 'Lab supplier record'],
]);

const title = document.querySelector('#app-title');
const activeModule = document.querySelector('#active-module');
const moreApps = document.querySelector('#more-apps');

window.dentalApp?.onModuleSelected(({ moduleId }) => {
  const label = modules.get(moduleId);
  if (!label) return;
  title.textContent = label;
  activeModule.textContent = label;
  document.title = label;
});

moreApps.addEventListener('click', () => {
  void window.dentalApp?.openAppExplorer();
});
