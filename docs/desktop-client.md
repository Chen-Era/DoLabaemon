# 桌面客户端与发布指南

`Dorlabaemon` 桌面端是**线上客户端**：Electron 只负责打开已经部署的 Web
服务、提供独立窗口和系统级安装体验。它不会在用户电脑上启动 Next.js、PostgreSQL
或 Prisma，也不会把数据库连接串或 AI 密钥打进 `.dmg` / `.exe`。

因此，桌面端需要网络和可用的 HTTPS 服务；它不是离线版，也不是把现有 DEMO 模式
封装成安装包的方案。用户登录、权限、实验室隔离、数据存储与 AI 调用均继续由服务端
完成。

## 运行范围与安全边界

- 正式安装包默认加载 `https://dorlabaemon.era.ac.cn`。可在启动时使用
  `--server-url=https://your-host.example`，或设置 `DORLABAEMON_SERVER_URL`，将其
  指向另一个 HTTPS 环境（命令行参数优先）。HTTP 地址、以及 URL 中含用户名或密码的
  地址会被拒绝。
- 开发态默认加载 `http://127.0.0.1:3000`；可通过 `DORLABAEMON_DEV_URL` 覆盖，也可
  使用上面的 `DORLABAEMON_SERVER_URL`。开发态只允许 `http://localhost`、
  `http://127.0.0.1`、`http://[::1]` 或 HTTPS 地址。
- 窗口启用 Electron sandbox 和上下文隔离，禁用 Node 集成与远程模块。预加载层只暴露
  不可变的 `window.dorlabaemonDesktop.isDesktopClient` 标识，不提供 Node/IPC 功能。
- 应用只保留同源导航；跨源的同窗口跳转会被阻止。请求新窗口的安全 `http(s)` 链接会
  由系统默认浏览器打开，非 `http(s)` 或含 URL 凭据的链接会被拒绝；网页权限请求默认
  拒绝，也不允许 `<webview>`。
- 桌面端不保存或代理 `OPENAI_API_KEY`、`REAGENT_SEARCH_API_KEY`、
  `DATABASE_URL` 等服务器秘密。不要通过命令行、构建环境变量或安装包把这些值传给
  客户端。

> 业务数据、账号权限和 AI 调用均由服务端控制，客户端无法绕过服务端的登录、RBAC
> 或实验室数据隔离。Electron 仍会在当前操作系统用户的应用资料目录保存正常的浏览器
> 缓存和会话资料；共用电脑时应使用独立的操作系统账户，并在离开前退出应用。发布前必须先按
> [服务器部署指南](deployment-server.md) 完成线上服务的 HTTPS、数据库迁移和备份。

## 服务端环境变量

桌面客户端没有自身必填的私密环境变量；所有运行时业务配置仍在服务器的 `.env` 中。
至少应为正式服务设置以下变量：

| 变量 | 生产要求 |
| --- | --- |
| `DEMO_MODE` | 固定为 `false`。 |
| `DATABASE_URL` | 仅在服务器可访问的 PostgreSQL 连接串，绝不能进入客户端。 |
| `NEXTAUTH_URL` | 与桌面端实际加载的 HTTPS 站点完全一致，例如 `https://dorlabaemon.era.ac.cn`。 |
| `NEXTAUTH_SECRET` | 高强度随机密钥，仅服务器保存。 |
| `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_VISION_MODEL` | 启用 AI 解析时由服务器配置；其中密钥不得下发给浏览器或 Electron。 |
| `REAGENT_SEARCH_*`、`LLM_*` | 需要联网检索、运行时 skill/MCP 或自检时，仍只在服务器配置。 |

若使用不同测试/预发布域名，须同时用 `DORLABAEMON_SERVER_URL` 指向该 HTTPS 域名，
并将该环境的 `NEXTAUTH_URL` 配成相同的站点根地址。

## 本地开发

安装依赖后，在第一个终端启动 Web 服务：

```bash
npm ci
cp .env.example .env
npm run dev
```

在第二个终端启动 Electron 开发壳：

```bash
npm run desktop:dev
```

默认会打开 `http://127.0.0.1:3000`。如端口不同，可在启动 Electron 前设置：

```bash
DORLABAEMON_DEV_URL=http://127.0.0.1:3001 npm run desktop:dev
```

也可以用 `DORLABAEMON_SERVER_URL=https://staging.example.com` 让未打包的桌面壳
直接验证预发布服务。开发 Web 服务所需的数据库或 DEMO 配置仍遵从 README；它们
不是安装包的一部分。

## 生成安装包

先固定依赖并执行应用检查：

```bash
npm ci
npm run lint
npm run test
npm run desktop:test
```

然后在对应操作系统上构建：

```bash
# macOS：输出 DMG（以及供签名/公证使用的 app）
npm run desktop:dist:mac

# Windows：输出 NSIS 安装程序 .exe
npm run desktop:dist:win
```

