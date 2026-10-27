import { browserModules, canReadAppPath, permittedView } from './catalog.js';

const MAX_RESPONSE_CHARACTERS = 2_000_000;
const MAX_PENDING = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export function validateFrameRead(appId, request, capabilities) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
  if (request.type !== 'read' || !Number.isSafeInteger(request.id) || request.id < 1) return false;
  if (!canReadAppPath(appId, request.path)) return false;
  const view = permittedView(appId, request.viewId, capabilities);
  if (!view) return false;
  // Staff reference reads are distinct from sensitive staff-management resources.
  if (appId === 'staff') {
    if (request.path !== '/v1/clinic/staff-references' && !capabilities?.includes('staff.manage')) return false;
    if (view.id === 'references' && request.path !== '/v1/clinic/staff-references') return false;
  }
  // A Patient Payments-only account may not query privileged finance endpoints.
  if (appId === 'finance') {
    if (!request.path.startsWith('/v1/patient-payments') && !capabilities?.includes('finance.manage')) return false;
    // In Finance, a module may not use the grant assigned to a different tab.
    if (!request.path.startsWith(view.route.split('?')[0])) return false;
  }
  return true;
}

export function mountBrowserApp({ content, appId, connected, apiBaseUrl, getAccess }) {
  if (!browserModules[appId]) throw new Error('Unregistered first-party app.');
  if (!content?.replaceChildren || typeof getAccess !== 'function') throw new Error('Missing app host boundary.');

  const iframe = document.createElement('iframe');
  iframe.className = 'browser-app-frame';
  iframe.title = browserModules[appId].title;
  iframe.src = '/apps/browser/frame.html';
  iframe.setAttribute('sandbox', 'allow-scripts'); // deliberately omit allow-same-origin
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('loading', 'eager');
  iframe.setAttribute('allow', '');
  content.classList.add('has-browser-app');
  content.replaceChildren(iframe);

  let stopped = false;
  let bridge = null;
  const pending = new Set();
  const launchNonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), v => v.toString(16).padStart(2, '0')).join('');
  const startingAccess = getAccess();
  const launchUid = startingAccess?.user?.uid ?? null;
  let initialized = false;

  function dispose() {
    if (stopped) return;
    stopped = true;
    bridge?.close();
    for (const controller of pending) controller.abort();
    pending.clear();
    iframe.remove();
    content.classList.remove('has-browser-app');
  }

  async function onRequest(event) {
    const request = event.data;
    if (stopped || request?.type !== 'read') return;
    const access = getAccess();
    const sessionValid = connected && access?.allowed && access?.user?.uid === launchUid && !!launchUid;
    const send = message => {
      if (!stopped && bridge && Number.isSafeInteger(request.id) && request.id > 0) {
        bridge.postMessage({ type: 'response', id: request.id, ...message });
      }
    };
    if (!sessionValid) {
      send({ ok: false, error: connected ? 'Clinic session unavailable. Sign in again.' : 'Offline preview: clinic data unavailable.' });
      return;
    }
    if (!validateFrameRead(appId, request, access.capabilities)) {
      send({ ok: false, error: 'This app or clinic role cannot read that resource.' });
      return;
    }
    if (pending.size >= MAX_PENDING) {
      send({ ok: false, error: 'Too many requests. Please retry.' });
      return;
    }
    if (!apiBaseUrl || new URL(apiBaseUrl).protocol !== 'https:') {
      send({ ok: false, error: 'Staging API configuration is unavailable.' });
      return;
    }
    const controller = new AbortController();
    pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const token = await access.user.getIdToken();
      if (stopped || getAccess()?.user?.uid !== launchUid || !getAccess()?.allowed) return;
      // The route is exclusively assembled from a known staging Worker origin and an approved relative path.
      const response = await fetch(apiBaseUrl + request.path, {
        method: 'GET',
        headers: { authorization: 'Bearer ' + token, accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      const length = Number(response.headers.get('content-length') || '0');
      if (length > MAX_RESPONSE_CHARACTERS) throw new Error('Response is too large for the browser window.');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          send({ ok: false, error: 'The Worker denied this clinic request (' + response.status + ').' });
        } else {
          send({ ok: false, error: 'Clinic read failed (' + response.status + ').' });
        }
        return;
      }
      const body = await response.text();
      if (body.length > MAX_RESPONSE_CHARACTERS) throw new Error('Response is too large for the browser window.');
      const data = JSON.parse(body);
      const latestAccess = getAccess();
      if (latestAccess?.allowed && latestAccess?.user?.uid === launchUid &&
          validateFrameRead(appId, request, latestAccess.capabilities)) send({ ok: true, data });
    } catch (error) {
      if (!stopped) send({
        ok: false,
        error: error?.name === 'AbortError' ? 'Clinic read timed out.' : 'Clinic data could not be read.',
      });
    } finally {
      clearTimeout(timeout);
      pending.delete(controller);
    }
  }

  iframe.addEventListener('load', () => {
    if (stopped || !iframe.contentWindow) return;
    // An unexpected subsequent navigation must never receive a new capability port.
    if (initialized) { dispose(); return; }
    initialized = true;
    const channel = new MessageChannel();
    bridge?.close();
    bridge = channel.port1;
    bridge.onmessage = event => void onRequest(event);
    bridge.start();
    // Sandboxed frame has an opaque origin; target the exact contentWindow and transfer only a Port.
    iframe.contentWindow.postMessage({
      type: 'dental-os-browser-init',
      nonce: launchNonce,
      appId,
      title: browserModules[appId].title,
      icon: browserModules[appId].icon,
      source: browserModules[appId].source,
      session: connected && getAccess()?.allowed ? getAccess()?.session : null,
      views: browserModules[appId].views
        .filter(view => permittedView(appId, view.id, getAccess()?.capabilities ?? (connected ? [] : ['finance.manage'])))
        .map(({ id, title, route }) => ({ id, title, route })),
      preview: !connected,
    }, '*', [channel.port2]);
  });

  return dispose;
}
