# Dental OS Browser Edition — Working Rules

- This branch's working tree is the browser project. Keep browser implementation, tooling, and records in this tree; do not add Electron preload, IPC, native host, or desktop build dependencies.
- Use `docs/ROADMAP.md` for browser milestones, `docs/STATUS.md` for actual state, and `docs/WORK_CHECKLIST.md` for active tasks. Do not use desktop milestone documents as browser acceptance.
- Use the existing Dental SaaS staging identity and APIs for browser integration. Keep production endpoints and credentials out of this branch. The local preview intentionally blocks network requests.
- The existing SaaS backend remains business authority. Do not add a local authoritative business database or hidden offline write queue.
- Support first-party company apps only. Browser app isolation, one signed-in session, role enforcement, and safe updates are required design goals; do not claim them before they are implemented and verified.
- Keep the agreed browser product scope: familiar Dental OS experience, role-based static dock, no Genie animation, and no app-store/install infrastructure. Show battery status only when the browser exposes a live reading; never invent one.
- V1 targets Brave only. Defer Chrome, Edge, Firefox, Safari, and mobile-browser support until all V1 milestones are complete.
- Do not deploy, publish, or change backend resources as part of local browser work without explicit authorization.
- Documentation changes should run `git diff --check` and update the browser status/checklist when milestone state changes. Use browser-specific verification; desktop Electron test commands do not apply here.
