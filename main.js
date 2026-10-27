import {
  adToBs,
  getMonthData,
  MAX_BS_YEAR,
  MIN_BS_YEAR,
  NEPALI_DAYS,
  NEPALI_MONTHS,
} from './vendor/nepali-date-utils/index.js';
import { mountBrowserApp } from './apps/browser/host.js';

const config = window.DENTAL_OS_BROWSER_CONFIG;
const apps = [
  { id: 'appointments', title: 'Appointments', icon: '/assets/dock/appointments.webp', capabilities: ['appointments.access'] },
  { id: 'patients', title: 'Patients', icon: '/assets/dock/patients.webp', capabilities: ['patient_record.access'] },
  { id: 'calendar', title: 'Calendar', icon: '/assets/dock/calendar.webp', capabilities: ['calendar.access'] },
  {
    id: 'finance', title: 'Finance', icon: '/assets/dock/finance.webp',
    capabilities: ['finance.manage', 'patient_billing_ledger.read', 'patient_payments.outstanding.read', 'patient_payments.received.read', 'patient_payments.collect'],
  },
  { id: 'followups', title: 'Follow-ups', icon: '/assets/dock/followups.webp', capabilities: ['followups.access'] },
  { id: 'staff', title: 'Staff', icon: '/assets/dock/staff.webp', capabilities: ['staff.reference.read', 'staff.manage'] },
  { id: 'lab', title: 'Lab Tracker', icon: '/assets/dock/lab.webp', capabilities: ['lab_tracker.access', 'lab_requests.create'] },
  { id: 'treatment', title: 'Treatment Progress', icon: '/assets/dock/treatment.webp', capabilities: ['treatment_progress.access'] },
  {
    id: 'protocols', title: 'Treatment Protocols', icon: '/assets/dock/protocols.webp',
    capabilities: ['treatment_protocols.reference.read', 'treatment_protocols.manage'],
  },
  { id: 'workentry', title: 'Work Entry', icon: '/assets/dock/workentry.webp', capabilities: ['work_entry.access'] },
];

const appById = new Map(apps.map((app) => [app.id, app]));
const dock = document.getElementById('app-dock');
const windowStage = document.getElementById('window-stage');
const homeView = document.getElementById('home-view');
const homeNote = document.getElementById('home-note');
const startupView = document.getElementById('startup-view');
const startupStatus = document.getElementById('startup-status');
const startupProgress = document.getElementById('startup-progress');
const startupSoundToggle = document.getElementById('startup-sound-toggle');
const startupSoundLabel = document.getElementById('startup-sound-label');
const authView = document.getElementById('auth-view');
const authTitle = document.getElementById('auth-title');
const authDescription = document.getElementById('auth-description');
const authStatus = document.getElementById('auth-status');
const authForm = document.getElementById('sign-in-form');
const authEmail = document.getElementById('sign-in-email');
const authPassword = document.getElementById('sign-in-password');
const signInButton = document.getElementById('sign-in-button');
const signInLabel = document.getElementById('sign-in-label');
const rememberEmailInput = document.getElementById('remember-email');
const identityNote = document.getElementById('identity-note').querySelector('span');
const passwordReveal = document.getElementById('password-reveal');
const clinicWidget = document.getElementById('clinic-widget');
const clinicNameLabel = document.getElementById('clinic-name');
const clinicUserLabel = document.getElementById('clinic-user');
const clinicRoleLabel = document.getElementById('clinic-role');
const lockWorkspaceButton = document.getElementById('lock-workspace-button');
const signOutButton = document.getElementById('signout-button');
const announcement = document.getElementById('workspace-announcement');
const desktop = document.querySelector('.desktop');
const fullscreenToggle = document.getElementById('fullscreen-toggle');
const fullscreenToggleLabel = fullscreenToggle.querySelector('.fullscreen-toggle-label');
const switchRoleButton = document.getElementById('switch-role-button');
const networkStatus = document.getElementById('network-status');
const networkLabel = document.getElementById('network-label');
const batteryStatus = document.getElementById('status-battery');
const batteryLabel = document.getElementById('battery-label');
const batteryLevel = batteryStatus.querySelector('.battery-level');
const nepaliMonthTitle = document.getElementById('nepali-month-title');
const nepaliCalendarGrid = document.getElementById('nepali-calendar-grid');
const localClockTime = document.getElementById('local-clock-time');
const localClockDate = document.getElementById('local-clock-date');
const gregorianMonthTitle = document.getElementById('gregorian-month-title');
const gregorianCalendarGrid = document.getElementById('gregorian-calendar-grid');
const openWindows = new Map();
const shellRegions = [document.querySelector('.desktop-statusbar'), homeView, windowStage, dock];
const connectedStaging = config?.flavor === 'staging' && config.firebase;
let firebaseAuth = null;
let firebaseAuthSdk = null;
let firebaseUser = null;
let clinicSession = null;
let allowedAppIds = new Set();
let authGeneration = 0;
let signInNotice = null;
let startupMinimumElapsed = !connectedStaging;
let startupResolved = !connectedStaging;
let startupComplete = !connectedStaging;
let startupDestination = 'sign-in';
let startupSoundEnabled = true;
let startupAudioContext = null;
let activeWindowId = null;
let nextLayer = 1;
let shownBsMonth = (() => {
  const today = adToBs(new Date());
  return { year: today.year, month: today.month };
})();
let shownGregorianMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const calendarWeekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const rememberedEmailPreferenceKey = 'sajilo.identity.remember-email';
const rememberedEmailKey = 'sajilo.identity.email';
const startupSoundPreferenceKey = 'sajilo.startup-sound';
const startupStages = {
  checking: 'Checking your saved session…',
  workspace: 'Session restored. Opening your workspace…',
  'sign-in': 'Ready to sign in',
  unavailable: 'Opening session recovery…',
};

