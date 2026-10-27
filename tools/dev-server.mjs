import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const expectedFlavor = '--flavor';
const args = process.argv.slice(2);
const flavor = args[1];

if (args.length !== 2 || args[0] !== expectedFlavor || !['preview', 'staging'].includes(flavor)) {
  console.error('Usage: node tools/dev-server.mjs --flavor <preview|staging>');
  process.exit(1);
}

const connected = flavor === 'staging';
const port = connected ? 3003 : 4280;
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
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const routes = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/main.js', 'main.js'],
  ['/styles.css', 'styles.css'],
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
    : "'none'";
  const scriptSources = connected ? "'self' https://www.gstatic.com" : "'self'";
  const frameSources = connected ? `https://${firebaseConfig.authDomain}` : "'none'";
  response.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSources}; frame-src ${frameSources}; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  );

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
