# 已关闭标签页记录扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个仅面向 Chrome 的 WXT Vue 扩展，持久记录关闭的标签页，在 popup 中搜索、分页和恢复，并通过独立设置页管理行为和记录数据。

**Architecture:** 后台 service worker 用 Chrome tabs 事件维护内存 tab 快照，并以 UUID 同步到 Dexie 快照表；关闭事件把快照幂等写入记录表；service worker 空闲重启时恢复会话映射，不把仍打开的标签误记为关闭；新浏览器会话启动时恢复残留快照。Popup 和 options entrypoint 共享 db、i18n 和领域函数；UI 使用 Nuxt UI 与本地打包图标。

**Tech Stack:** WXT 0.21、Vue 3、TypeScript、Dexie、Nuxt UI、Tailwind CSS、Iconify/Lucide 图标、vue-i18n、day.js。

**Spec:** `docs/superpowers/specs/2026-09-16-closed-tabs-history-design.md`

## Global Constraints

- 只支持 Chrome，不实现其他浏览器兼容逻辑。
- 导入导出仅涉及记录表，不导出、导入或覆盖设置项。
- `maxRecords` 的有效范围是 1–10000，默认 1000；修改设置不立即裁剪。
- 记录按 `closedAt` 倒序；记录写操作完成后按容量删除最旧记录。
- 导入按 UUID 覆盖或追加，不执行 URL 去重；导入完成后执行容量裁剪。
- `chrome://`、`chrome-extension://`、无痕记录开关默认关闭；无痕还要求 Chrome 管理页允许扩展运行在无痕模式。
- 浏览器崩溃、强制结束或断电时不保证记录成功。
- 不使用 `localStorage` 保存业务设置；设置和记录均使用 IndexedDB。
- 现有仓库没有测试框架；使用 `bun run compile`、`bun run lint`、`bun run build` 做验证，不新增无意义静态测试。

---

### Task 1: 安装依赖并配置 Chrome/WXT 构建

**Files:**
- Modify: `package.json`
- Modify: `wxt.config.ts`
- Modify: `src/entrypoints/popup/index.html`
- Delete or leave unused: `src/entrypoints/content.ts`, `src/components/HelloWorld.vue`, starter SVG references

**Interfaces:**
- Produces a Chrome Manifest V3 build with `tabs`, `favicon`, `storage` and `unlimitedStorage` only if required by chosen implementation; `options_ui` points to the options entrypoint; Vue entrypoints can import Nuxt UI styles and icons.

- [ ] **Step 1: Install only required dependencies**

```bash
bun add dexie dayjs vue-i18n @nuxt/ui @iconify/vue @iconify-json/lucide
```

If the chosen Nuxt UI integration requires a peer package, install only the peer named by its package manager error; do not add an ORM, router, or state-management library.

- [ ] **Step 2: Configure WXT for Chrome and Nuxt UI’s Vite plugin**

Use the WXT Vue module already present, add the Nuxt UI Vite integration through WXT’s Vite config hook, disable color mode behavior that depends on Nuxt runtime, and import Tailwind/Nuxt UI CSS once from a shared stylesheet. Keep the existing Vue auto-import setup.

- [ ] **Step 3: Declare the minimum manifest permissions**

Configure Chrome-only output and add permissions needed for tab metadata, favicon URL rendering, options page, and tab creation. Do not request host permissions just to read ordinary tab metadata when the `tabs` permission covers it. Keep the default incognito mode as spanning.

- [ ] **Step 4: Remove starter UI wiring**

Replace the starter popup title and remove `HelloWorld`/WXT logo imports so later tasks own the popup layout.

- [ ] **Step 5: Verify the build configuration**

Run:

```bash
bun run compile
bun run lint
bun run build
```

