import {
  adToBs,
  getMonthData,
  MAX_BS_YEAR,
  MIN_BS_YEAR,
  NEPALI_DAYS,
  NEPALI_MONTHS,
} from './vendor/nepali-date-utils/index.js';
import { firstPartyApps } from './apps/manifest.js';
import { apiRequestPathIsValid, appApiCapabilitiesForRequest, appContextCapabilitiesForApp, isValidAppCatalog, visibleAppsForCapabilities } from './apps/catalog.js';
import { BrowserClinicMediaHost } from './apps/clinic-app-runtime/mediaHost.js';

const config = window.DENTAL_OS_BROWSER_CONFIG;
const appCatalogTrusted = isValidAppCatalog(firstPartyApps, window.location.origin);
const apps = appCatalogTrusted ? firstPartyApps : [];
const appDisplayOrder = [
  'followups', 'appointments', 'workentry', 'patients', 'lab',
  'treatment', 'protocols', 'staff', 'user-management', 'calendar', 'finance',
];
const appDisplayRank = new Map(appDisplayOrder.map((appId, index) => [appId, index]));
const APP_LAUNCH_MIN_VISIBLE_MS = 2_000;
const APP_LAUNCH_SETTLE_MS = 340;

function orderAppsForDisplay(appList) {
  return [...appList].sort((left, right) => (appDisplayRank.get(left.id) ?? appDisplayOrder.length)
    - (appDisplayRank.get(right.id) ?? appDisplayOrder.length));
}

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
const clinicWidgetMark = document.getElementById('clinic-widget-mark');
const clinicNameLabel = document.getElementById('clinic-name');
const clinicUserLabel = document.getElementById('clinic-user');
const clinicRoleLabel = document.getElementById('clinic-role');
const operatingRoleWidget = document.getElementById('operating-role-widget');
const operatingRoleValue = document.getElementById('operating-role-value');
const signOutButton = document.getElementById('signout-button');
const signOutConfirmationDialog = document.getElementById('signout-confirmation-dialog');
const signOutConfirmationForm = document.getElementById('signout-confirmation-form');
const signOutConfirmationError = document.getElementById('signout-confirmation-error');
const signOutConfirmationCancel = document.getElementById('signout-confirmation-cancel');
const signOutConfirmationConfirm = document.getElementById('signout-confirmation-confirm');
const announcement = document.getElementById('workspace-announcement');
const desktop = document.querySelector('.desktop');
const fullscreenToggle = document.getElementById('fullscreen-toggle');
const fullscreenToggleLabel = fullscreenToggle.querySelector('.fullscreen-toggle-label');
const appExplorerDialog = document.getElementById('app-explorer-dialog');
const appExplorerGrid = document.getElementById('app-explorer-grid');
const appExplorerEmpty = document.getElementById('app-explorer-empty');
const appExplorerClose = document.getElementById('app-explorer-close');
const dockTooltip = document.getElementById('dock-tooltip');
const workspaceRolePicker = document.getElementById('workspace-role-picker');
const switchRoleButton = document.getElementById('switch-role-button');
const workspaceRoleMenu = document.getElementById('workspace-role-menu');
const currentWorkspaceLabel = document.getElementById('current-workspace-label');
const workspaceRoleOptions = document.getElementById('workspace-role-options');
const workspaceSwitchDialog = document.getElementById('workspace-switch-dialog');
const workspaceSwitchForm = document.getElementById('workspace-switch-form');
const workspaceSwitchDescription = document.getElementById('workspace-switch-description');
const workspacePinField = document.getElementById('workspace-pin-field');
const workspacePinInput = document.getElementById('workspace-pin-input');
const workspacePinReveal = document.getElementById('workspace-pin-reveal');
const workspaceSwitchError = document.getElementById('workspace-switch-error');
const workspaceSwitchConfirm = document.getElementById('workspace-switch-confirm');
const workspaceSwitchCancel = document.getElementById('workspace-switch-cancel');
const workspaceSwitchingBackdrop = document.getElementById('workspace-switching-backdrop');
const workspaceSwitchingCard = document.getElementById('workspace-switching-card');
const workspaceSwitchingMessage = document.getElementById('workspace-switching-message');
const workspaceSwitchSuccess = document.getElementById('workspace-switch-success');
const workspaceSwitchSuccessTitle = document.getElementById('workspace-switch-success-title');
const workspaceSwitchSuccessDismiss = document.getElementById('workspace-switch-success-dismiss');
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
let clinicLogoGeneration = 0;
let clinicLogoController = null;
let pendingWorkspaceRole = null;
let workspaceSwitchBusy = false;
let signOutBusy = false;
let workspaceSwitchNoticeTimer = null;
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
const clinicMediaHost = new BrowserClinicMediaHost({
  getContext: () => ({ connected: connectedStaging, session: clinicSession, user: firebaseUser, apiBaseUrl: config?.apiBaseUrl }),
  isCurrent: (app, entry, attempt) => isCurrentAppLaunch(app, entry, attempt) && allowedAppIds.has(app.id),
  onPendingChange: (entry, pending) => {
    entry.mediaPending = pending;
    updateAppHistoryControls(entry);
  },
});

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

function clinicSessionFromMeResponse(payload) {
  const session = payload?.session;
  if (!session?.clinicUser || !Array.isArray(session.clinicUser.capabilities)) return null;
  return session;
}

function trustedCalendarTimeZone() {
  const candidate = clinicSession?.clinic?.timezone;
  if (typeof candidate === 'string' && candidate.length <= 100) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: candidate });
      return candidate;
    } catch {
      // Fall back to the pinned Calendar app's default timezone.
    }
  }
  return 'Asia/Kathmandu';
}

const clinicWorkspaceRoles = new Set(['admin', 'doctor', 'reception']);

function availableWorkspaceRoles(session) {
  const currentRole = session?.clinicUser?.role;
  const roles = session?.clinicUser?.workspaceRoles;
  if (!clinicWorkspaceRoles.has(currentRole) || !Array.isArray(roles)) return [];
  return [...new Set(roles.filter((role) => clinicWorkspaceRoles.has(role) && role !== currentRole))];
}

function workspaceRoleName(role) {
  return clinicWorkspaceRoles.has(role) ? role[0].toLocaleUpperCase() + role.slice(1) : '';
}

function workspaceRoleError(status, payload) {
  const code = payload?.error?.code;
  if (code === 'invalid_workspace_pin') return 'The Admin PIN is incorrect. Check it and try again.';
  if (code === 'workspace_pin_locked') return 'Admin PIN entry is temporarily locked. Try again in 15 minutes.';
  if (code === 'clinic_access_denied') return 'That workspace is not available for this clinic account.';
  if (code === 'workspace_role_conflict') return 'Your clinic account changed. Refresh the workspace and try again.';
  if (status === 503) return 'The clinic service is unavailable right now. Try again in a moment.';
  return payload?.error?.message || 'The workspace change could not be confirmed. Please try again.';
}

function closeWorkspaceRoleMenu(restoreFocus = false) {
  workspaceRoleMenu.hidden = true;
  switchRoleButton.setAttribute('aria-expanded', 'false');
  if (restoreFocus && !switchRoleButton.hidden) switchRoleButton.focus();
}

function updateWorkspaceRolePicker(session) {
  const roles = availableWorkspaceRoles(session);
  currentWorkspaceLabel.textContent = `Current workspace: ${workspaceRoleName(session?.clinicUser?.role)}`;
  workspaceRoleOptions.replaceChildren();
  for (const role of roles) {
    const option = document.createElement('button');
    option.type = 'button';
    option.setAttribute('role', 'menuitem');
    option.textContent = `Switch to ${workspaceRoleName(role)}`;
    option.addEventListener('click', () => selectWorkspaceRole(role));
    workspaceRoleOptions.append(option);
  }
  switchRoleButton.hidden = roles.length === 0;
  closeWorkspaceRoleMenu();
}

function selectWorkspaceRole(role) {
  if (!clinicSession || !availableWorkspaceRoles(clinicSession).includes(role) || workspaceSwitchBusy) return;
  if (!ensureNoAppWork('switch workspaces')) return;
  pendingWorkspaceRole = role;
  closeWorkspaceRoleMenu();
  workspaceSwitchDescription.textContent = 'Save unfinished work first. Switching workspace closes open apps and reloads your clinic access.';
  workspacePinField.hidden = role !== 'admin';
  workspacePinInput.value = '';
  workspaceSwitchError.textContent = '';
  workspaceSwitchError.hidden = true;
  workspaceSwitchConfirm.disabled = false;
  workspaceSwitchConfirm.textContent = `Switch to ${workspaceRoleName(role)}`;
  if (role === 'admin') {
    workspaceSwitchDialog.showModal();
    workspacePinInput.focus();
    return;
  }
  void confirmWorkspaceRoleSwitch(true);
}