function visibleAppsForCapabilities(appCatalog, rawCapabilities) {
  if (!Array.isArray(rawCapabilities)) return [];

  const capabilities = new Set(rawCapabilities.filter((capability) => typeof capability === 'string'));
  return appCatalog.filter((app) => (
    Array.isArray(app.capabilities)
    && app.capabilities.some((capability) => capabilities.has(capability))
  ));
}

function clinicSessionFromMeResponse(payload) {
  const session = payload?.session;
  if (!session?.clinicUser || !Array.isArray(session.clinicUser.capabilities)) return null;
  return session;
}

function setStartupStage(stage) {
  const label = startupStages[stage] ?? startupStages.checking;
  startupStatus.textContent = label;
  startupProgress.dataset.complete = String(stage !== 'checking');
  startupProgress.setAttribute('aria-valuetext', label);
  if (stage === 'checking') startupProgress.removeAttribute('aria-valuenow');
  else startupProgress.setAttribute('aria-valuenow', '100');
}

function setShellRegionsInert(inert) {
  for (const region of shellRegions) {
    region.inert = inert;
    if (inert) region.setAttribute('aria-hidden', 'true');
    else region.removeAttribute('aria-hidden');
  }
}

function finishStartupIfReady() {
  if (startupComplete || !startupMinimumElapsed || !startupResolved) return;
  startupComplete = true;
  if (startupDestination === 'workspace') enterWorkspaceScreen();
  else enterAuthScreen();
}

function resolveStartup(destination) {
  if (startupComplete) return;
  startupDestination = destination;
  startupResolved = true;
  setStartupStage(destination === 'workspace' ? 'workspace' : destination === 'unavailable' ? 'unavailable' : 'sign-in');
  finishStartupIfReady();
}

function beginStartup() {
  startupView.hidden = false;
  authView.hidden = true;
  setShellRegionsInert(true);
  setStartupStage('checking');
  startupMinimumElapsed = false;
  startupResolved = false;
  startupComplete = false;
  window.setTimeout(() => {
    startupMinimumElapsed = true;
    finishStartupIfReady();
  }, 5000);
  if (startupSoundEnabled) window.setTimeout(() => void playStartupSound(), 300);
}

function enterAuthScreen() {
  startupView.hidden = true;
  authView.hidden = false;
  desktop.classList.add('auth-active');
  setShellRegionsInert(true);
}

function enterWorkspaceScreen() {
  startupView.hidden = true;
  authView.hidden = true;
  desktop.classList.remove('auth-active');
  setShellRegionsInert(false);
}

function readRememberedEmail() {
  try {
    const enabled = localStorage.getItem(rememberedEmailPreferenceKey) !== 'off';
    rememberEmailInput.checked = enabled;
    const email = enabled ? localStorage.getItem(rememberedEmailKey) ?? '' : '';
    return email.length <= 254 ? email : '';
  } catch {
    rememberEmailInput.checked = true;
    return '';
  }
}

function persistEmailPreference() {
  const enabled = rememberEmailInput.checked;
  try {
    localStorage.setItem(rememberedEmailPreferenceKey, enabled ? 'on' : 'off');
    const email = authEmail.value.trim();
    if (enabled && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      localStorage.setItem(rememberedEmailKey, email);
    } else {
      localStorage.removeItem(rememberedEmailKey);
    }
  } catch {
    // Remembering an email is optional; browser storage must not block sign-in.
  }
  identityNote.textContent = enabled
    ? 'Your clinic email is remembered on this browser.'
    : 'Your clinic email is not remembered on this browser.';
}

