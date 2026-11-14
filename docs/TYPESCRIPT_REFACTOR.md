# TypeScript 渐进重构与功能基线

当前基线：v1.2.5，主分支提交 `30698d8`，包含多仓库管理与连续差分更新。重构期间保持版本号、界面、操作流程、存储格式、默认值、权限判断及更新协议的现有行为。新需求与重构分开提交。

逐批文件范围、依赖顺序、验收门槛、回退方式与工作量评估见 [TypeScript 重构实施计划](TYPESCRIPT_REFACTOR_PLAN.md)。

## 开始前与每批提交

```sh
pnpm install --frozen-lockfile
pnpm check:refactor
pnpm test:ui:refactor
```

`check:refactor` 汇总严格类型检查、现有语法检查、生成数据一致性检查和所有 Node 单元测试。`test:ui:refactor` 顺序运行现有 13 个界面回归脚本（含多仓库管理），遇到失败立即停止；需要 Playwright 和 Microsoft Edge，使用隔离浏览器与模拟 bridge，不写入正式资料库。截图继续输出到已忽略的目录。

`tsconfig.json` 严格检查阅读详情与共享类型；`tsconfig.preload.json` 检查 preload，`tsconfig.boundary.json` 检查 IPC 注册/页面适配器、本地归一化及类型反例。`tsconfig.modules.json` 检查 renderer 入口及其业务模块，`tsconfig.node.json` 检查主进程、服务、更新器、工具、服务器及 Node 类型反例；浏览器配置不引入 Node 全局。上述业务源码已迁移到 TS，必要的 CJS 构建引导、测试、生成数据和静态资源按用途保留。`ui/reading-detail.js` 等受版本控制的兼容产物禁止手改；修改 TS 后运行对应生成命令，`pnpm typecheck` 会检查漂移。不能以 `any`、`@ts-nocheck` 或大范围忽略错误作为迁移完成标准。

`pnpm build:app` 生成独立 `build/app` 副本，保留现有 Electron/UI 相对布局并收集生产依赖；构建前先检查生成产物一致性。`pnpm start` / `preview:app` 构建并启动该副本，`pnpm serve:web` 默认先构建并从副本提供页面与匿名同步后端。导入 server 模块不会启动构建或监听。

`pnpm test` 先构建，再用统一 `appPath` 定位运行时模块、VM 入口、缓存覆盖和浏览器资源；源码数据、生成工具及可信签名工具仍按用途单独验证。`test:ui:refactor` 也先构建并显式传入同一根目录，避免继承的环境变量把检查指向旧副本。直接运行单个测试前先 `pnpm build:app`；`QMX_APP_ROOT` 可用于指定单个测试的已构建应用。

未签名打包（`QMX_BUILD_UPDATE_FEED=1` 或没有 feed）先调用同一构建器，再复制到全新暂存目录。存在有效 signed feed 的正式打包直接验证并使用已接受的 app.asar，不重新编译；该归档必须来自此前未签名构建和签名验收流程。`pnpm test:build:desktop` 验证真实 preload、版本与离线格式化器；设置 `QMX_PACKAGED_EXE` 可检查本地便携包及其阅读脚本与构建脚本字节一致。正式签名归档和本次未发布的源码改动属于不同构建，不可混淆。

## 完整 IPC 契约

共享类型来源为 `src/shared/contracts/notebook.ts`。原有 34 项方法和两项订阅均已定义类型：`openExternal`、`openAuthUrl`、`formatCode`、`cancelLogin`、`exportLocal`、`bootstrap`、`updateLocal`、`plannerAction` 共 8 项走 boundary 注册包装；其余 26 项由 `ServiceMethods` 定义实际参数元组与返回值，不再保留任意参数的待迁移兜底。历史元数据、未经运行时验证的 OAuth 字段及 `comment` 原始 POST 响应仍保留 unknown，这是外部输入边界，不代表方法未迁移。

`src/preload/preload.ts` 编译为独立 `electron/preload.cjs`，运行时只加载 Electron；`src/main/ipc/boundary.ts` 和 `src/renderer/ipc/boundary.ts` 分别生成注册器与页面适配器，并由页面模块显式导入。主进程及实际服务已纳入严格 TS 检查，继续共用原 `handle` 的 sender/更新锁校验。保留格式化器对实时 bridge 和浏览器回退的选择、原频道/别名、拒绝值及订阅取消行为。类型不替代不可信 IPC 入参校验。

