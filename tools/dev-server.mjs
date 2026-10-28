import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { browserStaticRoutes as routes, isolatedAppAssets, isolatedAppPages } from './static-routes.mjs';

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
const listenAddress = connected ? '0.0.0.0' : '127.0.0.1';
const lanAddress = connected
  ? Object.values(networkInterfaces()).flat().find((address) => address && !address.internal && address.family === 'IPv4')?.address
  : null;
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
  '.png': 'image/png',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
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
  if (isolatedAppPages.has(pathname)) {
    try {
      const relativePath = routes.get(pathname);
      const appHtml = await readFile(resolve(root, relativePath), 'utf8');
      const policy = appHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*\/>/i)?.[1];
      if (!policy) throw new Error('app CSP metadata is missing');
      response.setHeader('Content-Security-Policy', policy);
    } catch {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('App package is not built');
      return;
    }
  }
  if (isolatedAppAssets.has(pathname)) {
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

server.listen(port, listenAddress, () => {
  const url = connected && lanAddress ? `http://${lanAddress}:${port}` : `http://127.0.0.1:${port}`;
  console.log(`Dental OS Browser ${connected ? 'staging integration' : 'offline preview'}: ${url}`);
  if (connected) console.log(`Listening on ${listenAddress}:${port} for access from this network.`);
  console.log(connected
    ? `Firebase staging sign-in and read-only /v1/me use ${workerOrigin}`
    : 'Network requests are blocked in this preview.');
});
