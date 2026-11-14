# AI 维护规则

适用于本仓库内的 AI 编码代理。先阅读 `CONTRIBUTING.md`；发布操作另读 `docs/RELEASING.md`。用户在当前会话中的明确指令优先。本文件规定维护方式，不单独授权推送、发布、修改正式资料库或处理用户凭据。

## 修改源码

- 功能代码以 `src/` 内的 TypeScript 为准。renderer 使用 `.ts` 和显式 ES import/export；Node 服务、工具及入口通常使用 `.cts`。沿用现有目录与配置，不引入 React/Vue 等框架或运行时 TypeScript loader，除非用户要求。
- 修改前定位实现、类型和调用者。按职责修改已有模块；共享领域数据和 IPC 契约位于 `src/shared/`。新增模块需接入相应 tsconfig、生成目标及实际调用链，不能只增加未使用的类型包装。
- `electron/`、`ui/`、`tools/` 和根目录 `server.js` 中带有 Generated 标记的文件是受版本控制的运行产物。修改其 TS 源文件并运行生成命令，不手工修改这些产物。没有 Generated 标记的构建引导、测试、静态资源和数据文件仍按其实际职责维护。
- 保持 strict 类型检查；不使用 `any`、`@ts-ignore`、`@ts-nocheck`、扩大断言或关闭检查掩盖错误。外部网络、历史存储和未验证字段使用 `unknown`，在真实边界按原有运行时规则处理。类型不能替代输入校验或权限验证。
- renderer 业务模块通过 import 连接，不增加内部 API 的 Window 全局。保留宿主 bridge、第三方库及 QMX 静态数据所需的现有边界。兼容适配器供独立测试使用，不重新加入页面形成第二个模块实例。

## 兼容性与权限

- 除非任务要求行为变更，否则保持 DOM、CSS、文案、交互顺序、历史数据 schema、路径、缺失/null/零的含义，以及未知字段的保留语义。发现独立问题时明确说明行为差异。
- 保持账号/资料库隔离、主进程凭据边界、sender 校验和并发锁。不得把 Token、OAuth Secret 或用户数据写入 renderer、日志、测试夹具、源码或发布产物。不得向正式资料库写入测试记录。
- preload 产物须能在 sandbox/contextIsolation 下独立运行；复制到 ASAR 外的更新 helper 须保持独立。更新清单、公钥、签名验证、备份/恢复及降级限制属于兼容边界，不随重构更改。
- 开发 map 仅进入 `build/app` 副本；发行构建不包含 map、应用 TS 源码、测试或编译器。签名归档验收后不得重新编译、重新打包或替换字节。

## 生成与验证

使用 `package.json` 指定的 Node/pnpm 版本。在源码根目录执行：

- 应用与 Node 模块：`pnpm modules:build`。
- 阅读详情：`pnpm reader:build`；preload：`pnpm preload:build`；IPC/本地归一化：`pnpm ipc:build`。修改被应用导入的模块后同时运行 `pnpm modules:build`。
- 算法生成数据：修改对应源数据/工具后运行 `pnpm algorithms:build`。
- 完成功能修改后运行 `pnpm check:refactor`，覆盖严格类型、生成漂移、语法、算法数据与单元检查。源码和对应生成产物一并提交。
- 界面或 renderer 行为变更运行相关行为测试；涉及入口、模块图或共享界面流程时运行 `pnpm test:ui:refactor`。直接运行单个测试前先 `pnpm build:app`，通过 `tests/app-path.cjs` 定位构建副本。
- preload、主进程、生产依赖或打包布局变更，运行 `pnpm build:app` 和 `pnpm test:build:desktop`；涉及发布产物再按发布文档验收成品。存在有效 feed 时默认包装已签名旧归档，验证新源码的未签名本地构建需显式设置 `QMX_BUILD_UPDATE_FEED=1`。
- 纯文档修改检查准确性、链接和 diff 即可。根据真实影响选择检查，不为低风险修改编写镜像实现的测试，也不删除原有行为断言来通过检查。

## 交付

- 提交前检查 `git diff --check`、暂存范围与生成一致性，保留用户的无关文件和改动。
- 汇报实际修改、验证结果与限制。模拟 API 不等于真实 OAuth/远端写入，跨平台打包不等于该平台桌面验收；无法执行的验收如实记录。
- 推送、合并和发布遵循用户在会话中的授权及仓库保护规则。发布与更新通道使用现有可信签名流程，不覆盖已发布标签、归档或成品，不绕过失败的 CI。