function showWorkspaceSwitching(role) {
  workspaceSwitchingMessage.textContent = `Opening the ${workspaceRoleName(role)} workspace…`;
  workspaceSwitchingBackdrop.setAttribute('aria-label', `Switching to the ${workspaceRoleName(role)} workspace`);
  setShellRegionsInert(true);
  workspaceSwitchingBackdrop.hidden = false;
  workspaceSwitchingCard.focus({ preventScroll: true });
}

function hideWorkspaceSwitching() {
  workspaceSwitchingBackdrop.hidden = true;
  workspaceSwitchingBackdrop.removeAttribute('aria-label');
}

function dismissWorkspaceSwitchSuccess() {
  workspaceSwitchSuccess.hidden = true;
  if (workspaceSwitchNoticeTimer !== null) {
    window.clearTimeout(workspaceSwitchNoticeTimer);
    workspaceSwitchNoticeTimer = null;
  }
}

function showWorkspaceSwitchSuccess(role) {
  dismissWorkspaceSwitchSuccess();
  workspaceSwitchSuccessTitle.textContent = `${workspaceRoleName(role)} workspace is active`;
  workspaceSwitchSuccess.hidden = false;
  workspaceSwitchNoticeTimer = window.setTimeout(dismissWorkspaceSwitchSuccess, 5_000);
}

function finishWorkspaceRoleSwitch(role) {
  closeAllWindows({ force: true });
  workspaceSwitchDialog.close();
  pendingWorkspaceRole = null;
  workspacePinInput.value = '';
  hideWorkspaceSwitching();
  setShellRegionsInert(false);
  announcement.textContent = `${workspaceRoleName(role)} workspace is active.`;
  showWorkspaceSwitchSuccess(role);
}

