# 拾题 · QMX ACM Notebook

面向 ACM 集训队的 Windows、Linux 与 macOS 本地错题与算法资料客户端，无需自建服务器、数据库或域名。默认资料来源：[qmx-acm-data/2026](https://github.com/qmx-acm-data/2026)。

**[Windows x64 安装包 v1.5.0](https://github.com/qmx-acm-data/qmx-acm-notebook/releases/download/v1.5.0/QMX-Notebook-Setup-1.5.0.exe)** · [所有版本](https://github.com/qmx-acm-data/qmx-acm-notebook/releases) · [v1.5.0 更新说明](docs/releases/v1.5.0.md)

v1.5.0：算法树与学习路线统一为真实叶子的“Markdown 简介／精选笔记／全部笔记（排除精选）”阅读，目录只组织叶子；新增“仅看已有笔记”与嵌套收起恢复，条件筛选不再在右侧堆叠额外匹配模块。

下载后运行安装程序。首次配置、登录、数据备份与已知限制见 [使用指南](docs/USAGE.md)。客户端 OAuth 的真实设备授权、组织访问和在线写入仍需按实际账号验收，本地测试不代替这些验证。

![浅色界面示例](screenshots/preview-light.png)

## 能做什么

- 公共题库与“本地题解”采用紧凑七列题目列表：平台、题号、算法标签、题目、难度、作者、更新，最小行高 42px；点击题目直接阅读，返回保留列表滚动位置。作者头像使用 GitHub 官方域名，支持当前账号缓存头像与加载失败文字回退。
- 公共题库展示正式 Markdown 题解，算法笔记提供分层目录与资料阅读；已有收藏继续保留。设置管理多个仓库，顶栏可切换 GitHub 与 Gitea 公开题库；缓存、权限和收藏按服务地址与仓库隔离。自建 Gitea 仅支持匿名公开读取，GitHub 登录凭据不会发送给自建服务。
- 个人收藏统一收纳题解、Trick 和算法笔记；支持按类型切换与关键词搜索，紧凑列表点击后阅读完整内容。新收藏按账号、服务地址和资料库隔离保存在本机，保存失败恢复原状态。
- “本地题解”汇总当前可见的本地记录，以及当前 GitHub 账号按用户 ID 匹配、在当前仓库上传的正式题解；保留账号、仓库和资料来源隔离。管理标记为“仅本地”的题解、草稿、收藏与复习状态，本地编辑删除不影响 GitHub；保存后直接阅读本地题解，收藏后可从个人收藏再次访问。
- GitHub 登录提供账号身份；直接上传题解文件，在客户端修改、删除本人已上传题解，不创建重复 Issue 或 PR。
- 账户界面检查更新，本机旧包匹配时优先差分下载。1.2.5 起支持连续差分：无直接补丁时，在最近 8 次差分清单变更中寻找最多 8 段的补丁链，逐段重建并验证签名、大小和哈希，最后统一安装最新版，只需重启一次。实际可跨版本数受历史记录与补丁完整性限制；累计补丁须小于完整包的 90%，不适用或任一段失败时回退完整包并显示原因。已有旧客户端需先升级到 1.2.5，之后才具备自动连续差分能力。升级前备份个人数据，保留原位置与已有快捷方式。
- 旧版无法使用应用内更新或 Electron 运行时不匹配时，从 Releases 下载当前完整安装包升级。
- 启动进入紧凑主页，集中展示每日一题、比赛提醒、待做题目、学习任务与平台统计；主页不再显示六项快捷入口，tricks、公共题库、算法笔记与个人收藏通过侧边栏访问，导航支持悬浮展开与固定。
- Trick 集采用紧凑目录展示标题、作者、简介，具体内容点击后进入独立阅读页；支持搜索与 Markdown 编辑预览。Trick 保存到当前公共资料库，作者维护本人内容，管理员可管理，更新与删除均检查 SHA。
- 主页“每日一题”可按来源、CF Rating、洛谷难度与算法标签筛选抽题，启动后自动抽一道；支持换一道、复制链接与难度调整。题目来自 Codeforces、AtCoder、洛谷、牛客、力扣、LibreOJ，配置 CLIST 后可补充洛谷与牛客题库；凭据经系统安全存储加密。
- 题目元数据可保存为按平台分片的本地索引并增量更新，抽题改为本地查询；板块右上角“刷新题库”手动更新，失败平台单独提示且保留旧数据。
- 待做题目可粘贴受支持平台的题目链接并选填名称；学习任务支持完成、编辑、删除与可选截止时间弹窗，点击任务标题查看只读详情，补充说明通过“编辑”填写。计划只保存在本机，不随 GitHub 同步。
- 算法笔记提供 578 节点的知识树和“学习路线”：初窥、入门、基础、进阶四阶段关系图，33 个知识节点与 38 条连接，绿蓝金红区分层次；支持自适应缩放、搜索、列表、关联高亮与知识详情。只有真实叶子保存笔记，目录只组织子节点；公共与个人范围统一展示“Markdown 简介／精选笔记／全部笔记（排除精选）”，管理员可多篇精选并预览 Markdown，路线目录仅显示一篇简介与叶子入口。个人题单与当前关注按账号和资料来源保存；旧完成、任务和题单记录保留，旧课程编排入口不再作为路线编辑器。
- 主页统一展示洛谷、Codeforces、AtCoder、牛客比赛提醒，独立缓存、北京时间倒计时与赛时；支持“不参加”和勾选恢复，AtCoder 显示 ABC、ARC、AGC、AHC 类型标签。
- 设置绑定 CF、AtCoder、洛谷、牛客和力扣公开主页，主页统一展示做题与提交统计、最近比赛、CF/AtCoder Rating 图及每日做题热图；支持局部平台切换和悬停详情，新用户无默认绑定。
- 展示 Markdown、公式、代码与平台原生难度，提供瓷白、晴空蓝、雾紫、樱粉、暖杏、海盐青六套配色，独立切换浅色与深色，卡片布局大小适中；设置支持即时预览、取消恢复与保存。平台和语义颜色保留；代码支持高亮、复制和离线格式化（含 Rust），阅读字号与行号可设置。

## 文档

- [使用指南](docs/USAGE.md)：安装、OAuth 登录、同步格式、数据安全与限制。
- [参与开发](CONTRIBUTING.md)：开发环境、检查与构建命令、贡献约定。
- [维护与发布](docs/RELEASING.md)：源码上传、版本发布、验收状态及应用归属。

## 管理员发布新版本

1. 更新 `package.json` 中的版本号并编写版本说明。将改动合并到 `main` 后，在对应提交上创建并推送同版本的新标签，例如 `0.6.1` 对应 `v0.6.1`。
2. 在 GitHub [Actions](https://github.com/qmx-acm-data/qmx-acm-notebook/actions) → **Build desktop clients** → **Run workflow** 中选择 `main`，填写已推送的标签，保持 `verify_signing_only` 未勾选，然后运行。GitHub Actions 会使用仓库 Secret 签名，管理员无需获取私钥。
3. 构建成功后，在 [Releases](https://github.com/qmx-acm-data/qmx-acm-notebook/releases) 中打开生成的草稿，核对版本说明、安装包和 `SHA256SUMS.txt`，验收通过后点击 **Publish release**。
4. 发布后，在 Actions → **Prepare published update channel** → **Run workflow** 中选择 `main`，填写同一个标签。审核并合并生成的更新通道 PR；若工作流只生成了分支，按运行摘要中的链接手动开 PR。

**发布 Release 只开放下载；更新通道 PR 合并后，现有客户端下次检查更新时才会发现新版本。** 如更换了 Electron 运行时，仍需用完整安装包升级。更多验收和故障处理见[维护与发布](docs/RELEASING.md#构建与版本发布)。

## 如何合并 Pull Request（PR）

`main` 是受保护分支，代码修改通过 PR 合并。GitHub 不允许作者 **Approve（批准）自己的 PR**，即使作者是组织 Owner；但 `time-lo` 和 `yiliyuOVO` 当前已配置审批豁免，可以不经他人批准合并自己的 PR。其他人仍需至少一位有审批权限的维护者批准。

1. 打开仓库的 [Pull requests 页面](https://github.com/qmx-acm-data/qmx-acm-notebook/pulls)，进入对应 PR。先在 **Files changed** 中确认修改内容，再回到 **Conversation** 并滚动到页面底部的合并区域；合并自己的 PR 不用点 **Approve**。
2. 如果 PR 仍为草稿，先确认已准备好，再点击 **Ready for review**。如果显示 **Update branch**，先同步最新 `main`，再等待检查重新运行；有冲突时先解决冲突。
3. 等待必需的 **`check`** 检查变绿，并处理未解决的审查讨论，确认后点击 **Resolve conversation**。两位审批豁免账号不必等待他人批准；其他账号仍须取得批准。若更新通道 PR 没有检查，在 Actions → **Source checks** → **Run workflow** 中选择该 PR 的分支运行。
4. 条件满足后点击 **Squash and merge** 或 **Merge pull request**，再点击 **Confirm squash and merge / Confirm merge**。不要为了合并而跳过失败或尚未完成的 CI；审批豁免不代表可以绕过其他保护。
5. 看到紫色 **Merged** 即表示完成；可按需点击 **Delete branch** 删除已合并的工作分支，不要删除 `main`。若不需要这些修改，使用 **Close pull request** 关闭而不合并。

**更新通道 PR 合并后会激活对应版本的客户端更新通道，请先验收 Release；关闭但不合并不会激活更新。**

## 源码目录

| 目录 | 职责 |
| --- | --- |
| `src/` | TypeScript 业务源码、共享模型与 IPC 契约，按 main/renderer/preload/tools/server 分工 |
| `electron/` | 受版本控制的主进程运行产物及独立运行边界 |
| `ui/` | 界面样式、静态数据与生成的浏览器应用包，无 Node 权限 |
| `tests/` | 数据处理、界面、桌面及更新验证脚本 |
| `tools/` | 构建引导与生成的发布、打包和数据工具 |
| `.github/workflows/` | 源码检查、五平台构建与可信签名草稿发布 |
| `AGENTS.md` | AI 修改 TypeScript、生成产物与验证的维护规则 |
| `docs/` | 使用与维护文档 |

客户端发布仓库为 [qmx-acm-data/qmx-acm-notebook](https://github.com/qmx-acm-data/qmx-acm-notebook)。许可证状态与维护责任见 [维护与发布](docs/RELEASING.md#归属与许可证)。