function setSignInBusy(busy) {
  authForm.setAttribute('aria-busy', String(busy));
  signInButton.disabled = busy;
  signInButton.setAttribute('aria-busy', String(busy));
  signInLabel.textContent = busy ? 'Please wait…' : 'Sign in';
  authEmail.disabled = busy;
  authPassword.disabled = busy;
  rememberEmailInput.disabled = busy;
  passwordReveal.disabled = busy;
}

function updatePasswordVisibility(visible) {
  authPassword.type = visible ? 'text' : 'password';
  passwordReveal.setAttribute('aria-pressed', String(visible));
  passwordReveal.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
}

function updateIdentityClock() {
  const now = new Date();
  const date = document.getElementById('identity-date');
  const time = document.getElementById('identity-time');
  date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  time.dateTime = now.toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

async function playStartupSound() {
  if (!startupSoundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    startupAudioContext = context;
    await context.resume();
    const now = context.currentTime + 0.03;
    const master = context.createGain();
    master.gain.value = 0.15;
    master.connect(context.destination);
    [[261.63, 0], [392, 0.16], [523.25, 0.32], [659.25, 0.48]].forEach(([frequency, delay], index) => {
      const note = context.createOscillator();
      const envelope = context.createGain();
      note.type = 'sine';
      note.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, now + delay);
      envelope.gain.linearRampToValueAtTime(0.28, now + delay + 0.035);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.25);
      note.connect(envelope);
      envelope.connect(master);
      note.start(now + delay);
      note.stop(now + delay + 1.3);
      if (index === 3) note.onended = () => {
        if (context.state !== 'closed') void context.close().catch(() => {});
        if (startupAudioContext === context) startupAudioContext = null;
      };
    });
  } catch {
    if (startupAudioContext && startupAudioContext.state !== 'closed') void startupAudioContext.close().catch(() => {});
    startupAudioContext = null;
  }
}

function updateStartupSoundToggle() {
  startupSoundToggle.setAttribute('aria-pressed', String(startupSoundEnabled));
  startupSoundToggle.setAttribute('aria-label', startupSoundEnabled ? 'Mute startup sound' : 'Enable startup sound');
  startupSoundLabel.textContent = `Sound ${startupSoundEnabled ? 'on' : 'off'}`;
}

document.documentElement.dataset.environment = connectedStaging ? 'staging' : 'preview';

function updateClinicWidget(session) {
  const clinic = session.clinic || {};
  const user = session.clinicUser || {};
  const clinicName = clinic.displayName || clinic.name || clinic.clinicName || user.clinicName || 'Sajilo Dental';
  const userName = user.displayName || user.fullName || user.name || user.email || 'Signed-in user';
  const role = String(user.role || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
  clinicNameLabel.textContent = clinicName;
  clinicNameLabel.title = clinicName;
  clinicUserLabel.textContent = userName;
  clinicUserLabel.title = userName;
  clinicRoleLabel.textContent = role;
  clinicRoleLabel.hidden = !role;
}

function makeButton(className, label, symbol, action) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = symbol;
  button.addEventListener('click', action);
  return button;
}

function buildDock() {
  dock.replaceChildren();
  for (const app of apps) {
    if (!allowedAppIds.has(app.id)) continue;
    const button = document.createElement('button');
    button.className = 'dock-icon';
    button.type = 'button';
    button.dataset.appId = app.id;
    button.setAttribute('aria-label', 'Open ' + app.title);
    button.setAttribute('aria-pressed', 'false');
    button.title = app.title;

    const image = document.createElement('img');
    image.className = 'dock-artwork';
    image.src = app.icon;
    image.alt = '';
    image.draggable = false;
    image.width = 256;
    image.height = 256;

    const caption = document.createElement('span');
    caption.className = 'dock-caption';
    caption.textContent = app.title;

    const running = document.createElement('span');
    running.className = 'running-dot';
    running.setAttribute('aria-hidden', 'true');

    button.append(image, caption, running);
    button.addEventListener('click', () => openApp(app.id));
    dock.append(button);
  }
}

function updateDock() {
  for (const button of dock.querySelectorAll('[data-app-id]')) {
    const appId = button.dataset.appId;
    const isOpen = openWindows.has(appId);
    button.setAttribute('aria-pressed', String(activeWindowId === appId));
    button.classList.toggle('is-running', isOpen);
    button.classList.toggle('is-active', activeWindowId === appId);
  }
}

function updateHome() {
  const hasVisibleWindow = [...openWindows.values()].some((entry) => !entry.element.hidden);
  homeView.hidden = (!clinicSession && connectedStaging) || hasVisibleWindow;
  const homeButton = document.querySelector('[data-action="home"]');
  if (hasVisibleWindow) homeButton.removeAttribute('aria-current');
  else homeButton.setAttribute('aria-current', 'page');
}

function setRoute(appId, replace = false) {
  const hash = appId ? '#app/' + appId : '#home';
  if (window.location.hash === hash) return;
  if (replace) {
    window.history.replaceState({ appId: appId || null }, '', hash);
  } else {
    window.history.pushState({ appId: appId || null }, '', hash);
  }
}