Expected: all commands succeed and WXT emits a Chrome extension containing popup, background, and options entrypoints.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock wxt.config.ts src/entrypoints/popup/index.html
bun run format
git add src package.json bun.lock wxt.config.ts
git commit -m "chore: configure chrome extension dependencies"
```

### Task 2: Build Dexie schema, settings, snapshots, and record operations

**Files:**
- Create: `src/db/types.ts`
- Create: `src/db/database.ts`
- Create: `src/db/settings.ts`
- Create: `src/db/records.ts`
- Create: `src/db/import-export.ts`

**Interfaces:**
- `TabRecord = { id: string; url: string; title: string; faviconUrl?: string; closedAt: number; incognito: boolean }`
- `TabSnapshot` has the same fields and uses the tab UUID as its primary key.
- `Settings` includes `locale`, `maxRecords`, `pageSize`, `popupWidth`, `deleteOnRestore`, `deduplicateUrlOnClose`, `recordIncognito`, `recordChromeUrls`, and `recordExtensionUrls`.
- `getSettings(): Promise<Settings>` returns defaults for missing keys.
- `saveSettings(input: Settings): Promise<void>` clamps `maxRecords` to 1–10000 and validates page size/width.
- `addClosedRecord(record): Promise<void>` applies optional exact-URL deduplication, inserts the record, then prunes oldest records.
- `deleteRecord(id)`, `clearRecords()`, `listRecords()`, `upsertImportedRecords(records)`, and `pruneRecords()` are the shared write/query functions.
- `exportRecords(): Promise<{version: number; exportedAt: string; records: TabRecord[]}>` contains records only.
- `importRecords(payload: unknown): Promise<number>` validates version and record shape, UUID-upserts in a transaction, prunes, and returns the imported count; it never reads or writes settings.
- `upsertSnapshot`, `deleteSnapshot`, `listSnapshots`, `updateSnapshotTimes`, and `deleteSnapshots(ids)` support the background lifecycle.

- [ ] **Step 1: Define the exact database and JSON types**

Use a numeric Unix millisecond `closedAt`, UUID string primary keys, and an explicit export `version: 1`. Keep `faviconUrl` optional and preserve `incognito` in both tables.

- [ ] **Step 2: Define Dexie schema and default settings**

Create one Dexie database with `records`, `snapshots`, and `settings` tables. Index records by `closedAt` and `url`, snapshots by `closedAt`; store settings as one keyed object or a small keyed table, whichever makes atomic updates shortest.

- [ ] **Step 3: Implement record writes and pruning**

Implement one write path that performs URL duplicate deletion only when the setting is enabled, inserts the new row, and deletes the oldest rows beyond `maxRecords`. Ensure all related mutations use a Dexie transaction. `clearRecords` must never clear snapshots.

- [ ] **Step 4: Implement import/export validation**

Accept only version 1 payloads with an array of records and valid UUID-like IDs, nonempty URLs, finite timestamps, booleans for `incognito`, and string titles. Reject the whole payload before opening a write transaction on unknown versions or malformed data. Use `bulkPut` so matching UUIDs replace existing records; do not apply URL deduplication during import. Export only records, never settings or snapshots.

- [ ] **Step 5: Add the smallest runnable domain check**

Because no test framework exists, add a development-only `demo()` or equivalent pure validation check for `maxRecords` clamping and import UUID merge behavior, or validate these paths manually through the options UI during Task 5. Do not create a test suite solely for static exports.

- [ ] **Step 6: Verify and commit**

```bash
bun run compile
bun run lint
bun run format
bun run compile

git add src/db package.json bun.lock
git commit -m "feat: add persistent records and settings database"
```

### Task 3: Implement durable background tab snapshots and recovery

**Files:**
- Modify: `src/entrypoints/background/index.ts`
- Create: `src/entrypoints/background/tab-snapshots.ts`
- Create: `src/entrypoints/background/url-policy.ts`

**Interfaces:**
- `TabSnapshotManager` maintains `Map<number, TabSnapshot>` with stable UUID per tab ID.
- `shouldRecordTab(tab, settings): boolean` filters unsupported schemes, incognito, `chrome://`, and `chrome-extension://` according to settings.
- `onTabCreatedOrUpdated(tab): Promise<void>` refreshes memory and snapshot-table state.
- `onTabRemoved(tabId): Promise<void>` removes memory first, then writes a record if the snapshot passes current settings.
- `flushOnSuspend(): Promise<void>` takes all memory snapshots, writes them, updates snapshot times, then deletes only the processed snapshot IDs.
- `recoverSnapshots(): Promise<void>` reads residual snapshots at startup, inserts only missing UUIDs, prunes, and deletes each successfully processed snapshot.

- [ ] **Step 1: Implement URL policy**

Allow `http:`, `https:`, and `about:blank`; allow `file:` only when Chrome can access it; gate `chrome:` and `chrome-extension:` by settings; reject `javascript:`, `devtools:`, `chrome-untrusted:`, and known crash/restart URLs. Treat empty or missing URL/title data as unrecordable.

