# TypeScript 渐进重构与功能基线

基线：v1.2.4，主分支提交 `273648b`。重构期间保持版本号、界面、操作流程、存储格式、默认值、权限判断及更新协议的现有行为。新需求与重构分开提交。

逐批文件范围、依赖顺序、验收门槛、回退方式与工作量评估见 [TypeScript 重构实施计划](TYPESCRIPT_REFACTOR_PLAN.md)。

## 开始前与每批提交

```sh
pnpm install --frozen-lockfile
pnpm check:refactor
pnpm test:ui:refactor
```

`check:refactor` 汇总严格类型检查、现有语法检查、生成数据一致性检查和所有 Node 单元测试。`test:ui:refactor` 顺序运行现有 12 个界面回归脚本，遇到失败立即停止；需要 Playwright 和 Microsoft Edge，使用隔离浏览器与模拟 bridge，不写入正式资料库。截图继续输出到已忽略的目录。

首批 `tsconfig.json` 只覆盖阅读详情模块与其真实 API 类型，采用 `strict + checkJs + noEmit`。它不代表其他 JS 已经经过类型检查。每迁移一个模块，将其加入检查范围并移除旧实现；禁止以 `any`、`@ts-nocheck` 或大范围忽略错误作为迁移完成标准。注释中的类型导入不产生运行时依赖。

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