function focusWindow(appId, shouldFocus = false) {
  const entry = openWindows.get(appId);
  if (!entry) return;
  entry.element.hidden = false;
  entry.element.style.zIndex = String(++nextLayer);
  activeWindowId = appId;
  updateHome();
  updateDock();
  if (shouldFocus) entry.element.focus({ preventScroll: true });
}

function topVisibleWindowId() {
  return [...openWindows.entries()]
    .filter(([, entry]) => !entry.element.hidden)
    .sort((left, right) => Number(right[1].element.style.zIndex) - Number(left[1].element.style.zIndex))[0]?.[0] ?? null;
}

function syncRouteToVisibleWindow() {
  const nextActiveId = topVisibleWindowId();
  if (nextActiveId) focusWindow(nextActiveId, true);
  else activeWindowId = null;
  setRoute(nextActiveId, true);
  updateHome();
  updateDock();
}

function closeWindow(appId) {
  const entry = openWindows.get(appId);
  if (!entry) return;
  entry.dispose?.();
  entry.element.remove();
  openWindows.delete(appId);
  if (activeWindowId === appId) syncRouteToVisibleWindow();
  else updateDock();
  announcement.textContent = appById.get(appId).title + ' closed.';
}

function closeAllWindows() {
  for (const entry of openWindows.values()) { entry.dispose?.(); entry.element.remove(); }
  openWindows.clear();
  activeWindowId = null;
  setRoute(null, true);
  updateHome();
  updateDock();
}

function minimizeWindow(appId) {
  const entry = openWindows.get(appId);
  if (!entry) return;
  entry.element.hidden = true;
  if (activeWindowId === appId) syncRouteToVisibleWindow();
  else updateHome();
  announcement.textContent = appById.get(appId).title + ' minimized.';
}

function createWindow(app, shift) {
  const section = document.createElement('section');
  section.className = 'app-window';
  section.dataset.appId = app.id;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'false');
  section.setAttribute('aria-label', app.title + ' browser preview');
  section.tabIndex = -1;
  section.style.setProperty('--window-shift', shift + 'px');

  const titlebar = document.createElement('header');
  titlebar.className = 'window-titlebar';

  const identity = document.createElement('div');
  identity.className = 'window-identity';
  const icon = document.createElement('img');
  icon.src = app.icon;
  icon.alt = '';
  icon.width = 28;
  icon.height = 28;
  const title = document.createElement('strong');
  title.textContent = app.title;
  identity.append(icon, title);

  const controls = document.createElement('div');
  controls.className = 'window-controls';
  controls.append(
    makeButton('window-control minimize-control', 'Minimize ' + app.title, '−', () => minimizeWindow(app.id)),
    makeButton('window-control maximize-control', 'Maximize ' + app.title, '□', () => {
      section.classList.toggle('is-maximized');
      section.querySelector('.maximize-control').setAttribute(
        'aria-label',
        (section.classList.contains('is-maximized') ? 'Restore ' : 'Maximize ') + app.title,
      );
    }),
    makeButton('window-control close-control', 'Close ' + app.title, '×', () => closeWindow(app.id)),
  );

  titlebar.append(identity, controls);

  const content = document.createElement('div');
  content.className = 'window-content';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'window-eyebrow';
  eyebrow.textContent = 'BROWSER APP SHELL';
  const heading = document.createElement('h1');
  heading.textContent = app.title;
  const description = document.createElement('p');
  description.className = 'window-description';
  description.textContent = connectedStaging
    ? 'Staging access is verified. This app workflow will connect in a later milestone.'
    : 'The browser shell is ready. This app will connect to the staging clinic in a later milestone.';
  const status = document.createElement('div');
  status.className = 'window-preview-status';
  const statusDot = document.createElement('span');
  statusDot.setAttribute('aria-hidden', 'true');
  const statusCopy = document.createElement('div');
  const statusTitle = document.createElement('strong');
  statusTitle.textContent = 'Preview only';
  const statusDescription = document.createElement('small');
  statusDescription.textContent = 'No clinic data is connected.';
  statusCopy.append(statusTitle, statusDescription);
  status.append(statusDot, statusCopy);
  content.append(eyebrow, heading, description, status);

  section.append(titlebar, content);
  enableWindowDrag(section, titlebar);
  windowStage.append(section);
  section.classList.add('has-browser-module');
  const dispose = mountBrowserApp({
    content,
    appId: app.id,
    connected: connectedStaging,
    apiBaseUrl: config.apiBaseUrl,
    getAccess: () => ({
      user: firebaseUser,
      allowed: Boolean(clinicSession && allowedAppIds.has(app.id)),
      capabilities: clinicSession?.clinicUser?.capabilities ?? [],
    }),
  });
  return { element: section, dispose };
}

