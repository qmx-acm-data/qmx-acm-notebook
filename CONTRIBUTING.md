# 参与开发

[项目首页](README.md) · [用户使用指南](docs/USAGE.md) · [维护与发布](docs/RELEASING.md)

## 环境与命令

使用 Node.js 24 和 `package.json` 指定的 pnpm 10.28.2。在源码根目录执行：

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

若环境未提供 Corepack，可自行安装对应版本的 pnpm。

提交代码变更前运行：

```powershell
pnpm check
pnpm test
```

本地 Windows 构建命令：

```powershell
pnpm package
pnpm dist
```

`pnpm package` 仅生成便携目录 `release/QMX-Notebook-win32-x64`；`pnpm dist` 再通过 electron-builder 生成当前用户 NSIS 安装程序 `release/installer/QMX-Notebook-Setup-<version>.exe`。未签名构建先生成与开发/测试相同的 `build/app`，然后复制到独立暂存目录。存在有效 feed 时默认包装已签名归档，不能用它验证尚未发布的源码改动。本地验证新源码需显式设置 `QMX_BUILD_UPDATE_FEED=1`；此输出仅用于本地验收，不激活更新通道。发布工作流与成品验收见[维护与发布](docs/RELEASING.md)。

图形驱动相关启动问题可使用 `--disable-gpu`。当前受管理环境的自动化桌面检查额外使用过 `--no-sandbox`，该参数仅供必要时验证，不能据此宣称默认发行启动已通过；兼容启动的安全取舍见[使用指南](docs/USAGE.md#安装和启动)。

## 渐进式 TypeScript 重构

功能保持基线、当前验证记录和未验收范围见 [TypeScript 重构说明](docs/TYPESCRIPT_REFACTOR.md)及[实施计划与执行状态](docs/TYPESCRIPT_REFACTOR_PLAN.md)。主进程、服务、更新器、发布/数据工具、匿名服务器及 renderer 业务源码已迁移到 `src` 下的 TS；必要的 CJS 构建引导、测试、静态资源和生成数据继续保留原格式。`pnpm check:refactor` 汇总严格类型、语法、生成数据和单元检查；`pnpm test:ui:refactor` 运行现有 13 组界面回归，需要 Playwright 和 Microsoft Edge。类型覆盖以 `tsconfig.json`、`tsconfig.preload.json`、`tsconfig.boundary.json`、`tsconfig.modules.json` 和 `tsconfig.node.json` 为准，浏览器配置不引入 Node 全局。

renderer 使用显式 ES import/export，由固定版本 esbuild 0.25.12 将 `src/renderer/app/app.ts` 打包为浏览器专用单个 IIFE `ui/app.js`。页面只加载第三方库、QMX 静态数据和应用 bundle；业务模块不再通过页面全局互相调用。受版本控制的独立浏览器兼容适配器仍供夹具和单模块测试使用，并接受生成一致性检查，不是第二套手写实现。主进程入口为 `src/main/app/main.cts`，会话及 IPC 职责分别在 `session.cts`、`ipc-handlers.cts`；服务按真实业务目录组织。

`pnpm modules:build` 更新应用 bundle、模块兼容输出及 Node 产物，目标清单在 `tools/build-modules.cjs`。阅读详情、preload 和 IPC/本地归一化产物另由 `pnpm reader:build`、`pnpm preload:build`、`pnpm ipc:build` 更新；修改阅读或 IPC 模块后也需运行 `pnpm modules:build` 更新包含它们的应用 bundle。不要手改生成脚本，`typecheck` 和构建会检查漂移。共享契约 `src/shared/contracts/notebook.ts` 已为全部 34 项方法和两项订阅定义类型，其中 8 项走 boundary 注册包装、26 项为服务契约；历史字段及未校验的外部响应仍如实保留 unknown，类型与归一化不替代运行时校验。

`pnpm build:app` 构建独立 `build/app`，`pnpm preview:app` 构建并启动副本，`pnpm test:build:desktop` 验证真实桌面与离线格式化器；开发启动、单元/界面测试及未签名打包统一使用构建副本，正式签名包装复用已验收归档。直接运行单个测试前先执行 `pnpm build:app`。开发调试可设置 `QMX_SOURCE_MAPS=1`，map 仅写入构建副本，不改受版本控制的无 map 产物；未签名发行构建显式使用 `sourceMaps: false`，签名包装也不重编译已接受的归档。源码迁移状态与最终平台/真实账号/签名候选验收分别记录，不将先前批次通过视为最新改动全部验收。

## 贡献约定

AI 编码代理须遵循仓库根目录的 [AGENTS.md](AGENTS.md)：以 TS 源码为准、通过生成命令更新运行产物，并验证类型、生成一致性与受影响行为。

- 每个 PR 说明解决的问题、用户行为变化、验证结果和剩余限制。小范围修改保持职责集中，目录分工见[首页目录图](README.md#源码目录)。
- 界面变更需检查本地保存、标签筛选、收藏、复习状态和公开库同步。使用演示模式或测试仓库，不要向正式资料库提交测试记录。
- 不提交依赖目录、构建产物、私人错题、`auth.json`、个人 Token 或 OAuth Secret。Client ID 可公开配置，但修改队伍默认值应由维护者决定。
- GitHub 写入必须由用户明确操作触发。保留主进程凭据边界、Markdown 清洗和外部链接校验，不扩大渲染页面权限。
- 不将模拟测试描述为在线授权或投稿成功；当前真实账号验收状态以[发布记录](docs/RELEASING.md#当前已核实状态)为准。

源码推送或 PR 会触发 **Source checks**，执行严格类型、构建、语法和单元检查。纯文档变更无需额外运行测试，但应检查链接、命令及现状表述是否准确。
