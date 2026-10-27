import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const expectedFlavor = '--flavor';
const args = process.argv.slice(2);
const flavor = args[1];
const portArgument = args.indexOf('--port');
const requestedPort = portArgument >= 0 ? Number(args[portArgument + 1]) : null;

if (args[0] !== expectedFlavor || !['preview', 'staging'].includes(flavor)
  || (portArgument >= 0 && (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65535))
  || args.some((argument, index) => ![0, 1, portArgument, portArgument + 1].includes(index))) {
  console.error('Usage: node tools/dev-server.mjs --flavor <preview|staging> [--port <1024-65535>]');
  process.exit(1);
}

const connected = flavor === 'staging';
const port = requestedPort ?? (connected ? 3003 : 4280);
const stagingApiBaseUrl = 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev';
let firebaseConfig = null;

if (connected) {
  try {
    firebaseConfig = JSON.parse(await readFile(resolve(root, 'config/staging-firebase.json'), 'utf8'));
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
      throw new Error('required public Firebase fields are missing');
    }
  } catch {
    console.error('Staging Firebase web configuration is missing or invalid.');
    process.exit(1);
  }
}

const workerOrigin = new URL(stagingApiBaseUrl).origin;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const routes = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/main.js', 'main.js'],
  ['/apps/catalog.js', 'apps/catalog.js'],
  ['/apps/manifest.js', 'apps/manifest.js'],
  ['/apps/runtime.v1.html', 'apps/runtime.v1.html'],
  ['/apps/runtime.v1.js', 'apps/runtime.v1.js'],
  ['/apps/treatment-protocols.v1.html', 'apps/treatment-protocols.v1.html'],
  ['/apps/treatment-protocols.v1.js', 'apps/treatment-protocols.v1.js'],
  ['/apps/treatment-protocols.v1.css', 'apps/treatment-protocols.v1.css'],
  ['/apps/treatment-protocols/asset-manifest.js', 'apps/treatment-protocols/asset-manifest.js'],
  ['/apps/calendar.v1.html', 'apps/calendar.v1.html'],
  ['/apps/calendar.v1.js', 'apps/calendar.v1.js'],
  ['/apps/calendar.v1.css', 'apps/calendar.v1.css'],
  ['/apps/calendar/asset-manifest.js', 'apps/calendar/asset-manifest.js'],
  ['/apps/treatment-progress.v1.html', 'apps/treatment-progress.v1.html'],
  ['/apps/treatment-progress.v1.js', 'apps/treatment-progress.v1.js'],
  ['/apps/treatment-progress.v1.css', 'apps/treatment-progress.v1.css'],
  ['/apps/treatment-progress/asset-manifest.js', 'apps/treatment-progress/asset-manifest.js'],
  ['/apps/finance.v1.html', 'apps/finance.v1.html'],
  ['/apps/finance.v1.js', 'apps/finance.v1.js'],
  ['/apps/finance.v1.css', 'apps/finance.v1.css'],
  ['/apps/finance/asset-manifest.js', 'apps/finance/asset-manifest.js'],
  ['/styles.css', 'styles.css'],
  ['/vendor/nepali-date-utils/index.js', 'vendor/nepali-date-utils/index.js'],
  ['/assets/sajilo-dental-mark.svg', 'assets/sajilo-dental-mark.svg'],
  ['/assets/fewa-turquoise-shore.jpg', 'assets/fewa-turquoise-shore.jpg'],
  ['/assets/dock/appointments.webp', 'assets/dock/appointments.webp'],
  ['/assets/dock/calendar.webp', 'assets/dock/calendar.webp'],
  ['/assets/dock/finance.webp', 'assets/dock/finance.webp'],
  ['/assets/dock/followups.webp', 'assets/dock/followups.webp'],
  ['/assets/dock/lab.webp', 'assets/dock/lab.webp'],
  ['/assets/dock/patients.webp', 'assets/dock/patients.webp'],
  ['/assets/dock/protocols.webp', 'assets/dock/protocols.webp'],
  ['/assets/dock/staff.webp', 'assets/dock/staff.webp'],
  ['/assets/dock/treatment.webp', 'assets/dock/treatment.webp'],
  ['/assets/dock/workentry.webp', 'assets/dock/workentry.webp'],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;

  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', connected ? 'strict-origin-when-cross-origin' : 'no-referrer');
  const connectSources = connected
    ? `'self' ${workerOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`
    : "'self'";
  const scriptSources = connected ? "'self' https://www.gstatic.com" : "'self'";
  const frameSources = connected ? `'self' https://${firebaseConfig.authDomain}` : "'self'";
  response.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSources}; frame-src ${frameSources}; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );
  if (pathname === '/apps/runtime.v1.html') {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'sha256-QxKPypccfuyhMR46nwtOP1sxgoNKNWXp+27ulGg8W+g='; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    );
  }
  if (pathname === '/apps/treatment-protocols.v1.html') {
    try {
      const appHtml = await readFile(resolve(root, 'apps/treatment-protocols.v1.html'), 'utf8');
      const scriptHash = appHtml.match(/script-src '(sha256-[A-Za-z0-9+/=]+)'/)?.[1];
      const styleHash = appHtml.match(/style-src '(sha256-[A-Za-z0-9+/=]+)'/)?.[1];
      if (!scriptHash || !styleHash) throw new Error('app CSP hashes are missing');
      response.setHeader('Content-Security-Policy', `default-src 'none'; script-src '${scriptHash}'; style-src '${styleHash}'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Treatment Protocols bundle is not built');
      return;
    }
  }
  if (['/apps/finance.v1.html', '/apps/calendar.v1.html', '/apps/treatment-progress.v1.html'].includes(pathname)) {
    try {
      const relativePath = routes.get(pathname);
      const html = await readFile(resolve(root, relativePath), 'utf8');
      const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*\/>/i)?.[1];
      if (!policy) throw new Error('App package CSP is missing.');
      response.setHeader('Content-Security-Policy', policy);
    } catch {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('App package is not built.');
      return;
    }
  }
  if (['/apps/runtime.v1.js', '/apps/treatment-protocols.v1.js', '/apps/treatment-protocols.v1.css',
    '/apps/calendar.v1.js', '/apps/calendar.v1.css', '/apps/treatment-progress.v1.js', '/apps/treatment-progress.v1.css',
    '/apps/finance.v1.js', '/apps/finance.v1.css'].includes(pathname)) {
    response.setHeader('Access-Control-Allow-Origin', '*');
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  if (pathname === '/runtime-config.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(
      `window.DENTAL_OS_BROWSER_CONFIG = Object.freeze(${JSON.stringify({
        flavor,
        apiBaseUrl: connected ? stagingApiBaseUrl : null,
        firebase: connected ? firebaseConfig : null,
      })});`,
    );
    return;
  }

  const relativePath = routes.get(pathname);
  if (!relativePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  try {
    const body = await readFile(resolve(root, relativePath));
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(relativePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Preview asset unavailable');
  }
});

server.listen(port, '127.0.0.1', () => {
  const host = connected ? 'localhost' : '127.0.0.1';
  console.log(`Dental OS Browser ${connected ? 'staging integration' : 'offline preview'}: http://${host}:${port}`);
  console.log(connected
    ? `Firebase staging sign-in and read-only /v1/me use ${workerOrigin}`
    : 'Network requests are blocked in this preview.');
});
