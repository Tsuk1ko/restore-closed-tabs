# Restore Closed Tabs

[中文](README_ZH.md)

A Chrome extension that keeps a searchable history of closed tabs and reopens them from its popup. It is built with WXT, Vue, Nuxt UI, and Dexie.

|                                        Popup                                         |                                       Settings                                       |
| :----------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------: |
| ![](https://github.com/user-attachments/assets/02008e8f-fd23-4f2f-b902-cb2294dcafa0) | ![](https://github.com/user-attachments/assets/67354aba-cfa1-44c2-9f68-bded7bea1686) |

## Requirements

- Google Chrome
- Bun to build from source

## Installation

```bash
bun install
bun run build
```

Load `.output/chrome-mv3` as an unpacked extension in Chrome.

## Quick start

1. Close a tab with a supported URL and a page title
2. Open the extension popup to see the newest closed tabs first
3. Left-click a record to reopen it in the foreground, or middle-click to reopen it in the background

Records remain in the history after reopening by default. Enable **Delete after restore** in the settings page to remove them instead.

## Features

- Search titles and URLs without case sensitivity, and browse results by page
- View each tab's title, URL, favicon, and relative closing time; hover over the time for its full timestamp
- Right-click a record to copy its title, URL, or hyperlink, or to delete the record
- Open settings from the popup to change the language, history size, page size, popup width, and recording rules
- Export, import, or clear closed-tab records from the settings page

## Settings

| Setting                               | Default          | Details                                                                  |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| Language                              | Browser language | Simplified Chinese, Traditional Chinese, or English can also be selected |
| Maximum records                       | 1,000            | 100–10,000; oldest records are removed when the limit is applied         |
| Items per page                        | 10               | 5–100                                                                    |
| Popup width                           | 400 px           | 280–800 px                                                               |
| Delete after restore                  | Off              | Remove a record after its tab is reopened successfully                   |
| Remove older record with the same URL | Off              | Deduplicate by exact URL when recording a closed tab                     |
| Record incognito tabs                 | Off              | Also requires **Allow in incognito** in Chrome's extension settings      |
| Record `chrome://` pages              | Off              | `chrome://newtab/` is always excluded                                    |
| Record `chrome-extension://` pages    | Off              | Some extension pages may be unavailable when reopened                    |

By default, the extension records titled `http:` and `https:` tabs. Other URL schemes, including `file:`, are excluded. Changing the maximum-record setting does not immediately trim existing history; the limit is applied when a closed record is added or records are imported.

## Data and limitations

Closed records, settings, and live-tab snapshots are stored locally in IndexedDB. Export produces a JSON file containing closed records only; it does not include settings or live-tab snapshots. Import accepts the extension's version 1 JSON format, adds new records, replaces records with matching IDs, and then applies the maximum-record limit. Clearing history removes closed records only.

The background service worker saves snapshots of open tabs and uses them to recover interrupted work when it starts again. Chrome has no reliable browser-shutdown event, so a crash, forced termination, or power loss can still lose the final tab-close events. Chrome can also refuse to reopen restricted or unavailable pages.
