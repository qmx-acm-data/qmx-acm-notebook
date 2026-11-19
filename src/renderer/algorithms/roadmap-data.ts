import type { RoadmapData } from '../../shared/models/learning-roadmap.js';

/** Approved four-stage outline, maintained as typed source. */
export const roadmapData: RoadmapData = {
  "rows": [
    {
      "name": "初窥",
      "color": "#287449",
      "bg": "#eef8f1"
    },
    {
      "name": "入门",
      "color": "#2869b5",
      "bg": "#edf4ff"
    },
    {
      "name": "基础",
      "color": "#946400",
      "bg": "#fff7df"
    },
    {
      "name": "进阶",
      "color": "#b34443",
      "bg": "#fff0ef"
    }
  ],
  "nodes": [
    {
      "id": "g",
      "row": 0,
      "label": "C++ 基础语法",
      "kind": "root",
      "px": 680,
      "py": 49,
      "detail": [
        "把题意变成程序的起点",
        "输入输出、类型和表达式；分支、循环、数组与函数共同构成基本程序。",
        [
          "变量、类型转换与整数范围",
          "if / switch、for / while、输入输出与多组数据",
          "函数、作用域、引用与 struct 的基础概念"
        ],
        [
          "先写可运行的小程序，再用样例与边界检查。",
          "语法是表达工具，不必背完所有语言特性再接触题目。"
        ],
        "尝试独立处理一组输入，说明数据怎样变化、结果怎样输出。"
      ],
      "gateIds": [
        "stage-00-gate-01",
        "lp2-cpp-toolkit-program-flow-types-io",
        "lp2-cpp-toolkit-program-flow-branches-loops",
        "lp2-cpp-toolkit-program-flow-practice-assessment",
        "lp2-cpp-toolkit-data-organization-functions-records",
        "lp2-cpp-toolkit-data-organization-addresses",
        "lp2-cpp-toolkit-data-organization-sequences",
        "lp2-cpp-toolkit-data-organization-practice-assessment"
      ],
      "topicIds": [
        "directory-contest-experience",
        "algorithm-万能头文件与标准库使用",
        "algorithm-int128-与整数溢出",
        "algorithm-数组初始化与-memset",
        "algorithm-content-feishu-part-1-1",
        "xcpc-函数-1",
        "xcpc-引用-1",
        "xcpc-结构体-类-1",
        "xcpc-指针-1",
        "xcpc-vector-1",
        "algorithm-string",
        "xcpc-pair-1"
      ]
    },
    {
      "id": "xh",
      "row": 0,
      "label": "循环",
      "kind": "leaf",
      "px": 220,
      "py": 148,
      "detail": [
        "描述重复与状态变化",
        "循环连接枚举、模拟与复杂度分析。",
        [
          "循环变量、终止条件和边界",
          "嵌套循环与枚举范围",
          "break / continue 与状态更新顺序"
        ],
        [
          "关注少一次、多一次、死循环和多组数据的清空。"
        ],
        "写出一个简单枚举，并估算循环实际执行次数。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-program-flow-branches-loops"
      ],
      "topicIds": [
        "algorithm-数组初始化与-memset",
        "algorithm-content-feishu-part-1-1"
      ]
    },
    {
      "id": "sz",
      "row": 0,
      "label": "数组",
      "kind": "leaf",
      "px": 400,
      "py": 148,
      "detail": [
        "组织可按位置访问的数据",
        "数组与序列是后续容器、状态表和图表示的基础。",
        [
          "一维与二维数组、下标与遍历",
          "字符数组、初始化和边界",
          "连续存储与基本空间估算"
        ],
        [
          "长度、下标和输入规模要区分；注意越界。"
        ],
        "实现一次序列统计，并覆盖空边界与极值。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-program-flow-branches-loops"
      ],
      "topicIds": [
        "algorithm-数组初始化与-memset",
        "algorithm-content-feishu-part-1-1"
      ]
    },
    {
      "id": "hs",
      "row": 0,
      "label": "函数",
      "kind": "leaf",
      "px": 40,
      "py": 148,
      "detail": [
        "拆分计算，组织解法",
        "函数与递归帮助把复杂过程拆成清楚的接口。",
        [
          "参数、返回值与作用域",
          "值传递、引用与 const",
          "递归出口、调用栈与分治的直觉"
        ],
        [
          "理解生命周期，不返回悬垂引用。"
        ],
        "把一段计算抽成函数，解释输入、输出和副作用。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-data-organization-functions-records"
      ],
      "topicIds": [
        "xcpc-函数-1",
        "xcpc-引用-1",
        "xcpc-结构体-类-1"
      ]
    },
    {
      "id": "wy",
      "row": 0,
      "label": "位运算",
      "kind": "leaf",
      "px": 1300,
      "py": 148,
      "detail": [
        "用二进制表达集合与组合",
        "位运算连接子集枚举、快速幂、状压 DP 与异或问题。",
        [
          "二进制与按位与、或、异或",
          "移位、位掩码与简单集合表示",
          "整数宽度、符号与运算优先级"
        ],
        [
          "移位范围与有符号溢出需要核对。"
        ],
        "用小整数手算异或与位掩码，观察集合对应关系。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-reliable-code-bits-complexity",
        "lp2-cpp-toolkit-reliable-code-debugging",
        "lp2-cpp-toolkit-reliable-code-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-5-1",
        "xcpc-时空复杂度分析-1",
        "algorithm-int128-与整数溢出",
        "xcpc-对拍-1"
      ]
    },
    {
      "id": "ds",
      "row": 1,
      "label": "基础数据结构（上）",
      "kind": "aggregate",
      "sub": "＋ STL",
      "px": 680,
      "py": 357,
      "detail": [
        "基础数据结构（上）与常用 STL 接口",
        "这一部分集中认识数据如何组织、标准库如何操作；算法思想与工具接口在浮窗中分别说明。",
        [
          "STL 速查：vector、array、string、pair、tuple 与迭代器",
          "链表、栈、队列、双端队列及对应接口",
          "二叉堆与 priority_queue；空容器和操作复杂度",
          "map / set / multiset 的有序维护，unordered_map / unordered_set 的哈希维护",
          "sort、stable_sort、lower_bound、upper_bound 等接口"
        ],
        [
          "初识贪心与本节点的连接表示工具应用，不表示贪心是 STL 的子类。",
          "map 是有序映射，不能用它代替哈希表的定义。"
        ],
        "选择一种查询与修改需求，比较两种容器的成本与不支持的操作。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-stl-selection-sorting-interfaces",
        "lp2-cpp-toolkit-stl-selection-ordered-containers",
        "lp2-cpp-toolkit-stl-selection-hash-containers",
        "lp2-cpp-toolkit-stl-selection-adapters",
        "lp2-cpp-toolkit-stl-selection-binary-search-interface",
        "lp2-cpp-toolkit-stl-selection-practice-assessment"
      ],
      "topicIds": [
        "algorithm-常用算法函数与迭代器",
        "xcpc-pair-1",
        "xcpc-map-1",
        "xcpc-set-1",
        "xcpc-multiset-1",
        "xcpc-unordered-map-1",
        "xcpc-unordered-set-1",
        "algorithm-stack-queue",
        "algorithm-deque",
        "xcpc-priority-queue-1",
        "algorithm-二分查找"
      ]
    },
    {
      "id": "ss",
      "row": 1,
      "label": "认识数学",
      "kind": "leaf",
      "px": 1300,
      "py": 357,
      "detail": [
        "认识数学在问题里的作用",
        "从整数、奇偶、余数与简单计数建立直觉。位运算是其中一个入口，不是数学的唯一前置条件。",
        [
          "整除、余数、GCD / LCM",
          "奇偶、配对、不变量与基础构造",
          "加法乘法原理与小规模计数"
        ],
        [
          "先说明在数什么、条件是什么，再使用公式。"
        ],
        "用枚举检查一个简单的整数或计数规律。"
      ],
      "gateIds": [
        "lp2-brute-models-construction-integers-constructive-invariants",
        "lp2-brute-models-construction-integers-gcd-factorization",
        "lp2-brute-models-construction-integers-prime-sieve",
        "lp2-brute-models-construction-integers-linear-sieve",
        "lp2-brute-models-construction-integers-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-1-6",
        "algorithm-content-feishu-part-5-2-2",
        "algorithm-lcm",
        "xcpc-埃式筛-1",
        "algorithm-线性筛-素数"
      ]
    },
    {
      "id": "px",
      "row": 1,
      "label": "排序",
      "sub": "sort",
      "kind": "branch",
      "px": 220,
      "py": 456,
      "detail": [
        "整理顺序，暴露结构",
        "排序既是工具，也是许多方法的预处理步骤。",
        [
          "sort / stable_sort 与比较器",
          "排序后的去重、排名和离散化",
          "比较器的严格弱序与复杂度"
        ],
        [
          "排序可能改变原下标，应考虑是否保留身份。"
        ],
        "比较排序前后，查找或配对是否更简单。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-stl-selection-sorting-interfaces"
      ],
      "topicIds": [
        "algorithm-常用算法函数与迭代器",
        "xcpc-pair-1"
      ]
    },
    {
      "id": "ef",
      "row": 1,
      "label": "二分",
      "sub": "lower_bound",
      "kind": "branch",
      "px": 400,
      "py": 456,
      "detail": [
        "利用有序性或单调性定位边界",
        "标准库二分接口与二分答案有联系，但需要分别理解条件与不变量。",
        [
          "lower_bound / upper_bound 的返回含义",
          "闭开区间与边界不变量",
          "单调判定与二分答案"
        ],
        [
          "能调用 lower_bound 不等于理解所有二分问题。"
        ],
        "手工验证空区间、重复值与找不到目标的情况。"
      ],
      "gateIds": [
        "lp2-basic-optimization-monotone-methods-binary-boundaries",
        "lp2-basic-optimization-monotone-methods-binary-answer",
        "lp2-basic-optimization-monotone-methods-two-pointers",
        "lp2-basic-optimization-monotone-methods-practice-assessment",
        "lp2-cpp-toolkit-stl-selection-binary-search-interface"
      ],
      "topicIds": [
        "algorithm-二分查找",
        "algorithm-二分答案",
        "algorithm-content-feishu-part-1-9",
        "algorithm-常用算法函数与迭代器"
      ]
    },
    {
      "id": "tx",
      "row": 1,
      "label": "初识贪心",
      "sub": "优先队列",
      "kind": "branch",
      "px": 580,
      "py": 456,
      "detail": [
        "初识贪心：先感受局部选择",
        "从排序、区间和配对问题认识贪心。此处先建立直觉，后续贪心分类再比较不同模型及正确性理由。",
        [
          "局部选择与全局目标",
          "排序与区间选择",
          "配对、安排顺序与优先队列应用"
        ],
        [
          "通过样例只是开始，仍需反例或正确性解释。"
        ],
        "尝试一个看似合理的策略，并主动寻找使它失败的小例子。"
      ],
      "gateIds": [
        "lp2-basic-optimization-powers-greedy-binary-power",
        "lp2-basic-optimization-powers-greedy-greedy-proof",
        "lp2-basic-optimization-powers-greedy-practice-assessment"
      ],
      "topicIds": [
        "xcpc-快速幂-1",
        "algorithm-content-feishu-part-5-1",
        "algorithm-content-feishu-part-1-5"
      ]
    },
    {
      "id": "dl",
      "row": 1,
      "label": "队列",
      "sub": "queue",
      "kind": "branch",
      "px": 760,
      "py": 456,
      "detail": [
        "按先后顺序处理状态",
        "队列与栈、双端队列等工具帮助组织搜索与维护信息。",
        [
          "queue 的先进先出",
          "deque 与双端操作",
          "入队标记、空队列和处理顺序"
        ],
        [
          "普通队列、优先队列与单调队列的顺序规则不同。"
        ],
        "用队列模拟分层处理，观察同层状态的关系。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-stl-selection-adapters"
      ],
      "topicIds": [
        "algorithm-stack-queue",
        "algorithm-deque",
        "xcpc-priority-queue-1"
      ]
    },
    {
      "id": "zfc",
      "row": 1,
      "label": "字符串",
      "sub": "string",
      "kind": "branch",
      "px": 940,
      "py": 456,
      "detail": [
        "认识字符序列与基本操作",
        "字符串在此先作为数据对象，匹配和子串结构在后续基础层展开。",
        [
          "string 的长度、访问、拼接与截取",
          "前缀、后缀、子串与子序列",
          "下标和字符处理"
        ],
        [
          "子串连续，子序列不必连续；频繁复制会产生额外成本。"
        ],
        "用最直接的办法完成一次查找或比较。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-data-organization-sequences"
      ],
      "topicIds": [
        "xcpc-vector-1",
        "algorithm-string",
        "xcpc-pair-1"
      ]
    },
    {
      "id": "hm",
      "row": 1,
      "label": "哈希",
      "sub": "map",
      "kind": "branch",
      "px": 1120,
      "py": 456,
      "detail": [
        "从键值查询理解哈希与映射",
        "保留原框架的“哈希”分支，同时区分有序映射和哈希表。",
        [
          "unordered_map / unordered_set 与哈希表",
          "map / set 的有序访问和复杂度",
          "冲突、最坏情况与选型意识"
        ],
        [
          "字符串哈希是另一类应用，不能与 unordered_map 混为一谈。"
        ],
        "对同一组键值查询比较有序容器与哈希容器。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-stl-selection-hash-containers"
      ],
      "topicIds": [
        "xcpc-unordered-map-1",
        "xcpc-unordered-set-1"
      ]
    },
    {
      "id": "ssr",
      "row": 2,
      "label": "搜索",
      "kind": "aggregate",
      "px": 40,
      "py": 665,
      "detail": [
        "搜索：系统探索状态与减少无效计算",
        "在递归/分治基础上认识状态探索，DFS 与 BFS 可分别实现，遇到特殊模型时再展开深入方法。",
        [
          "DFS、回溯与 BFS：状态、访问标记、分层和路径恢复",
          "记忆化搜索：重复状态与基础 DP 的联系",
          "搜索剪枝：可行性、最优性、对称与顺序",
          "按题深入：双向搜索、A* 与启发函数条件",
          "按题深入：IDA* 与迭代加深；精确覆盖问题和 DLX"
        ],
        [
          "DLX 是精确覆盖的实现方法，不是 BFS 的下一必学步骤。",
          "A* 和 IDA* 必须理解所用启发函数与搜索条件。"
        ],
        "用同一小状态问题比较 DFS、BFS 和记忆化，再找出可以安全剪掉的状态。"
      ],
      "gateIds": [
        "lp2-search-search-states-graph-state",
        "lp2-search-search-states-dfs-backtracking",
        "lp2-search-search-states-practice-assessment",
        "lp2-search-shortest-actions-bfs-paths",
        "lp2-search-shortest-actions-practice-assessment",
        "lp2-search-pruning-cache-safe-pruning",
        "lp2-search-pruning-cache-cached-search",
        "lp2-search-pruning-cache-practice-assessment",
        "lp2-search-search-extensions-bidirectional",
        "lp2-search-search-extensions-meet-middle",
        "lp2-search-search-extensions-iterative-deepening",
        "lp2-search-search-extensions-practice-assessment"
      ],
      "topicIds": [
        "xcpc-图的概念-1",
        "algorithm-content-xcpc-图的遍历-1",
        "algorithm-content-feishu-part-2-1",
        "algorithm-backtracking",
        "algorithm-content-feishu-part-2-2",
        "algorithm-content-feishu-part-2-4",
        "algorithm-content-feishu-part-2-3",
        "algorithm-双向-bfs",
        "xcpc-折半搜索-1",
        "xcpc-递归-回溯-1"
      ]
    },
    {
      "id": "jcdp",
      "row": 2,
      "label": "基础 dp",
      "kind": "leaf",
      "px": 400,
      "py": 785,
      "detail": [
        "基础 DP：完整定义状态、转移与答案",
        "先理解重复子问题和状态，再将线性、背包、区间与计数模型连起来。",
        [
          "记忆化与递推、状态含义、初值与边界",
          "线性与序列 DP",
          "背包：01、完全、多重与分组",
          "区间 DP、计数、方案还原和空间优化"
        ],
        [
          "循环顺序可能改变背包含义；计数先定义对象和去重。"
        ],
        "用小规模枚举检查一个 DP，并解释状态保留了哪些历史。"
      ],
      "gateIds": [
        "lp2-basic-dp-state-sequence-dp-contract",
        "lp2-basic-dp-state-sequence-linear-lis",
        "lp2-basic-dp-state-sequence-lcs",
        "lp2-basic-dp-state-sequence-practice-assessment",
        "lp2-basic-dp-knapsack-zero-one",
        "lp2-basic-dp-knapsack-unbounded",
        "lp2-basic-dp-knapsack-bounded",
        "lp2-basic-dp-knapsack-grouped",
        "lp2-basic-dp-knapsack-practice-assessment",
        "lp2-basic-dp-interval-counting-interval",
        "lp2-basic-dp-interval-counting-count-reconstruct",
        "lp2-basic-dp-interval-counting-practice-assessment",
        "lp2-basic-dp-dp-selection-dp-greedy-search",
        "lp2-basic-dp-dp-selection-practice-assessment"
      ],
      "topicIds": [
        "xcpc-状态-1",
        "xcpc-转移-1",
        "xcpc-无后效性-1",
        "algorithm-content-feishu-part-3-1",
        "algorithm-最长上升子序列-lis",
        "algorithm-最长公共子序列-lcs",
        "xcpc-01背包-1",
        "xcpc-无限背包-1",
        "algorithm-content-xcpc-多重背包-1",
        "xcpc-o-nm-log-l-1",
        "xcpc-分组背包-1",
        "xcpc-混合背包-1",
        "xcpc-基础-2",
        "xcpc-基础-7",
        "xcpc-最优子结构-1",
        "algorithm-content-feishu-part-1-5"
      ]
    },
    {
      "id": "tl",
      "row": 2,
      "label": "基础图论",
      "kind": "leaf",
      "px": 580,
      "py": 785,
      "detail": [
        "基础图论：路径、连接、依赖与树",
        "从图存储和遍历进入，按问题目标区分路径、连通、生成树与依赖。",
        [
          "图的存储与遍历",
          "最短路：等权 BFS、非负权 Dijkstra、Floyd；负边方法按需补",
          "树上基础：二叉树、树的直径、倍增与最近公共祖先 LCA",
          "生成树与并查集的应用",
          "拓扑排序、DAG 与二分图认识和染色"
        ],
        [
          "并查集的主归属在数据结构，本节点通过连通和生成树应用它。",
          "最短路、生成树与拓扑排序的目标不同。"
        ],
        "把一道关系题画成图，解释边的含义和需要求的量。"
      ],
      "gateIds": [
        "lp2-graph-trees-paths-dependency-topological",
        "lp2-graph-trees-paths-dependency-dijkstra",
        "lp2-graph-trees-paths-dependency-floyd",
        "lp2-graph-trees-paths-dependency-negative-edges",
        "lp2-graph-trees-paths-dependency-practice-assessment",
        "lp2-graph-trees-connectivity-cost-dsu",
        "lp2-graph-trees-connectivity-cost-mst",
        "lp2-graph-trees-connectivity-cost-practice-assessment",
        "lp2-graph-trees-static-trees-tree-info",
        "lp2-graph-trees-static-trees-diameter",
        "lp2-graph-trees-static-trees-practice-assessment",
        "lp2-graph-trees-tree-queries-lca",
        "lp2-graph-trees-tree-queries-dfn",
        "lp2-graph-trees-tree-queries-practice-assessment"
      ],
      "topicIds": [
        "xcpc-拓扑序-1",
        "xcpc-图上dp-1",
        "xcpc-dijkstra-1",
        "xcpc-floyd-1",
        "xcpc-bellman-ford-1",
        "xcpc-并查集基础-1",
        "xcpc-kruskal-1",
        "xcpc-prim-1",
        "xcpc-树的基本概念-1",
        "xcpc-树的遍历-1",
        "algorithm-content-feishu-part-7-3-2",
        "xcpc-倍增-1",
        "algorithm-content-feishu-part-7-3-3",
        "xcpc-dfn-1",
        "algorithm-一维前缀和"
      ]
    },
    {
      "id": "srgt",
      "row": 2,
      "label": "贪心分类",
      "kind": "leaf",
      "px": 760,
      "py": 785,
      "detail": [
        "贪心分类：按模型比较选择策略",
        "按区间、排序、配对、反悔与候选维护等场景分类理解，与 DP 对照信息保留方式。",
        [
          "区间选择、排序与配对模型",
          "候选维护、优先队列与反悔思路",
          "交换论证、不变量和反例",
          "与搜索、DP 的方法比较"
        ],
        [
          "同一类别也必须核对题目条件，不能只凭标签套策略。"
        ],
        "为同一个问题比较贪心和 DP，解释为什么某些历史信息可以省略。"
      ],
      "gateIds": [
        "lp2-basic-optimization-powers-greedy-binary-power",
        "lp2-basic-optimization-powers-greedy-greedy-proof",
        "lp2-basic-optimization-powers-greedy-practice-assessment",
        "lp2-basic-optimization-method-selection-optimize-from-brute",
        "lp2-basic-optimization-method-selection-practice-assessment"
      ],
      "topicIds": [
        "xcpc-快速幂-1",
        "algorithm-content-feishu-part-5-1",
        "algorithm-content-feishu-part-1-5",
        "algorithm-枚举",
        "algorithm-二分答案",
        "algorithm-content-feishu-part-1-9"
      ]
    },
    {
      "id": "zfsf",
      "row": 2,
      "label": "字符串算法",
      "kind": "leaf",
      "px": 940,
      "py": 785,
      "detail": [
        "字符串算法：从匹配到前缀与回文结构",
        "前后缀、匹配、回文与前缀集合有各自的信息复用方式，基础与扩展连续理解。",
        [
          "字符串哈希与碰撞风险",
          "KMP、Z 函数、周期与失配结构",
          "Manacher 与回文半径",
          "Trie 树（字典树）：前缀集合、终止标记与计数",
          "AC 自动机：Trie、BFS、fail 指针与传播"
        ],
        [
          "Trie 与 AC 连贯学习，但使用 Trie 不要求先学习 AC。",
          "哈希提供概率性保证，与确定性匹配方法分开辨认。"
        ],
        "将一种匹配或回文算法与暴力对照，说明它复用了什么信息。"
      ],
      "gateIds": [
        "lp2-strings-single-pattern-prefix-kmp",
        "lp2-strings-single-pattern-z-function",
        "lp2-strings-single-pattern-practice-assessment",
        "lp2-strings-substring-palindrome-hash",
        "lp2-strings-substring-palindrome-manacher",
        "lp2-strings-substring-palindrome-practice-assessment",
        "lp2-strings-prefix-set-trie",
        "lp2-strings-prefix-set-practice-assessment",
        "lp2-strings-multi-pattern-ac-build",
        "lp2-strings-multi-pattern-ac-count",
        "lp2-strings-multi-pattern-practice-assessment",
        "lp2-strings-string-selection-string-tool-choice",
        "lp2-strings-string-selection-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-4-2",
        "xcpc-扩展kmp-1",
        "algorithm-content-feishu-part-4-1",
        "algorithm-content-feishu-part-4-3",
        "algorithm-content-feishu-part-4-4",
        "algorithm-content-feishu-part-4-5"
      ]
    },
    {
      "id": "jcsz",
      "row": 2,
      "label": "基础数学",
      "kind": "leaf",
      "px": 1300,
      "py": 785,
      "detail": [
        "基础数学：整数、同余、计数与随机模型",
        "在认识数学的基础上，按具体对象理解可复用的定义和运算条件。计算几何从此节点单独向下展开。",
        [
          "整除相关：素数、GCD、欧拉函数和基础筛法",
          "同余方程：线性同余、乘法逆元与中国剩余定理",
          "组合数学：排列组合、容斥；卡特兰数与斯特林数按模型查阅",
          "博弈论：胜负状态与公平组合游戏，SG 方法按题深入",
          "概率与期望：样本空间、条件概率、全概率和线性性"
        ],
        [
          "逆元需满足存在条件，模意义概率也需检查分母。",
          "基础数学不是完成所有数学专题才可进入几何的门槛。"
        ],
        "用枚举检查一个计数或博弈状态结论，说明公式的条件。"
      ],
      "gateIds": [
        "lp2-number-counting-congruence-inverses-congruence-theorems",
        "lp2-number-counting-congruence-inverses-extended-gcd",
        "lp2-number-counting-congruence-inverses-practice-assessment",
        "lp2-number-counting-combinations-combination-model",
        "lp2-number-counting-combinations-factorial-combinations",
        "lp2-number-counting-combinations-lucas",
        "lp2-number-counting-combinations-practice-assessment",
        "lp2-number-counting-inclusion-integers-inclusion-exclusion",
        "lp2-number-counting-inclusion-integers-multiplicative",
        "lp2-number-counting-inclusion-integers-classical-counts",
        "lp2-number-counting-inclusion-integers-practice-assessment",
        "lp2-number-counting-crt-extension-crt",
        "lp2-number-counting-crt-extension-extended-crt",
        "lp2-number-counting-crt-extension-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-5-2-3",
        "xcpc-费马定理-欧拉定理-1",
        "xcpc-扩展欧几里得-1",
        "xcpc-逆元-1",
        "algorithm-content-feishu-part-5-6-1",
        "xcpc-杨辉三角-1",
        "xcpc-多重集组合数-1",
        "algorithm-content-xcpc-lucas定理-1",
        "algorithm-content-feishu-part-5-6-3",
        "algorithm-content-feishu-part-5-2-2",
        "xcpc-错排问题-1",
        "xcpc-卡特兰数-1",
        "algorithm-content-feishu-part-5-3-2",
        "xcpc-扩展中国剩余定理-1"
      ]
    },
    {
      "id": "jjsj",
      "row": 3,
      "label": "进阶数据结构",
      "kind": "adv",
      "px": 220,
      "py": 1005,
      "detail": [
        "进阶数据结构：按操作和模型选分支",
        "从基础数据结构（下）向树上、版本、有序集合与多层维护深入。离线算法集中在额外索引中查阅。",
        [
          "分块与可并堆",
          "可持久化数据结构：主席树（可持久化权值线段树）及历史版本",
          "平衡树、树套树与动态树",
          "树链剖分与树上区间维护",
          "K-D Tree：空间查询；珂朵莉树：核对适用数据和复杂度条件"
        ],
        [
          "主席树是可持久化结构的具体实现入口，不与其重复作为两条无关路线。",
          "不同结构依赖不同操作条件，不以全部学习作为使用某一结构的前提。"
        ],
        "列出所需查询和修改，再比较两种结构并用朴素实现验证。"
      ],
      "gateIds": [
        "lp2-advanced-data-tree-route-hld",
        "lp2-advanced-data-tree-route-small-large",
        "lp2-advanced-data-tree-route-centroid-virtual",
        "lp2-advanced-data-tree-route-practice-assessment",
        "lp2-advanced-data-offline-route-blocks-mo",
        "lp2-advanced-data-offline-route-cdq",
        "lp2-advanced-data-offline-route-parallel-binary",
        "lp2-advanced-data-offline-route-mo-variants",
        "lp2-advanced-data-offline-route-practice-assessment",
        "lp2-advanced-data-versions-route-persistent-kth",
        "lp2-advanced-data-versions-route-rollback-time",
        "lp2-advanced-data-versions-route-practice-assessment",
        "lp2-advanced-data-ordered-route-bst-treap",
        "lp2-advanced-data-ordered-route-implicit-treap",
        "lp2-advanced-data-ordered-route-practice-assessment",
        "lp2-specialization-dynamic-tree-route-link-cut",
        "lp2-specialization-dynamic-tree-route-practice-assessment"
      ],
      "topicIds": [
        "xcpc-重链剖分-1",
        "xcpc-带标记的线段树-1",
        "xcpc-树的启发式合并-1",
        "xcpc-线段树合并-1",
        "algorithm-content-feishu-part-7-11",
        "algorithm-content-feishu-part-7-12",
        "algorithm-content-feishu-part-6-10",
        "algorithm-content-feishu-part-9-3-3",
        "algorithm-content-feishu-part-9-3-1",
        "algorithm-content-feishu-part-9-3-2",
        "algorithm-带修莫队",
        "algorithm-回滚莫队",
        "algorithm-content-feishu-part-6-12",
        "algorithm-可撤销并查集",
        "xcpc-treap-1",
        "xcpc-fhqtreap-1",
        "algorithm-content-feishu-part-6-16",
        "xcpc-splay-1"
      ]
    },
    {
      "id": "jjdp",
      "row": 3,
      "label": "进阶 dp",
      "kind": "adv",
      "px": 400,
      "py": 1005,
      "detail": [
        "进阶 DP：模型扩展与转移优化分组",
        "先形成正确状态和转移，再按问题结构扩展模型或优化瓶颈。",
        [
          "状态模型：树形与换根、状态压缩、数位统计类、轮廓线",
          "概率期望 DP：DAG、自环与联立方程分别讨论",
          "转移优化：数据结构、单调队列与前缀信息",
          "条件性优化：斜率优化、李超树与决策单调性",
          "倍增优化：针对可复合的重复转移，区别于 LCA 的倍增应用"
        ],
        [
          "优化不替代状态正确性；斜率和决策单调性必须检查前提。"
        ],
        "保留正确但较慢的转移作为对照，验证一种优化。"
      ],
      "gateIds": [
        "lp2-advanced-dp-tree-subset-dp-tree-dp",
        "lp2-advanced-dp-tree-subset-dp-reroot",
        "lp2-advanced-dp-tree-subset-dp-subset",
        "lp2-advanced-dp-tree-subset-dp-practice-assessment",
        "lp2-advanced-dp-digits-probability-digit",
        "lp2-advanced-dp-digits-probability-probability-basics",
        "lp2-advanced-dp-digits-probability-probability-dp",
        "lp2-advanced-dp-digits-probability-practice-assessment",
        "lp2-advanced-dp-transition-optimization-queue-optimize",
        "lp2-advanced-dp-transition-optimization-structure-optimize",
        "lp2-advanced-dp-transition-optimization-practice-assessment",
        "lp2-advanced-dp-dp-extensions-convex-hull-dp",
        "lp2-advanced-dp-dp-extensions-li-chao",
        "lp2-advanced-dp-dp-extensions-divide-conquer-dp",
        "lp2-advanced-dp-dp-extensions-profile-dp",
        "lp2-advanced-dp-dp-extensions-practice-assessment"
      ],
      "topicIds": [
        "xcpc-基础-3",
        "xcpc-进阶-2",
        "algorithm-树形-dp-换根",
        "xcpc-普通型-1",
        "xcpc-枚举子集-超集-1",
        "xcpc-基础-4",
        "xcpc-条件概率-1",
        "xcpc-期望的线性性-1",
        "xcpc-基础-5",
        "algorithm-期望dp",
        "algorithm-content-feishu-part-3-8",
        "xcpc-o-nm-1",
        "algorithm-content-feishu-part-3-7",
        "algorithm-content-feishu-part-3-9",
        "xcpc-李超线段树-1",
        "xcpc-分治dp-1",
        "algorithm-content-feishu-part-3-10",
        "algorithm-content-feishu-part-3-12"
      ]
    },
    {
      "id": "jjgl",
      "row": 3,
      "label": "进阶图论",
      "kind": "adv",
      "px": 580,
      "py": 1005,
      "detail": [
        "进阶图论：结构分解与约束模型",
        "图的结构、流量、逻辑与树上专题分别组织，保持基础图论到进阶图论的直接连接。",
        [
          "连通性：强连通、割点、桥与双连通",
          "差分约束、二分图匹配与 2-SAT",
          "网络流分组：最大流、最小割、费用流、上下界网络流",
          "树上专题：点分治与虚树",
          "图计数：矩阵树定理，关联线性代数"
        ],
        [
          "2-SAT 关联强连通，差分约束关联最短路，矩阵树定理关联消元。",
          "费用流和上下界网络流是不同扩展，不默认组成一条先后链。"
        ],
        "用小图手工推导一种模型中点、边、容量或约束的含义。"
      ],
      "gateIds": [
        "lp2-advanced-graphs-graph-decomposition-scc",
        "lp2-advanced-graphs-graph-decomposition-bridges-cuts",
        "lp2-advanced-graphs-graph-decomposition-practice-assessment",
        "lp2-advanced-graphs-relations-matching-weighted-dsu",
        "lp2-advanced-graphs-relations-matching-bipartite",
        "lp2-advanced-graphs-relations-matching-practice-assessment",
        "lp2-advanced-graphs-flow-models-residual-dinic",
        "lp2-advanced-graphs-flow-models-mincut",
        "lp2-advanced-graphs-flow-models-practice-assessment",
        "lp2-advanced-graphs-graph-extensions-two-sat",
        "lp2-advanced-graphs-graph-extensions-biconnected",
        "lp2-advanced-graphs-graph-extensions-difference-constraints",
        "lp2-advanced-graphs-graph-extensions-mincost",
        "lp2-advanced-graphs-graph-extensions-practice-assessment",
        "lp2-specialization-special-graph-route-special-matching",
        "lp2-specialization-special-graph-route-dominators",
        "lp2-specialization-special-graph-route-practice-assessment"
      ],
      "topicIds": [
        "algorithm-强连通分量-tarjan-",
        "xcpc-割点-割边-1",
        "xcpc-带权并查集-1",
        "xcpc-二分图判定-1",
        "xcpc-匈牙利算法-1",
        "xcpc-dinic-1",
        "algorithm-content-feishu-part-7-9-1",
        "algorithm-最小割模型",
        "algorithm-最大权闭合子图",
        "algorithm-content-feishu-part-7-10",
        "algorithm-边双连通分量",
        "algorithm-点双连通分量",
        "xcpc-圆方树-1",
        "algorithm-content-feishu-part-7-6",
        "algorithm-content-feishu-part-7-9-3",
        "algorithm-一般图最大匹配-带花树",
        "algorithm-一般图最大权匹配",
        "xcpc-支配树-1"
      ]
    },
    {
      "id": "jjsz",
      "row": 3,
      "label": "进阶数学",
      "kind": "adv",
      "px": 1300,
      "py": 1005,
      "detail": [
        "进阶数学：代数、反演与计算分支",
        "数学内部保留清晰分组；线性基可从异或问题直接进入，计算几何在主图中另设分支。",
        [
          "线性代数：矩阵、高斯消元与线性基",
          "多项式：卷积、FFT / NTT 与后续代数运算",
          "莫比乌斯反演、整除分块与筛法深入",
          "同余深入：高次同余方程",
          "数值方法：三分法、自适应辛普森法；三分需检查适用条件",
          "置换群与群作用计数；线性规划按需专题",
          "格雷码索引关联位运算与构造"
        ],
        [
          "浮点域、模域和 GF(2) 的条件分别理解。",
          "三分法不等同于对任意函数使用二分。"
        ],
        "挑当前问题需要的一支，用小规模直接计算对照数学推导。"
      ],
      "gateIds": [
        "lp2-advanced-math-linear-algebra-route-matrix",
        "lp2-advanced-math-linear-algebra-route-gaussian",
        "lp2-advanced-math-linear-algebra-route-xor-basis",
        "lp2-advanced-math-linear-algebra-route-practice-assessment",
        "lp2-advanced-math-inversion-route-mobius",
        "lp2-advanced-math-inversion-route-division-blocks",
        "lp2-advanced-math-inversion-route-practice-assessment",
        "lp2-advanced-math-convolution-route-convolution",
        "lp2-advanced-math-convolution-route-fft-ntt",
        "lp2-advanced-math-convolution-route-generating-interpolation",
        "lp2-advanced-math-convolution-route-practice-assessment",
        "lp2-advanced-math-geometry-route-geometry-primitives",
        "lp2-advanced-math-geometry-route-convex-hull",
        "lp2-advanced-math-geometry-route-calipers-halfplanes",
        "lp2-advanced-math-geometry-route-practice-assessment",
        "lp2-specialization-algebra-route-newton",
        "lp2-specialization-algebra-route-formal-exp-log",
        "lp2-specialization-algebra-route-bit-convolution",
        "lp2-specialization-algebra-route-burnside",
        "lp2-specialization-algebra-route-practice-assessment"
      ],
      "topicIds": [
        "xcpc-矩阵快速幂-1",
        "algorithm-content-feishu-part-5-7-2",
        "algorithm-content-feishu-part-5-7-3",
        "algorithm-content-feishu-part-5-9",
        "xcpc-狄利克雷卷积-1",
        "xcpc-整除分块-1",
        "algorithm-content-xcpc-fft-ntt-1",
        "xcpc-原根-阶-1",
        "algorithm-content-xcpc-生成函数-1",
        "algorithm-content-xcpc-拉格朗日插值-1",
        "algorithm-点与向量",
        "xcpc-点积-1",
        "xcpc-叉积-1",
        "algorithm-content-feishu-part-8-1",
        "algorithm-content-feishu-part-8-2",
        "algorithm-content-feishu-part-8-3",
        "algorithm-多项式求逆",
        "algorithm-多项式-ln",
        "algorithm-多项式-exp",
        "xcpc-fwt-fmt-1",
        "xcpc-集合幂级数-1",
        "xcpc-burnside引理-1",
        "xcpc-polya定理-1"
      ]
    },
    {
      "id": "recursion",
      "row": 1,
      "label": "递归/分治",
      "kind": "leaf",
      "px": 40,
      "py": 456,
      "detail": [
        "把递归表达与分治思想连起来理解",
        "递归是一种过程表达，分治是一种拆分、求解和合并问题的思想。它们放在同一个入口中，先理解调用，再看问题怎样拆。",
        [
          "递归出口、参数含义、规模缩小与调用栈",
          "递归枚举与回溯：选择、递归、撤销",
          "分治：拆分、独立求解与合并",
          "用归并排序理解分治的过程和复杂度"
        ],
        [
          "不是所有递归都是分治；BFS 也不要求递归实现。",
          "先核对递归深度和总调用次数，再讨论效率。"
        ],
        "画出一次归并排序或递归枚举的调用过程，比较拆分和合并分别做了什么。"
      ],
      "gateIds": [
        "lp2-brute-models-complete-enumeration-enumeration",
        "lp2-brute-models-complete-enumeration-recursion",
        "lp2-brute-models-complete-enumeration-divide-merge",
        "lp2-brute-models-complete-enumeration-practice-assessment"
      ],
      "topicIds": [
        "algorithm-枚举",
        "algorithm-content-feishu-part-5-1",
        "xcpc-递归-回溯-1",
        "xcpc-归并排序-1"
      ]
    },
    {
      "id": "struct",
      "row": 0,
      "label": "结构体",
      "sub": "struct",
      "kind": "leaf",
      "contextual": true,
      "px": 760,
      "py": 148,
      "detail": [
        "用一个对象组织相关数据",
        "结构体属于 C++ 基础语法，把多个相关字段组织为一个整体，可在需要记录多属性数据时补学。",
        [
          "struct 的定义、初始化与成员访问",
          "结构体数组与 vector<struct>",
          "结构体作为函数参数与排序对象"
        ],
        [
          "结构体不是图论结构；先理解对象中的字段和数据含义。"
        ],
        "把带编号、分数和姓名的数据组织成结构体并排序。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-data-organization-functions-records"
      ],
      "topicIds": [
        "xcpc-函数-1",
        "xcpc-引用-1",
        "xcpc-结构体-类-1"
      ]
    },
    {
      "id": "pointer",
      "row": 0,
      "label": "指针",
      "sub": "地址与解引用",
      "kind": "leaf",
      "contextual": true,
      "px": 940,
      "py": 148,
      "detail": [
        "认识地址与解引用",
        "指针属于 C++ 基础语法，用来理解地址、间接访问和对象生命周期。",
        [
          "取地址 & 与解引用 *",
          "指针、数组和引用的区别",
          "空指针、有效范围与生命周期"
        ],
        [
          "不要解引用空指针或失效地址；入门不要求立即学习复杂内存管理。"
        ],
        "观察变量地址与指针指向，说明修改指向数据和修改指针的区别。"
      ],
      "gateIds": [
        "lp2-cpp-toolkit-data-organization-addresses"
      ],
      "topicIds": [
        "xcpc-指针-1",
        "xcpc-引用-1"
      ]
    },
    {
      "id": "simulation",
      "row": 1,
      "label": "模拟与枚举",
      "kind": "leaf",
      "px": 220,
      "py": 554,
      "detail": [
        "从忠实表达题意到完整遍历可能性",
        "模拟与枚举连接基本语法和实际解题。先把状态变化写清，再确定枚举对象、范围以及是否重复。",
        [
          "流程模拟、网格与操作顺序",
          "完整枚举、排列、子集与重复检查",
          "用暴力作为优化算法的对照",
          "按题补学：高精度整数的表示、加减乘除与进位；不依赖固定语言的大整数接口"
        ],
        [
          "高精度作为本入口的工具索引，不单独占据主图。",
          "模拟检查边界，枚举检查遗漏和重复。"
        ],
        "先写小数据暴力解，再记录限制它扩展到大数据的计算瓶颈。"
      ],
      "gateIds": [
        "lp2-brute-models-simulation-state-simulation",
        "lp2-brute-models-simulation-practice-assessment",
        "lp2-brute-models-complete-enumeration-enumeration",
        "lp2-brute-models-complete-enumeration-recursion",
        "lp2-brute-models-complete-enumeration-divide-merge",
        "lp2-brute-models-complete-enumeration-practice-assessment",
        "lp2-brute-models-brute-validation-build-oracle",
        "lp2-brute-models-brute-validation-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-1-1",
        "algorithm-枚举",
        "algorithm-content-feishu-part-5-1",
        "xcpc-递归-回溯-1",
        "xcpc-归并排序-1",
        "xcpc-对拍-1"
      ]
    },
    {
      "id": "construction",
      "row": 1,
      "label": "构造",
      "sub": "特殊题型",
      "kind": "leaf",
      "contextual": true,
      "px": 1300,
      "py": 554,
      "detail": [
        "按题目约束构造一个合法答案",
        "构造作为特殊题型独立呈现，可在补题遇到时学习；不强挂到 STL、贪心或某一种数学工具下。",
        [
          "奇偶、配对、余数和不变量",
          "必要条件、充分条件与合法性证明",
          "小数据验证与反例",
          "按题延伸：格雷码与相邻状态构造，关联位运算"
        ],
        [
          "相关数学是可能用到的基础，不是构造属于数学的隶属线。"
        ],
        "枚举几个小规模实例，寻找能推广的构造规则并解释为何总是合法。"
      ],
      "gateIds": [
        "lp2-brute-models-construction-integers-constructive-invariants",
        "lp2-brute-models-construction-integers-gcd-factorization",
        "lp2-brute-models-construction-integers-prime-sieve",
        "lp2-brute-models-construction-integers-linear-sieve",
        "lp2-brute-models-construction-integers-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-1-6",
        "algorithm-content-feishu-part-5-2-2",
        "algorithm-lcm",
        "xcpc-埃式筛-1",
        "algorithm-线性筛-素数"
      ]
    },
    {
      "id": "prefix",
      "row": 1,
      "label": "前缀和与差分",
      "sub": "优化方法",
      "kind": "leaf",
      "contextual": true,
      "px": 580,
      "py": 554,
      "detail": [
        "复用区间信息，减少重复计算",
        "前缀和与差分是独立的优化方法，可在补题遇到区间查询或批量修改时回补。",
        [
          "一维与二维前缀和",
          "差分、累计还原与区间修改",
          "区间边界、空区间与整数范围"
        ],
        [
          "前缀查询与差分更新解决不同操作；不要混淆下标约定。"
        ],
        "将区间求和或批量加法与朴素实现逐项对照。"
      ],
      "gateIds": [
        "lp2-basic-optimization-preprocessing-prefix-sums",
        "lp2-basic-optimization-preprocessing-difference",
        "lp2-basic-optimization-preprocessing-compression-counting",
        "lp2-basic-optimization-preprocessing-practice-assessment"
      ],
      "topicIds": [
        "algorithm-一维前缀和",
        "algorithm-二维前缀和",
        "algorithm-一维差分",
        "algorithm-二维差分",
        "xcpc-离散-1",
        "xcpc-桶排序-1"
      ]
    },
    {
      "id": "two",
      "row": 1,
      "label": "双指针",
      "sub": "优化方法",
      "kind": "leaf",
      "contextual": true,
      "px": 940,
      "py": 554,
      "detail": [
        "利用可证明的指针推进减少枚举",
        "双指针与滑动窗口独立呈现，属于优化方法。不同问题中的相向、同向推进需要分别验证条件。",
        [
          "相向双指针、同向双指针",
          "滑动窗口的加入、移除与答案维护",
          "单调推进、反例与失效条件"
        ],
        [
          "指针不回退需要依据，不是只要连续区间就能使用窗口。"
        ],
        "对一个窗口题保留二次枚举，比较指针移动与每次答案。"
      ],
      "gateIds": [
        "lp2-basic-optimization-monotone-methods-binary-boundaries",
        "lp2-basic-optimization-monotone-methods-binary-answer",
        "lp2-basic-optimization-monotone-methods-two-pointers",
        "lp2-basic-optimization-monotone-methods-practice-assessment"
      ],
      "topicIds": [
        "algorithm-二分查找",
        "algorithm-二分答案",
        "algorithm-content-feishu-part-1-9"
      ]
    },
    {
      "id": "basicdata",
      "row": 2,
      "label": "基础数据结构（下）",
      "kind": "aggregate",
      "px": 220,
      "py": 785,
      "detail": [
        "基础数据结构（下）：信息维护与区间查询",
        "在常用容器之上理解如何维护信息。线段树、树状数组明确放在这一基础层，向下再连接进阶数据结构。",
        [
          "单调栈与单调队列：候选淘汰和摊还分析",
          "并查集：集合合并、路径压缩与按大小合并；图论中通过关联使用",
          "ST 表：静态区间查询与可重复贡献",
          "树状数组：前缀维护、动态查询与 lowbit",
          "线段树：信息合并、单点修改、区间查询与懒标记"
        ],
        [
          "线段树和树状数组不是被遗漏的进阶细节，属于本节点的核心范围。",
          "区间操作要明确可合并信息、可逆性和标记复合顺序。"
        ],
        "对同一查询问题比较前缀和、树状数组和线段树，并用暴力核对。"
      ],
      "gateIds": [
        "lp2-range-data-static-monotone-monotone-stack",
        "lp2-range-data-static-monotone-monotone-queue",
        "lp2-range-data-static-monotone-sparse-table",
        "lp2-range-data-static-monotone-practice-assessment",
        "lp2-range-data-fenwick-fenwick",
        "lp2-range-data-fenwick-inversions",
        "lp2-range-data-fenwick-practice-assessment",
        "lp2-range-data-segment-lazy-segment-merge",
        "lp2-range-data-segment-lazy-lazy-add",
        "lp2-range-data-segment-lazy-lazy-compose",
        "lp2-range-data-segment-lazy-practice-assessment",
        "lp2-range-data-offline-selection-offline-events",
        "lp2-range-data-offline-selection-structure-choice",
        "lp2-range-data-offline-selection-practice-assessment"
      ],
      "topicIds": [
        "xcpc-单调栈-1",
        "xcpc-单调队列-1",
        "algorithm-content-feishu-part-6-7",
        "xcpc-树状数组基础-1",
        "xcpc-逆序对-1",
        "xcpc-离散-1",
        "xcpc-基础线段树-1",
        "xcpc-带标记的线段树-1",
        "xcpc-扫描线-1"
      ]
    },
    {
      "id": "advancedstrings",
      "row": 3,
      "label": "进阶字符串",
      "kind": "adv",
      "px": 940,
      "py": 1005,
      "detail": [
        "进阶字符串：统一组织大量子串关系",
        "后缀与回文的深入结构按具体问题分别进入，不形成统一必学链。",
        [
          "后缀数组与 LCP",
          "后缀自动机与 endpos",
          "回文自动机与回文后缀链接"
        ],
        [
          "后缀数组与后缀自动机是不同结构，不要求先学一个才学另一个。"
        ],
        "用短串列出子串或回文，对照结构中保存的信息。"
      ],
      "gateIds": [
        "lp2-specialization-suffix-route-suffix-array",
        "lp2-specialization-suffix-route-suffix-automaton",
        "lp2-specialization-suffix-route-palindrome-lyndon",
        "lp2-specialization-suffix-route-practice-assessment"
      ],
      "topicIds": [
        "algorithm-content-feishu-part-4-7",
        "algorithm-content-feishu-part-4-8",
        "algorithm-content-feishu-part-4-6",
        "xcpc-lyndon-分解-1"
      ]
    },
    {
      "id": "geometry",
      "row": 3,
      "label": "计算几何",
      "kind": "adv",
      "px": 1120,
      "py": 1005,
      "detail": [
        "计算几何：位置关系与凸性",
        "计算几何由基础数学单独引出，与进阶数学并列；从向量和几何判断开始，按问题深入。",
        [
          "先备知识：向量、点积、叉积、距离与相交判断",
          "凸包",
          "旋转卡壳",
          "半平面交"
        ],
        [
          "分别处理整数精确判断、浮点误差以及共线、重合和端点等退化情况。"
        ],
        "用小图核对边界和退化情况，再测试凸性算法。"
      ],
      "gateIds": [
        "lp2-advanced-math-geometry-route-geometry-primitives",
        "lp2-advanced-math-geometry-route-convex-hull",
        "lp2-advanced-math-geometry-route-calipers-halfplanes",
        "lp2-advanced-math-geometry-route-practice-assessment"
      ],
      "topicIds": [
        "algorithm-点与向量",
        "xcpc-点积-1",
        "xcpc-叉积-1",
        "algorithm-content-feishu-part-8-1",
        "algorithm-content-feishu-part-8-2",
        "algorithm-content-feishu-part-8-3"
      ]
    }
  ],
  "edges": [
    {
      "from": "g",
      "to": "xh"
    },
    {
      "from": "g",
      "to": "sz"
    },
    {
      "from": "g",
      "to": "hs"
    },
    {
      "from": "g",
      "to": "wy"
    },
    {
      "from": "xh",
      "to": "ds"
    },
    {
      "from": "sz",
      "to": "ds"
    },
    {
      "from": "hs",
      "to": "ds"
    },
    {
      "from": "wy",
      "to": "ss"
    },
    {
      "from": "ds",
      "to": "px"
    },
    {
      "from": "ds",
      "to": "ef"
    },
    {
      "from": "ds",
      "to": "tx"
    },
    {
      "from": "ds",
      "to": "dl"
    },
    {
      "from": "ds",
      "to": "zfc"
    },
    {
      "from": "ds",
      "to": "hm"
    },
    {
      "from": "ds",
      "to": "ssr"
    },
    {
      "from": "tx",
      "to": "srgt"
    },
    {
      "from": "zfc",
      "to": "zfsf"
    },
    {
      "from": "ss",
      "to": "jcsz"
    },
    {
      "from": "ssr",
      "to": "jcdp"
    },
    {
      "from": "ssr",
      "to": "tl"
    },
    {
      "from": "jcdp",
      "to": "srgt",
      "bidir": true
    },
    {
      "from": "jcdp",
      "to": "jjdp"
    },
    {
      "from": "tl",
      "to": "jjgl"
    },
    {
      "from": "jcsz",
      "to": "jjsz"
    },
    {
      "from": "jjsj",
      "to": "jjdp"
    },
    {
      "from": "hs",
      "to": "recursion"
    },
    {
      "from": "recursion",
      "to": "ssr"
    },
    {
      "from": "g",
      "to": "struct"
    },
    {
      "from": "g",
      "to": "pointer"
    },
    {
      "from": "xh",
      "to": "simulation"
    },
    {
      "from": "sz",
      "to": "simulation"
    },
    {
      "from": "ds",
      "to": "basicdata"
    },
    {
      "from": "basicdata",
      "to": "jjsj"
    },
    {
      "from": "zfsf",
      "to": "advancedstrings"
    },
    {
      "from": "jcsz",
      "to": "geometry"
    },
    {
      "from": "sz",
      "to": "prefix",
      "relation": "foundation"
    },
    {
      "from": "sz",
      "to": "two",
      "relation": "foundation"
    },
    {
      "from": "ss",
      "to": "construction",
      "relation": "foundation"
    }
  ],
  "goals": [
    "认识程序怎样表达问题",
    "常用工具与方法建立广度",
    "围绕模型形成连贯主干",
    "按题目与兴趣选择分支深入"
  ],
  "indexEntries": [
    {
      "id": "offline",
      "row": 3,
      "label": "离线与杂项",
      "sub": "专项索引",
      "kind": "leaf",
      "px": 580,
      "py": 1100,
      "detail": [
        "查询可以重排时的专项方法",
        "离线与杂项先作为专题索引，不新增技巧主图节点。",
        [
          "CDQ 分治、整体二分、莫队",
          "模拟退火、0/1 分数规划",
          "奇怪题型、非传统题与提交答案题"
        ],
        [
          "先确认题目允许离线或改变处理顺序，再选择具体算法；特殊赛制不是算法阶段。"
        ],
        "把查询记录下来，判断哪些操作可以重排并比较维护成本。"
      ],
      "gateIds": [
        "lp2-range-data-offline-selection-offline-events",
        "lp2-range-data-offline-selection-structure-choice",
        "lp2-range-data-offline-selection-practice-assessment",
        "lp2-advanced-data-offline-route-blocks-mo",
        "lp2-advanced-data-offline-route-cdq",
        "lp2-advanced-data-offline-route-parallel-binary",
        "lp2-advanced-data-offline-route-mo-variants",
        "lp2-advanced-data-offline-route-practice-assessment",
        "lp2-specialization-capstone-solution-reconstruction",
        "lp2-specialization-capstone-project-review",
        "lp2-specialization-capstone-practice-assessment"
      ],
      "topicIds": [
        "xcpc-扫描线-1",
        "xcpc-树状数组基础-1",
        "xcpc-基础线段树-1",
        "algorithm-content-feishu-part-6-10",
        "algorithm-content-feishu-part-9-3-3",
        "algorithm-content-feishu-part-9-3-1",
        "algorithm-content-feishu-part-9-3-2",
        "algorithm-带修莫队",
        "algorithm-回滚莫队",
        "algorithm-content-feishu-part-1-6",
        "algorithm-content-feishu-part-1-5",
        "xcpc-状态-1",
        "xcpc-对拍-1",
        "xcpc-时空复杂度分析-1"
      ]
    }
  ]
};
