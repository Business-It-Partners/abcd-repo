import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { build } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appDir, "../..");
const appsDir = path.join(projectRoot, "apps");
const runtimeVersion = "0.2.0";
const entryPath = path.join(appsDir, "treatment-protocols.v1.html");
const manifestPath = path.join(appDir, "asset-manifest.js");

await mkdir(appsDir, { recursive: true });
const buildDir = await mkdtemp(path.join(tmpdir(), "dental-os-treatment-protocols-"));
try {
  await build({
    configFile: false,
    root: appDir,
    base: "/apps/",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: [{ find: "@", replacement: path.join(appDir, "src") }],
    },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: path.join(appDir, "src/main.tsx"),
        name: "DentalOSTreatmentProtocols",
        formats: ["iife"],
        fileName: () => "treatment-protocols.v1.js",
      },
      rollupOptions: {
        output: { assetFileNames: "treatment-protocols.v1.[ext]" },
      },
      minify: "oxc",
      reportCompressedSize: false,
      sourcemap: false,
    },
  });

  const script = await readFile(path.join(buildDir, "treatment-protocols.v1.js"));
  const style = await readFile(path.join(buildDir, "treatment-protocols.v1.css"));
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const integrity = (bytes) => "sha256-" + createHash("sha256").update(bytes).digest("base64");
  const scriptIntegrity = integrity(script);
  const styleIntegrity = integrity(style);
  const scriptCspHash = scriptIntegrity.replace("sha256-", "");
  const styleCspHash = styleIntegrity.replace("sha256-", "");
  const styleText = new TextDecoder("utf-8", { fatal: true }).decode(style);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptCspHash}'; style-src 'sha256-${styleCspHash}'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <title>Treatment Protocols app</title>
    <style>${styleText}</style>
    <script defer src="/apps/treatment-protocols.v1.js" integrity="${scriptIntegrity}" crossorigin="anonymous"></script>
  </head>
  <body>
    <div id="root"><main class="protocolMessage" role="status">Starting Treatment Protocols…</main></div>
  </body>
</html>
`;
  await writeFile(path.join(appsDir, "treatment-protocols.v1.js"), script);
  await writeFile(path.join(appsDir, "treatment-protocols.v1.css"), style);
  await writeFile(entryPath, html);
  await writeFile(manifestPath, `export const treatmentProtocolsBundle = Object.freeze({
  entry: "/apps/treatment-protocols.v1.html",
  entrySha256: "${sha256(Buffer.from(html))}",
  script: "/apps/treatment-protocols.v1.js",
  scriptSha256: "${sha256(script)}",
  style: "/apps/treatment-protocols.v1.css",
  styleSha256: "${sha256(style)}",
});
export const treatmentProtocolsVersion = "${runtimeVersion}";
`);
  console.log(`Built Treatment Protocols ${runtimeVersion} (${script.byteLength} JS bytes, ${style.byteLength} CSS bytes).`);
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