- [ ] **Step 2: Implement snapshot creation and updates**

On first observation generate `crypto.randomUUID()`, bind it to `tabId`, and persist the full snapshot. On updates preserve the UUID and update URL/title/favicon/incognito. When `recordIncognito` is disabled, do not persist private tab URL/title/favicon data.

- [ ] **Step 3: Implement removal and suspend flushing**

For `tabs.onRemoved`, delete the memory entry before calling the record write path. For `runtime.onSuspend`, take and clear the current memory map, write taken snapshots, update snapshot `closedAt` values, and delete only IDs completed by the flow. Catch errors so one failed tab does not prevent remaining cleanup.

- [ ] **Step 4: Add one-minute snapshot heartbeat**

Use `setInterval` inside the background entrypoint to update the database timestamp of still-live snapshots. Do not treat this timestamp as the actual close time; `onRemoved` uses the current time when creating the record.

- [ ] **Step 5: Add startup recovery before listeners process normal activity**

Call `recoverSnapshots()` when the service worker starts. For each residual row, `put` only if the records table does not already contain its UUID, then delete that snapshot row after successful handling. Never call `clear()` on the entire snapshots table during recovery.

- [ ] **Step 6: Register Chrome listeners and query initial tabs**

Register `tabs.onCreated`, `tabs.onUpdated`, `tabs.onRemoved`, and `alarms.onAlarm`; query existing tabs after startup to seed snapshots, including incognito tabs when Chrome has granted incognito access and the setting is enabled.

- [ ] **Step 7: Verify and commit**

```bash
bun run compile
bun run lint
bun run build

git add src/entrypoints/background
git commit -m "feat: persist and recover closed tab snapshots"
```

### Task 4: Add shared i18n and popup application shell

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/zh-CN.ts`
- Create: `src/i18n/locales/en.ts`
- Create: `src/components/AppIcon.vue`
- Modify: `src/entrypoints/popup/main.ts`
- Modify: `src/entrypoints/popup/style.css`
- Modify: `src/entrypoints/popup/index.html`

**Interfaces:**
- `resolveLocale(setting, navigator.language): 'zh-CN' | 'en'`
- `createI18nForSettings(settings)` returns the Vue i18n instance used by popup and options.
- Message keys cover search placeholder, settings, empty state, pagination, restore errors, all settings labels, import/export/clear actions, and confirmation text.

- [ ] **Step 1: Create the locale resolver**

Map browser languages beginning with `zh` to simplified Chinese and every other language to English. Explicit `zh-CN` and `en` settings override browser detection; `browser` follows the mapping.

- [ ] **Step 2: Add complete Chinese and English messages**

Define matching keys in both locale files; do not leave visible starter text in templates.

- [ ] **Step 3: Configure shared UI CSS**

Import Tailwind and Nuxt UI styles once, set popup body margin/width from the root variable, use accessible focus styles, and keep the popup compact at the default 400px width.

- [ ] **Step 4: Verify the shell**

```bash
bun run compile
bun run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n src/components/AppIcon.vue src/entrypoints/popup
bun run format
git add src
git commit -m "feat: add shared localization and popup shell"
```

### Task 5: Implement popup search, pagination, and restore interactions

**Files:**
- Modify: `src/entrypoints/popup/App.vue`
- Modify: `src/entrypoints/popup/style.css`
- Create: `src/components/ClosedTabItem.vue`
- Create: `src/components/RelativeTime.vue`

**Interfaces:**
- `filterRecords(records, query): TabRecord[]` performs case-insensitive title/full-URL matching.
- `paginate(items, page, pageSize): {items: TabRecord[]; pageCount: number}` clamps page bounds.
- `restoreRecord(record, button): Promise<void>` uses active `tabs.create` for left click and inactive `tabs.create` for middle click, then conditionally deletes the record.

- [ ] **Step 1: Implement record loading and derived search state**

Load records newest-first, watch settings and query, filter title/URL, reset page to 1 when query or page size changes, and recompute page count.

- [ ] **Step 2: Build the item layout**

Render favicon URL with `AppIcon` fallback, one-line title, truncated URL, and a day.js relative timestamp. Wrap the timestamp in a Nuxt UI tooltip whose content is the full local date/time.

- [ ] **Step 3: Implement click and middle-click behavior**

Handle normal click with `active: true` and close the popup only after `tabs.create` resolves. Handle `auxclick` button 1 with `active: false` and prevent the browser default; keep popup open. If restore deletion is enabled, delete only after create succeeds.

- [ ] **Step 4: Add search, settings button, empty state, and pagination**

Open the options page with `runtime.openOptionsPage()`, show the localized empty state, and render previous/next/page-number controls. Re-read records when the popup becomes visible or after a successful deletion.

- [ ] **Step 5: Verify the popup manually and by build**

Load the unpacked Chrome build, close tabs with known URLs, verify ordering, search, tooltip, left click, middle click, deletion option, and pagination. Then run:

```bash
bun run compile
bun run lint
bun run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components src/entrypoints/popup
bun run format
git add src
git commit -m "feat: add closed tabs popup"
```

### Task 6: Implement the options page and records-only JSON management

**Files:**
- Create: `src/entrypoints/options/index.html`
- Create: `src/entrypoints/options/main.ts`
- Create: `src/entrypoints/options/App.vue`
- Create: `src/entrypoints/options/style.css`

**Interfaces:**
- `saveSettings` persists only validated settings and does not prune records.
- `exportRecords` downloads one JSON file containing version, export time, and records only.
- `importRecords` reads a selected JSON file and reports imported count or a localized validation error.
- `clearRecords` deletes all records and leaves snapshots/settings unchanged.

- [ ] **Step 1: Create the WXT options entrypoint**

Use the options entrypoint metadata so WXT emits a standalone options page that can be opened in a new tab. Mount Vue with the shared i18n and Nuxt UI setup.

- [ ] **Step 2: Build the settings form**

Load settings into controls for locale, max records, page size, popup width, restore deletion, URL deduplication, incognito recording, `chrome://` recording, and `chrome-extension://` recording. Enforce `maxRecords` min 1/max 10000 in both HTML attributes and `saveSettings`.

