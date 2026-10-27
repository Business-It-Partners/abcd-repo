/* First-party browser frame. Runs as an opaque-origin sandbox, with no Firebase/IPC/Worker globals. */
const fields = {
  appointments: ['date', 'time', 'patientName', 'doctorName', 'status'],
  patients: ['patientNumber', 'fullName', 'phone', 'lastVisitOn', 'status'],
  calendar: ['taskDate', 'title', 'category', 'status'],
  finance: ['date', 'patientName', 'amount', 'type', 'status'],
  followups: ['dueOn', 'patientName', 'doctorName', 'status', 'reason'],
  staff: ['fullName', 'staffType', 'position', 'phone', 'status'],
  lab: ['patientName', 'workType', 'supplierName', 'dueOn', 'status'],
  treatment: ['patientNumber', 'fullName', 'planTitle', 'nextReturnOn', 'outstandingDue'],
  protocols: ['name', 'title', 'treatmentType', 'defaultPrice', 'status'],
  workentry: ['patientName', 'chiefComplaint', 'openedOn', 'status', 'doctorName'],
};
const collectionKeys = {
  appointments: ['appointments', 'staff'],
  patients: ['patients'],
  calendar: ['calendarTasks'],
  finance: ['transactions', 'payments', 'expenses', 'payouts', 'products', 'purchases', 'suppliers', 'supplierPayments', 'rows'],
  followups: ['followUps', 'staff'],
  staff: ['staff'],
  lab: ['labOrders', 'suppliers'],
  treatment: ['patients'],
  protocols: ['treatmentProtocols'],
  workentry: ['cases'],
};
const descriptions = {
  appointments: 'Clinic appointment diary and visiting-doctor coordination',
  patients: 'Patient directory, registration reference and clinical history',
  calendar: 'Clinic-wide calendar and shared task planning',
  finance: 'Transactions, patient payments, expenses, inventory and suppliers',
  followups: 'Patient recall schedule and follow-up worklist',
  staff: 'Clinic staff directory and employment records',
  lab: 'Lab orders, delivery progress and laboratory suppliers',
  treatment: 'Active treatment plans, stage progress and outstanding balances',
  protocols: 'Reusable stages and standard treatment pricing',
  workentry: 'Ongoing clinical cases and chairside work references',
};
let app = null;
let port = null;
let currentView = null;
let currentRows = [];
let responseRecord = null;
let searchValue = '';
let loadingSerial = 0;
let requestSerial = 0;
const pending = new Map();

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}
function toText(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(toText).join(', ').slice(0, 200);
  if (typeof value === 'object') return 'See details';
  return String(value).slice(0, 240);
}
function pick(row, key) {
  const aliases = {
    patientName: ['patientFullName', 'fullName', 'name'],
    fullName: ['patientName', 'name'],
    dueOn: ['dueDate', 'dueDateAd', 'nextFollowUpOn'],
    date: ['appointmentDate', 'createdOn', 'occurredOn', 'transactionDate'],
    time: ['startTime', 'appointmentTime'],
    status: ['workStatus', 'paymentStatus'],
    patientNumber: ['registrationNumber', 'patientCode'],
    chiefComplaint: ['complaint', 'title'],
    planTitle: ['treatmentName'],
  };
  if (row?.[key] !== undefined) return row[key];
  for (const alias of aliases[key] || []) if (row?.[alias] !== undefined) return row[alias];
  return undefined;
}
function dateToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function rangeForMonth() {
  const now = new Date();
  const begin = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  return { from: iso(begin), to: iso(end) };
}
function payloadRows(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  for (const key of collectionKeys[app.appId] || []) if (Array.isArray(data[key])) return data[key];
  // Some reporting endpoints nest the worklist under one report/envelope.
  for (const key of ['report', 'data', 'result']) {
    if (data[key] && typeof data[key] === 'object') {
      const entries = Object.entries(data[key]);
      const found = entries.find(([name, val]) => Array.isArray(val) && name !== 'errors');
      if (found) return found[1];
    }
  }
  return null;
}
function read(path, viewId) {
  return new Promise((resolve, reject) => {
    if (!port) return reject(new Error('The clinic connection is closed.'));
    const id = ++requestSerial;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Clinic response timed out.'));
    }, 18_000);
    pending.set(id, { resolve, reject, timeout });
    port.postMessage({ type: 'read', id, viewId, path });
  });
}
function withQuery(route) {
  if (app.appId === 'appointments' && currentView?.id === 'diary') {
    return route + '?date=' + encodeURIComponent(document.getElementById('record-date')?.value || dateToday());
  }
  if (app.appId === 'patients' && currentView?.id === 'directory') {
    return '/v1/patients?limit=30' + (searchValue ? '&q=' + encodeURIComponent(searchValue.slice(0, 120)) : '');
  }
  if (app.appId === 'calendar') {
    const range = rangeForMonth();
    return route + '?from=' + range.from + '&to=' + range.to;
  }
  return route;
}
function setMessage(text, tone = 'normal') {
  const area = document.getElementById('view-message');
  if (!area) return;
  area.textContent = text;
  area.dataset.tone = tone;
  area.hidden = !text;
}
function rowLabel(row, index) {
  return toText(pick(row, 'fullName') || pick(row, 'patientName') || row?.title || row?.name || row?.patientNumber || 'Record ' + (index + 1));
}
function showDetails(row, index) {
  const panel = document.getElementById('detail');
  panel.replaceChildren();
  const head = node('header', 'detail-header');
  head.append(node('h3', '', rowLabel(row, index)));
  const close = node('button', 'subtle-button', 'Close');
  close.type = 'button';
  close.addEventListener('click', () => { panel.hidden = true; });
  head.append(close);
  panel.append(head);
  const content = node('dl', 'details-grid');
  for (const [key, value] of Object.entries(row || {}).slice(0, 36)) {
    if (value == null || typeof value === 'object') continue;
    const dt = node('dt', '', key.replace(/([A-Z])/g, ' $1'));
    const dd = node('dd', '', toText(value));
    content.append(dt, dd);
  }
  panel.append(content);
  const id = row.patientId || row.staffId || row.chiefComplaintId || row.id;
  const detailsRoute = app.appId === 'patients' ? '/v1/patients/' + encodeURIComponent(id || '') + '/core'
    : app.appId === 'staff' ? '/v1/clinic/staff/' + encodeURIComponent(id || '')
    : app.appId === 'workentry' ? '/v1/chief-complaints/' + encodeURIComponent(id || '') + '/work-entry'
    : null;
  if (detailsRoute && id && !app.preview) {
    const more = node('button', 'subtle-button', 'Load clinic details');
    more.type = 'button';
    more.addEventListener('click', async () => {
      more.disabled = true;
      more.textContent = 'Loading…';
      try {
        const result = await read(detailsRoute, currentView.id);
        more.replaceWith(node('p', 'detail-note', 'Additional clinic fields loaded.'));
        const extra = result?.patient || result?.staff || result?.case || result;
        if (extra && typeof extra === 'object') {
          for (const [key, value] of Object.entries(extra).slice(0, 50)) {
            if (value === null || typeof value === 'object') continue;
            content.append(node('dt', '', key.replace(/([A-Z])/g, ' $1')), node('dd', '', toText(value)));
          }
        }
      } catch (error) { more.disabled = false; more.textContent = 'Retry clinic details'; setMessage(error.message, 'error'); }
    });
    panel.append(more);
  }
  panel.hidden = false;
}
function renderRows() {
  const body = document.getElementById('data-body');
  const table = document.getElementById('record-table');
  const summary = document.getElementById('record-summary');
  if (!body || !table || !summary) return;
  body.replaceChildren();
  let rows = currentRows;
  if (searchValue && app.appId !== 'patients') rows = rows.filter(row =>
    JSON.stringify(row).toLowerCase().includes(searchValue.toLowerCase()));
  rows = rows.slice(0, 120);
  const keys = fields[app.appId] || [];
  const header = table.querySelector('thead tr');
  header.replaceChildren();
  for (const key of keys) header.append(node('th', '', key.replace(/([A-Z])/g, ' $1')));
  summary.textContent = app.preview ? 'Preview • no clinic records' : rows.length + ' visible record' + (rows.length === 1 ? '' : 's');
  if (!rows.length) {
    table.hidden = true;
    document.getElementById('empty-state').hidden = false;
    return;
  }
  table.hidden = false;
  document.getElementById('empty-state').hidden = true;
  rows.forEach((row, index) => {
    const tr = node('tr', 'record-row');
    tr.tabIndex = 0;
    tr.setAttribute('aria-label', 'Inspect ' + rowLabel(row, index));
    for (const key of keys) tr.append(node('td', '', toText(pick(row, key))));
    tr.addEventListener('click', () => showDetails(row, index));
    tr.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetails(row, index); }
    });
    body.append(tr);
  });
}
async function loadView() {
  const serial = ++loadingSerial;
  const reloadButton = document.getElementById('refresh-records');
  if (reloadButton) reloadButton.disabled = true;
  currentRows = [];
  if (document.getElementById('detail')) document.getElementById('detail').hidden = true;
  if (app.preview) {
    setMessage('Offline preview. Sign in to staging to read clinic data. No records or changes are simulated.');
    renderRows();
    if (reloadButton) reloadButton.disabled = false;
    return;
  }
  setMessage('Reading authorized clinic data…');
  renderRows();
  try {
    const data = await read(withQuery(currentView.route), currentView.id);
    if (serial !== loadingSerial) return;
    responseRecord = data;
    const rows = payloadRows(data);
    if (!rows) {
      setMessage('The Worker returned a valid response, but this view needs a response-shape adapter before records can be shown.', 'warning');
    } else {
      currentRows = rows.filter(row => row && typeof row === 'object');
      setMessage('');
    }
  } catch (error) {
    if (serial === loadingSerial) setMessage(error.message, 'error');
  } finally {
    if (serial === loadingSerial) { renderRows(); if (reloadButton) reloadButton.disabled = false; }
  }
}
function selectView(view) {
  currentView = view;
  const buttons = document.querySelectorAll('[data-view-id]');
  buttons.forEach(btn => {
    const active = btn.dataset.viewId === view.id;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', String(active));
  });
  document.getElementById('view-title').textContent = view.title;
  const datePicker = document.getElementById('record-date');
  datePicker.hidden = !(app.appId === 'appointments' && view.id === 'diary');
  const searchInput = document.getElementById('record-search');
  searchInput.value = '';
  searchValue = '';
  void loadView();
}
function build() {
  const root = document.getElementById('app-root');
  root.replaceChildren();
  const shell = node('div', 'app-layout');
  const sidebar = node('aside', 'app-sidebar');
  const brand = node('div', 'app-brand');
  const icon = node('img', 'app-icon'); icon.src = app.icon; icon.alt = ''; icon.width = 36; icon.height = 36;
  brand.append(icon, node('strong', '', app.title));
  sidebar.append(brand, node('p', 'sidebar-heading', 'WORKSPACES'));
  const nav = node('nav', 'app-navigation');
  nav.setAttribute('aria-label', app.title + ' sections');
  for (const view of app.views) {
    const button = node('button', '', view.title);
    button.type = 'button';
    button.dataset.viewId = view.id;
    button.addEventListener('click', () => selectView(view));
    nav.append(button);
  }
  sidebar.append(nav);
  sidebar.append(node('p', 'sidebar-disclaimer', 'Browser port • read-only workflow. Clinical changes remain available only in the existing verified product.'));
  const main = node('main', 'app-workspace');
  const top = node('header', 'app-header');
  const eyebrow = node('p', 'app-eyebrow', 'DENTAL OS / CLINIC WORKSPACE');
  top.append(eyebrow, node('h1', '', app.title), node('p', 'app-description', descriptions[app.appId] || 'Clinic workspace'));
  const tool = node('div', 'app-toolbar');
  const date = node('input', 'record-date'); date.type = 'date'; date.id = 'record-date'; date.value = dateToday();
  date.setAttribute('aria-label', 'Appointment date'); date.addEventListener('change', () => void loadView());
  const search = node('input', 'record-search'); search.type = 'search'; search.id = 'record-search';
  search.placeholder = app.appId === 'patients' ? 'Search patient name or phone…' : 'Filter visible records…';
  search.setAttribute('aria-label', 'Search clinic records');
  let debounce;
  search.addEventListener('input', () => {
    searchValue = search.value.trim();
    clearTimeout(debounce);
    if (app.appId === 'patients' && currentView?.id === 'directory') debounce = setTimeout(() => void loadView(), 300);
    else renderRows();
  });
  const refresh = node('button', 'refresh-button', '↻ Refresh'); refresh.id = 'refresh-records'; refresh.type = 'button';
  refresh.addEventListener('click', () => void loadView());
  tool.append(date, search, refresh);
  const banner = node('div', 'read-only-banner', 'Read-only browser integration • No clinical edits or payments are submitted.');
  banner.setAttribute('role', 'note');
  const message = node('p', 'view-message'); message.id = 'view-message'; message.setAttribute('role', 'status');
  const card = node('section', 'records-card');
  const cardHeader = node('div', 'records-heading');
  const title = node('h2', '', 'Records'); title.id = 'view-title';
  const summary = node('span', 'record-summary', 'Loading…'); summary.id = 'record-summary';
  cardHeader.append(title, summary);
  const tableWrap = node('div', 'table-scroll');
  const table = node('table', 'records-table'); table.id = 'record-table';
  table.append(node('thead', ''), node('tbody', ''));
  table.querySelector('thead').append(node('tr', ''));
  table.querySelector('tbody').id = 'data-body';
  const empty = node('div', 'empty-state', 'No records to display for this view.'); empty.id = 'empty-state';
  tableWrap.append(table, empty);
  card.append(cardHeader, tableWrap);
  const detail = node('aside', 'record-detail'); detail.id = 'detail'; detail.hidden = true;
  main.append(top, banner, tool, message, card, detail);
  shell.append(sidebar, main);
  root.append(shell);
  if (app.views.length > 0) selectView(app.views[0]);
  else setMessage('This clinic role cannot open a section of this app.', 'error');
}
window.addEventListener('message', event => {
  if (port || event.source !== window.parent) return;
  const init = event.data;
  if (!init || init.type !== 'dental-os-browser-init' || typeof init.nonce !== 'string' ||
      !/^[a-f0-9]{48}$/.test(init.nonce) || !/^[a-z]+$/.test(init.appId) ||
      !Array.isArray(init.views) || !event.ports?.[0]) return;
  const accepted = ['appointments','patients','calendar','finance','followups','staff','lab','treatment','protocols','workentry'];
  if (!accepted.includes(init.appId)) return;
  // The expected parent window transfers the single capability port. No Firebase SDK or bearer token exists here.
  port = event.ports[0];
  app = Object.freeze({
    appId: init.appId,
    title: String(init.title).slice(0, 80),
    icon: String(init.icon),
    preview: !!init.preview,
    views: init.views.filter(v => typeof v.id === 'string' && typeof v.title === 'string' &&
      typeof v.route === 'string').slice(0, 12),
  });
  if (app.appId === 'followups' && !app.preview && init.session?.clinicUser && init.session?.clinic &&
      typeof window.createBrowserAppBridge === 'function' &&
      init.source === 'company.dental.followups.m17') {    // The original React renderer expects #root and window.dentalApp. Here the SDK is a
    // browser-native, token-free MessageChannel facade, not Electron preload/IPC.
    const originalRoot = document.getElementById('app-root');
    originalRoot.id = 'root';
    originalRoot.replaceChildren(node('p', 'opening', 'Opening original ' + app.title + ' interface…'));
    let adapter;
    try {
      adapter = window.createBrowserAppBridge({
        port, appId: app.appId, source: init.source,
        title: app.title, icon: app.icon, views: app.views, session: init.session,
      });
      Object.defineProperty(window, 'dentalApp', {
        configurable: true, writable: false, value: adapter,
      });
    } catch {
      originalRoot.replaceChildren(node('p', 'opening', 'The clinic session could not open this app.'));
      return;
    }
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/apps/browser/dist/' + app.appId + '/assets/app.css';
    document.head.append(stylesheet);
    // Only a fixed, allowlisted app ID is used in the module path. No arbitrary sources.
    import(new URL('/apps/browser/dist/' + app.appId + '/assets/app.js', window.location.href).href).catch((cause) => {
      console.error('Original Follow-ups React bundle import failed:', cause);
      adapter.close();
      delete window.dentalApp;
      stylesheet.remove();
      originalRoot.id = 'app-root';
      originalRoot.replaceChildren(node('p', 'opening',
        'The original ' + app.title + ' React bundle has not been built or could not load. Run npm run build:apps.'));
    });
    return;
  }
  port.onmessage = message => {
    const reply = message.data;
    if (!reply || reply.type !== 'response' || !Number.isSafeInteger(reply.id)) return;
    const handler = pending.get(reply.id);
    if (!handler) return;
    clearTimeout(handler.timeout);
    pending.delete(reply.id);
    if (reply.ok) handler.resolve(reply.data);
    else handler.reject(new Error(String(reply.error || 'Clinic request was denied.').slice(0, 240)));
  };
  port.start();
  build();
}, { once: true });
window.addEventListener('pagehide', () => {
  for (const handler of pending.values()) { clearTimeout(handler.timeout); handler.reject(new Error('App closed.')); }
  pending.clear();
  port?.close();
});
