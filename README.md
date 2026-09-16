# Closed Tabs History

Chrome-only WXT + Vue extension that remembers closed tabs and lets you restore them from the popup.

## Development

```bash
bun install
bun run dev
bun run compile
bun run lint
bun run build
```

Load `.output/chrome-mv3` as an unpacked extension in Chrome. The extension uses IndexedDB (Dexie) for settings, closed records, and durable tab snapshots. Import/export contains records only; settings are never included.

Chrome may block `javascript:`, `devtools:`, `chrome-untrusted:`, unavailable extension pages, and `file://` pages without file-access permission. Recording `chrome://`, `chrome-extension://`, and incognito tabs is disabled by default. Incognito recording also requires enabling “Allow in incognito” for the extension in Chrome’s extension settings.

The service worker persists snapshots and recovers interrupted work on startup. Chrome does not provide a reliable browser-shutdown event, so crashes, forced termination, and power loss can still lose the final close events.