修改后运行 `pnpm preload:build` / `pnpm ipc:build` 更新对应产物；`typecheck` 和构建均检查生成一致性。类型反例在 `tests/types/ipc-contracts.ts`，会拒绝错误频道、参数、返回类型和事件字段。授权返回 false 代表默认浏览器回退成功；格式化错误返回原代码；auth 事件字段保留 unknown，因为 OAuth JSON 尚无对应运行时格式校验。更新事件的可选字段保留首次状态缺失的情况。

## 记录模型与本地归一化

`src/shared/models/records.ts` 区分原始 JSON、主进程快照、页面归一化结果、新建本地记录和解析器领域记录。旧字段与未知元数据保持 unknown；存储默认值可以被历史数据覆盖，不把缓存对象声明为完整解析结果。`bootstrap` 已接入认证、计划、平台、比赛、设置等实际模型，稀疏缓存和未知扩展字段仍如实保留；`updateLocal` 只约束已有运行时检查的 records/字符串 ID，其他字段保留浅合并语义。

`src/renderer/records/local.ts` 提取原页面归一化实现，由应用显式导入，并通过 `pnpm ipc:build` 生成供独立测试使用的 `ui/local-records.js`。保留旧 ID/clientId 的宽松规则、账号归属转换、引用和迁移 ID 缓存；归一化不等于写入验证。GitHub 解析器及客户端已迁移，额外属性按最后一次 spread 覆盖建模。主进程入口已将会话与 IPC 操作提取到 `src/main/app/session.cts`、`ipc-handlers.cts`；renderer 的筛选、编辑、阅读、算法工作区及账户等职责在各业务目录中。兼容测试对照冻结的原函数，并验证存盘和重启后的未知字段与账号隔离。

## 实现模块的统一生成

`pnpm modules:build` 统一生成 renderer 应用 bundle、独立浏览器兼容适配器，以及主进程、服务、更新器、发布/数据工具和匿名服务器的 Node 产物，目标清单在 `tools/build-modules.cjs`。Node `.cts` 按 NodeNext 输出 `.cjs`（服务器保留 `server.js` 命令入口），维持运行时相对依赖路径及原生动态 import。阅读详情、preload、IPC/本地归一化分别由 `reader:build`、`preload:build`、`ipc:build` 管理；修改被应用导入的阅读或 IPC 模块后，也要运行 `modules:build` 更新应用 bundle。`typecheck` 与 `build:app` 检查所有受版本控制的生成产物，不悄悄覆盖漂移。

renderer 业务模块全部使用显式 ES import/export。固定版本 esbuild 0.25.12 以 `platform: browser`、`format: iife` 将 `src/renderer/app/app.ts` 打包为单个 `ui/app.js`，适配现有 file:// 与 CSP，无运行时 chunks 或 Node 权限。`ui/index.html` 只加载第三方库、QMX 静态数据和应用 bundle；源码全局边界只保留 QMX 数据、宿主 `window.notebook` 与 Marked/DOMPurify/KaTeX/Prism 等第三方 API。独立兼容输出仍受版本控制，供夹具及单模块测试使用，其全局导出由生成适配器提供；页面不加载它们，不会重复初始化业务模块。

开发构建可设置 `QMX_SOURCE_MAPS=1`；map 及对应引用只写入 `build/app`，映射到实际 TS 源码并携带源码内容，受版本控制的生成产物始终无 map。普通构建默认关闭 map，未签名发行打包显式传入 `sourceMaps: false`；签名包装复用校验后的归档，不因开发环境变量重编译。

## 行为保持矩阵

