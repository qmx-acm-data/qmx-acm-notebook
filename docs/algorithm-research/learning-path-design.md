# 闯关学习路径的设计依据

2026-11-15，课程依据用户认可的[完善稿 B](../../chapter-framework-v2.json)重构为 14 章、58 个学习段或独立路线，另保留第 0 章竞赛导览。每章围绕主干知识形成可检验成果，内部按内容自然拆关，不固定 12 关，也不将知识树全部节点排成必修清单。

## 练习与反馈

参考 [Carnegie Mellon University：Learning Principles](https://www.cmu.edu/teaching/principles/learning.html) 中的知识组织、分技能与综合应用、目标导向练习、及时反馈和自我监控原则：

- 每关使用明确算法或方法名称，列出适用条件、先修、学习目标及实际知识树关联。
- 每个学习段或路线安排一项自然的混练验收：基本实现、变化任务、无标签独立应用可以合在一个成果关内，不机械增加两个练习关。第 1–11 章最后一个核心验收覆盖本章其他核心段成果；已学工具在后续混练中复用。
- 章节范围与知识难度分开：`core` 为基础必修、`recommended` 为推荐进阶、`elective` 为选修、`route` 为具体路线基础。知识树的 advanced 难度不自动变成选修；是否属于核心以认可的教学范围为准。
- 第 12–13 章按具体路线分别记录完成度；每条路线的基础关和深入选修分开计算，学完一条路线不意味着完成全部高级方向。第 14 章按选定方向的核心成果验收，不要求全部高级路线完成。
- 反馈说明完成了什么：首关、综合关、章节和复盘记录形成里程碑，不根据勾选授予 CF 水平。
- 已完成、当前、未开始用颜色、文字与图标共同区分；减少动画偏好下取消庆祝动画。
- 允许跳学与回补；高阶专题按需求选修，不以全清知识点作为达到某个题目分数的保证。
- 任务卡直接提供关联笔记、官方精选题单与个人题单入口；不再提供互助卡。

这组原则为设计参考，不代表单一界面设计已经被证实能提升竞赛成绩。

## 难度体系

- [Codeforces：Problem Difficulties](https://codeforces.com/blog/entry/62865)：题目 Rating 不等同选手 Rating。新版不沿用旧章节区间；未绑定已核实题单前不填写 CF 范围，洛谷标签同样允许空缺。
- [洛谷：题目难度体系](https://help.luogu.com.cn/manual/luogu/problem/difficulty)：洛谷难度为独立分级，主观且可能调整，按标签提供另一组选题参考。
- 知识树 D1–D5 按算法的具体学习范围评价，直接读取节点数据，不换算成 CF 或洛谷等级。
- 学习路径目前绑定实际算法节点，题单后续按题目核实；未提供虚构题号或自动评测结果。

## 数据与维护

正式可编辑源为 [algorithm-learning-path.json](../../data/algorithm-learning-path.json)，课程范围依据[完善稿 B](../../chapter-framework-v2.json)。生成器的 TypeScript 源为 [build-algorithm-learning-path.cts](../../src/tools/build-algorithm-learning-path.cts)，经 `pnpm modules:build` 生成工具，再由 `pnpm algorithms:build` 验证并生成运行数据。

当前数据包含 15 章（含导览）、58 个非导览学习段/路线、201 关与 188 个真实知识树节点；各章关数按实际内容自然分布。校验覆盖真实节点、语义身份、段归属、路线一致性、先修与章节图无环、核心不被选修阻塞、章末核心成果覆盖及统计。不再要求每章 12–16 关、强填 CF 区间，或限定 expert 只能在第 13 章后出现。

### 字段与完成范围

- 关卡 `sectionId`、`sectionTitle` 对应所属段；`routeId` 为路线稳定 ID，普通学习段为 `null`；`scope` 采用 `core | recommended | elective | route`，`optional` 与 `scope !== 'core'` 一致。
- 章内 `sections` 保存段标题、范围、路线 ID、说明、验收标准、`gateIds` 与直接先修。段基础与选修深入可同属一个路线，但路线基础分母包含 `route`，不包含附属 `recommended/elective`。
- `topicIds` 只关联实际知识树算法节点。知识树没有独立叶子的语言细节通过真实上位工具节点关联，具体范围在关卡说明与目标中写明；不发明题号或节点。
- `prerequisites.gateIds` 是具体知识依赖；`topicIds` 补充真实主题回顾。`threadGateIds` 只作回顾与延伸，不构成锁关边。
- `learningTitle`、`learningDescription`、`goals` 描述学习过程与可验证成果；“学习完成”与独立解题验收仍分别保存。

### 公共关卡与学习任务

点击开始学习后，学习关显示笔记学习与题单练习两项任务；混练、验收关只显示练习任务。任务勾选和个人题单保存在原账号/资料库学习记录中；个人题单通过浮窗添加，不占用任务主区域。

官方精选题单在默认关卡窗口直接展示，无需先开始学习；未配置时显示尚未发布状态。添加与编辑官方题单及公共关卡的按钮仅管理员可见，放在关卡标题旁。管理员可以编辑公共介绍、核心目标和一个官方精选题单，并在发布前查看公共版预览。公共内容保存在当前资料库的 `algorithms/learning-path/gates/<gateId>.json`；同步和离线缓存均按资料来源隔离。服务端重新检查管理员权限与版本 SHA，其他成员只能查看。首次添加与后续编辑分别使用明确的空 SHA 和当前 SHA，冲突时需重新同步，不能覆盖他人的更新。个人题单和学习状态不进入公共关卡文件。

### 历史进度

旧路线完整保存为 [algorithm-learning-path-legacy.json](../../data/algorithm-learning-path-legacy.json)。路线 `id` 仍为 `xcpc-breadth-first-v1`，保留账号/资料库进度命名空间；第 0 章关卡身份保留。第 1–14 章新关卡全部使用 `lp2-` 开头的稳定语义 ID，绝不复用旧编号身份，因此旧完成记录不会误授给新课。新数据内 `legacyGates` 保存旧 168 关的 ID、标题和原章标题，供 renderer 展示历史；历史记录不进入新课程进度分母。