function enableWindowDrag(section, titlebar) {
  let drag = null;
  titlebar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button') || section.classList.contains('is-maximized')) return;
    const rect = section.getBoundingClientRect();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    section.style.left = rect.left + 'px';
    section.style.top = rect.top + 'px';
    section.style.transform = 'none';
    titlebar.setPointerCapture(event.pointerId);
    section.classList.add('is-dragging');
    focusWindow(section.dataset.appId);
  });

  titlebar.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const left = Math.min(window.innerWidth - 80, Math.max(0, drag.left + event.clientX - drag.x));
    const top = Math.min(window.innerHeight - 48, Math.max(35, drag.top + event.clientY - drag.y));
    section.style.left = left + 'px';
    section.style.top = top + 'px';
  });

  const endDrag = (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    drag = null;
    section.classList.remove('is-dragging');
  };
  titlebar.addEventListener('pointerup', endDrag);
  titlebar.addEventListener('pointercancel', endDrag);
}

function openApp(appId, fromRoute = false) {
  const app = appById.get(appId);
  if (!app || !allowedAppIds.has(appId)) return;
  let entry = openWindows.get(appId);
  if (!entry) {
    entry = createWindow(app, openWindows.size * 22);
    openWindows.set(appId, entry);
  }
  focusWindow(appId, true);
  if (!fromRoute) setRoute(appId);
  announcement.textContent = app.title + ' opened.';
}

function showHome(fromRoute = false) {
  for (const entry of openWindows.values()) entry.element.hidden = true;
  activeWindowId = null;
  updateHome();
  updateDock();
  if (!fromRoute) setRoute(null);
}

