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

`tsconfig.json` 严格检查阅读详情与共享类型；`tsconfig.preload.json` 检查 preload，`tsconfig.boundary.json` 检查已迁移 IPC 注册/页面适配器及类型反例。`tsconfig.modules.json` 检查浏览器纯逻辑、Markdown、算法目录和计划组件，`tsconfig.node.json` 检查已迁移服务及 Node 类型反例；浏览器配置不引入 Node 全局。其他尚未列入配置的业务 JS 待继续迁移。`ui/reading-detail.js` 是受版本控制的生成兼容产物，禁止手改；修改 TS 后运行 `pnpm reader:build`，`pnpm typecheck` 会检查产物是否一致并拒绝 CommonJS 浏览器输出。每迁移一个模块，将其加入检查范围；禁止以 `any`、`@ts-nocheck` 或大范围忽略错误作为迁移完成标准。

`pnpm build:app` 生成独立 `build/app` 副本，保留现有 Electron/UI 相对布局并收集生产依赖；构建前先检查生成产物一致性。`pnpm start` / `preview:app` 构建并启动该副本，`pnpm serve:web` 默认先构建并从副本提供页面与匿名同步后端。导入 server 模块不会启动构建或监听。

`pnpm test` 先构建，再用统一 `appPath` 定位运行时模块、VM 入口、缓存覆盖和浏览器资源；源码数据、生成工具及可信签名工具仍按用途单独验证。`test:ui:refactor` 也先构建并显式传入同一根目录，避免继承的环境变量把检查指向旧副本。直接运行单个测试前先 `pnpm build:app`；`QMX_APP_ROOT` 可用于指定单个测试的已构建应用。

未签名打包（`QMX_BUILD_UPDATE_FEED=1` 或没有 feed）先调用同一构建器，再复制到全新暂存目录。存在有效 signed feed 的正式打包直接验证并使用已接受的 app.asar，不重新编译；该归档必须来自此前未签名构建和签名验收流程。`pnpm test:build:desktop` 验证真实 preload、版本与离线格式化器；设置 `QMX_PACKAGED_EXE` 可检查本地便携包及其阅读脚本与构建脚本字节一致。正式签名归档和本次未发布的源码改动属于不同构建，不可混淆。

## 首批 IPC 契约

共享类型来源为 `src/shared/contracts/notebook.ts`。已细化 `openExternal`、`openAuthUrl`、`formatCode`、`cancelLogin`、`exportLocal`、`bootstrap`、`updateLocal`、`plannerAction` 的参数与返回值，以及 auth/update 事件。其余 26 项仍以 `unknown` 参数/结果标注为待迁移，不代表已经完成业务类型建模。原有 34 项方法和两项订阅保持可用。

`src/preload/preload.ts` 编译为独立 `electron/preload.cjs`，运行时只加载 Electron；`src/main/ipc/boundary.ts` 和 `src/renderer/ipc/boundary.ts` 分别生成注册器与页面适配器。主进程仍使用原 `handle` sender/更新锁校验及原业务实现，尚未整体经过 TS 检查。页面迁移的八项调用真实经过已检查适配器，保留格式化器对实时 bridge 和浏览器回退的选择。类型不替代不可信 IPC 入参校验。

修改后运行 `pnpm preload:build` / `pnpm ipc:build` 更新对应产物；`typecheck` 和构建均检查生成一致性。类型反例在 `tests/types/ipc-contracts.ts`，会拒绝错误频道、参数、返回类型和事件字段。授权返回 false 代表默认浏览器回退成功；格式化错误返回原代码；auth 事件字段保留 unknown，因为 OAuth JSON 尚无对应运行时格式校验。更新事件的可选字段保留首次状态缺失的情况。

## 记录模型与本地归一化

`src/shared/models/records.ts` 区分原始 JSON、主进程快照、页面归一化结果、新建本地记录和解析器领域记录。旧字段与未知元数据保持 unknown；存储默认值可以被历史数据覆盖，不把缓存对象声明为完整解析结果。`bootstrap` 的其他尚未迁移服务保持 unknown，`updateLocal` 只约束已有运行时检查的 records/字符串 ID，其他字段保留浅合并语义。

`src/renderer/records/local.ts` 提取原页面归一化实现，生成 `ui/local-records.js`，由 `pnpm ipc:build` 一起更新。保留旧 ID/clientId 的宽松规则、账号归属转换、引用和迁移 ID 缓存；归一化不等于写入验证。GitHub 解析器及客户端已迁移，额外属性按最后一次 spread 覆盖建模；主进程大型入口和页面大型入口仍待拆分。兼容测试对照冻结的原函数，并验证存盘和重启后的未知字段与账号隔离。

## 实现模块的统一生成

`pnpm modules:build` 统一生成已迁移的搜索、目录 hydrate、Markdown、计划页面/日期组件、GitHub 解析/客户端、认证、标签、算法目录和比赛服务。浏览器保留独立 classic/UMD 输出，Node 服务使用可导入的 `.cts` 模块；共享模型只作为类型依赖。`typecheck` 与 `build:app` 均只检查生成一致性，不悄悄覆盖手改产物。新增模块必须登记到 `tools/build-modules.cjs`，并保持原运行时依赖路径。

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

## 分批迁移

1. 先用实际实现定义共享类型，优先阅读详情、记录模型和 IPC 请求/响应。当前从阅读详情开始，其他契约随对应服务迁移补齐，避免先写一套与运行代码脱节的接口。
2. 小型纯逻辑模块先迁移，再按状态、导航、题库、算法学习、账户、更新拆分界面入口。每批只迁移一项职责，保留 CSS、DOM 结构、用户文案和交互。
3. 分开建立浏览器、Electron 和工具编译配置。主进程 `.cts` 编译为 `.cjs`；保留 NodeNext 的原生动态 import，兼容现有 ESM/WASM 格式化器。页面使用显式模块依赖。
4. 接入实际编译输出时同步调整开发启动、VM 测试、打包暂存目录。三者必须引用同一套产物，保持 package/main、preload、UI、依赖的相对布局。
5. 最后迁移更新和发布工具，并单独验证旧版升级、失败恢复与五平台成品。不得在同一批更换测试框架、UI 框架、数据 schema 或签名协议。

## 发布边界

- preload 在 sandbox/contextIsolation 下运行；产物应为一个 CJS 文件，只保留允许的运行时依赖。
- update-helper 复制到 ASAR 外执行，必须是只依赖内置模块的独立 CJS 文件；共享类型用 type-only import，不引入运行时分块或编译器 loader。
- 所有平台复用同一份已签名 app.asar。编译在归档及签名前完成，签名后不重新编译、替换归档或改变字节。
- 发布工具当前部分步骤不安装依赖。迁移前先设计可信 checkout 的编译引导，并更新可信源码检查范围。
- JSON、Markdown、网络响应及 IPC 入参仍做运行时校验；TS 类型不能替代外部输入校验、权限控制和签名验证。
