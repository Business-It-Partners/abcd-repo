/* Browser-native facade for the existing M17 ClinicClient.
 * Only uses MessagePort. No Electron, preload, Firebase, direct Worker fetch, or write queue.
 * The host owns tokens and route enforcement; this facade never receives credentials. */
(function () {
  const SDK = Object.freeze({ major: 1, minor: 7 });
  function error(code, message, outcome = 'not_sent') {
    return { ok: false, error: { code, message, outcome } };
  }
  window.createBrowserAppBridge = function ({ port, appId, source, title, icon, views, session }) {
    if (!port || !session?.clinicUser || !session?.clinic) throw new Error('Clinic session unavailable');
    const connection = Object.freeze({
      connection: crypto.randomUUID(), generation: 1, appId: source,
      appVersion: 'browser-m17-port', sdk: SDK, capabilities: ['clinic.api.request'],
    });
    const pending = new Map();
    let sequence = 0;
    let closed = false;
    function viewFor(path) {
      // Exact finance/staff submodule grants are still enforced again in the host.
      if (appId === 'finance') {
        return views.find(v => path.startsWith(v.route.split('?')[0]))?.id;
      }
      if (appId === 'staff') {
        return path.startsWith('/v1/clinic/staff-references') ? 'references' : 'directory';
      }
      return views[0]?.id;
    }
    const listener = event => {
      const data = event.data;
      if (!data || data.type !== 'response' || !Number.isSafeInteger(data.id)) return;
      const entry = pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timeout);
      pending.delete(data.id);
      if (data.ok) entry.resolve({ ok: true, value: { status: 200, body: data.data } });
      else entry.resolve(error(data.error?.includes('denied') ? 'FORBIDDEN' : 'INVALID_RESPONSE',
        String(data.error || 'Clinic request unavailable.').slice(0, 240)));
    };
    port.addEventListener('message', listener);
    port.start();

    async function dispatch(request) {
      if (closed) return error('STALE_SESSION', 'The clinic app is closed.');
      if (request?.version !== 1 || request.connection !== connection.connection || request.generation !== 1) {
        return error('STALE_SESSION', 'App session changed.');
      }
      if (request.operation === 'session.context') {
        return { ok: true, value: { clinicSession: session } };
      }
      if (request.operation !== 'clinic.api.request') {
        return error('FORBIDDEN', 'This browser port does not support native/media operations.');
      }
      const input = request.input;
      if (input?.method !== 'GET' || input?.body != null || input?.idempotencyKey != null) {
        return error('FORBIDDEN', 'Clinical writes are disabled until browser-specific verification is complete.');
      }
      const path = input.path;
      const viewId = typeof path === 'string' ? viewFor(path) : null;
      if (typeof path !== 'string' || !viewId || path.length > 512) {
        return error('FORBIDDEN', 'This clinic route is not granted to the app.');
      }
      if (pending.size >= 3) return error('BUSY', 'Too many requests in flight.');
      return await new Promise(resolve => {
        const id = ++sequence;
        const timeout = setTimeout(() => {
          pending.delete(id);
          resolve(error('TIMEOUT', 'Clinic read timed out.'));
        }, 18_000);
        pending.set(id, { resolve, timeout });
        port.postMessage({ type: 'read', id, path, viewId });
      });
    }
    function dispose() {
      closed = true;
      port.removeEventListener('message', listener);
      for (const p of pending.values()) {
        clearTimeout(p.timeout);
        p.resolve(error('STALE_SESSION', 'App closed.'));
      }
      pending.clear();
    }
    window.addEventListener('pagehide', dispose, { once: true });
    return Object.freeze({
      async connect({ major }) {
        return major === SDK.major ? { ok: true, value: connection } : error('INCOMPATIBLE_SDK', 'Unsupported browser SDK.');
      },
      async request(req) { return dispatch(req); },
      async cancel() { return { ok: true, value: null }; },
      async getAppInfo() {
        return { ok: true, value: {
          appId: source, title, description: title, iconDataUrl: icon,
          modules: views.map(v => ({ id: v.id, label: v.title, tab: v.id, capability: 'clinic.api.request' })),
        } };
      },
      async openAppExplorer() { return error('UNAVAILABLE', 'No app-store or explorer in browser edition.'); },
      onModuleSelected() { return () => {}; },
      navigation: Object.freeze({ report() {}, onRequest() { return () => {}; } }),
      report() {},
      close: dispose,
    });
  };
})();