function setWorkspaceSwitchError(message) {
  workspaceSwitchError.textContent = message;
  workspaceSwitchError.hidden = !message;
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

function updateWorkspacePinVisibility(visible) {
  workspacePinInput.classList.toggle('is-obscured', !visible);
  workspacePinReveal.setAttribute('aria-pressed', String(visible));
  workspacePinReveal.setAttribute('aria-label', visible ? 'Hide Admin PIN' : 'Show Admin PIN');
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

function updateClinicWidget(session, authUser) {
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
  operatingRoleValue.textContent = role;
  operatingRoleWidget.hidden = !role;
  clearClinicWidgetLogo(clinicName);
  if (authUser) void loadClinicWidgetLogo(authUser, clinicName);
}

function clinicInitials(name) {
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase();
  return initials || 'SD';
}

function clearClinicWidgetLogo(clinicName = '') {
  clinicLogoGeneration += 1;
  clinicLogoController?.abort();
  clinicLogoController = null;
  clinicWidgetMark.classList.remove('has-logo');
  clinicWidgetMark.replaceChildren(document.createTextNode(clinicInitials(clinicName)));
}

async function loadClinicWidgetLogo(user, clinicName) {
  const requestGeneration = clinicLogoGeneration;
  const controller = new AbortController();
  clinicLogoController = controller;
  try {
    const idToken = await user.getIdToken();
    if (!idToken || requestGeneration !== clinicLogoGeneration) return;

    const apiBase = new URL(config.apiBaseUrl);
    const endpoint = new URL('/v1/clinic/branding/logo/view', apiBase);
    if (endpoint.origin !== apiBase.origin) return;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${idToken}`, accept: 'image/png, image/jpeg, image/webp' },
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    const mimeType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    const supportedTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const contentLength = response.headers.get('content-length');
    if (!response.ok || !supportedTypes.has(mimeType) || !response.body
      || (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 2_000_000))) {
      void response.body?.cancel().catch(() => {});
      return;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 2_000_000) {
          void reader.cancel().catch(() => {});
          return;
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    if (!length || requestGeneration !== clinicLogoGeneration) return;

    const blob = new Blob(chunks, { type: mimeType });
    const logoUrl = await new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.addEventListener('load', () => {
        if (typeof fileReader.result === 'string') resolve(fileReader.result);
        else reject(new Error('Clinic logo could not be decoded.'));
      }, { once: true });
      fileReader.addEventListener('error', () => reject(fileReader.error || new Error('Clinic logo could not be read.')), { once: true });
      fileReader.readAsDataURL(blob);
    });
    if (requestGeneration !== clinicLogoGeneration) return;

    const image = document.createElement('img');
    image.alt = '';
    image.addEventListener('error', () => {
      if (requestGeneration !== clinicLogoGeneration) return;
      clinicWidgetMark.classList.remove('has-logo');
      clinicWidgetMark.replaceChildren(document.createTextNode(clinicInitials(clinicName)));
    }, { once: true });
    image.src = logoUrl;
    clinicWidgetMark.replaceChildren(image);
    clinicWidgetMark.classList.add('has-logo');
  } catch {
    // A missing or unavailable clinic logo falls back to the clinic initials.
  } finally {
    if (clinicLogoController === controller) clinicLogoController = null;
  }
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

function setWindowControlIcon(button, restore = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', restore
    ? 'M4 14h6v6m10-10h-6V4m0 6 6-6M10 14l-6 6'
    : 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3');
  svg.append(path);
  button.replaceChildren(svg);
}

function syncMaximizeControl(section, button, title) {
  const maximized = section.classList.contains('is-maximized');
  button.setAttribute('aria-label', (maximized ? 'Restore ' : 'Maximize ') + title);
  button.title = maximized ? 'Restore window size' : 'Maximize window';
  setWindowControlIcon(button, maximized);
}

function setHistoryButtonIcon(button) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M19 12H5m7 7-7-7 7-7');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  button.replaceChildren(svg);
}

function buildDock() {
  dock.replaceChildren();
  const exploreButton = document.createElement('button');
  exploreButton.className = 'dock-icon dock-explorer-icon';
  exploreButton.type = 'button';
  exploreButton.setAttribute('aria-label', 'Explore apps');
  exploreButton.dataset.dockTooltip = 'Explore apps';

  const exploreGlyph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  exploreGlyph.setAttribute('viewBox', '0 0 32 32');
  exploreGlyph.setAttribute('aria-hidden', 'true');
  for (const [x, y] of [[4, 4], [18, 4], [4, 18], [18, 18]]) {
    const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    square.setAttribute('x', String(x));
    square.setAttribute('y', String(y));
    square.setAttribute('width', '10');
    square.setAttribute('height', '10');
    square.setAttribute('rx', '2.2');
    square.setAttribute('fill', 'currentColor');
    exploreGlyph.append(square);
  }
  exploreButton.append(exploreGlyph);
  attachDockTooltip(exploreButton);
  exploreButton.addEventListener('click', openAppExplorer);
  dock.append(exploreButton);

  for (const app of orderAppsForDisplay(apps.filter((app) => app.id !== 'calendar'))) {
    if (!allowedAppIds.has(app.id)) continue;
    const button = document.createElement('button');
    button.className = 'dock-icon';
    button.type = 'button';
    button.dataset.appId = app.id;
    button.dataset.dockTooltip = app.title;
    button.setAttribute('aria-label', 'Open ' + app.title);
    button.setAttribute('aria-pressed', 'false');

    const image = document.createElement('img');
    image.className = 'dock-artwork';
    image.src = app.icon;
    image.alt = '';
    image.draggable = false;
    image.width = 256;
    image.height = 256;

    const running = document.createElement('span');
    running.className = 'running-dot';
    running.setAttribute('aria-hidden', 'true');

    button.append(image, running);
    attachDockTooltip(button);
    button.addEventListener('click', () => openApp(app.id));
    dock.append(button);
  }
}

function attachDockTooltip(button) {
  button.addEventListener('pointerenter', () => showDockTooltip(button));
  button.addEventListener('pointerleave', hideDockTooltip);
  button.addEventListener('focus', () => showDockTooltip(button));
  button.addEventListener('blur', hideDockTooltip);
}

function showDockTooltip(button) {
  const label = button.dataset.dockTooltip;
  if (!label) return;
  dockTooltip.textContent = label;
  dockTooltip.hidden = false;
  const buttonRect = button.getBoundingClientRect();
  const tooltipRect = dockTooltip.getBoundingClientRect();
  const halfWidth = tooltipRect.width / 2;
  const centerX = buttonRect.left + buttonRect.width / 2;
  const left = Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, centerX));
  const aboveTop = buttonRect.top - tooltipRect.height - 9;
  const top = aboveTop >= 8 ? aboveTop : Math.min(window.innerHeight - tooltipRect.height - 8, buttonRect.bottom + 9);
  dockTooltip.style.left = `${left}px`;
  dockTooltip.style.top = `${top}px`;
}

function hideDockTooltip() {
  dockTooltip.hidden = true;
}

function renderAppExplorer() {
  appExplorerGrid.replaceChildren();
  const visibleApps = orderAppsForDisplay(apps.filter((app) => app.id !== 'calendar' && allowedAppIds.has(app.id)));
  appExplorerEmpty.hidden = visibleApps.length > 0;

  for (const app of visibleApps) {
    const button = document.createElement('button');
    button.className = 'app-explorer-card';
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', 'Open ' + app.title);

    const image = document.createElement('img');
    image.src = app.icon;
    image.alt = '';
    image.width = 256;
    image.height = 256;

    const label = document.createElement('span');
    label.textContent = app.title;
    button.append(image, label);
    button.addEventListener('click', () => {
      appExplorerDialog.close();
      openApp(app.id);
    });
    appExplorerGrid.append(button);
  }
}

function openAppExplorer() {
  renderAppExplorer();
  if (!appExplorerDialog.open) appExplorerDialog.showModal();
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
  homeView.hidden = !clinicSession && connectedStaging;
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
  syncAppLaunchFeedbackForWindows();
  if (shouldFocus) entry.element.focus({ preventScroll: true });
}

function clearAppLaunchTimers(entry) {
  if (entry.launchTimer) window.clearTimeout(entry.launchTimer);
  if (entry.launchHandoffTimer) window.clearTimeout(entry.launchHandoffTimer);
  entry.launchTimer = null;
  entry.launchHandoffTimer = null;
}

function pauseAppLaunchFeedback(entry) {
  if (entry.launchTimer) window.clearTimeout(entry.launchTimer);
  entry.launchTimer = null;
  if (entry.launchStartedAt !== null) {
    entry.launchElapsedMs = Math.min(APP_LAUNCH_MIN_VISIBLE_MS,
      entry.launchElapsedMs + Math.max(0, performance.now() - entry.launchStartedAt));
  }
  entry.launchStartedAt = null;
}

function isForegroundAppLaunch(entry) {
  return !document.hidden && !entry.element.hidden && activeWindowId === entry.app.id
    && topVisibleWindowId() === entry.app.id;
}

function revealAppRuntime(entry) {
  if (entry.launchHandoff !== 'waiting' || !entry.runtimeReady || !entry.frame) return;
  pauseAppLaunchFeedback(entry);
  entry.launchHandoff = 'revealing';
  entry.frame.removeAttribute('aria-hidden');
  entry.frame.removeAttribute('tabindex');
  const splash = entry.runtimeHost.querySelector('.app-runtime-loading');
  window.requestAnimationFrame(() => {
    if (entry.launchHandoff !== 'revealing') return;
    entry.frame?.classList.add('is-revealed');
    splash?.classList.add('is-exiting');
  });
  const settleDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : APP_LAUNCH_SETTLE_MS;
  entry.launchHandoffTimer = window.setTimeout(() => {
    entry.launchHandoffTimer = null;
    if (entry.launchHandoff !== 'revealing') return;
    splash?.remove();
    entry.launchHandoff = 'complete';
  }, settleDelay);
}

function syncAppLaunchFeedback(entry) {
  if (entry.launchHandoff !== 'waiting') return;
  if (!isForegroundAppLaunch(entry)) {
    pauseAppLaunchFeedback(entry);
    return;
  }

  if (entry.launchElapsedMs >= APP_LAUNCH_MIN_VISIBLE_MS) {
    if (entry.runtimeReady) revealAppRuntime(entry);
    return;
  }

  if (entry.launchStartedAt === null) entry.launchStartedAt = performance.now();
  const elapsed = entry.launchElapsedMs + Math.max(0, performance.now() - entry.launchStartedAt);
  if (elapsed >= APP_LAUNCH_MIN_VISIBLE_MS) {
    entry.launchElapsedMs = APP_LAUNCH_MIN_VISIBLE_MS;
    entry.launchStartedAt = null;
    if (entry.launchTimer) window.clearTimeout(entry.launchTimer);
    entry.launchTimer = null;
    if (entry.runtimeReady) revealAppRuntime(entry);
    return;
  }
  if (!entry.launchTimer) {
    entry.launchTimer = window.setTimeout(() => {
      entry.launchTimer = null;
      syncAppLaunchFeedback(entry);
    }, Math.max(1, APP_LAUNCH_MIN_VISIBLE_MS - elapsed));
  }
}

function syncAppLaunchFeedbackForWindows() {
  for (const entry of openWindows.values()) syncAppLaunchFeedback(entry);
}

function resetAppLaunchFeedback(entry) {
  clearAppLaunchTimers(entry);
  entry.launchElapsedMs = 0;
  entry.launchStartedAt = null;
  entry.launchHandoff = 'waiting';
}

function isCurrentAppLaunch(app, entry, attempt) {
  return openWindows.get(app.id) === entry && !entry.disposed
    && entry.runtimeAttempt === attempt && allowedAppIds.has(app.id);
}

function setAppRuntimeState(entry, title, description, retry) {
  entry.runtimeHost.dataset.state = retry ? 'error' : 'loading';
  entry.runtimeHost.setAttribute('aria-busy', 'false');
  const message = document.createElement('div');
  message.className = 'app-runtime-state';
  message.setAttribute('role', retry ? 'alert' : 'status');
  entry.element.dataset.appState = retry ? 'error' : 'loading';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const detail = document.createElement('span');
  detail.textContent = description;
  message.append(heading, detail);
  if (retry) {
    const button = makeButton('app-runtime-retry', 'Retry app launch', 'Retry', retry);
    message.append(button);
  }
  entry.runtimeHost.replaceChildren(message);
}

function setAppRuntimeLoading(entry, app) {
  entry.runtimeHost.dataset.state = 'loading';
  entry.runtimeHost.setAttribute('aria-busy', 'true');
  entry.element.dataset.appState = 'loading';

  const splash = document.createElement('div');
  splash.className = 'app-runtime-loading';
  splash.setAttribute('role', 'status');
  splash.setAttribute('aria-live', 'polite');

  const icon = document.createElement('img');
  icon.className = 'app-runtime-loading-icon';
  icon.src = app.icon;
  icon.alt = '';
  icon.draggable = false;

  const title = document.createElement('strong');
  title.textContent = app.title;

  const progress = document.createElement('span');
  progress.className = 'app-runtime-loading-progress';
  const spinner = document.createElement('span');
  spinner.className = 'app-runtime-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const description = document.createElement('span');
  description.textContent = 'Opening your workspace…';
  progress.append(spinner, description);
  splash.append(icon, title, progress);
  entry.runtimeHost.replaceChildren(splash);
}

function disposeAppRuntime(entry) {
  if (!entry || entry.disposed) return;
  entry.disposed = true;
  entry.runtimeAttempt += 1;
  if (entry.readyTimer) window.clearTimeout(entry.readyTimer);
  entry.readyTimer = null;
  clearAppLaunchTimers(entry);
  entry.launchStartedAt = null;
  entry.launchHandoff = 'disposed';
  for (const controller of entry.apiControllers?.values() ?? []) controller.abort();
  entry.apiControllers?.clear();
  clinicMediaHost.dispose(entry);
  entry.port?.close();
  entry.port = null;
  entry.frame?.remove();
  entry.frame = null;
  entry.runtimeHost.replaceChildren();
}

async function readBoundedResponse(response, maxBytes, acceptedContentTypes, allowHttpErrors = false) {
  if ((!response.ok && !allowHttpErrors) || response.redirected || !response.body) return null;
  if (!acceptedContentTypes.includes(response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase())) return null;
  const contentLength = response.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length) return null;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readTrustedAppAsset(path, expectedSha256, maxBytes, acceptedContentTypes) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname !== path || url.search || url.hash) {
    throw new Error('The app package path is not trusted.');
  }
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: acceptedContentTypes.join(', ') },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  });
  if (response.url && new URL(response.url).origin !== window.location.origin) {
    void response.body?.cancel().catch(() => {});
    throw new Error('The app package left the browser origin.');
  }
  const bytes = await readBoundedResponse(response, maxBytes, acceptedContentTypes);
  if (!bytes || typeof crypto === 'undefined' || !crypto.subtle) throw new Error('The app package could not be verified.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actualSha256 = Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
  if (actualSha256 !== expectedSha256) throw new Error('The app package checksum did not match.');
  return bytes;
}

async function verifyTrustedAppBundle(app) {
  if (!appCatalogTrusted) throw new Error('The first-party app catalog is not trusted.');
  const assets = [
    readTrustedAppAsset(app.bundle.entry, app.bundle.entrySha256, 1_048_576, ['text/html']),
    readTrustedAppAsset(app.bundle.script, app.bundle.scriptSha256, 1_048_576, ['text/javascript', 'application/javascript']),
  ];
  if (app.bundle.style) assets.push(readTrustedAppAsset(app.bundle.style, app.bundle.styleSha256, 262_144, ['text/css']));
  const [entryBytes, scriptBytes, styleBytes] = await Promise.all(assets);
  const html = new TextDecoder('utf-8', { fatal: true }).decode(entryBytes);
  const scriptDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', scriptBytes));
  const scriptIntegrity = `sha256-${btoa(String.fromCharCode(...scriptDigest))}`;
  if (!html.includes(`integrity="${scriptIntegrity}"`)) {
    throw new Error('The app entry does not pin its expected runtime bundle.');
  }
  if (app.bundle.style) {
    const styleDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', styleBytes));
    const styleIntegrity = `sha256-${btoa(String.fromCharCode(...styleDigest))}`;
    const styleText = new TextDecoder('utf-8', { fatal: true }).decode(styleBytes);
    if (!html.includes(`style-src '${styleIntegrity}'`) || !html.includes(`<style>${styleText}</style>`)) {
      throw new Error('The app entry does not pin its expected stylesheet.');
    }
  }
}

function createAppLaunchNonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (value) => value.toString(16).padStart(2, '0')).join('');
}

function appEnvelopeMatches(app, entry, message) {
  return message.appId === app.id && message.version === app.version
    && message.nonce === entry.nonce;
}

function sendAppPortMessage(entry, message) {
  try {
    entry.port?.postMessage({
      appId: entry.app.id,
      version: entry.app.version,
      nonce: entry.nonce,
      ...message,
    });
  } catch {
    // A closed app channel is cleaned up by its window lifecycle.
  }
}

async function requestGrantedAppApi(app, entry, attempt, request, signal) {
  const write = request.method !== 'GET';
  if (!apiRequestPathIsValid(request.path)
    || (write && (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.idempotencyKey)
      || typeof request.body !== 'string' || new TextEncoder().encode(request.body).byteLength > 12_000))) {
    return { ok: false, code: 'invalid_request', message: 'This clinic request is not valid.' };
  }
  if (!connectedStaging || !clinicSession || !firebaseUser || !config?.apiBaseUrl) {
    return { ok: false, code: 'clinic_session_unavailable', message: 'A verified clinic session is required.' };
  }
  let body = null;
  if (write) {
    try { body = JSON.parse(request.body); } catch { return { ok: false, code: 'invalid_request', message: 'This clinic request is not valid.' }; }
  }
  const requiredCapabilities = appApiCapabilitiesForRequest(app, request.method, request.path, body);
  if (!requiredCapabilities) return { ok: false, code: 'route_not_granted', message: 'This app does not have permission for that clinic route.' };
  const capabilities = clinicSession.clinicUser.capabilities;
  if (!Array.isArray(capabilities) || requiredCapabilities.some(capability => !capabilities.includes(capability))) {
    return { ok: false, code: 'clinic_access_denied', message: 'Your clinic role does not permit this action.' };
  }
  const base = new URL(config.apiBaseUrl);
  const url = new URL(request.path, base);
  const requestPath = request.path.split('?', 1)[0];
  if (base.protocol !== 'https:' || url.origin !== base.origin || url.pathname !== requestPath || url.hash) {
    return { ok: false, code: 'route_not_granted', message: 'This app route is not available.' };
  }
  const idToken = await firebaseUser.getIdToken();
  if (!isCurrentAppLaunch(app, entry, attempt) || !allowedAppIds.has(app.id) || signal?.aborted) {
    return { ok: false, code: 'clinic_session_unavailable', message: 'Clinic access changed. Reopen the app.' };
  }
  const response = await fetch(url, {
    method: request.method,
    headers: {
      authorization: `Bearer ${idToken}`,
      accept: 'application/json',
      ...(write ? { 'content-type': 'application/json', 'idempotency-key': request.idempotencyKey } : {}),
    },
    ...(write ? { body: request.body } : {}),
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  const responseLimit = app.id === 'finance' ? 262_144 : 524_288;
  const bytes = await readBoundedResponse(response, responseLimit, ['application/json'], true);
  if (!bytes) return { ok: false, code: 'clinic_service_unavailable', message: 'The clinic service response could not be read.' };
  let data;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, code: 'invalid_clinic_response', message: 'The clinic service returned an invalid response.' };
  }
  return { ok: true, data: { status: response.status, body: data } };
}

function appRequestLimitReached(entry, countRateLimitedRequest = true) {
  if (countRateLimitedRequest) {
    const now = Date.now();
    if (now - entry.requestWindowStartedAt >= 60_000) {
      entry.requestWindowStartedAt = now;
      entry.requestCount = 0;
    }
    entry.requestCount += 1;
  }
  return (countRateLimitedRequest && entry.requestCount > 30) || entry.pendingRequests >= 4;
}

function sendAppRequestError(entry, type, requestId, code, message) {
  sendAppPortMessage(entry, { type, requestId, ok: false, code, message });
}

async function handleAppPortMessage(app, entry, attempt, message) {
  if (!isCurrentAppLaunch(app, entry, attempt)) return;
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    failAppRuntime(app, entry, attempt, 'The app sent an invalid message.');
    return;
  }
  if (!entry.runtimeReady) {
    if (Object.keys(message).sort().join(',') !== 'appId,bundleSha256,nonce,type,version'
      || message.type !== 'app:ready' || !appEnvelopeMatches(app, entry, message)) {
      failAppRuntime(app, entry, attempt, 'The app session could not be verified.');
      return;
    }
    if (message.bundleSha256 !== app.bundle.scriptSha256) {
      failAppRuntime(app, entry, attempt, 'The app runtime version did not match the trusted manifest.');
      return;
    }
    entry.runtimeReady = true;
    if (entry.readyTimer) window.clearTimeout(entry.readyTimer);
    entry.readyTimer = null;
    entry.runtimeHost.dataset.state = 'ready';
    entry.runtimeHost.setAttribute('aria-busy', 'false');
    entry.element.dataset.appState = 'ready';
    syncAppLaunchFeedback(entry);
    return;
  }

  if (!appEnvelopeMatches(app, entry, message)) {
    failAppRuntime(app, entry, attempt, 'The app sent a request outside its approved interface.');
    return;
  }
  if (message.type === 'app:lifecycle') {
    const keys = ['appId', 'dirty', 'modal', 'nonce', 'pendingWrite', 'type', 'version'];
    if (Object.keys(message).sort().join(',') !== keys.join(',')
      || typeof message.dirty !== 'boolean' || typeof message.modal !== 'boolean'
      || typeof message.pendingWrite !== 'boolean') {
      failAppRuntime(app, entry, attempt, 'The app sent invalid work-state information.');
      return;
    }
    entry.lifecycle = { dirty: message.dirty, modal: message.modal, pendingWrite: message.pendingWrite };
    updateAppHistoryControls(entry);
    return;
  }
  if (message.type === 'app:navigation-state') {
    const keys = ['appId', 'canGoBack', 'canNavigate', 'nonce', 'type', 'version'];
    if (Object.keys(message).sort().join(',') !== keys.join(',')
      || typeof message.canGoBack !== 'boolean' || typeof message.canNavigate !== 'boolean') {
      failAppRuntime(app, entry, attempt, 'The app sent invalid navigation state.');
      return;
    }
    entry.navigationState = { canGoBack: message.canGoBack, canNavigate: message.canNavigate };
    updateAppHistoryControls(entry);
    return;
  }

  if (message.type === 'app:api-cancel' || message.type === 'app:media-cancel') {
    const keys = ['appId', 'nonce', 'requestId', 'type', 'version'];
    if (Object.keys(message).sort().join(',') !== keys.join(',') || typeof message.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(message.requestId)) {
      failAppRuntime(app, entry, attempt, 'The app sent an invalid cancellation request.');
      return;
    }
    if (message.type === 'app:api-cancel') entry.apiControllers.get(message.requestId)?.abort();
    else clinicMediaHost.cancel(entry, message.requestId);
    return;
  }

  if (message.type === 'app:media-request') {
    const expected = ['appId', 'input', 'nonce', 'operation', 'requestId', 'type', 'version'];
    if (Object.keys(message).sort().join(',') !== expected.join(',') || typeof message.requestId !== 'string'
      || !/^[a-f0-9]{32}$/.test(message.requestId) || !['clinic.media.read', 'clinic.media.upload'].includes(message.operation)
      || !message.input || typeof message.input !== 'object' || Array.isArray(message.input)) {
      failAppRuntime(app, entry, attempt, 'The app sent a media request outside its approved interface.');
      return;
    }
    // Binary uploads use one bounded host message per 8 KiB chunk. The media
    // host caps each transfer at 10 MiB and bounds concurrent transfers, so
    // count other media operations against the normal app request window but
    // do not reject a valid upload after its 30th chunk.
    const isMediaUploadChunk = message.operation === 'clinic.media.upload' && message.input.action === 'chunk';
    if (appRequestLimitReached(entry, !isMediaUploadChunk)) {
      sendAppRequestError(entry, 'app:media-response', message.requestId, 'request_limit', 'This app has reached its request limit.');
      return;
    }
    entry.pendingRequests += 1;
    void clinicMediaHost.handle(app, entry, attempt, message).then(data => {
      if (isCurrentAppLaunch(app, entry, attempt)) sendAppPortMessage(entry, { type: 'app:media-response', requestId: message.requestId, ok: true, data });
    }).catch(cause => {
      if (isCurrentAppLaunch(app, entry, attempt)) sendAppRequestError(entry, 'app:media-response', message.requestId,
        typeof cause?.code === 'string' ? cause.code : 'UNKNOWN_OUTCOME',
        typeof cause?.message === 'string' ? cause.message : 'The private media result is not confirmed.');
    }).finally(() => { entry.pendingRequests = Math.max(0, entry.pendingRequests - 1); });
    return;
  }

  const expectedKeys = ['appId', 'body', 'idempotencyKey', 'method', 'nonce', 'path', 'requestId', 'type', 'version'];
  const basicRequestValid = message.type === 'app:api-request'
    && Object.keys(message).sort().join(',') === expectedKeys.join(',')
    && typeof message.requestId === 'string' && /^[a-f0-9]{32}$/.test(message.requestId)
    && ['GET', 'POST', 'PUT', 'PATCH'].includes(message.method)
    && typeof message.path === 'string' && message.path.length > 0 && message.path.length <= 1024;
  const isWrite = message.method !== 'GET';
  const requestBodyValid = isWrite
    ? typeof message.body === 'string' && new TextEncoder().encode(message.body).byteLength <= 12_000
      && typeof message.idempotencyKey === 'string'
      && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.idempotencyKey)
      && (() => { try { const body = JSON.parse(message.body); return body && typeof body === 'object' && !Array.isArray(body); } catch { return false; } })()
    : message.body === null && message.idempotencyKey === null;
  if (!basicRequestValid || !requestBodyValid) {
    failAppRuntime(app, entry, attempt, 'The app sent a request outside its approved interface.');
    return;
  }
  if (appRequestLimitReached(entry)) {
    sendAppRequestError(entry, 'app:api-response', message.requestId, 'request_limit', 'This app has reached its request limit.');
    return;
  }
  entry.pendingRequests += 1;
  const controller = new AbortController();
  entry.apiControllers.set(message.requestId, controller);
  try {
    const result = await requestGrantedAppApi(app, entry, attempt, message, controller.signal);
    if (isCurrentAppLaunch(app, entry, attempt)) {
      sendAppPortMessage(entry, { type: 'app:api-response', requestId: message.requestId, ...result });
    }
  } catch {
    if (isCurrentAppLaunch(app, entry, attempt)) {
      sendAppPortMessage(entry, { type: 'app:api-response', requestId: message.requestId, ok: false,
        code: isWrite ? 'unknown_outcome' : 'clinic_service_unavailable',
        message: isWrite ? 'The save result is not confirmed.' : 'The clinic service could not be reached.' });
    }
  } finally {
    entry.apiControllers.delete(message.requestId);
    entry.pendingRequests = Math.max(0, entry.pendingRequests - 1);
  }
}

function failAppRuntime(app, entry, attempt, message) {
  if (!isCurrentAppLaunch(app, entry, attempt)) return;
  if (entry.readyTimer) window.clearTimeout(entry.readyTimer);
  entry.readyTimer = null;
  clearAppLaunchTimers(entry);
  entry.launchStartedAt = null;
  entry.launchHandoff = 'failed';
  entry.port?.close();
  entry.port = null;
  entry.frame?.remove();
  entry.frame = null;
  entry.runtimeReady = false;
  setAppRuntimeState(entry, 'App could not be started', message, () => void initializeAppRuntime(app, entry));
}

async function initializeAppRuntime(app, entry) {
  const attempt = ++entry.runtimeAttempt;
  resetAppLaunchFeedback(entry);
  entry.runtimeReady = false;
  entry.requestCount = 0;
  entry.pendingRequests = 0;
  entry.requestWindowStartedAt = Date.now();
  setAppRuntimeLoading(entry, app);
  try {
    await verifyTrustedAppBundle(app);
    if (!isCurrentAppLaunch(app, entry, attempt)) return;

    const iframe = document.createElement('iframe');
    iframe.className = 'app-runtime-frame';
    iframe.title = app.title + ' isolated app';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.referrerPolicy = 'no-referrer';
    iframe.allow = '';
    iframe.loading = 'eager';
    entry.frame = iframe;
    entry.nonce = createAppLaunchNonce();
    entry.runtimeHost.dataset.state = 'connecting';
    entry.runtimeHost.append(iframe);

    const channel = new MessageChannel();
    entry.port = channel.port1;
    entry.port.onmessage = (event) => void handleAppPortMessage(app, entry, attempt, event.data);
    entry.port.onmessageerror = () => failAppRuntime(app, entry, attempt, 'The app communication channel failed.');
    entry.port.start();
    let loaded = false;
    iframe.addEventListener('load', () => {
      if (!isCurrentAppLaunch(app, entry, attempt)) return;
      if (loaded) {
        failAppRuntime(app, entry, attempt, 'The app tried to navigate outside its trusted package.');
        return;
      }
      loaded = true;
      try {
        const clinicContext = ['workentry', 'patients', 'appointments', 'followups', 'staff', 'lab', 'user-management'].includes(app.id) ? (() => {
          const rawCapabilities = clinicSession?.clinicUser?.capabilities;
          const appContextCapabilities = appContextCapabilitiesForApp(app.id);
          const capabilities = Array.isArray(rawCapabilities)
            ? appContextCapabilities.filter(capability => rawCapabilities.includes(capability))
            : [];
          const sourceRole = clinicSession?.clinicUser?.role;
          const role = sourceRole === 'reception' ? 'assistant' : sourceRole;
          const clinicDisplayName = clinicSession?.clinic?.displayName ?? clinicSession?.clinic?.name ?? 'Dental clinic';
          const clinicUserId = clinicSession?.clinicUser?.clinicUserId;
          if (!['admin', 'doctor', 'reception', 'assistant'].includes(role)
            || typeof clinicDisplayName !== 'string' || clinicDisplayName.length > 160
            || /[\u0000-\u001f\u007f]/.test(clinicDisplayName) || capabilities.length > 16
            || (app.id === 'user-management' && (role !== 'admin' || !capabilities.includes('clinic_users.manage')
              || typeof clinicUserId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(clinicUserId)))) {
            throw new Error('The verified clinic session context is incomplete.');
          }
          return { capabilities, role, clinicDisplayName, ...(app.id === 'user-management' ? { clinicUserId } : {}) };
        })() : {};
        const financeContext = Array.isArray(app.sessionCapabilities) ? {
          capabilities: app.sessionCapabilities.filter(capability => clinicSession?.clinicUser?.capabilities?.includes(capability)),
        } : {};
        const calendarContext = app.id === 'calendar' ? { clinicTimeZone: trustedCalendarTimeZone() } : {};
        iframe.contentWindow.postMessage({
          type: 'dental-os:init',
          appId: app.id,
          title: app.title,
          version: app.version,
          nonce: entry.nonce,
          bundleSha256: app.bundle.scriptSha256,
          ...clinicContext,
          ...financeContext,
          ...calendarContext,
        }, '*', [channel.port2]);
      } catch {
        failAppRuntime(app, entry, attempt, 'The app could not establish its private channel.');
      }
    });
    entry.readyTimer = window.setTimeout(() => {
      failAppRuntime(app, entry, attempt, 'The app did not complete its secure startup handshake.');
    }, 8_000);
    iframe.src = app.bundle.entry;
  } catch {
    failAppRuntime(app, entry, attempt, 'The app package failed its integrity check or could not be loaded.');
  }
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
  syncAppLaunchFeedbackForWindows();
}

function closeWindow(appId) {
  const entry = openWindows.get(appId);
  if (!entry) return;
  if (hasUnresolvedAppWork(entry)) {
    focusWindow(appId, true);
    announcement.textContent = workGuardMessage(entry, 'close this app');
    return;
  }
  disposeAppRuntime(entry);
  entry.element.remove();
  openWindows.delete(appId);
  if (activeWindowId === appId) syncRouteToVisibleWindow();
  else {
    updateDock();
    syncAppLaunchFeedbackForWindows();
  }
  announcement.textContent = (appById.get(appId)?.title || 'App') + ' closed.';
}

function closeAllWindows({ force = false } = {}) {
  if (!force) {
    const blocked = [...openWindows.values()].find(hasUnresolvedAppWork);
    if (blocked) {
      focusWindow(blocked.app.id, true);
      announcement.textContent = workGuardMessage(blocked, 'leave this workspace');
      return false;
    }
  }
  for (const entry of openWindows.values()) {
    disposeAppRuntime(entry);
    entry.element.remove();
  }
  openWindows.clear();
  activeWindowId = null;
  setRoute(null, true);
  updateHome();
  updateDock();
  syncAppLaunchFeedbackForWindows();
  return true;
}

function hasUnresolvedAppWork(entry) {
  return !!(entry.lifecycle?.dirty || entry.lifecycle?.modal || entry.lifecycle?.pendingWrite || entry.mediaPending);
}

function workGuardMessage(entry, action) {
  if (entry.lifecycle?.pendingWrite || entry.mediaPending) return `Check the original save in ${entry.app.title} before you ${action}.`;
  return `Save or cancel the open work in ${entry.app.title} before you ${action}.`;
}

function ensureNoAppWork(action) {
  const blocked = [...openWindows.values()].find(hasUnresolvedAppWork);
  if (!blocked) return true;
  focusWindow(blocked.app.id, true);
  announcement.textContent = workGuardMessage(blocked, action);
  return false;
}

function updateAppHistoryControls(entry) {
  if (!entry.backButton) return;
  entry.backButton.disabled = !(entry.runtimeReady
    && entry.navigationState?.canGoBack
    && entry.navigationState?.canNavigate
    && !entry.lifecycle?.modal
    && !entry.lifecycle?.pendingWrite
    && !entry.mediaPending);
}

function navigateAppBack(entry) {
  if (!entry || !entry.runtimeReady || entry.backButton?.disabled
    || entry.lifecycle?.modal || entry.lifecycle?.pendingWrite || entry.mediaPending) return;
  sendAppPortMessage(entry, { type: 'app:navigate-back' });
}

function minimizeWindow(appId) {
  const entry = openWindows.get(appId);
  if (!entry) return;
  entry.element.hidden = true;
  if (activeWindowId === appId) syncRouteToVisibleWindow();
  else {
    updateHome();
    syncAppLaunchFeedbackForWindows();
  }
  announcement.textContent = (appById.get(appId)?.title || 'App') + ' minimized.';
}

function createWindow(app, shift) {
  const section = document.createElement('section');
  section.className = 'app-window';
  section.dataset.appId = app.id;
  section.dataset.appVersion = app.version;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'false');
  section.setAttribute('aria-label', app.title + ' window');
  section.tabIndex = -1;
  section.style.setProperty('--window-shift', shift + 'px');

  const titlebar = document.createElement('header');
  titlebar.className = 'window-titlebar';

  const leading = document.createElement('div');
  leading.className = 'window-titlebar-leading';
  const controls = document.createElement('div');
  controls.className = 'window-controls';

  const maximizeButton = makeButton('window-control maximize-control', 'Maximize ' + app.title, '', () => {
    section.classList.toggle('is-maximized');
    syncMaximizeControl(section, maximizeButton, app.title);
  });
  setWindowControlIcon(maximizeButton);
  controls.append(
    maximizeButton,
    makeButton('window-control minimize-control', 'Minimize ' + app.title, '−', () => minimizeWindow(app.id)),
    makeButton('window-control close-control', 'Close ' + app.title, '×', () => closeWindow(app.id)),
  );

  const historyControls = document.createElement('div');
  historyControls.className = 'window-history-controls';
  historyControls.setAttribute('role', 'group');
  historyControls.setAttribute('aria-label', 'Page navigation');
  const backButton = makeButton('window-history-button', 'Back', '', () => navigateAppBack(openWindows.get(app.id)));
  setHistoryButtonIcon(backButton);
  backButton.disabled = true;
  historyControls.append(backButton);
  leading.append(controls, historyControls);

  const title = document.createElement('strong');
  title.className = 'window-title';
  title.textContent = app.title;
  titlebar.append(leading, title);

  const content = document.createElement('div');
  content.className = 'window-content app-runtime-content';
  const runtimeHost = document.createElement('div');
  runtimeHost.className = 'app-runtime-host';
  runtimeHost.dataset.state = 'loading';
  content.append(runtimeHost);

  section.append(titlebar, content);
  for (const edge of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
    const handle = document.createElement('div');
    handle.className = 'window-resize-handle window-resize-' + edge;
    handle.dataset.edge = edge;
    handle.setAttribute('aria-hidden', 'true');
    section.append(handle);
    enableWindowResize(section, handle, maximizeButton, app.title);
  }
  enableWindowDrag(section, titlebar, maximizeButton, app.title);
  windowStage.append(section);
  return {
    element: section, app, runtimeHost, backButton, frame: null, port: null, readyTimer: null,
    maximizeButton,
    runtimeReady: false, runtimeAttempt: 0, disposed: false,
    launchElapsedMs: 0, launchStartedAt: null, launchTimer: null, launchHandoffTimer: null, launchHandoff: 'waiting',
    lifecycle: { dirty: false, modal: false, pendingWrite: false }, navigationState: { canGoBack: false, canNavigate: true },
    fullscreenRestore: document.fullscreenElement === desktop
      ? { style: section.getAttribute('style'), maximized: section.classList.contains('is-maximized') }
      : null,
    apiControllers: new Map(), mediaPending: false,
  };
}

function enableWindowDrag(section, titlebar, maximizeButton, appTitle) {
  let drag = null;
  titlebar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button, .window-resize-handle')) return;
    const rect = section.getBoundingClientRect();
    const stageRect = windowStage.getBoundingClientRect();
    event.preventDefault();
    if (section.classList.contains('is-maximized')) {
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, maximizedRect: rect, stageRect, maximized: true };
      titlebar.setPointerCapture(event.pointerId);
      focusWindow(section.dataset.appId);
      return;
    }
    // Keep the initial centered transform until the pointer actually moves.
    // Normalizing top/left on pointerdown alone applies translateY(-50%) twice,
    // which can make the first drag jump away from the pointer.
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, stageRect, started: false };
    titlebar.setPointerCapture(event.pointerId);
    focusWindow(section.dataset.appId);
  });

  titlebar.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    if (drag.maximized) {
      const clickRatio = Math.min(0.9, Math.max(0.1, (drag.x - drag.maximizedRect.left) / Math.max(1, drag.maximizedRect.width)));
      const titlebarOffset = Math.min(22, Math.max(8, drag.y - drag.maximizedRect.top));
      section.classList.remove('is-maximized');
      syncMaximizeControl(section, maximizeButton, appTitle);

      const restoredRect = section.getBoundingClientRect();
      const { stageRect } = drag;
      const dockRect = dock.hidden ? null : dock.getBoundingClientRect();
      const bottomLimit = dockRect ? Math.min(stageRect.bottom, dockRect.top - 12) : stageRect.bottom;
      const maxLeft = Math.max(stageRect.left, stageRect.right - 80);
      const maxTop = Math.max(stageRect.top + 35, bottomLimit - restoredRect.height);
      const left = Math.min(maxLeft, Math.max(stageRect.left, event.clientX - restoredRect.width * clickRatio));
      const top = Math.min(maxTop, Math.max(stageRect.top + 35, event.clientY - titlebarOffset));
      section.style.left = ((left - stageRect.left) / stageRect.width * 100) + '%';
      section.style.top = ((top - stageRect.top) / stageRect.height * 100) + '%';
      section.style.transform = 'none';
      section.classList.add('is-dragging');
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left, top, stageRect };
      return;
    }
    if (!drag.started) {
      const { stageRect } = drag;
      section.style.left = ((drag.left - stageRect.left) / stageRect.width * 100) + '%';
      section.style.top = ((drag.top - stageRect.top) / stageRect.height * 100) + '%';
      section.style.transform = 'none';
      section.classList.add('is-dragging');
      drag.started = true;
    }
    const { stageRect } = drag;
    const dockRect = dock.hidden ? null : dock.getBoundingClientRect();
    const bottomLimit = dockRect ? Math.min(stageRect.bottom, dockRect.top - 12) : stageRect.bottom;
    const left = Math.min(stageRect.right - 80, Math.max(stageRect.left, drag.left + event.clientX - drag.x));
    const maxTop = Math.max(stageRect.top + 35, bottomLimit - section.getBoundingClientRect().height);
    const top = Math.min(maxTop, Math.max(stageRect.top + 35, drag.top + event.clientY - drag.y));
    section.style.left = ((left - stageRect.left) / stageRect.width * 100) + '%';
    section.style.top = ((top - stageRect.top) / stageRect.height * 100) + '%';
  });

  const endDrag = (event) => {
    if (drag?.pointerId !== event.pointerId) return;
    drag = null;
    section.classList.remove('is-dragging');
  };
  titlebar.addEventListener('pointerup', endDrag);
  titlebar.addEventListener('pointercancel', endDrag);
}

function enableWindowResize(section, handle, maximizeButton, appTitle) {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const edge = handle.dataset.edge;
    const initial = section.getBoundingClientRect();
    const stageRect = windowStage.getBoundingClientRect();
    const dockRect = dock.hidden ? null : dock.getBoundingClientRect();
    const bottomLimit = dockRect ? Math.min(stageRect.bottom, dockRect.top - 12) : stageRect.bottom;
    const minWidth = Math.min(360, stageRect.width - 24);
    const minHeight = Math.min(260, Math.max(120, bottomLimit - stageRect.top - 35));
    section.classList.remove('is-maximized');
    if (document.fullscreenElement === desktop) section.classList.add('is-fullscreen-resized');
    syncMaximizeControl(section, maximizeButton, appTitle);
    section.style.left = ((initial.left - stageRect.left) / stageRect.width * 100) + '%';
    section.style.top = ((initial.top - stageRect.top) / stageRect.height * 100) + '%';
    section.style.width = (initial.width / stageRect.width * 100) + '%';
    section.style.height = (initial.height / stageRect.height * 100) + '%';
    section.style.transform = 'none';
    section.classList.add('is-resizing');
    handle.setPointerCapture(event.pointerId);
    focusWindow(section.dataset.appId);

    const resize = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      const dx = moveEvent.clientX - event.clientX;
      const dy = moveEvent.clientY - event.clientY;
      let left = initial.left;
      let top = initial.top;
      let right = initial.right;
      let bottom = initial.bottom;
      if (edge.includes('w')) left = Math.min(initial.right - minWidth, Math.max(stageRect.left, initial.left + dx));
      if (edge.includes('e')) right = Math.max(initial.left + minWidth, Math.min(stageRect.right, initial.right + dx));
      if (edge.includes('n')) top = Math.min(initial.bottom - minHeight, Math.max(stageRect.top + 35, initial.top + dy));
      if (edge.includes('s')) bottom = Math.max(initial.top + minHeight, Math.min(bottomLimit, initial.bottom + dy));
      section.style.left = ((left - stageRect.left) / stageRect.width * 100) + '%';
      section.style.top = ((top - stageRect.top) / stageRect.height * 100) + '%';
      section.style.width = ((right - left) / stageRect.width * 100) + '%';
      section.style.height = ((bottom - top) / stageRect.height * 100) + '%';
    };
    const finish = (finishEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      handle.removeEventListener('pointermove', resize);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      section.classList.remove('is-resizing');
    };
    handle.addEventListener('pointermove', resize);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });
}

function openApp(appId, fromRoute = false) {
  const app = appById.get(appId);
  if (!app || !allowedAppIds.has(appId)) return;
  let entry = openWindows.get(appId);
  if (!entry) {
    entry = createWindow(app, openWindows.size * 22);
    openWindows.set(appId, entry);
    void initializeAppRuntime(app, entry);
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
  syncAppLaunchFeedbackForWindows();
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
  hideWorkspaceSwitching();
  dismissWorkspaceSwitchSuccess();
  clinicSession = null;
  clearClinicWidgetLogo();
  allowedAppIds = new Set();
  closeWorkspaceRoleMenu();
  if (workspaceSwitchDialog.open) workspaceSwitchDialog.close();
  if (signOutConfirmationDialog.open) signOutConfirmationDialog.close();
  pendingWorkspaceRole = null;
  workspaceSwitchBusy = false;
  signOutBusy = false;
  closeAllWindows({ force: true });
  buildDock();
  dock.hidden = true;
  clinicWidget.hidden = true;
  operatingRoleWidget.hidden = true;
  switchRoleButton.hidden = true;
  switchRoleButton.disabled = false;
  signOutButton.hidden = true;
  signOutButton.disabled = false;
  signOutConfirmationConfirm.disabled = false;
  signOutConfirmationCancel.disabled = false;
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
    disposeAppRuntime(entry);
    entry.element.remove();
    openWindows.delete(appId);
  }
  if (activeWindowId && !nextAllowedAppIds.has(activeWindowId)) activeWindowId = null;

  clinicSession = session;
  allowedAppIds = nextAllowedAppIds;
  updateClinicWidget(session, user);
  updateWorkspaceRolePicker(session);
  buildDock();
  dock.hidden = allowedAppIds.size === 0;
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
    if (generation !== authGeneration) return null;

    if (response.status === 401) {
      signInNotice = 'Your staging session expired. Sign in again to continue.';
      await firebaseAuthSdk.signOut(firebaseAuth);
      return null;
    }
    if (response.status === 403) {
      showSessionProblem(
        user,
        'Clinic access is not available',
        'This account has no active clinic access. Contact your clinic administrator.',
      );
      return null;
    }
    if (!response.ok) {
      showSessionProblem(
        user,
        'Clinic access could not be checked',
        response.status === 503
          ? 'The staging clinic is not ready right now. Retry in a moment.'
          : 'The staging clinic could not verify this session. Retry in a moment.',
      );
      return null;
    }
    const session = clinicSessionFromMeResponse(payload);
    if (!session) {
      showSessionProblem(
        user,
        'Clinic access could not be checked',
        'The staging clinic returned an unexpected session response. Retry in a moment.',
      );
      return null;
    }
    acceptClinicSession(user, session);
    return session;
  } catch {
    if (generation !== authGeneration) return null;
    showSessionProblem(
      user,
      'Staging clinic is unavailable',
      'Could not reach the staging clinic. Check your connection and retry.',
    );
    return null;
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
  homeNote.textContent = appCatalogTrusted
    ? 'Browser shell preview · no clinic data connected'
    : 'The approved app catalog could not be verified. No apps are available.';
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

function openSignOutConfirmation() {
  if (!firebaseAuth || !firebaseAuthSdk || signOutBusy) return;
  signOutConfirmationError.textContent = '';
  signOutConfirmationError.hidden = true;
  signOutConfirmationConfirm.disabled = false;
  signOutConfirmationConfirm.textContent = 'Sign out';
  signOutConfirmationCancel.disabled = false;
  signOutConfirmationDialog.showModal();
  signOutConfirmationCancel.focus();
}

async function signOutCurrentAccount() {
  if (!firebaseAuth || !firebaseAuthSdk || signOutBusy) return;
  if (!ensureNoAppWork('sign out')) return;
  signOutBusy = true;
  signOutButton.disabled = true;
  switchRoleButton.disabled = true;
  signOutConfirmationConfirm.disabled = true;
  signOutConfirmationCancel.disabled = true;
  signOutConfirmationConfirm.textContent = 'Signing out…';
  try {
    await firebaseAuthSdk.signOut(firebaseAuth);
    if (signOutConfirmationDialog.open) signOutConfirmationDialog.close();
  } catch {
    signOutBusy = false;
    signOutButton.disabled = false;
    switchRoleButton.disabled = false;
    signOutConfirmationConfirm.disabled = false;
    signOutConfirmationCancel.disabled = false;
    signOutConfirmationConfirm.textContent = 'Sign out';
    signOutConfirmationError.textContent = 'Could not sign out right now. Try again.';
    signOutConfirmationError.hidden = false;
    signOutConfirmationConfirm.focus();
  }
}

async function confirmWorkspaceRoleSwitch(workAlreadyChecked = false) {
  const targetRole = pendingWorkspaceRole;
  const user = firebaseAuth?.currentUser;
  if (!targetRole || !user || !clinicSession || workspaceSwitchBusy) return;
  if (!availableWorkspaceRoles(clinicSession).includes(targetRole)) {
    setWorkspaceSwitchError('That workspace is no longer available. Refresh your clinic session and try again.');
    return;
  }
  if (!workAlreadyChecked && !ensureNoAppWork('switch workspaces')) return;
  const pin = targetRole === 'admin' ? workspacePinInput.value : '';
  if (targetRole === 'admin' && !/^\d{4}$/.test(pin)) {
    setWorkspaceSwitchError('Enter the four-digit Admin PIN.');
    workspacePinInput.focus();
    return;
  }

  workspaceSwitchBusy = true;
  switchRoleButton.disabled = true;
  workspaceSwitchConfirm.disabled = true;
  workspaceSwitchCancel.disabled = true;
  workspaceSwitchConfirm.textContent = 'Switching…';
  setWorkspaceSwitchError('');
  dismissWorkspaceSwitchSuccess();
  if (workspaceSwitchDialog.open) workspaceSwitchDialog.close();
  showWorkspaceSwitching(targetRole);

  const refreshAndConfirm = async () => {
    const refreshedSession = await loadClinicSession(user, ++authGeneration);
    if (refreshedSession?.clinicUser?.role === targetRole) {
      finishWorkspaceRoleSwitch(targetRole);
      return true;
    }
    return false;
  };

  try {
    const idToken = await user.getIdToken();
    let response;
    try {
      response = await fetch(`${config.apiBaseUrl}/v1/clinic/workspace-role`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${idToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ role: targetRole, ...(pin ? { pin } : {}) }),
      });
    } catch {
      if (await refreshAndConfirm()) return;
      if (clinicSession) setWorkspaceSwitchError('The switch request may have reached the clinic service, but the result could not be confirmed. Check your workspace and try again.');
      return;
    }

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      signInNotice = 'Your staging session expired. Sign in again to continue.';
      if (workspaceSwitchDialog.open) workspaceSwitchDialog.close();
      await firebaseAuthSdk.signOut(firebaseAuth);
      return;
    }
    if (!response.ok) {
      if (response.status >= 500 && await refreshAndConfirm()) return;
      if (clinicSession) setWorkspaceSwitchError(workspaceRoleError(response.status, payload));
      return;
    }

    const refreshedSession = await loadClinicSession(user, ++authGeneration);
    if (!refreshedSession) return;
    if (refreshedSession.clinicUser.role !== targetRole) {
      setWorkspaceSwitchError('The clinic service did not confirm the requested workspace. Refresh and try again.');
      return;
    }
    finishWorkspaceRoleSwitch(targetRole);
  } catch {
    if (await refreshAndConfirm()) return;
    if (clinicSession) setWorkspaceSwitchError('The workspace change could not be confirmed. Please try again.');
  } finally {
    workspaceSwitchBusy = false;
    switchRoleButton.disabled = false;
    workspaceSwitchCancel.disabled = false;
    hideWorkspaceSwitching();
    if (clinicSession) setShellRegionsInert(false);
    if (workspaceSwitchDialog.open) {
      workspaceSwitchConfirm.disabled = false;
      workspaceSwitchConfirm.textContent = pendingWorkspaceRole
        ? `Switch to ${workspaceRoleName(pendingWorkspaceRole)}`
        : 'Switch workspace';
    } else if (pendingWorkspaceRole && clinicSession) {
      workspaceSwitchConfirm.disabled = false;
      workspaceSwitchConfirm.textContent = `Switch to ${workspaceRoleName(pendingWorkspaceRole)}`;
      workspaceSwitchDialog.showModal();
      workspaceSwitchConfirm.focus();
    } else if (clinicSession) {
      if (!switchRoleButton.hidden) switchRoleButton.focus();
      else document.querySelector('.statusbar-brand').focus();
    }
  }
}

signOutButton.addEventListener('click', openSignOutConfirmation);
signOutConfirmationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void signOutCurrentAccount();
});
signOutConfirmationCancel.addEventListener('click', () => {
  if (!signOutBusy && signOutConfirmationDialog.open) signOutConfirmationDialog.close();
});
signOutConfirmationDialog.addEventListener('cancel', (event) => {
  if (signOutBusy) event.preventDefault();
});
signOutConfirmationDialog.addEventListener('close', () => {
  if (signOutBusy) return;
  signOutConfirmationError.textContent = '';
  signOutConfirmationError.hidden = true;
});
workspaceSwitchSuccessDismiss.addEventListener('click', dismissWorkspaceSwitchSuccess);
switchRoleButton.addEventListener('click', () => {
  if (workspaceRoleMenu.hidden) {
    workspaceRoleMenu.hidden = false;
    switchRoleButton.setAttribute('aria-expanded', 'true');
    workspaceRoleOptions.querySelector('button')?.focus();
  } else {
    closeWorkspaceRoleMenu(true);
  }
});
workspaceRolePicker.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !workspaceRoleMenu.hidden) {
    event.preventDefault();
    closeWorkspaceRoleMenu(true);
  }
});
document.addEventListener('click', (event) => {
  if (!workspaceRolePicker.contains(event.target)) closeWorkspaceRoleMenu();
});
workspaceSwitchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void confirmWorkspaceRoleSwitch();
});
workspaceSwitchCancel.addEventListener('click', () => {
  if (!workspaceSwitchBusy && workspaceSwitchDialog.open) workspaceSwitchDialog.close();
});
workspacePinInput.addEventListener('input', () => {
  workspacePinInput.value = workspacePinInput.value.replace(/\D/g, '').slice(0, 4);
});
workspaceSwitchDialog.addEventListener('cancel', (event) => {
  if (workspaceSwitchBusy) event.preventDefault();
});
workspaceSwitchDialog.addEventListener('close', () => {
  if (workspaceSwitchBusy) return;
  pendingWorkspaceRole = null;
  workspacePinInput.value = '';
  updateWorkspacePinVisibility(false);
  setWorkspaceSwitchError('');
});
authEmail.addEventListener('input', persistEmailPreference);
rememberEmailInput.addEventListener('change', persistEmailPreference);
passwordReveal.addEventListener('click', () => updatePasswordVisibility(authPassword.type === 'password'));
workspacePinReveal.addEventListener('click', () => updateWorkspacePinVisibility(workspacePinInput.classList.contains('is-obscured')));
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

function updateDesktopFullscreenState() {
  const isFullscreen = document.fullscreenElement === desktop;
  for (const entry of openWindows.values()) {
    if (isFullscreen) {
      if (!entry.fullscreenRestore) {
        entry.fullscreenRestore = {
          style: entry.element.getAttribute('style'),
          maximized: entry.element.classList.contains('is-maximized'),
        };
      }
      continue;
    }
    if (!entry.fullscreenRestore) continue;
    if (entry.fullscreenRestore.style === null) entry.element.removeAttribute('style');
    else entry.element.setAttribute('style', entry.fullscreenRestore.style);
    entry.element.classList.toggle('is-maximized', entry.fullscreenRestore.maximized);
    entry.element.classList.remove('is-fullscreen-resized', 'is-resizing');
    syncMaximizeControl(entry.element, entry.maximizeButton, entry.app.title);
    entry.fullscreenRestore = null;
  }
  updateFullscreenToggle();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === desktop) await document.exitFullscreen();
    else await desktop.requestFullscreen();
  } catch {
    announcement.textContent = 'Full screen could not be changed. Use the browser full-screen controls.';
  }
}

document.querySelector('.statusbar-brand').addEventListener('click', (event) => {
  event.preventDefault();
  showHome();
});
appExplorerClose.addEventListener('click', () => appExplorerDialog.close());
appExplorerDialog.addEventListener('click', (event) => {
  if (event.target === appExplorerDialog) appExplorerDialog.close();
});
fullscreenToggle.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateDesktopFullscreenState);
document.addEventListener('visibilitychange', syncAppLaunchFeedbackForWindows);
document.addEventListener('scroll', hideDockTooltip, true);
window.addEventListener('resize', hideDockTooltip);

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