function routeFromLocation() {
  const match = window.location.hash.match(/^#app\/([a-z0-9-]+)$/);
  if (match && allowedAppIds.has(match[1])) openApp(match[1], true);
  else {
    showHome(true);
    if (match || (window.location.hash && window.location.hash !== '#home')) setRoute(null, true);
  }
}

function setAuthMessage(message, tone = 'normal') {
  authStatus.textContent = message;
  authStatus.dataset.tone = tone;
  authStatus.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  authStatus.hidden = !message;
}

function clearClinicAccess() {
  clinicSession = null;
  allowedAppIds = new Set();
  closeAllWindows();
  buildDock();
  dock.hidden = true;
  clinicWidget.hidden = true;
  switchRoleButton.hidden = true;
  signOutButton.hidden = true;
  homeView.hidden = true;
}

function showSignIn(message = '') {
  clearClinicAccess();
  authTitle.textContent = 'Sign in to your clinic';
  authDescription.textContent = 'Your clinic. Your workspace.';
  authForm.hidden = false;
  authPassword.value = '';
  updatePasswordVisibility(false);
  setSignInBusy(false);
  if (!rememberEmailInput.checked) authEmail.value = '';
  setAuthMessage(message, 'normal');
  if (startupComplete) enterAuthScreen();
  else resolveStartup('sign-in');
}

function showSessionProblem(user, title, message) {
  clearClinicAccess();
  authTitle.textContent = title;
  authDescription.textContent = 'Your clinic. Your workspace.';
  authForm.hidden = false;
  if (user?.email) {
    authEmail.value = user.email;
    persistEmailPreference();
  }
  authPassword.value = '';
  updatePasswordVisibility(false);
  setSignInBusy(false);
  setAuthMessage(message, 'error');
  if (startupComplete) enterAuthScreen();
  else resolveStartup('unavailable');
}

function acceptClinicSession(user, session) {
  const nextAllowedAppIds = new Set(
    visibleAppsForCapabilities(apps, session.clinicUser.capabilities).map((app) => app.id),
  );
  for (const [appId, entry] of openWindows) {
    if (nextAllowedAppIds.has(appId)) continue;
    entry.dispose?.();
    entry.element.remove();
    openWindows.delete(appId);
  }
  if (activeWindowId && !nextAllowedAppIds.has(activeWindowId)) activeWindowId = null;

  clinicSession = session;
  allowedAppIds = nextAllowedAppIds;
  updateClinicWidget(session);
  buildDock();
  dock.hidden = allowedAppIds.size === 0;
  switchRoleButton.hidden = false;
  signOutButton.hidden = false;
  clinicWidget.hidden = false;
  authForm.hidden = true;
  setAuthMessage('', 'normal');
  setSignInBusy(false);
  if (allowedAppIds.size > 0) {
    homeNote.textContent = 'Staging access verified · app workflows will connect in later milestones';
    updateHome();
    updateDock();
    routeFromLocation();
  } else {
    homeNote.textContent = 'No clinic apps are available for this account. Contact your clinic administrator.';
    homeView.hidden = false;
  }
  if (startupComplete) enterWorkspaceScreen();
  else resolveStartup('workspace');
}

async function loadClinicSession(user, generation) {
  const sameUserHasSession = clinicSession && firebaseUser?.uid === user.uid;
  if (!sameUserHasSession) {
    clearClinicAccess();
    authTitle.textContent = 'Sign in to your clinic';
    authDescription.textContent = 'Your clinic. Your workspace.';
    authForm.hidden = false;
    authEmail.value = user.email || authEmail.value;
    persistEmailPreference();
    setSignInBusy(true);
    setAuthMessage('', 'normal');
    if (startupComplete) enterAuthScreen();
  }

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${config.apiBaseUrl}/v1/me`, {
      headers: { authorization: `Bearer ${idToken}`, accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (generation !== authGeneration) return;

    if (response.status === 401) {
      signInNotice = 'Your staging session expired. Sign in again to continue.';
      await firebaseAuthSdk.signOut(firebaseAuth);
      return;
    }
    if (response.status === 403) {
      showSessionProblem(
        user,
        'Clinic access is not available',
        'This account has no active clinic access. Contact your clinic administrator.',
      );
      return;
    }
    if (!response.ok) {
      showSessionProblem(
        user,
        'Clinic access could not be checked',
        response.status === 503
          ? 'The staging clinic is not ready right now. Retry in a moment.'
          : 'The staging clinic could not verify this session. Retry in a moment.',
      );
      return;
    }
    const session = clinicSessionFromMeResponse(payload);
    if (!session) {
      showSessionProblem(
        user,
        'Clinic access could not be checked',
        'The staging clinic returned an unexpected session response. Retry in a moment.',
      );
      return;
    }
    acceptClinicSession(user, session);
  } catch {
    if (generation !== authGeneration) return;
    showSessionProblem(
      user,
      'Staging clinic is unavailable',
      'Could not reach the staging clinic. Check your connection and retry.',
    );
  }
}

function readableSignInError(code) {
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'That email or password is not recognised.';
  }
  if (code === 'auth/too-many-requests') return 'Too many sign-in attempts. Try again shortly.';
  if (code === 'auth/network-request-failed') return 'Firebase sign-in is unavailable. Check your connection.';
  return 'We could not sign you in. Check your details and try again.';
}

async function initializeStagingAuthentication(isInitial = false) {
  if (isInitial) beginStartup();
  else enterAuthScreen();
  dock.hidden = true;
  homeView.hidden = true;
  if (!startupComplete) authForm.hidden = true;
  authTitle.textContent = 'Sign in to your clinic';
  authDescription.textContent = 'Your clinic. Your workspace.';
  authEmail.value = readRememberedEmail();
  persistEmailPreference();
  try { startupSoundEnabled = localStorage.getItem(startupSoundPreferenceKey) !== 'off'; } catch { startupSoundEnabled = true; }
  updateStartupSoundToggle();
  if (startupComplete) setAuthMessage('Connecting to Firebase staging…', 'normal');

  try {
    const sdkVersion = '11.10.0';
    const [appSdk, authSdk] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-auth.js`),
    ]);
    const firebaseApp = appSdk.getApps().length > 0 ? appSdk.getApp() : appSdk.initializeApp(config.firebase);
    firebaseAuth = authSdk.getAuth(firebaseApp);
    firebaseAuthSdk = authSdk;
    await authSdk.setPersistence(firebaseAuth, authSdk.browserLocalPersistence).catch(() => undefined);

    authSdk.onIdTokenChanged(firebaseAuth, (user) => {
      const previousUid = firebaseUser?.uid;
      firebaseUser = user;
      const generation = ++authGeneration;
      if (!user) {
        const notice = signInNotice || '';
        signInNotice = null;
        showSignIn(notice);
        return;
      }
      if (previousUid !== user.uid) clearClinicAccess();
      void loadClinicSession(user, generation);
    });
  } catch {
    showSessionProblem(
      null,
      'Session unavailable',
      'Firebase could not be loaded. Check the network and retry.',
    );
    setSignInBusy(true);
  }
}

function initializeOfflinePreview() {
  startupView.hidden = true;
  desktop.classList.remove('auth-active');
  setShellRegionsInert(false);
  allowedAppIds = new Set(apps.map((app) => app.id));
  buildDock();
  dock.hidden = false;
  authView.hidden = true;
  homeNote.textContent = 'Browser shell preview · no clinic data connected';
  homeView.hidden = false;
  routeFromLocation();
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!firebaseAuth || !firebaseAuthSdk) return;
  const email = authEmail.value.trim();
  const password = authPassword.value;
  persistEmailPreference();
  authPassword.value = '';
  updatePasswordVisibility(false);
  setSignInBusy(true);
  setAuthMessage('Signing in…', 'normal');
  try {
    await firebaseAuthSdk.signInWithEmailAndPassword(firebaseAuth, email, password);
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
    setAuthMessage(readableSignInError(code), 'error');
    setSignInBusy(false);
  }
});

