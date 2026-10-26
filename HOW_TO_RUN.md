# Run Electron OS

Normal launches require your existing **staging clinic account** after M05. The platform resolves clinic access before opening the desktop. Remember-me is offered only with adequate protected storage; otherwise login is session-only. Lock, sign-out and account switching clear in-memory workspaces. The currently running session is untouched; this appears after your next full relaunch.

Click **Electron OS** in the Applications menu or pinned dock. Its launcher at `~/.local/bin/electron-os` uses `/home/master-x/Desktop/dental-os-public-repo`.

From a terminal:

```sh
cd /home/master-x/Desktop/dental-os-public-repo
npm run build
npm start
```

Updates load after a full exit and relaunch. Repeated launcher clicks activate the current session. Fully exiting discards dummy session data. The old `electron-desktop-prototype` path remains a compatibility symlink.

The prior Flutter/Rust project is reference-only under `refrence/`; its run instructions do not apply to this active Electron project.
