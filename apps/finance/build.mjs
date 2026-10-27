import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { build } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appDir, "../..");
const appsDir = path.join(projectRoot, "apps");
const buildDependencies = path.join(appDir, "node_modules");
const packageInfo = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8"));
const bundleName = "finance.v1";
const buildDir = await mkdtemp(path.join(tmpdir(), "dental-os-finance-"));

await mkdir(appsDir, { recursive: true });
try {
  await build({
    configFile: false,
    root: appDir,
    base: "/apps/",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: [
        { find: "react/jsx-runtime", replacement: path.join(buildDependencies, "react/jsx-runtime.js") },
        { find: "react-dom/client", replacement: path.join(buildDependencies, "react-dom/client.js") },
        { find: "react-dom", replacement: path.join(buildDependencies, "react-dom/index.js") },
        { find: "react", replacement: path.join(buildDependencies, "react/index.js") },
        { find: "lucide-react", replacement: path.join(buildDependencies, "lucide-react/dist/esm/lucide-react.mjs") },
        { find: "@sbmdkl/nepali-date-converter", replacement: path.join(buildDependencies, "@sbmdkl/nepali-date-converter/dist/@sbmdkl/nepali-date-converter.es.js") },
        { find: "@/shared", replacement: path.join(appDir, "src/shared") },
        { find: "@", replacement: path.join(appDir, "src") },
      ],
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 1_048_576,
      lib: {
        entry: path.join(appDir, "src/main.tsx"),
        name: "DentalOSFinance",
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
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const integrity = (bytes) => `sha256-${createHash("sha256").update(bytes).digest("base64")}`;
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
    <title>Finance · Dental OS</title>
    <style>${styleText}</style>
    <script defer src="/apps/${bundleName}.js" integrity="${scriptIntegrity}" crossorigin="anonymous"></script>
  </head>
  <body>
    <div id="root"><main class="finance-open-state" role="status">Starting Finance…</main></div>
  </body>
</html>
`;
  await writeFile(path.join(appsDir, `${bundleName}.js`), script);
  await writeFile(path.join(appsDir, `${bundleName}.css`), style);
  await writeFile(path.join(appsDir, `${bundleName}.html`), html);
  await mkdir(path.join(appDir), { recursive: true });
  await writeFile(path.join(appDir, "asset-manifest.js"), `export const financeBundle = Object.freeze({
  entry: "/apps/${bundleName}.html",
  entrySha256: "${sha256(Buffer.from(html))}",
  script: "/apps/${bundleName}.js",
  scriptSha256: "${sha256(script)}",
  style: "/apps/${bundleName}.css",
  styleSha256: "${sha256(style)}",
});
export const financeVersion = "${packageInfo.version}";
`);
  console.log(`Built Finance ${packageInfo.version} (${script.byteLength} JS bytes, ${style.byteLength} CSS bytes).`);
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
