const appRoot = document.getElementById('app-root');
const noncePattern = /^[a-f0-9]{48}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
let appPort = null;
let appContext = null;
const pendingRequests = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function validInitialization(data, ports) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && Object.keys(data).sort().join(',') === 'appId,bundleSha256,nonce,title,type,version'
    && data.type === 'dental-os:init'
    && typeof data.appId === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.appId)
    && typeof data.title === 'string' && data.title.length > 0 && data.title.length <= 64
    && typeof data.version === 'string' && versionPattern.test(data.version)
    && typeof data.nonce === 'string' && noncePattern.test(data.nonce)
    && typeof data.bundleSha256 === 'string' && sha256Pattern.test(data.bundleSha256)
    && ports.length === 1;
}

function validEnvelope(data) {
  return appContext && data && typeof data === 'object' && !Array.isArray(data)
    && data.appId === appContext.appId
    && data.version === appContext.version
    && data.nonce === appContext.nonce;
}

function renderReady() {
  appRoot.replaceChildren(
    element('p', 'eyebrow', 'ISOLATED APP PREVIEW'),
    element('h1', '', appContext.title),
    element('p', 'description', `Browser app package ${appContext.version}. Clinic workflows are enabled in a later milestone.`),
  );
  const status = element('div', 'status');
  status.append(element('span', 'status-dot'));
  const copy = document.createElement('div');
  copy.append(element('strong', '', 'Preview only'), element('small', '', 'This app has no clinic API routes in B3.'));
  status.append(copy);
  appRoot.append(status);
}

function apiRequest(method, path) {
  if (!appPort || !appContext || method !== 'GET' || typeof path !== 'string' || path.length > 180) {
    return Promise.reject(new Error('This app request is not available.'));
  }
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, '0')).join('');
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('The app request timed out.'));
    }, 10_000);
    pendingRequests.set(requestId, { resolve, reject, timeout });
    appPort.postMessage({
      type: 'app:api-request',
      appId: appContext.appId,
      version: appContext.version,
      nonce: appContext.nonce,
      requestId,
      method,
      path,
    });
  });
}

function handlePortMessage(event) {
  const data = event.data;
  if (!validEnvelope(data)) {
    appPort?.close();
    appPort = null;
    appRoot.replaceChildren(element('p', 'eyebrow', 'APP SESSION CLOSED'), element('h1', '', 'This app session could not be verified.'));
    return;
  }
  if (data.type !== 'app:api-response' || typeof data.requestId !== 'string') return;
  const pending = pendingRequests.get(data.requestId);
  if (!pending) return;
  window.clearTimeout(pending.timeout);
  pendingRequests.delete(data.requestId);
  if (data.ok === true) pending.resolve(data.data);
  else pending.reject(new Error(typeof data.message === 'string' ? data.message : 'This app request is not allowed.'));
}

window.addEventListener('message', (event) => {
  if (appPort || event.source !== window.parent || !validInitialization(event.data, event.ports)) return;
  const { appId, title, version, nonce, bundleSha256 } = event.data;
  appContext = Object.freeze({ appId, title, version, nonce, bundleSha256 });
  appPort = event.ports[0];
  appPort.onmessage = handlePortMessage;
  appPort.onmessageerror = () => {
    appPort?.close();
    appPort = null;
  };
  appPort.start();
  appPort.postMessage({ type: 'app:ready', appId, version, nonce, bundleSha256 });
  Object.defineProperty(window, 'dentalOSAppApi', {
    value: Object.freeze({ request: apiRequest }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
  renderReady();
}, { passive: true });
