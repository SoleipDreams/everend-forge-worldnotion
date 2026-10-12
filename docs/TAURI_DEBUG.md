# Debug the standalone WorldNotion window with Playwright

Run commands from the WorldNotion repository with Node, PowerShell 7,
Rust/MSVC and WebView2 installed:

```powershell
npm run tauri:debug
```

This starts the real Tauri app with Vite on port **1420** and WebView2 CDP on
loopback port **9224**. Reuse an existing debug instance if one is running.
The launcher never terminates another process and rejects occupied CDP ports.
The isolated WebView2 profile and terminal logs live in `output/playwright/`.
Preferences are isolated; universe files are not. Use a disposable universe
for checks that change content.

After the window opens, attach from another terminal in this repository:

```powershell
npm run pw:attach
npm run pw -- snapshot
npm run pw -- console
npm run pw -- screenshot
```

The pinned Playwright CLI uses session `worldnotion`. It attaches to the actual
Tauri WebView2 without a Chromium download. Interact using references from the
latest snapshot, then capture a new snapshot after navigation or menu changes.
Use `npm run pw -- detach` before reconnecting after a native app restart.
Detaching leaves the application open.

Native Windows file/folder dialogs require manual user interaction. Continue
independent page checks while waiting. Use Playwright for application inspection
and interaction; do not use Computer Use.

An alternate CDP port can be selected with
`npm run tauri:debug -- -CdpPort 9226`, followed by
`npm run pw -- attach --cdp=http://127.0.0.1:9226`.
Normal development and release builds do not enable CDP.
