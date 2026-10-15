# Run Electron OS

Click **Electron OS** in the Applications menu or pinned dock. Its launcher at `~/.local/bin/electron-os` uses `/home/master-x/Desktop/fewa_business_os`.

From a terminal:

```sh
cd /home/master-x/Desktop/fewa_business_os
npm run build
npm start
```

Updates load after a full exit and relaunch. Repeated launcher clicks activate the current session. Fully exiting discards dummy session data. The old `electron-desktop-prototype` path remains a compatibility symlink.

The prior Flutter/Rust project is reference-only under `refrence/`; its run instructions do not apply to this active Electron project.