async function signOutCurrentAccount() {
  if (!firebaseAuth || !firebaseAuthSdk) return;
  lockWorkspaceButton.disabled = true;
  signOutButton.disabled = true;
  switchRoleButton.disabled = true;
  setAuthMessage('Signing out…', 'normal');
  try {
    await firebaseAuthSdk.signOut(firebaseAuth);
  } catch {
    setAuthMessage('Could not sign out right now. Try again.', 'error');
  } finally {
    lockWorkspaceButton.disabled = false;
    signOutButton.disabled = false;
    switchRoleButton.disabled = false;
  }
}

signOutButton.addEventListener('click', () => void signOutCurrentAccount());
lockWorkspaceButton.addEventListener('click', () => void signOutCurrentAccount());
switchRoleButton.addEventListener('click', () => void signOutCurrentAccount());
authEmail.addEventListener('input', persistEmailPreference);
rememberEmailInput.addEventListener('change', persistEmailPreference);
passwordReveal.addEventListener('click', () => updatePasswordVisibility(authPassword.type === 'password'));
startupSoundToggle.addEventListener('click', () => {
  startupSoundEnabled = !startupSoundEnabled;
  try { localStorage.setItem(startupSoundPreferenceKey, startupSoundEnabled ? 'on' : 'off'); } catch { /* Session-only preference. */ }
  updateStartupSoundToggle();
  if (startupSoundEnabled) void playStartupSound();
  else if (startupAudioContext && startupAudioContext.state !== 'closed') {
    void startupAudioContext.close().catch(() => {});
    startupAudioContext = null;
  }
});

function updateFullscreenToggle() {
  const isFullscreen = document.fullscreenElement === desktop;
  const isSupported = document.fullscreenEnabled && typeof desktop.requestFullscreen === 'function';
  const label = isFullscreen ? 'Exit full screen' : 'Full screen';
  fullscreenToggle.disabled = !isSupported;
  fullscreenToggle.setAttribute('aria-label', label);
  fullscreenToggle.setAttribute('aria-pressed', String(isFullscreen));
  fullscreenToggle.title = isSupported ? label : 'Full screen is unavailable in this browser';
  fullscreenToggleLabel.textContent = label;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === desktop) await document.exitFullscreen();
    else await desktop.requestFullscreen();
  } catch {
    announcement.textContent = 'Full screen could not be changed. Use the browser full-screen controls.';
  }
}

document.querySelector('[data-action="home"]').addEventListener('click', () => showHome());
document.querySelector('[data-action="apps"]').addEventListener('click', () => {
  dock.scrollIntoView({ block: 'nearest', inline: 'center' });
  dock.querySelector('[data-app-id]')?.focus({ preventScroll: true });
});
document.querySelector('.statusbar-brand').addEventListener('click', (event) => {
  event.preventDefault();
  showHome();
});
fullscreenToggle.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenToggle);

function renderCalendarGrid(container, days, monthLabel, currentMonth, today, monthDayLabel) {
  container.replaceChildren();
  container.setAttribute('aria-label', monthLabel);
  const weekdayLong = calendarWeekdays.map((_, index) => new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + index)));
  calendarWeekdays.forEach((weekday, index) => {
    const heading = document.createElement('span');
    heading.setAttribute('role', 'columnheader');
    heading.setAttribute('aria-label', weekdayLong[index]);
    heading.textContent = weekday;
    container.append(heading);
  });
  for (const day of days) {
    const cell = document.createElement('span');
    cell.setAttribute('role', 'gridcell');
    const isToday = day !== null && currentMonth && day === today;
    cell.setAttribute('aria-selected', String(isToday));
    if (day !== null) {
      cell.textContent = String(day);
      cell.setAttribute('aria-label', monthDayLabel(day));
      if (isToday) cell.className = 'is-today';
    }
    container.append(cell);
  }
}