| 范围 | 必须保持的行为 | 现有验证入口 |
| --- | --- | --- |
| 导航与主题 | 主页、侧栏展开与固定、五个导航入口、三主题、窄屏 | navigation-smoke、各功能界面检查 |
| 题库与个人记录 | 公共/本地题解切换、同题记录、收藏、复习、草稿、账号隔离 | public-local-solution-smoke、main.test |
| 搜索 | 题库和算法搜索、标签及平台筛选、原有排序 | search.test、algorithm-search.test、search-ui-smoke |
| 算法知识树 | 原节点及别名可解析、搜索、目录管理、精选笔记、上传权限 | algorithm-directory.test、algorithm-topics-service.test、algorithm-notes-ui-smoke |
| 闯关学习 | 章节/关卡、笔记关联、完成证据、旧进度、知识树跳转 | algorithm-learning-path.test、algorithm-learning-path-ui-smoke |
| 页内详情 | 模式栏可见、路径跳转、逐级返回/Esc、滚动和焦点恢复、原生表单 | algorithm-reading-ui-smoke |
| Markdown | 清洗、公式、表格、文字颜色、代码高亮/复制/格式化、阅读设置 | markdown-*.test、markdown-format-ui-smoke、markdown-color-ui-smoke；按改动另跑 code-actions/code-highlight/reading-prefs |
| 计划与平台 | 截止时间、增删改、持久化、统计缺失值与每日做题数据 | planner-service.test、platform-*.test、platform-ui-smoke；修改计划时另跑 planner-native-smoke |
| 比赛 | 数据来源、时间和提醒、过滤和不参加状态 | contests.test、contest-sources.test、contests-ui-smoke |
| 账户与远端写入 | 授权取消、凭据隔离、权限校验、上传/编辑/删除、错误恢复 | auth.test、github.test、main.test；真实账号流程另行人工验收 |
| 更新与发布 | 签名、差分/全量回退、备份、恢复与回滚、独立 helper | updater/delta/file-upgrade/update-helper 等单元测试、update-ui-smoke、startup-update-smoke；涉及运行代码时另做真实桌面/成品验收 |

已有自动化测试仅证明覆盖的场景；不把模拟授权、模拟远端写入或浏览器检查视为真实账号与最终安装包验收。测试失败先判断是回归还是历史脚本失效，保留原有行为断言，避免为通过测试删掉安全检查。

## 当前实施与验收状态

源码迁移已覆盖 P1–P6：共享领域模型与全部 IPC、纯逻辑与阅读、renderer 业务拆分与显式导入、主进程/服务、更新/helper、发布与数据工具、匿名服务器均已接入真实实现；主进程 `main.cts` 当前为 283 行，会话与主要 IPC 操作已分离。开发、测试与未签名打包使用同一构建布局。P7 的构建 map 隔离及应用入口兼容输出清理已实现，最终回归与外部验收分别记录。

最终 48 个生成模块的完整检查已通过：严格类型、生成漂移、语法、算法数据一致性，以及 509 项单元测试中的 508 项通过、1 项因本机文件符号链接权限跳过、0 失败。13 组界面回归全部通过；原生计划、代码复制/格式化与高亮、阅读设置附加测试通过。真实 Electron 已验证隔离 profile、preload、C++/Python/Rust 离线格式化、历史字段保留、保存和重启恢复。Windows x64 未签名成品使用 Electron 40.10.6 实际打包并启动，完成同组桌面与持久化验收；ASAR 的应用入口、preload、session、reader 与适配器字节均与构建目录相同，且未包含应用源码、类型、测试、文档、编译器或 map。应用无需内部 Notebook 全局接口即可运行；直接调用旧 API 的夹具已改为显式加载测试适配器，原有行为断言保留。开发 map 的原始源码、路径与精确位置、发行 map 清理，以及可信发布输入比较也已通过检查。

本次尚未执行干净 Linux/macOS 实机构建、专用测试资料库中的真实 OAuth 与远端写入，以及 Windows x64、Linux x64/arm64、macOS x64/arm64 五平台签名候选包的完整成品验收；最终候选的旧版升级与恢复也须另行验收。源码迁移完成不等于这些外部验收已接受，不据此发布、签名、激活更新通道或宣称完整发布验收通过。后续沿用行为保持矩阵，保留 CSS、DOM、文案、存储 schema、运行时权限和签名协议。

## 发布边界

- preload 在 sandbox/contextIsolation 下运行；产物应为一个 CJS 文件，只保留允许的运行时依赖。
- update-helper 复制到 ASAR 外执行，必须是只依赖内置模块的独立 CJS 文件；共享类型用 type-only import，不引入运行时分块或编译器 loader。
- 所有平台复用同一份已签名 app.asar。编译在归档及签名前完成，签名后不重新编译、替换归档或改变字节。
- 发布/数据工具的 TS 生成 CJS 仍受版本控制；签名及更新通道步骤可从可信 checkout 运行这些已审查产物，无需运行时编译器。发布工作流的可信源码比较已纳入 `src`、类型、TS 配置、构建工具及锁文件等输入；编译和生成漂移检查在签名前完成。
- JSON、Markdown、网络响应及 IPC 入参仍做运行时校验；TS 类型不能替代外部输入校验、权限控制和签名验证。
