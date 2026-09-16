# 已关闭标签页记录扩展设计

## 目标

为 Chrome 构建一个 WXT + Vue 扩展，记录关闭的标签页，在 popup 中按关闭时间倒序展示，并支持点击恢复；设置页提供语言、容量、分页、尺寸、恢复删除、URL 去重、特殊页面/无痕记录及 JSON 数据管理。

## 范围与约束

- 只支持 Chrome，不考虑其他浏览器。
- 使用 Manifest V3、WXT、Vue、Nuxt UI、图标库、Dexie、vue-i18n。
- IndexedDB 是记录和设置的持久化来源。
- Chrome 崩溃、强制结束或断电时不保证记录最后关闭的标签页。
- 无痕记录还要求用户在 Chrome 扩展管理页允许扩展运行在无痕模式。

## 数据模型

记录表以 UUID `id` 为主键，字段为 `url`、`title`、`faviconUrl`、`closedAt`、`incognito`。设置表保存：

- `locale`: `browser`、`zh-CN`、`en`
- `maxRecords`: 1–10000，默认 1000
- `pageSize`: 默认 10
- `popupWidth`: 默认 400
- `deleteOnRestore`: 默认 false
- `deduplicateUrlOnClose`: 默认 false
- `recordIncognito`: 默认 false
- `recordChromeUrls`: 默认 false
- `recordExtensionUrls`: 默认 false

记录图标只保存 URL；失效或缺失时显示通用图标。导出 JSON 包含版本字段、导出时间和记录数组，不包含设置。

## 后台记录流程

后台监听 `tabs.onCreated`、`tabs.onUpdated` 并持久化 tab 快照，因为 `tabs.onRemoved` 只提供 tab ID、窗口 ID 和 `isWindowClosing`，不提供 URL、标题或 favicon。关闭时按快照生成记录。

记录过滤规则：

- 普通 `http(s)`、Chrome Web Store、`about:blank`：允许。
- `chrome://`：仅 `recordChromeUrls` 开启时允许。
- `chrome-extension://`：仅 `recordExtensionUrls` 开启时允许。
- 无痕标签：仅 `recordIncognito` 开启时允许；关闭该设置时不持久化其 URL、标题或图标快照。
- `file://`：仅在 Chrome 已授予文件访问权限时尝试。
- `javascript:`、`devtools:`、`chrome-untrusted:` 及崩溃/退出调试地址：跳过。

每次新增记录前，如启用了 URL 去重，删除完全相同 URL 的旧记录。所有记录表写操作（新增、导入、清除）完成后按 `closedAt` 删除最旧的超量记录；修改容量设置本身不立即裁剪。

## Popup

popup 宽度由设置控制，默认 400px。顶部为搜索框和设置按钮，主体显示 favicon、标题、完整 URL 和相对关闭时间；悬停时间显示完整时间 tooltip。搜索是标题或完整 URL 的大小写不敏感包含匹配，搜索词变化回到第 1 页。底部显示分页控件。

- 左键：调用 `tabs.create({url, active: true})`，成功后关闭 popup。
- 鼠标中键：调用 `tabs.create({url, active: false})`，保持 popup。
- 恢复删除开启时，以上两种操作成功后删除记录。
- 创建标签成功不等于目标扩展页面已加载成功；失败捕获错误并保留记录。

## 设置页与国际化

使用独立 WXT options entrypoint，并在新标签打开。语言选项为跟随浏览器、简体中文、English；浏览器语言为中文简体或繁体时使用简体中文，其他语言使用 English。所有用户可见文案通过 vue-i18n 提供中英文消息。

设置页提供设置保存、JSON 导出、JSON 导入和清除全部记录。导入先验证版本和记录结构，按 UUID `bulkPut` 覆盖或追加，不执行 URL 去重，完成后执行记录容量裁剪；未知版本或校验失败时整批拒绝，不修改数据库。

## 文件边界

- `src/db/`：Dexie 数据库、类型、设置默认值、过滤/裁剪、导入导出。
- `src/background/` 或 background 入口相关文件：tab 快照和关闭记录。
- `src/i18n/`：消息、语言选择和 Vue 插件。
- `src/entrypoints/popup/`：列表、搜索、分页、恢复交互。
- `src/entrypoints/options/`：设置表单、导入导出、清除。
- `wxt.config.ts` 与 `package.json`：Chrome 目标、权限和依赖。

## 已知平台限制

- `tabs.onRemoved` 不含 URL，必须依赖持久化快照。
- MV3 service worker 会被停止，全局变量不能作为唯一状态来源。
- 浏览器退出没有可靠事件；`runtime.onSuspend` 中启动的异步写入不保证完成。
- `chrome-extension://` 跨扩展页面可能因目标扩展被禁用、资源不存在或导航限制而失败；仅尝试打开，不把 API Promise 成功当成页面加载成功。
