# Dental OS Windows preview

This is an unsigned, local test installer for the current Electron prototype. It does not complete M13/G13 or G14, and does not introduce production authentication, package delivery, updates, backend integration or durable business records.

## On the Windows computer

1. Copy `Dental-OS-Setup-0.1.0-x64.exe` to a Windows 10/11 x64 (Intel/AMD 64-bit) computer. No Node.js or development tools are required. This build has not been tested on Windows yet.
2. Run the installer and follow its setup wizard. It installs for the current Windows user, without requesting administrator privileges. Desktop and Start menu shortcuts are created.
3. Launch **Dental OS Preview** from its shortcut. Setup does not launch it automatically.
4. Test fullscreen coverage, app launch/movement/resizing, dock hover, internal minimize/restore, whole-environment minimize/restore, and shutdown. Confirm unfinished form data survives minimizing and restoring.
5. Uninstall **Dental OS Preview** from Windows Settings → Apps. The configured installer preserves its user profile; the current demo's business records are memory-only and end when the app exits.

The preview is unsigned: Windows/browser/email security may warn or block it. Verify the expected file and its SHA-256 checksum before deciding whether to run it; do not disable antivirus. Send a download link or copy via USB if your email service blocks executables or the file exceeds its attachment limit. No upload or email sending is performed by the build.

## Rebuild

From the repository root, run `npm ci`, then `npm run dist:windows`. Run installation/build/test jobs sequentially with available memory and CPU headroom. `electron-builder` is pinned in the lockfile; the build explicitly targets x64 and disables publishing/signing. The allowlist includes compiled UI/native-bridge files, the app icon and package metadata; it excludes source archives, documentation, tests, evidence, and local credentials. Production dependencies are bundled by electron-builder.

The build wrapper limits Linux work to two allowed CPUs at lower priority, requires 2.5 GiB available memory, uses moderate compression and strips live display/session variables. It never uploads the result. Configuration: `tools/desktop-release/windows-preview.cjs`. Output: `release/windows/` (Git ignored). The ICO is derived from `assets/electron-os.svg`, using ImageMagick: `convert -background none -density 192 assets/electron-os.svg -resize 256x256 -depth 8 -define icon:auto-resize=256,128,64,48,32,16 assets/electron-os.ico`.

Linux cross-builds use the pinned packager’s native NSIS uninstaller parser (also used by its macOS workaround), rather than executing a Windows helper under Wine. `package-windows.mjs` restricts this adaptation to the exact uninstaller-generation invocation and fails closed for other VM commands; it does not modify dependencies. No system Wine install is required. Graphical tests must use `tools/run-ui-test.mjs`; Wine/build helpers must never connect to the live desktop. This preview is a single packaged shell; the production independent-app/update architecture remains planned.

## Verification boundary

Successful Linux packaging, archive inspection, checksum verification and private Linux ASAR smoke tests do not prove Windows installation or runtime behavior. Windows clean-install, launch, shortcut, permission, restore, upgrade and uninstall checks remain required before a production release. No signing certificate, release feed, public upload or automatic update is configured.

After packaging, run `node tools/desktop-release/verify-windows.mjs` to inspect PE architecture, package contents, entrypoints and generate `SHA256SUMS.txt` plus evidence. Run `npm run test:windows-package` to smoke-test the exact bundled ASAR on the isolated Linux display. These commands do not execute the Windows installer.
