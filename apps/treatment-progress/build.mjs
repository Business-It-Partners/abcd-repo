import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { build } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appDir, "../..");
const appsDir = path.join(projectRoot, "apps");
const packageInfo = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8"));
const bundleName = "treatment-progress.v1";
const buildDir = await mkdtemp(path.join(tmpdir(), "dental-os-treatment-progress-"));

try {
  await build({
    configFile: false,
    root: appDir,
    base: "/apps/",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: [
        { find: "@/shared", replacement: path.join(appDir, "src/shared") },
        { find: "@", replacement: path.join(appDir, "src") },
      ],
    },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 1_048_576,
      lib: {
        entry: path.join(appDir, "src/main.tsx"),
        name: "DentalOSTreatmentProgress",
        formats: ["iife"],
        fileName: () => `${bundleName}.js`,
      },
      rollupOptions: { output: { assetFileNames: `${bundleName}.[ext]` } },
      minify: "oxc",
      reportCompressedSize: false,
      sourcemap: false,
    },
  });

  const script = await readFile(path.join(buildDir, `${bundleName}.js`));
  const style = await readFile(path.join(buildDir, `${bundleName}.css`));
  const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
  const integrity = bytes => `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
  const scriptIntegrity = integrity(script);
  const styleIntegrity = integrity(style);
  const styleText = new TextDecoder("utf-8", { fatal: true }).decode(style);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${scriptIntegrity}'; style-src '${styleIntegrity}'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" />
    <title>Treatment Progress · Dental OS</title>
    <style>${styleText}</style>
    <script defer src="/apps/${bundleName}.js" integrity="${scriptIntegrity}" crossorigin="anonymous"></script>
  </head>
  <body>
    <div id="root"><main class="tprogressMessage" role="status">Starting Treatment Progress…</main></div>
  </body>
</html>
`;
  await writeFile(path.join(appsDir, `${bundleName}.js`), script);
  await writeFile(path.join(appsDir, `${bundleName}.css`), style);
  await writeFile(path.join(appsDir, `${bundleName}.html`), html);
  await writeFile(path.join(appDir, "asset-manifest.js"), `export const treatmentProgressBundle = Object.freeze({
  entry: "/apps/${bundleName}.html",
  entrySha256: "${sha256(Buffer.from(html))}",
  script: "/apps/${bundleName}.js",
  scriptSha256: "${sha256(script)}",
  style: "/apps/${bundleName}.css",
  styleSha256: "${sha256(style)}",
});
export const treatmentProgressVersion = "${packageInfo.version}";
`);
  console.log(`Built Treatment Progress ${packageInfo.version} (${script.byteLength} JS bytes, ${style.byteLength} CSS bytes).`);
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
