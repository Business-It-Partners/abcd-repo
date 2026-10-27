# Dental OS Browser Edition

This branch's working tree is the browser edition. It has its own page, assets, package manifest, local server, and browser milestone documents. The Electron project remains on its desktop branch; older Git commits in this branch's history still include the original project files.

## Run locally

```sh
npm run dev:browser
```

Open [http://127.0.0.1:4280](http://127.0.0.1:4280) in Brave. V1 targets Brave only; other browser support is deferred until all V1 milestones are complete. The local preview is staging-flavored. It shows the browser shell and preview-only app windows; clinic sign-in and clinic data flow come later. The preview Content Security Policy blocks network requests.

For the connected B2 staging sign-in, run `npm run dev:staging` and open [http://localhost:3003](http://localhost:3003) in Brave. It uses the existing staging Firebase web client and calls only the staging Worker's read-only `/v1/me` session route. The dock appears only after the Worker returns clinic capabilities. App windows remain placeholders until later milestones. This mode does not deploy or change backend resources; use an existing staging clinic account directly in the browser form.

## Browser project records

- [Roadmap](docs/ROADMAP.md)
- [Current status](docs/STATUS.md)
- [Work checklist](docs/WORK_CHECKLIST.md)

The current page is the B1 shell foundation. Its app windows are placeholders and do not represent an authenticated clinic workflow.
