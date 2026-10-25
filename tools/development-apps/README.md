# Dental app preview lanes

These commands are source-only developer tools. They do not create signed release bundles or publish to Cloudflare.

## Browser Preview

From a worktree that contains the preview tool and app source:

```sh
npm run preview:browser -- --app company.dental.followups.m17
```

The Vite server prints a loopback URL and watches that app source for HMR. The browser bridge supplies a synthetic Dental session and sample data; clinic writes, media, and native file selection are disabled. The preview CSP blocks external connections. Stop the server with Ctrl+C.

Add or adjust app-specific synthetic GET responses in `apps/dental-apps/<app-id>/preview/api-responses.json`. Keys are `GET /v1/path` or `GET /v1/path?query=value`; values are the response body's JSON object. Do not put real patient, clinic, or credential data in these fixtures. Writes stay disabled.

To preview source in another worktree using the M15 tool copy, run:

```sh
node /path/to/m15-worktree/tools/development-apps/preview-browser.mjs --app company.dental.followups.m17 --source-root /path/to/app-worktree
```

## Dental OS Preview

Build and publish one app from the current worktree:

```sh
npm run publish:development-app -- --app company.dental.followups.m17
```

The command invokes that app's existing build script, validates the result against the fixed first-party identity and development capability grant, then writes an immutable snapshot to the OS user's shared `development-apps/` store. The running, unpackaged OS reads the shared registry on the next launch of that app. Close and reopen an already-open app to load a newly published snapshot; another running app is unaffected.

To build source from a different worktree without copying the publisher tool into it, run:

```sh
node /path/to/m15-worktree/tools/development-apps/publish.mjs --app company.dental.followups.m17 --source-root /path/to/app-worktree
```

The default bucket is `<Electron userData>/development-apps/`. On the current Linux development profile it resolves to `/home/master-x/.config/electron-desktop-prototype/development-apps/`. Existing registry entries are preserved and only the selected app pointer changes under a registry lock. A missing bucket is created in that location. If the OS is using a custom user-data directory, use `--user-data-dir /same/os/profile` or set `DENTAL_OS_USER_DATA_DIR` to that path.

## Release bundle

Release preparation is a separate signed/versioned Cloudflare App Store flow. Do not bundle, sign, or publish an app until the user explicitly requests release. A Browser Preview or local Dental OS snapshot is not a release artifact.