两个构建脚本都会先生成所需的临时图标，再运行 `desktop:verify` 检查主进程和目标图标，
最后交由 `electron-builder` 打包。产物写入 `dist/desktop/`：macOS 为
`Dorlabaemon-<version>-mac-universal.dmg`，Windows 为
`Dorlabaemon-<version>-win-x64-setup.exe`。

每种平台都应在该平台的 CI runner 上生成；不要在 macOS 上把已安装的 Node 模块直接
复制到 Windows 构建，也不要把 Windows 产物反向用于 macOS。这是 Electron 运行时、
代码签名和平台原生依赖的共同要求。macOS 构建还依赖系统自带的 `sips` 来生成临时
`.icns`，因此必须在 macOS 上执行。

构建完成后至少手动验证：首次启动、登录/登出、受保护页面、下载/上传、外链在系统
浏览器打开，以及断网或服务不可达时的报错体验。正式版本还应验证应用加载的站点没有
混合内容，并确认 `--server-url=http://...` 被拒绝。

## 图标资源

当前仓库有横向品牌图 `logo.png` / `public/logo.png`（859 × 263，带透明通道）及网页
favicon `src/app/favicon.ico`。`desktop:dist:mac` 当前会用 favicon 通过 `sips` 生成临时
`build/icons/dorlabaemon.icns`，`desktop:dist:win` 会复制 favicon 到临时
`build/icons/dorlabaemon.ico`。这些文件位于被忽略的 `build/` 目录，不是已验收的原生
发行图标资源。

横向 Logo 不适合作为 Dock、开始菜单或安装程序图标，因为缩小后文字会难以辨认。当前
尚没有经过品牌验收的方形 macOS `.icns` 和 Windows 多尺寸 `.ico` 源资源；临时图标
仅用于让内部构建可运行。

发布前应由设计提供一个方形、无小字的图标母版（建议至少 1024 × 1024 PNG），并导出：

- `build/icons/dorlabaemon.icns`：macOS 用，含 16–1024 px 的必要尺寸；
- `build/icons/dorlabaemon.ico`：Windows 用，至少含 16、24、32、48、64、128、256 px；
- 可选的 `build/icon.png`：Linux/开发预览用。

提供最终图标后，应更新生成脚本或将其复制到以上路径，并在 macOS 与 Windows 安装后
检查 Dock、Finder、开始菜单和安装程序的实际显示效果。没有最终图标的产物只适合内部
验证，不应作为正式发布包。

## 签名、公证与分发

### macOS（DMG）

1. 在 macOS runner 安装有效的 **Developer ID Application** 证书及私钥，并在钥匙串
   中可用；企业内部 ad-hoc 签名不能替代公开分发签名。
2. 在 CI secret 中提供证书（通常是 base64 P12）、其密码、Apple ID / App Store Connect
   API key 和团队 ID。不要把 `.p12`、密码或 API 私钥提交到仓库。
3. 构建时启用 hardened runtime、entitlements 和 Developer ID 签名；随后对 `.app` / DMG
   执行 Apple notarization 并 staple ticket。
4. 在一台未安装开发证书的干净 Mac 上下载并检查：

   ```bash
   spctl --assess --type execute --verbose /Applications/Dorlabaemon.app
   ```

   通过 Gatekeeper 后才可发布。若有自动更新，还必须维护受保护的更新元数据及签名。

### Windows（EXE）

1. 使用受信任 CA 签发的 Authenticode 代码签名证书；优先硬件令牌或云 HSM，避免把
   私钥以普通文件形式放入 CI。
2. 对 NSIS 安装器及安装后的应用可执行文件使用 SHA-256 签名并加可信时间戳。
3. 在干净 Windows 虚拟机中下载、安装并检查“数字签名”证书链。没有信誉的新证书仍
   可能触发 SmartScreen，需要逐步建立信誉；不要以关闭 SmartScreen 作为发布方案。

代码签名只能证明产物来源，不能替代服务端 HTTPS、账号权限、漏洞修复和依赖更新。

## CI 发布要求

建议把打包工作流限制为受保护 tag（例如 `v*`）或受保护 release 分支，并设置最小权限：

1. Linux runner 执行 `npm ci`、`npm run lint`、`npm run test`；构建时使用锁定的
   `package-lock.json`。
2. macOS runner 生成并签名/公证 DMG；Windows runner 生成并签名 NSIS `.exe`。
   每个 runner 分别安装依赖和构建，避免跨平台复用 `node_modules`。
3. 只把签名、公证凭据注入签名 job；来自 Pull Request 的构建不读取这些 secret，也不
   得发布权限。
4. 对每个发布附件生成 SHA-256 校验和，并同版本号、Git commit 和签名状态一起发布。
5. 在上传 release 前执行安装冒烟测试；保留构建日志、校验和与 SBOM（如团队已有
   制品合规要求）。

最终发布页应同时提供 DMG、Windows EXE、SHA-256 校验和、支持的系统版本和线上服务
地址。用户应只从受控发布页下载，且桌面客户端与服务端版本升级要有回滚计划。
