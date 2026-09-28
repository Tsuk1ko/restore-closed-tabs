# Chrome Web Store 自动发布选型

调研日期：2026-09-28

## 推荐结论

推荐在 GitHub Actions 中使用 `chrome-webstore-upload-cli@4.0.1`，继续使用 WXT 构建 ZIP

本项目已经使用 WXT 0.21.4，锁文件包含 `publish-browser-extension@6.1.1`，因此 `wxt submit` 的接入成本最低
但以自动发布可靠性为优先，独立 CLI 对异步上传的处理更完整，并支持单独重试发布步骤，值得增加这一项开发依赖

这是根据文档、源码和发布版本作出的选型判断，尚未使用商店凭据执行实际上传

## 候选比较

| 方案                                                                                                   | 当前能力                                                          | 判断                                                   |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------ |
| [chrome-webstore-upload-cli 4.0.1](https://github.com/fregante/chrome-webstore-upload-cli)             | API v2、OAuth、异步上传等待默认 300 秒、支持独立 upload / publish | 首选，可本地和 CI 复用，版本随 bun.lock 固定           |
| [mnao305/chrome-extension-upload v7.0.0](https://github.com/mnao305/chrome-extension-upload)           | API v2、OAuth、Node24，异步上传最多等待 60 秒，检查上传和发布状态 | 想直接使用专用 Action 时的首选，使用时固定提交 SHA     |
| [WXT submit / publish-browser-extension 6.1.1](https://github.com/aklinker1/publish-browser-extension) | 已安装，API v2、服务账号、dry-run、分阶段发布、多商店             | 集成成本最低，但当前 v2 实现没有异步上传轮询           |
| [MobileFirstLLC/cws-publish](https://github.com/MobileFirstLLC/cws-publish)                            | 核查时源码仍为 v1.1，Action 使用 Node16                           | 不适合新接入                                           |
| Google 官方 API v2 + 自写脚本                                                                          | 官方支持，可自行集成服务账号及短期 token                          | 需要自行维护上传状态、错误处理及发布逻辑，当前没有必要 |

CLI 4.0.1 发布于 2026-05-28，依赖 `chrome-webstore-upload ^6.0.0`
Action v7.0.0 发布于 2026-09-06，也使用该底层库
版本与发布日期分别核对了 [npm 元数据](https://registry.npmjs.org/chrome-webstore-upload-cli) 和 [Action release](https://github.com/mnao305/chrome-extension-upload/releases/tag/v7.0.0)

## 影响可靠性的关键证据

- Chrome 官方明确 API v1 仅支持到 **2026-10-15**，新流程应使用 v2：[弃用声明](https://developer.chrome.com/docs/webstore/api/v1)
- OAuth client ID、client secret、refresh token 仍可用于 v2，不能把 OAuth 等同于旧 API：[官方使用指南](https://developer.chrome.com/docs/webstore/using-api)
- 官方上传状态包含 `IN_PROGRESS`，收到上传响应不一定代表处理完成：[UploadState](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/UploadState)
- CLI 默认等待 300 秒，上传不成功则不会继续发布：[CLI 源码](https://github.com/fregante/chrome-webstore-upload-cli/blob/main/source/cli.js)、[底层轮询实现](https://github.com/fregante/chrome-webstore-upload/blob/main/source/index.ts)
- Action 同样检查状态，但等待窗口固定为 60 秒：[Action 源码](https://github.com/mnao305/chrome-extension-upload/blob/master/src/main.ts)
- WXT 当前发布器 v2 实现直接要求 `uploadState === 'SUCCEEDED'`，其他状态均抛错，没有轮询，可能出现后台仍在处理但工作流已失败的情况：[发布器源码](https://github.com/aklinker1/publish-browser-extension/blob/main/src/stores/chrome-web-store-v2.ts)

## 本项目建议落地方式

1. 添加并锁定 CLI 开发依赖，在 CI 中使用 `bun install --frozen-lockfile`
2. 使用 Node 24 和固定版本的 Bun，执行 ESLint、Prettier 检查及类型检查
3. 执行 `bun run zip`，由 WXT 生成 Chrome ZIP，无需重复运行 build
4. 首版使用 `workflow_dispatch` 手动触发，后续可接 GitHub Release
5. 对同一扩展配置发布并发组，避免多个工作流同时上传，不主动取消进行中的发布
6. 上传与发布使用明确的 ZIP 路径，校验扩展版本已递增

建议注入发布步骤的配置：

| 配置            | GitHub 存储位置                                                             |
| --------------- | --------------------------------------------------------------------------- |
| `EXTENSION_ID`  | Variables，README 中已有 `bmancocnclojmcogdgdmgjpbknagdale`，落地前确认目标 |
| `PUBLISHER_ID`  | Variables，从开发者后台获取，不能用扩展 ID 代替                             |
| `CLIENT_ID`     | Secrets                                                                     |
| `CLIENT_SECRET` | Secrets                                                                     |
| `REFRESH_TOKEN` | Secrets                                                                     |

安装依赖并配置凭据后的发布命令示意：

```sh
bun run zip
bun x chrome-webstore-upload \
  --source .output/restore-closed-tabs-1.0.0-chrome.zip \
  --max-await-in-progress 300
```

示例文件名依据当前包名和版本填写，实际工作流应使用本次生成的唯一 Chrome ZIP，避免版本变更后路径失效
如果上传已经成功而提交审核失败，可用 `chrome-webstore-upload publish` 仅重试提交，先检查商店状态，避免重复上传相同版本

## 服务账号备选与边界

如果更看重服务账号认证和零新增依赖，可以改用现有 `wxt submit --chrome-api-version v2`
所需配置是 `CHROME_EXTENSION_ID`、`CHROME_PUBLISHER_ID`、`CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` 和 `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`，支持 `--dry-run` 仅检查认证和访问状态
需启用 Chrome Web Store API，在开发者后台绑定服务账号，私钥保存在 Secrets：[服务账号指南](https://developer.chrome.com/docs/webstore/service-accounts)、[发布器配置](https://github.com/aklinker1/publish-browser-extension/blob/main/docs/config-reference.md)
服务账号私钥并不等于无密钥认证，该版本发布器没有直接接收 GitHub OIDC token 的配置

WXT 官网发布示例仍展示旧版发布器的 OAuth 配置，不能直接照搬到服务账号 v2 方案：[WXT 发布指南](https://wxt.dev/guide/essentials/publishing.html)
运行初始化向导产生的 `.env.submit` 必须加入忽略规则，本仓库目前只忽略 `.env`，不会自动忽略 `.env.submit`

自动发布需要已有商店条目和完整的商店资料，首次发布仍需在后台完成：[WXT 首次发布说明](https://wxt.dev/guide/essentials/publishing.html)
工作流成功通常表示提交审核成功，不代表扩展已经上架，默认审核通过后才发布：[官方 publish 文档](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish)