- [ ] **Step 3: Add records-only export**

Serialize `exportRecords()` as JSON and download it with a Blob/object URL. Confirm the generated payload has no settings keys and no snapshot rows.

- [ ] **Step 4: Add records-only import**

Read a local file, parse JSON, validate the version and every record before any write, then UUID-upsert and prune. Display the imported count. A malformed or unknown-version file must leave both records and settings unchanged.

- [ ] **Step 5: Add clear action**

Use a confirmation dialog before `clearRecords()`. Keep the database snapshot table and settings table untouched.

- [ ] **Step 6: Verify end-to-end**

In Chrome, change each setting, reload popup/options, export records, inspect JSON to confirm settings are absent, import a file with one matching and one new UUID, and verify the matching row is replaced while settings remain unchanged. Test invalid version and malformed record rejection.

```bash
bun run compile
bun run lint
bun run build
```

- [ ] **Step 7: Commit**

```bash
bun run format
git add src/entrypoints/options src
git commit -m "feat: add options and records import export"
```

### Task 7: Final verification and cleanup

**Files:**
- Modify: `README.md`
- Modify: any files flagged by compile/lint/build

- [ ] **Step 1: Document Chrome-only behavior and limitations**

Document Chrome permission requirements, the separate incognito permission, unsupported URL schemes, snapshot recovery, and the fact that crashes/forced exits cannot guarantee a record.

- [ ] **Step 2: Run the full verification set**

```bash
bun run format
bun run compile
bun run lint
bun run build
bun run zip
```

Expected: all commands pass and the zip contains popup, options, background, icons, and no starter HelloWorld UI.

- [ ] **Step 3: Inspect the final diff**

```bash
rtk git diff --check
rtk git status --short
```

Confirm no settings are included in import/export, no `localStorage` business state exists, max records is clamped to 1–10000, and no accidental Firefox entrypoint remains in the Chrome build.

- [ ] **Step 4: Commit final documentation/cleanup**

```bash
git add README.md src package.json bun.lock wxt.config.ts
git commit -m "docs: document closed tabs extension"
```

## Self-review

- Covered all requested popup fields, search, pagination, tooltip, left/middle click semantics, settings, i18n, special URL switches, incognito switch, URL deduplication, record limits, UUID import merge, JSON versioning, favicon URL fallback, and independent options page.
- Import/export explicitly excludes settings and snapshots.
- Browser-close best-effort behavior is represented by snapshot persistence, suspend flushing, and startup recovery; the plan does not claim impossible guarantees.
- No placeholders or unspecified function names remain; later tasks consume interfaces defined earlier.