function renderCalendarWidgets(now) {
  const todayBs = adToBs(now);
  const nepaliName = NEPALI_MONTHS[shownBsMonth.month - 1] || '';
  const bsLabel = `${nepaliName} ${shownBsMonth.year}`;
  nepaliMonthTitle.textContent = bsLabel;
  const bsData = getMonthData(shownBsMonth.year, shownBsMonth.month);
  const bsDays = [
    ...Array(bsData.startDay).fill(null),
    ...Array.from({ length: bsData.totalDays }, (_, index) => index + 1),
  ];
  while (bsDays.length < 42) bsDays.push(null);
  renderCalendarGrid(
    nepaliCalendarGrid,
    bsDays,
    bsLabel,
    shownBsMonth.year === todayBs.year && shownBsMonth.month === todayBs.month,
    todayBs.day,
    (day) => `${day} ${nepaliName} ${shownBsMonth.year}`,
  );
  document.getElementById('bs-month-prev').disabled = shownBsMonth.year === MIN_BS_YEAR && shownBsMonth.month === 1;
  document.getElementById('bs-month-next').disabled = shownBsMonth.year === MAX_BS_YEAR && shownBsMonth.month === 12;

  const adYear = shownGregorianMonth.getFullYear();
  const adMonth = shownGregorianMonth.getMonth();
  const adLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(shownGregorianMonth);
  gregorianMonthTitle.textContent = adLabel;
  const firstDay = new Date(adYear, adMonth, 1).getDay();
  const totalDays = new Date(adYear, adMonth + 1, 0).getDate();
  const adDays = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  while (adDays.length < 42) adDays.push(null);
  renderCalendarGrid(
    gregorianCalendarGrid,
    adDays,
    adLabel,
    adYear === now.getFullYear() && adMonth === now.getMonth(),
    now.getDate(),
    (day) => new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(adYear, adMonth, day)),
  );
}

function shiftShownBsMonth(delta) {
  const lastIndex = (MAX_BS_YEAR - MIN_BS_YEAR + 1) * 12 - 1;
  const currentIndex = (shownBsMonth.year - MIN_BS_YEAR) * 12 + shownBsMonth.month - 1;
  const index = Math.max(0, Math.min(lastIndex, currentIndex + delta));
  shownBsMonth = { year: MIN_BS_YEAR + Math.floor(index / 12), month: index % 12 + 1 };
  renderCalendarWidgets(new Date());
}

document.getElementById('bs-month-prev').addEventListener('click', () => shiftShownBsMonth(-1));
document.getElementById('bs-month-next').addEventListener('click', () => shiftShownBsMonth(1));
document.getElementById('ad-month-prev').addEventListener('click', () => {
  shownGregorianMonth = new Date(shownGregorianMonth.getFullYear(), shownGregorianMonth.getMonth() - 1, 1);
  renderCalendarWidgets(new Date());
});
document.getElementById('ad-month-next').addEventListener('click', () => {
  shownGregorianMonth = new Date(shownGregorianMonth.getFullYear(), shownGregorianMonth.getMonth() + 1, 1);
  renderCalendarWidgets(new Date());
});

function updateNetworkStatus() {
  const online = navigator.onLine;
  networkStatus.classList.toggle('is-online', online);
  networkStatus.classList.toggle('is-offline', !online);
  networkStatus.setAttribute('aria-label', `Network ${online ? 'online' : 'offline'}`);
  networkLabel.textContent = online ? 'Online' : 'Offline';
  networkStatus.title = online
    ? 'The browser reports a network connection; clinic services may still be unreachable.'
    : 'The browser reports no network connection.';
}

function initializeBatteryStatus() {
  if (typeof navigator.getBattery !== 'function') return;
  void navigator.getBattery().then((battery) => {
    const update = () => {
      const percentage = Math.round(Math.max(0, Math.min(1, battery.level)) * 100);
      const charging = battery.charging;
      const label = `Battery ${percentage}%${charging ? ', charging' : ''}`;
      batteryLabel.textContent = `${percentage}%`;
      batteryLevel.setAttribute('width', String(12 * Math.max(0, battery.level)));
      batteryStatus.classList.toggle('is-charging', charging);
      batteryStatus.classList.toggle('is-low', percentage <= 20 && !charging);
      batteryStatus.setAttribute('aria-label', label);
      batteryStatus.title = label;
      batteryStatus.hidden = false;
    };
    update();
    battery.addEventListener('chargingchange', update);
    battery.addEventListener('levelchange', update);
  }).catch(() => {});
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

function updateClock() {
  const now = new Date();
  const date = document.getElementById('status-date');
  const time = document.getElementById('status-time');
  date.dateTime = now.toISOString();
  time.dateTime = now.toISOString();
  date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  const formattedTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
  time.textContent = formattedTime;
  localClockTime.dateTime = now.toISOString();
  localClockDate.dateTime = now.toISOString();
  localClockTime.textContent = formattedTime;
  localClockDate.textContent = date.textContent;
  renderCalendarWidgets(now);
  updateIdentityClock();
}

updateNetworkStatus();
initializeBatteryStatus();
updateClock();
window.setInterval(updateClock, 1_000);
window.addEventListener('hashchange', routeFromLocation);
window.addEventListener('popstate', routeFromLocation);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.fullscreenElement !== desktop && activeWindowId) {
    closeWindow(activeWindowId);
  }
});
updateFullscreenToggle();
updateIdentityClock();
updateStartupSoundToggle();
if (connectedStaging) void initializeStagingAuthentication(true);
else initializeOfflinePreview();
