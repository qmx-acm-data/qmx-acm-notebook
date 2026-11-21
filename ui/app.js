// Generated from src/renderer/app/app.ts; run pnpm modules:build.
"use strict";
(() => {
  // src/renderer/lib/search.ts
  function text(value) {
    return String(value == null ? "" : value).normalize("NFKC").toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ").replace(/\s+/gu, " ").trim();
  }
  function normalizePlatform(value) {
    const name = text(value).replace(/[\s_-]/g, "");
    const aliases = { cf: "CF", codeforces: "CF", lg: "LG", luogu: "LG", "洛谷": "LG", at: "AT", atcoder: "AT", nc: "NC", nowcoder: "NC", "牛客": "NC", lc: "LC", leetcode: "LC", "力扣": "LC", oth: "Oth", other: "Oth", "其他": "Oth" };
    return aliases[name] || String(value == null ? "" : value).trim() || "Oth";
  }
  var luoguLevels = [
    ["red", ["入门"]],
    ["orange", ["普及-", "普及减"]],
    ["yellow", ["普及", "普及/提高-", "普及/提高减", "普及提高-"]],
    ["green", ["普及+/提高-", "普及+/提高", "普及加/提高", "普及提高"]],
    ["cyan", ["提高"]],
    ["blue", ["提高+/省选-", "提高加/省选减", "提高/省选-", "提高省选-"]],
    ["purple", ["省选/NOI-", "省选/NOI减", "省选NOI-"]],
    ["black", ["NOI/NOI+/CTS", "NOI/NOI+/CTSC", "NOI+", "NOI/CTSC", "NOI", "CTSC"]]
  ];
  function difficulty(input2) {
    const record = input2 || {};
    const code = normalizePlatform(record.platform);
    const native = String(record.difficulty == null ? "" : record.difficulty).trim();
    const hasRating = record.rating !== void 0 && record.rating !== null && String(record.rating).trim() !== "" && Number.isFinite(Number(record.rating));
    let tone = "neutral", rank = "", level = null;
    if (code === "CF" && hasRating) {
      level = Number(record.rating);
      const tiers = [[1200, "gray"], [1400, "green"], [1600, "cyan"], [1900, "blue"], [2100, "purple"], [2300, "orange"], [2400, "orange"], [2600, "red"], [3e3, "red"]];
      const index = tiers.findIndex(function(tier) {
        return level < tier[0];
      });
      tone = index < 0 ? "red" : tiers[index][1];
      rank = index < 0 ? "legendary" : index === 8 ? "grandmaster" : "";
    } else if (code === "LG" && native) {
      const name = text(native).replace(/[−–—﹣]/g, "-").replace(/\s/g, "");
      const index = luoguLevels.findIndex(function(entry2) {
        return entry2[1].some(function(alias) {
          return text(alias) === name;
        });
      });
      if (index >= 0) {
        tone = luoguLevels[index][0];
        level = index + 1;
      }
    } else if (code === "LC" && native) {
      const name = text(native).replace(/[\s/()（）]/g, "");
      const levels = [["green", ["easy", "简单", "easy简单"]], ["yellow", ["medium", "中等", "medium中等"]], ["red", ["hard", "困难", "hard困难"]]];
      const index = levels.findIndex(function(entry2) {
        return entry2[1].includes(name);
      });
      if (index >= 0) {
        tone = levels[index][0];
        level = index + 1;
      }
    }
    const label = [hasRating ? (code === "CF" ? "CF " : "Rating ") + record.rating : "", native].filter(Boolean).join(" · ");
    return { tone, rank, label, native, level };
  }
  function compact(value) {
    return text(value).replace(/[\s_-]/g, "");
  }
  function urlPid(value) {
    try {
      const url = new URL(String(value));
      const host = url.hostname.toLowerCase();
      let parts2;
      if (host === "codeforces.com" || host.endsWith(".codeforces.com")) {
        parts2 = url.pathname.match(/^\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([a-z]\d*)\/?$/i);
        if (parts2) return "cf" + parts2[1] + parts2[2].toLowerCase();
      }
      if (host === "luogu.com.cn" || host.endsWith(".luogu.com.cn") || host === "luogu.org" || host.endsWith(".luogu.org")) {
        parts2 = url.pathname.match(/^\/problem\/([a-z]+\d+[a-z\d]*)\/?$/i);
        if (parts2) return compact(parts2[1]);
      }
    } catch (_) {
    }
    return "";
  }
  function identifiers(record) {
    const values = [record.pid, record.problemUrl, record.url, record.link];
    const ids = /* @__PURE__ */ new Set();
    values.forEach(function(value, index) {
      const pid = urlPid(value) || (index === 0 ? compact(value) : "");
      if (!pid) return;
      ids.add(pid);
      if (/^cf\d+[a-z]\d*$/.test(pid)) ids.add(pid.slice(2));
      else if (/^\d+[a-z]\d*$/.test(pid) && normalizePlatform(record.platform) === "CF") ids.add("cf" + pid);
      if (/^p\d+$/.test(pid)) ids.add(pid.slice(1));
    });
    return Array.from(ids);
  }
  function queryText(query) {
    return text(query).replace(/https?:\/\/[^\s]+/g, function(url) {
      return urlPid(url) || url;
    }).replace(/\bcf[\s_-]*(\d+)[\s_-]*([a-z]\d*)\b/g, "cf$1$2").replace(/\b(\d+)[\s_-]+([a-z]\d*)\b/g, "$1$2").replace(/\bp[\s_-]+(\d+)\b/g, "p$1");
  }
  function match(input2, query) {
    const phrase = queryText(query);
    if (!phrase) return 1;
    const record = input2 || {};
    const terms = Array.from(new Set(phrase.split(/\s+/u)));
    const ids = identifiers(record);
    const title = text(record.title);
    const tags = text(Array.isArray(record.tags) ? record.tags.join(" ") : record.tags);
    const author = text(typeof record.author === "object" && record.author ? [record.author.name, record.author.login].filter(Boolean).join(" ") : record.author);
    const body = text(record.body);
    const metadata2 = text([record.platform, normalizePlatform(record.platform), record.rating, record.difficulty].filter((value) => value != null).join(" "));
    let score2 = 0;
    for (const term of terms) {
      const pid = compact(term);
      let hit = 0;
      if (ids.includes(pid)) hit = 1e4;
      else if (pid && ids.some(function(id) {
        return id.startsWith(pid);
      })) hit = 2500;
      if (title === term) hit = Math.max(hit, 1e3);
      else if (title.startsWith(term)) hit = Math.max(hit, 700);
      else if (title.includes(term)) hit = Math.max(hit, 500);
      if (tags.includes(term)) hit = Math.max(hit, 300);
      if (author.includes(term)) hit = Math.max(hit, 200);
      if (metadata2.includes(term)) hit = Math.max(hit, 100);
      if (body.includes(term)) hit = Math.max(hit, 50);
      if (!hit) return 0;
      score2 += hit;
    }
    if (terms.length > 1 && title.includes(phrase)) score2 += 1200;
    else if (terms.length > 1 && body.includes(phrase)) score2 += 20;
    return score2;
  }
  function tagHits(input2, selected2) {
    const record = input2;
    const wanted = selected2 instanceof Set ? selected2 : new Set(selected2 || []);
    return Array.from(new Set(Array.isArray(record?.tags) ? record.tags.map(String) : [])).filter((tag) => wanted.has(tag)).length;
  }
  var Search = { normalizePlatform, difficulty, match, tagHits };

  // src/renderer/algorithms/directory.ts
  function normalize(value) {
    return String(value ?? "").normalize("NFKC").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[‐‑‒–—−]/gu, "-").replace(/\s+/gu, " ").trim();
  }
  function compact2(value) {
    return normalize(value).replace(/[\s_\-()/（）、，,·.:：]/gu, "");
  }
  function score(query, fields) {
    const phrase = normalize(query);
    if (!phrase) return 1;
    const terms = phrase.split(/\s+/u).filter(Boolean);
    const prepared = fields.map((field2) => ({ value: normalize(field2.value), dense: compact2(field2.value), weight: field2.weight || 1 }));
    let total = 0;
    for (const term of terms) {
      const dense = compact2(term);
      let best = 0;
      for (const field2 of prepared) {
        if (!field2.value) continue;
        const hit = field2.value === term || dense && field2.dense === dense ? 10 : field2.value.startsWith(term) || dense && field2.dense.startsWith(dense) ? 6 : field2.value.includes(term) || dense && field2.dense.includes(dense) ? 3 : 0;
        best = Math.max(best, hit * field2.weight);
      }
      if (!best) return 0;
      total += best;
    }
    if (terms.length > 1) {
      const dense = compact2(phrase);
      total += Math.max(0, ...prepared.map((field2) => dense && field2.dense.includes(dense) ? 5 * field2.weight : 0));
    }
    return total;
  }
  function topicScore(node3, path, query) {
    return score(query, [
      { value: node3.label, weight: 12 },
      { value: node3.fullLabel, weight: 11 },
      ...(node3.aliases || []).map((value) => ({ value, weight: 10 })),
      { value: path.join(" / "), weight: 2 }
    ]);
  }
  function noteScore(note, node3, path, query, author) {
    return score(query, [
      { value: note.title, weight: 12 },
      ...(note.tags || []).map((value) => ({ value, weight: 9 })),
      { value: node3?.label, weight: 8 },
      { value: node3?.fullLabel, weight: 8 },
      ...(node3?.aliases || []).map((value) => ({ value, weight: 7 })),
      { value: author, weight: 5 },
      { value: path.join(" / "), weight: 2 },
      { value: note.body, weight: 1 }
    ]);
  }
  var COLORS = ["basic", "beginner", "intermediate", "advanced", "expert"];
  function splitMixed(tree) {
    function visit(node3) {
      node3.children = Array.isArray(node3.children) ? node3.children : [];
      if (!node3.children.length && ["feishu-part-9-5-1", "directory-contest-experience"].includes(node3.id) && node3.origin !== "admin") {
        node3.kind = "algorithm";
        node3.color = "unrated";
        node3.rating = { status: "unrated", type: "entry" };
      }
      if (node3.kind === "algorithm" && node3.children.length) {
        const content = { ...node3, id: `algorithm-content-${node3.id}`, children: [], kind: "algorithm", contentOf: node3.id };
        for (const key of ["legacyIds", "sourceHeading", "part", "nestedPart", "metadata"]) delete content[key];
        node3.children.unshift(content);
        node3.kind = "directory";
        node3.color = "parent";
        node3.algorithmContentId = content.id;
        node3.rating = { status: "not-applicable", type: "directory" };
        delete node3.difficultySource;
      }
      if (node3.kind === "directory" || node3.kind === "category") {
        node3.kind = "directory";
        node3.color = "parent";
        node3.rating = { status: "not-applicable", type: "directory" };
        delete node3.difficultySource;
      }
      node3.children.forEach(visit);
    }
    visit(tree);
    return tree;
  }
  function hydrate(base, topics = []) {
    const tree = JSON.parse(JSON.stringify(base)), byId = /* @__PURE__ */ new Map();
    function index(node3, depth) {
      node3.level = depth;
      node3.children = Array.isArray(node3.children) ? node3.children : [];
      node3.fullLabel = node3.fullLabel || node3.label;
      byId.set(node3.id, node3);
      for (const id of node3.legacyIds || []) byId.set(id, node3);
      node3.children.forEach((child) => index(child, depth + 1));
    }
    splitMixed(tree);
    index(tree, 0);
    let pending2 = Array.isArray(topics) ? topics.slice() : [];
    for (let round = 0; pending2.length && round <= topics.length; round++) {
      const next = [];
      let added = 0;
      for (const record of pending2) {
        if (!record || typeof record.id !== "string" || byId.has(record.id)) continue;
        const parent = byId.get(record.parentId);
        if (!parent) {
          next.push(record);
          continue;
        }
        if (!(record.kind === "directory" ? record.color === "parent" : COLORS.includes(record.color)) || typeof record.label !== "string") continue;
        const node3 = {
          id: record.id,
          label: record.label,
          fullLabel: record.fullLabel || record.label,
          color: record.color,
          scope: record.scope || "",
          rationale: "由管理员按学习范围添加。",
          children: [],
          attributes: [],
          aliases: record.fullLabel && record.fullLabel !== record.label ? [record.fullLabel] : [],
          kind: record.kind === "directory" ? "directory" : "algorithm",
          origin: "admin",
          difficultySource: { kind: "admin" },
          level: parent.level + 1
        };
        parent.children.push(node3);
        splitMixed(tree);
        index(tree, 0);
        added++;
      }
      if (!added) break;
      pending2 = next;
    }
    function ranges(node3) {
      const values = [COLORS.indexOf(node3.color) + 1, ...node3.children.flatMap((child) => {
        const r = ranges(child);
        return r ? [r.min, r.max] : [];
      })].filter((n) => n > 0);
      const range = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
      if (node3.kind === "directory") node3.rating = { status: "not-applicable", type: "directory" };
      else node3.rating = { ...node3.rating || {}, ...range ? { range } : {} };
      return range;
    }
    ranges(tree);
    return tree;
  }
  var AlgorithmDirectory = Object.freeze({ normalize, compact: compact2, score, topicScore, noteScore, splitMixed, hydrate });

  // src/renderer/platforms/dashboard.ts
  var platforms = [
    { code: "CF", name: "Codeforces", example: "https://codeforces.com/profile/tourist", hosts: ["codeforces.com", "www.codeforces.com"], profile: /^\/profile\/[^/]+\/?$/ },
    { code: "AT", name: "AtCoder", example: "https://atcoder.jp/users/tourist", hosts: ["atcoder.jp", "www.atcoder.jp"], profile: /^\/users\/[^/]+\/?$/ },
    { code: "LG", name: "洛谷", example: "https://www.luogu.com.cn/user/1", hosts: ["luogu.com.cn", "www.luogu.com.cn", "luogu.com", "www.luogu.com"], profile: /^\/user\/\d+\/?$/ },
    { code: "NC", name: "牛客", example: "https://ac.nowcoder.com/acm/contest/profile/1", hosts: ["ac.nowcoder.com", "www.nowcoder.com", "nowcoder.com"], profile: /^\/(?:profile|users|acm\/contest\/profile)\/\d+\/?$/ },
    { code: "LC", name: "LeetCode", example: "https://leetcode.cn/u/leetcode/", hosts: ["leetcode.cn", "www.leetcode.cn", "leetcode.com", "www.leetcode.com"], profile: /^\/u\/[^/]+\/?$/ }
  ];
  var pending = /* @__PURE__ */ new Set();
  var localErrors = /* @__PURE__ */ new Map();
  var state = {};
  var selected = "ALL";
  var expanded = false;
  var activityPeriod = "recent";
  var bridge;
  var onSettings;
  var modalCode = null;
  var dialog;
  var input;
  var modalError;
  var saveButton;
  var unlinkButton;
  var closeButton;
  var cancelButton;
  var floatingTip;
  var tipTarget;
  function dismissTip() {
    if (!floatingTip) return;
    floatingTip.hidden = true;
    if (tipTarget) tipTarget.removeAttribute("aria-describedby");
    tipTarget = null;
  }
  function ensureTip() {
    if (floatingTip) return;
    floatingTip = element("div", "platform-floating-tooltip");
    floatingTip.id = "platform-floating-tooltip";
    floatingTip.setAttribute("role", "tooltip");
    floatingTip.hidden = true;
    document.body.append(floatingTip);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") dismissTip();
    });
    document.addEventListener("scroll", dismissTip, true);
    window.addEventListener("resize", dismissTip);
    window.addEventListener("blur", dismissTip);
    document.addEventListener("pointerdown", (event) => {
      if (tipTarget && !tipTarget.contains(event.target)) dismissTip();
    });
  }
  function showTip(target, lines) {
    ensureTip();
    dismissTip();
    tipTarget = target;
    floatingTip.replaceChildren(...lines.map((line, index) => element(line.bold ? "strong" : "div", `platform-tooltip-line${index === 0 ? " platform-tooltip-first" : ""}`, line.text)));
    target.setAttribute("aria-describedby", floatingTip.id);
    floatingTip.hidden = false;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft || 0;
    const topEdge = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const margin = 8;
    floatingTip.style.maxWidth = `${Math.max(0, width - margin * 2)}px`;
    floatingTip.style.maxHeight = `${Math.max(0, height - margin * 2)}px`;
    const anchor = target.getBoundingClientRect();
    const rect = floatingTip.getBoundingClientRect();
    const left = Math.max(leftEdge + margin, Math.min(anchor.left + anchor.width / 2 - rect.width / 2, leftEdge + width - margin - rect.width));
    const below = anchor.bottom + margin;
    const top = Math.max(topEdge + margin, Math.min(below + rect.height <= topEdge + height - margin ? below : anchor.top - margin - rect.height, topEdge + height - margin - rect.height));
    floatingTip.style.left = `${left}px`;
    floatingTip.style.top = `${top}px`;
  }
  function attachTip(target, lines) {
    const reveal = () => showTip(target, lines);
    target.removeAttribute("title");
    target.setAttribute("aria-label", lines.map((line) => line.text).join("，"));
    if (!target.matches("a,button,[tabindex]")) target.tabIndex = 0;
    target.addEventListener("mouseenter", reveal);
    target.addEventListener("focus", reveal);
    target.addEventListener("focusin", reveal);
    target.addEventListener("click", reveal);
    target.addEventListener("mouseleave", () => {
      if (tipTarget === target) dismissTip();
    });
    target.addEventListener("blur", () => {
      if (tipTarget === target) dismissTip();
    });
    target.addEventListener("focusout", (event) => {
      if (!target.contains(event.relatedTarget) && tipTarget === target) dismissTip();
    });
  }
  function element(tag, className, text3) {
    const node3 = document.createElement(tag);
    if (className) node3.className = className;
    if (text3 !== void 0) node3.textContent = String(text3);
    return node3;
  }
  function button(text3, className, action2) {
    const node3 = element("button", className, text3);
    node3.type = "button";
    node3.addEventListener("click", action2);
    return node3;
  }
  function metadata(code) {
    return platforms.find((platform) => platform.code === code);
  }
  function entry(code) {
    return state[code] || {};
  }
  function bound(code) {
    return Boolean(entry(code).binding);
  }
  function username(code) {
    const value = entry(code);
    return String(value.binding?.username || value.data?.username || value.binding?.id || "未知用户");
  }
  function number(value) {
    return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "暂无数据";
  }
  function time(value) {
    if (!value) return "尚未刷新";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function errorText(error) {
    const text3 = typeof error === "string" ? error : error?.message;
    return String(text3 || "操作失败，请稍后重试。");
  }
  function safeURL(value, code, profileOnly = false) {
    try {
      const url = new URL(value);
      const platform = metadata(code);
      if (!platform || url.protocol !== "https:" || url.username || url.password || url.port || !platform.hosts.includes(url.hostname)) return null;
      if (profileOnly && !platform.profile.test(url.pathname)) return null;
      return url.href;
    } catch {
      return null;
    }
  }
  function external(text3, url, code, className) {
    const safe = safeURL(url, code);
    if (!safe || typeof bridge?.openExternal !== "function") return element("span", className, text3);
    const link = element("a", className, text3);
    link.href = safe;
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        await bridge.openExternal(safe);
      } catch (error) {
        localErrors.set(code, errorText(error));
        draw();
      }
    });
    return link;
  }
  function metric(label, value, key) {
    const node3 = element("div", "platform-metric");
    const strong = element("strong", "", number(value));
    strong.dataset.metric = key;
    if (typeof value !== "number" || !Number.isFinite(value)) strong.className = "platform-unknown";
    node3.append(strong, element("span", "", label));
    return node3;
  }
  function known(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function scope() {
    return selected === "ALL" ? platforms : platforms.filter((platform) => platform.code === selected);
  }
  function coverage(count, total) {
    return `${count}/${total} 平台有数据`;
  }
  function dateLabel(value) {
    const date = new Date(value);
    return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "日期未知";
  }
  function ratingChange(contest) {
    const delta = known(contest.delta) ? `${contest.delta > 0 ? "+" : ""}${contest.delta}` : null;
    if (known(contest.rating) && delta !== null) return `Rating ${contest.rating - contest.delta} → ${contest.rating}（${delta}）`;
    if (known(contest.rating)) return `Rating ${contest.rating}`;
    return delta !== null ? `Rating 变化 ${delta}` : null;
  }
  function contestScore(contest) {
    const solved = contest.solvedCount;
    const total = contest.problemCount;
    return Number.isSafeInteger(solved) && Number.isSafeInteger(total) && solved >= 0 && total >= 0 && solved <= total ? `${solved}/${total}` : null;
  }
  function contestLines(contest) {
    const lines = [{ text: String(contest.name || "未命名比赛"), bold: true }];
    const change = ratingChange(contest);
    const score2 = contestScore(contest);
    if (change) lines.push({ text: change });
    if (score2) lines.push({ text: score2 });
    return lines;
  }
  function contestDetails(contest) {
    const parts2 = [dateLabel(contest.date)];
    if (contest.rank !== null && contest.rank !== void 0 && contest.rank !== "") parts2.push(`排名 ${contest.rank}`);
    const change = ratingChange(contest);
    const score2 = contestScore(contest);
    if (change) parts2.push(change);
    if (score2) parts2.push(score2);
    return parts2.join(" · ");
  }
  function recentContests(targets = platforms) {
    return targets.filter(({ code }) => bound(code)).flatMap(({ code }) => {
      const contests = entry(code).data?.contests;
      return (Array.isArray(contests) ? contests : []).map((contest) => ({ ...contest, code }));
    }).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }
  function drawSummary(panel, contests) {
    const metrics = element("div", "platform-metrics");
    for (const [field2, label, key] of [["solvedCount", "总解题", "solved"], ["submissionCount", "总提交", "submissions"]]) {
      const values = scope().filter(({ code }) => bound(code) && known(entry(code).data?.[field2]));
      const total = values.length ? values.reduce((sum, { code }) => sum + entry(code).data[field2], 0) : null;
      const node3 = metric(selected === "ALL" ? `${label} · 已知合计` : label, total, key);
      node3.append(element("small", "platform-coverage", coverage(values.length, scope().length)));
      metrics.append(node3);
    }
    const latest = element("div", "platform-metric platform-latest");
    latest.append(element("span", "", "最近比赛"));
    if (contests.length) {
      const contest = contests[0];
      latest.append(external(contest.name || "未命名比赛", contest.url, contest.code, "platform-latest-name"));
      latest.append(element("small", "platform-coverage", `${contest.code} · ${dateLabel(contest.date)}`));
      const supplement = [ratingChange(contest), contestScore(contest)].filter(Boolean);
      if (supplement.length) latest.append(element("small", "platform-latest-result", supplement.join(" · ")));
      attachTip(latest, contestLines(contest));
    } else latest.append(element("strong", "platform-unknown", "暂无数据"));
    const covered = scope().filter(({ code }) => bound(code) && Array.isArray(entry(code).data?.contests)).length;
    latest.append(element("small", "platform-coverage", coverage(covered, scope().length)));
    metrics.append(latest);
    panel.append(metrics);
    panel.append(element("p", "platform-sum-note", "解题数为各平台已解题数相加，同一道题跨平台不去重；未知数据不计为 0。"));
  }
  function svgElement(tag, attributes = {}, text3) {
    const node3 = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) node3.setAttribute(name, String(value));
    if (text3 !== void 0) node3.textContent = String(text3);
    return node3;
  }
  function drawRatingChart(code) {
    const data = entry(code).data || {};
    const raw = Array.isArray(data.ratingHistory) ? data.ratingHistory : [];
    const points = raw.filter((point) => known(point.rating) && Number.isFinite(Date.parse(point.date))).slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const figure = element("figure", "platform-rating-chart");
    figure.dataset.platform = code;
    const caption = element("figcaption");
    caption.append(element("strong", "", `${metadata(code).name} Rating`), element("span", "platform-coverage", "独立刻度"));
    figure.append(caption);
    if (!points.length) {
      figure.append(element("p", "platform-chart-empty", "暂无 Rating 历史数据"));
      return figure;
    }
    const low = Math.min(...points.map((point) => point.rating));
    const high = Math.max(...points.map((point) => point.rating));
    const padding = Math.max(50, Math.ceil((high - low) * 0.12));
    const min = Math.max(0, low - padding);
    const max = Math.max(min + 100, high + padding);
    const first = Date.parse(points[0].date);
    const last = Date.parse(points[points.length - 1].date);
    const x = (point) => first === last ? 288 : 48 + (Date.parse(point.date) - first) / (last - first) * 480;
    const y = (point) => 154 - (point.rating - min) / (max - min) * 130;
    const svg = svgElement("svg", { viewBox: "0 0 560 190", role: "group", "aria-label": `${metadata(code).name} Rating 历史，独立刻度 ${Math.round(min)} 至 ${Math.round(max)}` });
    for (let index = 0; index < 3; index++) {
      const value = min + (max - min) * index / 2;
      const pos = 154 - index * 65;
      svg.append(svgElement("line", { x1: 48, y1: pos, x2: 528, y2: pos, class: "platform-chart-grid" }));
      svg.append(svgElement("text", { x: 40, y: pos + 4, "text-anchor": "end", class: "platform-chart-axis" }, Math.round(value)));
    }
    svg.append(svgElement("text", { x: 48, y: 178, class: "platform-chart-axis" }, dateLabel(points[0].date)));
    svg.append(svgElement("text", { x: 528, y: 178, "text-anchor": "end", class: "platform-chart-axis" }, dateLabel(points[points.length - 1].date)));
    svg.append(svgElement("polyline", { points: points.map((point) => `${x(point)},${y(point)}`).join(" "), class: "platform-chart-line", fill: "none" }));
    points.forEach((point, index) => {
      const dot = svgElement("circle", { cx: x(point), cy: y(point), r: 4, tabindex: "0", class: "platform-chart-point", "data-index": index });
      attachTip(dot, contestLines(point));
      svg.append(dot);
    });
    figure.append(svg);
    return figure;
  }
  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }
  function activityRange() {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
    const end = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
    const start = new Date(end);
    if (activityPeriod === "recent") {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      start.setUTCDate(start.getUTCDate() + 1);
    } else {
      start.setUTCFullYear(Number(activityPeriod), 0, 1);
      end.setUTCFullYear(Number(activityPeriod), 11, 31);
    }
    return { start, end, year: Number(today.slice(0, 4)) };
  }
  function activityData(code) {
    const activity = bound(code) ? entry(code).data?.activity : null;
    return activity && activity.days && typeof activity.days === "object" && !Array.isArray(activity.days) ? activity : null;
  }
  function activityCount(activity, key) {
    if (!activity) return null;
    if (Object.prototype.hasOwnProperty.call(activity.days, key) && known(activity.days[key]) && activity.days[key] >= 0) return activity.days[key];
    if (activity.complete === true) return 0;
    if (activity.rangeComplete === true && /^\d{4}-\d{2}-\d{2}$/.test(activity.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(activity.endDate) && key >= activity.startDate && key <= activity.endDate) return 0;
    return null;
  }
  function drawActivity(panel) {
    const section = element("section", "platform-activity");
    const heading = element("div", "platform-subheading");
    heading.append(element("h3", "", "每日解题"));
    const range = activityRange();
    const label = element("label", "platform-period-label", "时间范围");
    const select = element("select", "platform-select");
    select.id = "platform-activity-period";
    select.setAttribute("aria-label", "每日解题时间范围");
    for (const [value, title] of [["recent", "最近一年"], [String(range.year - 1), `${range.year - 1} 年`]]) {
      const option2 = element("option", "", title);
      option2.value = value;
      select.append(option2);
    }
    select.value = activityPeriod;
    select.addEventListener("change", () => {
      activityPeriod = select.value;
      updateScope();
    });
    label.append(select);
    heading.append(label);
    section.append(heading);
    const available = scope().filter(({ code }) => {
      const activity = activityData(code);
      return activity && (activity.complete === true || activity.rangeComplete === true || Object.values(activity.days).some((value) => known(value) && value >= 0));
    });
    const complete = available.filter(({ code }) => activityData(code).complete === true);
    const coverageText = `日历覆盖 ${available.length}/${scope().length} 平台 · 完整历史 ${complete.length}/${scope().length} 平台`;
    section.append(element("p", "platform-activity-note", `${coverageText} · Asia/Shanghai`));
    section.append(element("p", "platform-activity-note", "CF / AT / 牛客按每题首次 AC 计数；洛谷采用官方每日通过题数。各平台统计口径见数据说明。"));
    const incomplete = scope().filter(({ code }) => !activityData(code) || activityData(code).complete !== true);
    if (incomplete.length) section.append(element("p", "platform-activity-note", `覆盖不完整：${incomplete.map(({ code }) => code).join("、")}；仅汇总已提供日期与已确认完整区间，缺失数据不视为 0。`));
    for (const { code } of available) {
      const activity = activityData(code);
      if (activity.rangeComplete === true && activity.startDate && activity.endDate) section.append(element("p", "platform-activity-note", `${code} 完整区间：${activity.startDate} 至 ${activity.endDate}`));
    }
    if (!available.length) {
      section.append(element("p", "platform-chart-empty", "暂无每日解题数据，旧缓存或平台未提供日历。刷新后仍不可用时请查看数据说明。"));
      panel.append(section);
      return;
    }
    const scroll = element("div", "platform-heatmap-scroll");
    const months = element("div", "platform-heatmap-months");
    const grid = element("div", "platform-heatmap-grid");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "每日解题数日历，方向键移动，悬停或聚焦查看详情");
    const day = new Date(range.start);
    const offset = (day.getUTCDay() + 6) % 7;
    for (let index2 = 0; index2 < offset; index2++) {
      const spacer = element("span", "platform-heatmap-spacer");
      spacer.setAttribute("aria-hidden", "true");
      grid.append(spacer);
    }
    let index = offset;
    let lastMonth = -1;
    let total = 0;
    while (day <= range.end) {
      const key = dayKey(day);
      const counts = scope().map(({ code }) => ({ code, count: activityCount(activityData(code), key) }));
      const knownCounts = counts.filter((item) => item.count !== null);
      const count = knownCounts.reduce((sum, item) => sum + item.count, 0);
      total += count;
      const partial = knownCounts.length < scope().length;
      const lines = [{ text: key }, { text: knownCounts.length ? `总通过：${number(count)}道${partial ? "（已知）" : ""}` : "暂无数据" }];
      const cell = button("", "platform-heatmap-day", () => {
      });
      const level = !knownCounts.length || partial && count === 0 ? "unknown" : String(count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4);
      cell.dataset.date = key;
      cell.dataset.level = level;
      cell.dataset.count = knownCounts.length ? String(count) : "";
      cell.dataset.partial = String(partial);
      cell.tabIndex = key === dayKey(range.end) ? 0 : -1;
      attachTip(cell, lines);
      cell.addEventListener("keydown", (event) => {
        const move = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
        const cells = [...grid.querySelectorAll(".platform-heatmap-day")];
        let target = cells.indexOf(cell) + move;
        if (event.key === "Home") target = 0;
        else if (event.key === "End") target = cells.length - 1;
        else if (move === void 0) return;
        event.preventDefault();
        target = Math.max(0, Math.min(cells.length - 1, target));
        cells.forEach((node3) => {
          node3.tabIndex = -1;
        });
        cells[target].tabIndex = 0;
        cells[target].focus();
      });
      grid.append(cell);
      if (day.getUTCMonth() !== lastMonth) {
        const month = element("span", "", `${day.getUTCMonth() + 1}月`);
        month.dataset.week = String(Math.floor(index / 7));
        months.append(month);
        lastMonth = day.getUTCMonth();
      }
      index++;
      day.setUTCDate(day.getUTCDate() + 1);
    }
    const weeks = Math.ceil(index / 7);
    const monthLabels = new Map([...months.children].map((node3) => [Number(node3.dataset.week), node3.textContent]));
    months.replaceChildren(...Array.from({ length: weeks }, (_, week) => element("span", "", monthLabels.get(week) || "")));
    scroll.classList.add(`platform-heatmap-weeks-${weeks}`);
    const weekdays = element("div", "platform-heatmap-weekdays");
    for (const text3 of ["一", "", "三", "", "五", "", "日"]) weekdays.append(element("span", "", text3));
    const calendar = element("div", "platform-heatmap-calendar");
    calendar.append(weekdays, grid);
    scroll.append(months, calendar);
    const legend = element("div", "platform-heatmap-legend");
    legend.append(element("span", "", `本范围已知合计 ${number(total)} 题`), element("span", "", "少"));
    for (const level of ["0", "1", "2", "3", "4", "unknown"]) {
      const swatch = element("span", "platform-heatmap-swatch");
      swatch.dataset.level = level;
      swatch.title = level === "unknown" ? "数据缺失或覆盖不完整" : `强度 ${level}`;
      legend.append(swatch);
    }
    legend.append(element("span", "", "多 / 未知"));
    section.append(scroll, legend);
    panel.append(section);
  }
  function syncRefresh() {
    const refresh = document.getElementById("platform-refresh-all");
    if (!refresh) return;
    const targets = scope().filter(({ code }) => bound(code));
    const busy2 = targets.some(({ code }) => pending.has(code));
    refresh.textContent = busy2 ? "刷新中…" : selected === "ALL" ? "刷新全部" : "刷新平台";
    refresh.disabled = busy2 || !targets.length || typeof bridge?.refreshPlatform !== "function";
  }
  function updateScope() {
    dismissTip();
    const panel = document.querySelector("#platform-overview .platform-dashboard");
    if (!panel) return;
    panel.dataset.platform = selected;
    const summary = panel.querySelector(".platform-summary");
    if (summary) {
      summary.replaceChildren();
      drawSummary(summary, recentContests(scope()));
    }
    const activity = panel.querySelector(".platform-activity");
    if (activity) {
      const holder = element("div");
      drawActivity(holder);
      activity.replaceWith(...holder.childNodes);
    }
    syncRefresh();
  }
  function drawOverview() {
    dismissTip();
    const root2 = document.getElementById("platform-overview");
    if (!root2) return;
    const panel = element("article", `platform-dashboard${expanded ? " is-expanded" : ""}`);
    panel.dataset.platform = selected;
    const heading = element("div", "platform-section-heading");
    const copy = element("div");
    const title = element("h2", "", "做题与比赛总览");
    title.id = "platform-overview-title";
    copy.append(title, element("p", "", "公开主页数据 · 仅保存在本机 · 独立于 GitHub 账户"));
    const actions = element("div", "platform-dashboard-actions");
    const select = element("select", "platform-select");
    select.id = "platform-select";
    select.setAttribute("aria-label", "选择统计平台");
    for (const platform of [{ code: "ALL", name: "全部平台 · 汇总" }, ...platforms]) {
      const option2 = element("option", "", platform.code === "ALL" ? platform.name : `${platform.code} · ${platform.name}`);
      option2.value = platform.code;
      select.append(option2);
    }
    select.value = selected;
    select.addEventListener("change", () => {
      selected = select.value;
      updateScope();
    });
    const targets = platforms.filter(({ code }) => bound(code));
    const refreshTargets = scope().filter(({ code }) => bound(code));
    const busy2 = refreshTargets.some(({ code }) => pending.has(code));
    const refresh = button(busy2 ? "刷新中…" : selected === "ALL" ? "刷新全部" : "刷新平台", "platform-button", () => selected === "ALL" ? refreshAll() : refreshPlatform(selected));
    refresh.id = "platform-refresh-all";
    refresh.disabled = busy2 || !refreshTargets.length || typeof bridge?.refreshPlatform !== "function";
    const settings = button("账号设置", "platform-button", () => {
      if (typeof onSettings === "function") onSettings();
    });
    settings.id = "platform-settings";
    settings.disabled = typeof onSettings !== "function";
    const toggle = button(expanded ? "收起统计" : "展开统计", "platform-button", () => {
      expanded = !expanded;
      drawOverview();
      document.getElementById("platform-expand")?.focus();
    });
    toggle.id = "platform-expand";
    toggle.setAttribute("aria-expanded", String(expanded));
    actions.append(select, refresh, settings, toggle);
    heading.append(copy, actions);
    panel.append(heading);
    if (!targets.length) {
      const empty = element("div", "platform-dashboard-empty");
      empty.append(element("strong", "", selected === "ALL" ? "尚未绑定平台账号" : `${metadata(selected).name} 尚未绑定账号`), element("p", "", "在账号设置中添加公开主页，查看真实的解题、比赛和每日进展。"));
      const go = button("去设置绑定", "platform-button", () => {
        if (typeof onSettings === "function") onSettings();
      });
      go.disabled = typeof onSettings !== "function";
      empty.append(go);
      panel.append(empty);
    } else {
      const accounts = element("div", "platform-account-strip");
      for (const { code } of targets) accounts.append(external(`${code} · ${username(code)}`, entry(code).data?.profileUrl || entry(code).binding.url, code, "platform-username"));
      panel.append(accounts);
      const contests = recentContests();
      const summary = element("div", "platform-summary");
      drawSummary(summary, recentContests(scope()));
      panel.append(summary);
      const charts = element("div", "platform-rating-charts");
      for (const code of ["CF", "AT"]) charts.append(drawRatingChart(code));
      if (charts.childElementCount) panel.append(charts);
      drawActivity(panel);
      const recent = element("section", "platform-recent");
      recent.append(element("h3", "", "最近比赛记录"));
      if (!contests.length) recent.append(element("p", "platform-chart-empty", "暂无比赛数据"));
      for (const contest of contests.slice(0, expanded ? 8 : 3)) {
        const row2 = element("div", "platform-contest");
        row2.append(element("span", "platform-contest-platform", contest.code), external(String(contest.name || "未命名比赛"), contest.url, contest.code, "platform-contest-name"), element("span", "platform-contest-details", contestDetails(contest)));
        attachTip(row2, contestLines(contest));
        recent.append(row2);
      }
      panel.append(recent);
      const notes = element("details", "platform-source-details");
      notes.append(element("summary", "", "数据来源与覆盖说明"));
      for (const { code } of targets) {
        const value = entry(code);
        const data = value.data || {};
        notes.append(element("p", "platform-source-note", `${metadata(code).name}：${data.sourceNote || "数据来自平台公开页面；不可获取的字段显示暂无数据。"}`));
        if (data.activity?.note) notes.append(element("p", "platform-source-note", `${code} 每日解题：${data.activity.note}`));
        notes.append(element("p", "platform-updated", `${code} 上次成功刷新：${time(value.updatedAt)}`));
        const error = localErrors.get(code) || value.error;
        if (error) {
          const failure = element("p", "platform-error", `${code}：${value.data ? "保留上次数据。" : ""}${errorText(error)}`);
          failure.dataset.platform = code;
          failure.setAttribute("role", "status");
          panel.append(failure);
          if (value.attemptedAt) notes.append(element("p", "platform-updated", `${code} 最近尝试：${time(value.attemptedAt)}`));
        }
      }
      panel.append(notes);
    }
    root2.classList.add("notebook-platforms");
    root2.setAttribute("aria-labelledby", "platform-overview-title");
    root2.replaceChildren(panel);
  }
  function drawBindings() {
    const root2 = document.getElementById("platform-bindings");
    if (!root2) return;
    const title = element("h3", "", "竞赛平台账号");
    title.id = "platform-bindings-title";
    const help = element("p", "platform-settings-note", "粘贴公开个人主页即可绑定，无需密码或 Token。绑定与缓存仅保存在本机，不受 GitHub 登录、退出或切换影响。");
    const rows = element("div", "platform-binding-rows");
    for (const platform of platforms) {
      const row2 = element("div", "platform-binding-row");
      row2.dataset.platform = platform.code;
      const label = element("span", "platform-binding-name", platform.name);
      const action2 = button(bound(platform.code) ? username(platform.code) : "绑定账号", "platform-button platform-bind-account", () => openDialog(platform.code));
      action2.disabled = pending.has(platform.code);
      row2.append(label, action2);
      rows.append(row2);
    }
    root2.classList.add("notebook-platforms", "platform-settings");
    root2.setAttribute("aria-labelledby", "platform-bindings-title");
    root2.replaceChildren(title, help, rows);
  }
  function draw() {
    drawOverview();
    drawBindings();
    if (modalCode) syncDialog();
  }
  function showError(message) {
    modalError.textContent = message || "";
    modalError.hidden = !message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
  function syncDialog() {
    const busy2 = pending.has(modalCode);
    input.disabled = busy2;
    saveButton.disabled = busy2 || typeof bridge?.bindPlatform !== "function";
    unlinkButton.disabled = busy2 || typeof bridge?.unbindPlatform !== "function";
    unlinkButton.hidden = !bound(modalCode);
    closeButton.disabled = busy2;
    cancelButton.disabled = busy2;
    saveButton.textContent = busy2 ? "处理中…" : "绑定账号";
    dialog.setAttribute("aria-busy", String(busy2));
  }
  function closeDialog() {
    if (modalCode && pending.has(modalCode)) return;
    dialog.close();
    modalCode = null;
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = element("dialog", "platform-bind-dialog");
    dialog.id = "platform-bind-dialog";
    dialog.setAttribute("aria-labelledby", "platform-bind-title");
    dialog.setAttribute("aria-describedby", "platform-bind-description");
    const form = element("form");
    form.noValidate = true;
    const heading = element("div", "platform-dialog-heading");
    const title = element("h2");
    title.id = "platform-bind-title";
    closeButton = button("✕", "platform-dialog-close", closeDialog);
    closeButton.setAttribute("aria-label", "关闭绑定窗口");
    heading.append(title, closeButton);
    const description = element("p", "platform-dialog-description", "粘贴你的 HTTPS 公开个人主页链接。无需登录平台、密码或 Token。");
    description.id = "platform-bind-description";
    const label = element("label", "platform-url-label", "个人主页 URL");
    input = element("input");
    input.id = "platform-bind-url";
    input.type = "url";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 2048;
    input.setAttribute("aria-describedby", "platform-bind-example platform-bind-error");
    input.addEventListener("input", () => showError(""));
    label.append(input);
    const example = element("p", "platform-url-example");
    example.id = "platform-bind-example";
    modalError = element("p", "platform-error platform-modal-error");
    modalError.id = "platform-bind-error";
    modalError.setAttribute("role", "alert");
    modalError.hidden = true;
    const actions = element("div", "platform-dialog-actions");
    unlinkButton = button("解除绑定", "platform-button platform-unlink", () => mutate(modalCode, "unbindPlatform"));
    unlinkButton.id = "platform-unbind";
    cancelButton = button("取消", "platform-button", closeDialog);
    saveButton = element("button", "platform-button platform-primary", "绑定账号");
    saveButton.id = "platform-bind-submit";
    saveButton.type = "submit";
    actions.append(unlinkButton, cancelButton, saveButton);
    form.append(heading, description, label, example, modalError, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending.has(modalCode)) return;
      const url = input.value.trim();
      if (!url) {
        showError("请粘贴个人主页链接。");
        input.focus();
        return;
      }
      if (!safeURL(url, modalCode, true)) {
        showError(`请使用 ${metadata(modalCode).name} 官方个人主页的 HTTPS 链接。`);
        input.focus();
        return;
      }
      mutate(modalCode, "bindPlatform", url);
    });
    dialog.addEventListener("cancel", (event) => {
      if (modalCode && pending.has(modalCode)) event.preventDefault();
      else modalCode = null;
    });
    dialog.append(form);
    document.body.append(dialog);
  }
  function openDialog(code) {
    if (!metadata(code) || pending.has(code)) return;
    ensureDialog();
    modalCode = code;
    const platform = metadata(code);
    document.getElementById("platform-bind-title").textContent = `绑定 ${platform.name}`;
    document.getElementById("platform-bind-example").textContent = `例如：${platform.example}`;
    input.placeholder = platform.example;
    input.value = entry(code).binding?.url || "";
    showError("");
    syncDialog();
    if (!dialog.open) dialog.showModal();
    input.focus();
  }
  async function mutate(code, method, url) {
    if (!metadata(code) || pending.has(code) || typeof bridge?.[method] !== "function") return;
    pending.add(code);
    localErrors.delete(code);
    if (modalCode === code) showError("");
    draw();
    let success = false;
    try {
      const result = await bridge[method](code, ...url === void 0 ? [] : [url]);
      if (!result || typeof result !== "object") throw new Error("平台没有返回有效数据，请重试。");
      const next = result[code];
      if (method !== "unbindPlatform" && !next) throw new Error("平台没有返回该账号的数据，请重试。");
      if (next) state = { ...state, [code]: next };
      else {
        state = { ...state };
        delete state[code];
      }
      if (next?.error && method === "bindPlatform") {
        if (modalCode === code) showError(errorText(next.error));
      } else success = true;
    } catch (error) {
      localErrors.set(code, errorText(error));
      if (modalCode === code) showError(errorText(error));
    } finally {
      pending.delete(code);
      draw();
      if (success && modalCode === code && method !== "refreshPlatform") closeDialog();
    }
  }
  function refreshPlatform(code) {
    if (!bound(code)) return Promise.resolve();
    return mutate(code, "refreshPlatform");
  }
  async function refreshAll() {
    await Promise.all(platforms.filter((platform) => bound(platform.code) && !pending.has(platform.code)).map((platform) => refreshPlatform(platform.code)));
  }
  function init(options = {}) {
    bridge = options.bridge || window.notebook;
    onSettings = options.onSettings;
    ensureDialog();
    draw();
    return Platforms;
  }
  function render(mapping = {}) {
    const next = mapping && typeof mapping === "object" ? mapping : {};
    const merged = {};
    for (const { code } of platforms) {
      if (pending.has(code)) {
        if (state[code]) merged[code] = state[code];
      } else if (next[code]) merged[code] = next[code];
    }
    state = merged;
    if (!bridge) bridge = window.notebook;
    draw();
  }
  var Platforms = Object.freeze({ init, render, refreshAll, refreshPlatform, openDialog });

  // src/renderer/planner/deadline.ts
  var enhanced = /* @__PURE__ */ new WeakMap();
  var active = null;
  var sequence = 0;
  var pad = (value) => String(value).padStart(2, "0");
  var dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  function localDay(year, month, day) {
    const date = /* @__PURE__ */ new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(year, month, day);
    return date;
  }
  function parts(value) {
    return String(value).match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/);
  }
  function validLocal(value) {
    const match2 = value.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!match2) return false;
    const expected = [Number(match2[1]), Number(match2[2]) - 1, Number(match2[3]), Number(match2[4]), Number(match2[5]), Number(match2[6] || 0), Number((match2[7] || "").padEnd(3, "0"))];
    const date = new Date(value);
    const actual = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
    return !Number.isNaN(date.getTime()) && actual.every((part, index) => part === expected[index]);
  }
  function node(tag, className, text3) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text3 !== void 0) result.textContent = text3;
    return result;
  }
  function action(text3, className, callback, label) {
    const result = node("button", className, text3);
    result.type = "button";
    if (label) result.setAttribute("aria-label", label);
    result.addEventListener("click", callback);
    return result;
  }
  function enhance(input2) {
    if (enhanced.has(input2)) return enhanced.get(input2);
    if (!(input2 instanceof HTMLInputElement) || input2.type !== "datetime-local") throw new TypeError("NotebookDeadline.enhance requires a datetime-local input.");
    const id = `planner-deadline-${++sequence}`;
    const button8 = action("", "planner-deadline-trigger", () => {
      if (input2.disabled || input2.matches(":disabled")) return;
      if (opened) close();
      else open2();
    });
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 20 20");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("planner-deadline-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5.5 2.5v3m9-3v3M3 8h14M4.5 4h11A1.5 1.5 0 0 1 17 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4ZM6.5 11h2m3 0h2m-7 3h2");
    icon.append(path);
    const caption = node("span", "planner-deadline-caption");
    button8.append(icon, caption);
    button8.setAttribute("aria-haspopup", "dialog");
    button8.setAttribute("aria-expanded", "false");
    button8.setAttribute("aria-controls", id);
    input2.hidden = true;
    input2.insertAdjacentElement("afterend", button8);
    const popover = node("div", "planner-deadline-popover");
    popover.id = id;
    popover.setAttribute("popover", "auto");
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-labelledby", `${id}-title`);
    const heading = node("div", "planner-deadline-heading");
    const title = node("h3", "", "截止时间");
    title.id = `${id}-title`;
    heading.append(title, node("span", "planner-deadline-optional", "可选"));
    const navigation = node("div", "planner-deadline-navigation");
    const previous = action("‹", "planner-deadline-nav", () => changeMonth(-1), "上个月");
    const next = action("›", "planner-deadline-nav", () => changeMonth(1), "下个月");
    const month = node("span", "planner-deadline-month");
    month.id = `${id}-month`;
    month.setAttribute("aria-live", "polite");
    navigation.append(previous, month, next);
    const weekdays = node("div", "planner-deadline-weekdays");
    weekdays.setAttribute("aria-hidden", "true");
    for (const day of ["一", "二", "三", "四", "五", "六", "日"]) weekdays.append(node("span", "", day));
    const calendar = node("div", "planner-deadline-calendar");
    calendar.setAttribute("role", "group");
    calendar.setAttribute("aria-labelledby", month.id);
    const shortcuts = node("div", "planner-deadline-shortcuts");
    for (const [text3, offset] of [["今天", 0], ["明天", 1], ["+7天", 7]]) {
      shortcuts.append(action(text3, "planner-deadline-shortcut", () => {
        const date = /* @__PURE__ */ new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        selectDate(date);
      }));
    }
    const timeRow = node("label", "planner-deadline-time-row");
    const time2 = node("input", "planner-deadline-time");
    time2.type = "time";
    time2.step = "60";
    time2.setAttribute("aria-label", "截止时刻（本机时区）");
    timeRow.append(node("span", "", "时间"), time2, node("span", "planner-deadline-zone", "本机时区"));
    const selection = node("p", "planner-deadline-selection");
    selection.setAttribute("aria-live", "polite");
    const error = node("p", "planner-deadline-error");
    error.id = `${id}-error`;
    error.setAttribute("role", "alert");
    error.hidden = true;
    time2.setAttribute("aria-describedby", error.id);
    const footer = node("div", "planner-deadline-footer");
    const clear = action("清除", "planner-deadline-clear", () => {
      draftDate = "";
      time2.value = "";
      clearError();
      renderCalendar();
    });
    const cancel = action("取消", "planner-deadline-cancel", close);
    const confirm = action("确定", "planner-deadline-confirm", apply);
    footer.append(clear, cancel, confirm);
    popover.append(heading, navigation, weekdays, calendar, shortcuts, timeRow, selection, error, footer);
    let opened = false;
    let original = "";
    let originalParts = null;
    let draftDate = "";
    let view = /* @__PURE__ */ new Date();
    let frame = 0;
    function clearError() {
      error.hidden = true;
      error.textContent = "";
      time2.removeAttribute("aria-invalid");
    }
    function fail(message, target) {
      error.textContent = message;
      error.hidden = false;
      if (target === time2) time2.setAttribute("aria-invalid", "true");
      target.focus({ preventScroll: true });
      position();
    }
    function refresh() {
      const value = parts(input2.value);
      caption.textContent = value ? `${Number(value[1].split("-")[1])}/${Number(value[1].split("-")[2])} ${value[2]}` : "截止时间";
      button8.classList.toggle("has-deadline", Boolean(value));
      button8.disabled = input2.disabled || input2.matches(":disabled");
      const label = input2.getAttribute("aria-label") || "截止时间（可选，使用本机时区）";
      button8.setAttribute("aria-label", value ? `${label}：${value[1]} ${value[2]}` : label);
      button8.title = value ? `${value[1]} ${input2.value.split("T")[1]}（本机时区）` : label;
      if (button8.disabled && opened) close();
      return api;
    }
    function renderCalendar(focusDate) {
      const year = view.getFullYear();
      const monthIndex = view.getMonth();
      month.textContent = `${year} 年 ${monthIndex + 1} 月`;
      previous.disabled = year <= 1 && monthIndex === 0;
      next.disabled = year >= 9999 && monthIndex === 11;
      calendar.replaceChildren();
      const first = localDay(year, monthIndex, 1);
      const offset = (first.getDay() + 6) % 7;
      const today = dateKey(/* @__PURE__ */ new Date());
      for (let index = 0; index < 42; index++) {
        const date = localDay(year, monthIndex, index - offset + 1);
        const key = dateKey(date);
        const day = action(String(date.getDate()), "planner-deadline-day", () => selectDate(date, true));
        day.dataset.date = key;
        day.classList.toggle("is-adjacent", date.getMonth() !== monthIndex);
        day.classList.toggle("is-today", key === today);
        day.setAttribute("aria-pressed", String(key === draftDate));
        day.setAttribute("aria-label", `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，星期${["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}`);
        if (key === today) day.setAttribute("aria-current", "date");
        day.disabled = date.getFullYear() < 1 || date.getFullYear() > 9999;
        day.addEventListener("keydown", (event) => moveDay(event, date));
        calendar.append(day);
      }
      selection.textContent = draftDate ? `已选 ${draftDate.replace(/-/g, "/")} · 确定后生效` : "未选日期 · 可留空";
      if (focusDate) calendar.querySelector(`[data-date="${focusDate}"]`)?.focus({ preventScroll: true });
      if (opened) position();
    }
    function selectDate(date, focus = false) {
      draftDate = dateKey(date);
      view = localDay(date.getFullYear(), date.getMonth(), 1);
      clearError();
      renderCalendar(focus ? draftDate : null);
    }
    function changeMonth(delta) {
      const date = localDay(view.getFullYear(), view.getMonth() + delta, 1);
      if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
      view = date;
      clearError();
      renderCalendar();
    }
    function moveDay(event, date) {
      const increments = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const target = localDay(date.getFullYear(), date.getMonth(), date.getDate());
      if (Object.hasOwn(increments, event.key)) target.setDate(target.getDate() + increments[event.key]);
      else if (event.key === "Home") target.setDate(target.getDate() - (target.getDay() + 6) % 7);
      else if (event.key === "End") target.setDate(target.getDate() + 6 - (target.getDay() + 6) % 7);
      else if (event.key === "PageUp" || event.key === "PageDown") {
        const day = target.getDate();
        target.setDate(1);
        target.setMonth(target.getMonth() + (event.key === "PageUp" ? -1 : 1));
        const last = localDay(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(day, last));
      } else return;
      event.preventDefault();
      if (target.getFullYear() < 1 || target.getFullYear() > 9999) return;
      view = localDay(target.getFullYear(), target.getMonth(), 1);
      renderCalendar(dateKey(target));
    }
    function position() {
      if (!opened) return;
      if (!button8.isConnected || button8.disabled) {
        close();
        return;
      }
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 8;
      const topEdge = (viewport?.offsetTop || 0) + 8;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
      popover.style.maxHeight = `${Math.max(0, bottomEdge - topEdge)}px`;
      const anchor = button8.getBoundingClientRect();
      const box = popover.getBoundingClientRect();
      const below = anchor.bottom + 7;
      const above = anchor.top - box.height - 7;
      const top = below + box.height <= bottomEdge ? below : above >= topEdge ? above : Math.max(topEdge, Math.min(below, bottomEdge - box.height));
      popover.style.left = `${Math.max(leftEdge, Math.min(anchor.left, rightEdge - box.width))}px`;
      popover.style.top = `${top}px`;
    }
    function schedulePosition(event) {
      if (event?.target instanceof Node && popover.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    function finishClose() {
      if (!opened) return;
      opened = false;
      if (active === api) active = null;
      button8.setAttribute("aria-expanded", "false");
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      queueMicrotask(() => {
        if (!active && button8.isConnected && !button8.disabled) button8.focus({ preventScroll: true });
      });
    }
    function close() {
      if (popover.matches(":popover-open")) popover.hidePopover();
      finishClose();
    }
    function open2() {
      refresh();
      if (opened || button8.disabled || !button8.isConnected) return;
      if (active && active !== api) active.close();
      original = input2.value;
      originalParts = parts(original);
      draftDate = originalParts?.[1] || "";
      time2.value = originalParts?.[2] || "21:00";
      const selected2 = draftDate ? draftDate.split("-").map(Number) : null;
      const today = /* @__PURE__ */ new Date();
      view = selected2 ? localDay(selected2[0], selected2[1] - 1, 1) : localDay(today.getFullYear(), today.getMonth(), 1);
      clearError();
      renderCalendar();
      (input2.closest("dialog") || document.body).append(popover);
      popover.showPopover();
      opened = true;
      active = api;
      button8.setAttribute("aria-expanded", "true");
      position();
      const focusDate = draftDate || dateKey(today);
      (calendar.querySelector(`[data-date="${focusDate}"]`) || calendar.querySelector("button:not(:disabled)")).focus({ preventScroll: true });
      window.addEventListener("resize", schedulePosition);
      document.addEventListener("scroll", schedulePosition, true);
      window.visualViewport?.addEventListener("resize", schedulePosition);
      window.visualViewport?.addEventListener("scroll", schedulePosition);
    }
    function apply() {
      if (input2.disabled || input2.matches(":disabled")) {
        close();
        return;
      }
      if (!draftDate && time2.value) {
        fail("请选择日期，或清除截止时间。", calendar.querySelector("button:not(:disabled)"));
        return;
      }
      if (draftDate && !time2.value) {
        fail("请填写时间，或清除截止时间。", time2);
        return;
      }
      let value = draftDate ? `${draftDate}T${time2.value}` : "";
      if (value && originalParts && draftDate === originalParts[1] && time2.value === originalParts[2]) value = original;
      if (value && !validLocal(value)) {
        fail("该本地时间无效，请重新选择日期和时间。", time2);
        return;
      }
      input2.value = value;
      refresh();
      input2.dispatchEvent(new Event("input", { bubbles: true }));
      input2.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    }
    popover.addEventListener("beforetoggle", (event) => {
      if ("newState" in event && event.newState === "closed") finishClose();
    });
    popover.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
    time2.addEventListener("input", clearError);
    input2.addEventListener("input", refresh);
    input2.addEventListener("change", refresh);
    input2.form?.addEventListener("reset", () => queueMicrotask(() => {
      close();
      refresh();
    }));
    const observer = new MutationObserver(refresh);
    observer.observe(input2, { attributes: true, attributeFilter: ["disabled", "value", "aria-label"] });
    const api = { input: input2, button: button8, popover, refresh, open: open2, close };
    enhanced.set(input2, api);
    refresh();
    return api;
  }
  var Deadline = Object.freeze({ enhance, attach: enhance });

  // src/renderer/planner/planner.ts
  var bridge2;
  var onChange;
  var state2 = { problems: [], tasks: [], layout: "balanced" };
  var root;
  var dialog2;
  var editor;
  var busy = false;
  var mounted = false;
  var cards = {};
  var collapsed = { problems: false, tasks: false };
  var completedOpen = { problems: false, tasks: false };
  var deleteTarget = "";
  var lastFocus;
  var el = (tag, className, text3) => {
    const node3 = document.createElement(tag);
    if (className) node3.className = className;
    if (text3 !== void 0) node3.textContent = String(text3);
    return node3;
  };
  function button2(text3, className, action2) {
    const node3 = el("button", className, text3);
    node3.type = "button";
    node3.addEventListener("click", action2);
    return node3;
  }
  function field(label, name, type, placeholder, maxLength) {
    const wrap = el("label", "planner-field");
    wrap.append(el("span", "planner-sr-only", label));
    const input2 = el(type === "textarea" ? "textarea" : "input", "planner-input");
    input2.name = name;
    if (type !== "textarea") input2.type = type;
    if (placeholder) input2.placeholder = placeholder;
    if (maxLength) input2.maxLength = maxLength;
    input2.setAttribute("aria-label", label);
    wrap.append(input2);
    return { wrap, input: input2 };
  }
  function errorText2(error) {
    return String(typeof error === "string" ? error : error?.message || "保存失败，请重试。").replace(/^Error:\s*/, "");
  }
  function showError2(target, message) {
    target.textContent = message || "";
    target.hidden = !message;
  }
  function safeURL2(value) {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("请填写 http 或 https 题目链接。");
    return url.href;
  }
  function problemTitle(url) {
    const parsed = new URL(url);
    const path = parsed.pathname;
    let match2;
    if (/codeforces\.com$/i.test(parsed.hostname) && (match2 = path.match(/\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([a-z]\d*)/i))) return `CF ${match2[1]}${match2[2].toUpperCase()}`;
    if (/luogu\.(?:com\.cn|com)$/i.test(parsed.hostname) && (match2 = path.match(/\/problem\/([^/]+)/i))) return match2[1].toUpperCase();
    if (/atcoder\.jp$/i.test(parsed.hostname) && (match2 = path.match(/\/tasks\/([^/]+)/i))) return match2[1];
    if (/nowcoder\.com$/i.test(parsed.hostname) && (match2 = path.match(/\/acm\/contest\/(\d+)\/([^/]+)/i))) return `牛客 ${match2[1]} ${match2[2]}`;
    let last = path.split("/").filter(Boolean).pop() || parsed.hostname;
    try {
      last = decodeURIComponent(last);
    } catch (_) {
    }
    return last.slice(0, 180);
  }
  function parseProblem(value, optionalTitle) {
    const raw = value.trim();
    const match2 = raw.match(/https?:\/\/\S+/i);
    if (!match2) throw new Error("粘贴题目链接后再添加。");
    const url = safeURL2(match2[0]);
    const pastedTitle = raw.replace(match2[0], "").trim().replace(/^[|·—\-\s]+|[|·—\-\s]+$/g, "");
    const title = optionalTitle.trim() || pastedTitle || problemTitle(url);
    if (title.length > 180) throw new Error("题目名称请控制在 180 字以内。");
    return { url, title };
  }
  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad2 = (part, length = 2) => String(part).padStart(length, "0");
    const base = `${pad2(date.getFullYear(), 4)}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    return date.getSeconds() || date.getMilliseconds() ? `${base}:${pad2(date.getSeconds())}${date.getMilliseconds() ? `.${pad2(date.getMilliseconds(), 3)}` : ""}` : base;
  }
  function toISO(value) {
    if (!value) return "";
    const date = new Date(value);
    const parts2 = value.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    const expected = parts2 && [Number(parts2[1]), Number(parts2[2]) - 1, Number(parts2[3]), Number(parts2[4]), Number(parts2[5]), Number(parts2[6] || 0), Number((parts2[7] || "").padEnd(3, "0"))];
    const actual = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
    if (!expected || Number.isNaN(date.getTime()) || actual.some((part, index) => part !== expected[index])) throw new Error("截止时间无效，请重新选择。");
    return date.toISOString();
  }
  function dueTime(item) {
    const time2 = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
    return Number.isNaN(time2) ? Infinity : time2;
  }
  function deadline(item) {
    if (!item.dueAt || !Number.isFinite(dueTime(item))) return { text: "无截止时间", overdue: false };
    const date = new Date(item.dueAt);
    const delta = date.getTime() - Date.now();
    const minutes = Math.max(1, Math.ceil(Math.abs(delta) / 6e4));
    const span = minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.ceil(minutes / 60)} 小时` : `${Math.ceil(minutes / 1440)} 天`;
    const overdue = !item.done && delta < 0;
    const now = /* @__PURE__ */ new Date();
    const absolute = date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    const calendar = sameDay ? `今天 ${clock}` : `${date.getFullYear() !== now.getFullYear() ? `${date.getFullYear()}/` : ""}${date.getMonth() + 1}/${date.getDate()} ${clock}`;
    return { text: item.done ? `截止 ${calendar}` : `${calendar} · ${overdue ? `已逾期 ${span}` : `${span}后截止`}`, title: absolute, overdue };
  }
  function updateBusy(value) {
    busy = value;
    for (const area of [root, dialog2]) {
      if (!area) continue;
      area.setAttribute("aria-busy", String(value));
      area.querySelectorAll("button,input,textarea").forEach((node3) => {
        node3.disabled = value;
      });
    }
  }
  async function mutate2(action2, payload, errorNode, success) {
    if (busy) return false;
    showError2(errorNode, "");
    updateBusy(true);
    let next;
    try {
      if (typeof bridge2?.plannerAction !== "function") throw new Error("计划暂不可用，请稍后重试。");
      next = await bridge2.plannerAction(...[action2, payload]);
      if (!next || !Array.isArray(next.problems) || !Array.isArray(next.tasks)) throw new Error("保存结果无效，请重试。");
    } catch (error) {
      showError2(errorNode, errorText2(error));
      updateBusy(false);
      return false;
    }
    updateBusy(false);
    if (success) success();
    deleteTarget = "";
    render2(next);
    try {
      if (typeof onChange === "function") onChange(state2);
    } catch (error) {
      console.error("Planner onChange failed", error);
    }
    document.dispatchEvent(new CustomEvent("planner:change", { detail: state2 }));
    return true;
  }
  function createCard(kind, title, caption) {
    const card = el("section", `planner-card planner-${kind}`);
    const heading = el("div", "planner-heading");
    const titleGroup = el("div", "planner-title-group");
    const h2 = el("h2", "", title);
    h2.id = `planner-${kind}-title`;
    card.setAttribute("aria-labelledby", h2.id);
    const count = el("span", "planner-count");
    titleGroup.append(h2, count);
    heading.append(titleGroup, el("span", "planner-caption", caption));
    const form = el("form", `planner-add planner-add-${kind}`);
    form.noValidate = true;
    form.setAttribute("aria-label", kind === "problems" ? "添加待做题目" : "添加待办事项");
    const error = el("p", "planner-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const list = el("div", "planner-list");
    list.id = `planner-${kind}-list`;
    list.tabIndex = 0;
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", kind === "problems" ? "待做题单，可向下滚动" : "学习任务，可向下滚动");
    const more = button2("收起 ▴", "planner-list-toggle", () => {
      collapsed[kind] = !collapsed[kind];
      drawCard(kind);
      more.focus();
    });
    more.setAttribute("aria-controls", list.id);
    heading.lastChild.remove();
    heading.append(more);
    const completed = el("details", "planner-completed");
    const summary = el("summary");
    const doneList = el("div", "planner-list planner-done-list");
    completed.append(summary, doneList);
    completed.addEventListener("toggle", () => {
      completedOpen[kind] = completed.open;
    });
    const hint = el("p", "planner-scroll-hint", "向下滚动查看全部");
    hint.hidden = true;
    card.append(heading, form, error, list, hint, completed);
    const refs = { card, count, form, error, list, more, hint, completed, summary, doneList };
    cards[kind] = refs;
    return refs;
  }
  function build() {
    root = el("div", "planner-root");
    const problems = createCard("problems", "待做题目", "随手存下，稍后再做");
    const url = field("题目链接，可附题目名称", "url", "text", "粘贴题目链接", 2400);
    url.input.autocomplete = "off";
    url.input.spellcheck = false;
    const title = field("题目名称（可选，留空使用题号）", "title", "text", "名称（可选）", 180);
    const addProblem = el("button", "planner-add-button", "添加");
    addProblem.type = "submit";
    problems.form.append(url.wrap, title.wrap, addProblem);
    problems.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      try {
        const payload = parseProblem(url.input.value, title.input.value);
        await mutate2("addProblem", payload, problems.error, () => {
          url.input.value = "";
          title.input.value = "";
          url.input.focus();
        });
      } catch (error) {
        showError2(problems.error, errorText2(error));
        url.input.focus();
      }
    });
    const tasks = createCard("tasks", "学习任务", "把下一步写下来");
    const taskTitle = field("待办标题", "title", "text", "添加一项待办", 180);
    const due = field("截止时间（可选，使用本机时区）", "dueAt", "datetime-local", "");
    due.input.step = "any";
    due.input.title = "截止时间（可选，使用本机时区）";
    const deadlinePicker = Deadline?.enhance(due.input);
    due.wrap.classList.add("planner-deadline-field");
    const addTask = el("button", "planner-add-button", "添加");
    addTask.type = "submit";
    tasks.form.append(taskTitle.wrap, due.wrap, addTask);
    tasks.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      try {
        const titleValue = taskTitle.input.value.trim();
        if (!titleValue) throw new Error("先写下要做的事。");
        if (titleValue.length > 180) throw new Error("标题请控制在 180 字以内。");
        if (due.input.validity.badInput) throw new Error("请填写完整的截止时间，或留空。");
        const dueAt = toISO(due.input.value);
        await mutate2("addTask", { title: titleValue, details: "", dueAt }, tasks.error, () => {
          taskTitle.input.value = "";
          due.input.value = "";
          deadlinePicker?.refresh();
          taskTitle.input.focus();
        });
      } catch (error) {
        showError2(tasks.error, errorText2(error));
        taskTitle.input.focus();
      }
    });
    root.append(problems.card, tasks.card);
    buildDialog();
  }
  function captureFocus() {
    const active3 = document.activeElement;
    if (!active3 || !root.contains(active3)) return null;
    return { kind: active3.closest("[data-kind]")?.dataset.kind, id: active3.closest("[data-id]")?.dataset.id, action: active3.dataset.action };
  }
  function restoreFocus(focus) {
    if (!focus?.action) return;
    const card = cards[focus.kind];
    if (!card) return;
    const row2 = Array.from(card.card.querySelectorAll("[data-id]")).find((node3) => node3.dataset.id === focus.id);
    const target = row2 && Array.from(row2.querySelectorAll("[data-action]")).find((node3) => node3.dataset.action === focus.action);
    if (target && !target.closest("details:not([open])")) target.focus();
    else card.form.querySelector("input").focus();
  }
  function row(kind, item) {
    const refs = cards[kind];
    const node3 = el("div", `planner-row${item.done ? " is-done" : ""}`);
    node3.dataset.id = String(item.id);
    node3.dataset.kind = kind;
    const checkbox = el("input", "planner-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);
    checkbox.dataset.action = "done";
    checkbox.setAttribute("aria-label", `${item.done ? "标为未完成" : "标为完成"}：${item.title}`);
    checkbox.addEventListener("change", async () => {
      const done = checkbox.checked;
      checkbox.checked = Boolean(item.done);
      await mutate2(kind === "problems" ? "updateProblem" : "updateTask", { id: item.id, done }, refs.error);
    });
    const copy = el("div", "planner-row-copy");
    if (kind === "problems") {
      let url;
      try {
        url = safeURL2(item.url);
      } catch (_) {
      }
      const name = el(url ? "a" : "span", "planner-row-title", item.title || (url ? problemTitle(url) : "题目"));
      if (url) {
        name.href = url;
        name.title = url;
        name.dataset.action = "open";
        name.addEventListener("click", async (event) => {
          event.preventDefault();
          if (busy) return;
          try {
            if (typeof bridge2?.openExternal !== "function") throw new Error("暂时无法打开链接。");
            await bridge2.openExternal(url);
          } catch (error) {
            showError2(refs.error, errorText2(error));
          }
        });
      }
      copy.append(name);
      if (url) copy.append(el("span", "planner-row-meta", new URL(url).hostname.replace(/^www\./, "")));
    } else {
      const name = button2(item.title, "planner-row-title planner-task-title", () => openTaskDetail(item));
      name.dataset.action = "view";
      copy.append(name);
      const due = deadline(item);
      const meta = el("span", `planner-row-meta${due.overdue ? " is-overdue" : ""}`, due.text);
      if (due.title) meta.title = due.title;
      copy.append(meta);
      if (item.details) copy.append(el("span", "planner-row-details", item.details));
    }
    const actions = el("div", "planner-row-actions");
    const edit = button2("编辑", "planner-row-button", () => openEditor(kind, item));
    edit.dataset.action = "edit";
    edit.setAttribute("aria-label", `编辑：${item.title}`);
    const key = `${kind}:${item.id}`;
    const deleting = deleteTarget === key;
    const remove = button2(deleting ? "确认删除" : "删除", `planner-row-button${deleting ? " planner-danger" : ""}`, async () => {
      if (deleteTarget !== key) {
        deleteTarget = key;
        drawCard(kind);
        const replacement = Array.from(refs.card.querySelectorAll("[data-id]")).find((value) => value.dataset.id === String(item.id));
        replacement?.querySelector('[data-action="delete"]')?.focus();
        return;
      }
      await mutate2(kind === "problems" ? "deleteProblem" : "deleteTask", { id: item.id }, refs.error);
    });
    remove.dataset.action = "delete";
    remove.setAttribute("aria-label", `${deleting ? "确认删除" : "删除"}：${item.title}`);
    actions.append(edit, remove);
    if (deleting) {
      const cancel = button2("取消", "planner-row-button", () => {
        deleteTarget = "";
        drawCard(kind);
      });
      cancel.dataset.action = "cancel-delete";
      actions.append(cancel);
    }
    node3.append(checkbox, copy, actions);
    return node3;
  }
  function drawCard(kind) {
    const refs = cards[kind];
    const items = state2[kind];
    const pending2 = items.filter((item) => !item.done);
    if (kind === "tasks") pending2.sort((a, b) => {
      const left = dueTime(a), right = dueTime(b);
      return left === right ? 0 : left < right ? -1 : 1;
    });
    const done = items.filter((item) => item.done);
    const overdue = kind === "tasks" ? pending2.filter((item) => dueTime(item) < Date.now()).length : 0;
    refs.count.textContent = `${pending2.length} 项待办${overdue ? ` · ${overdue} 项逾期` : ""}`;
    if (kind === "problems") refs.count.textContent = `${pending2.length} 题待做`;
    const scrollTop = refs.list.scrollTop;
    refs.list.replaceChildren(...pending2.map((item) => row(kind, item)));
    if (!pending2.length) refs.list.append(el("p", "planner-empty", kind === "problems" ? "暂无待做题目，粘贴链接即可添加。" : "暂无待办，记下接下来要做的事。"));
    refs.list.hidden = collapsed[kind];
    refs.list.scrollTop = scrollTop;
    refs.more.textContent = collapsed[kind] ? `展开 ${pending2.length} ${kind === "problems" ? "题" : "项"} ▾` : "收起 ▴";
    refs.more.setAttribute("aria-expanded", String(!collapsed[kind]));
    refs.hint.hidden = collapsed[kind] || pending2.length <= 3;
    refs.completed.hidden = !done.length;
    refs.summary.textContent = `已完成 ${done.length} ${kind === "problems" ? "题" : "项"}`;
    refs.completed.open = completedOpen[kind];
    refs.doneList.replaceChildren(...done.map((item) => row(kind, item)));
    if (busy) refs.card.querySelectorAll("button,input,textarea").forEach((node3) => {
      node3.disabled = true;
    });
  }
  function buildDialog() {
    dialog2 = el("dialog", "planner-dialog");
    dialog2.setAttribute("aria-labelledby", "planner-editor-title");
    const form = el("form", "planner-editor");
    form.noValidate = true;
    const heading = el("div", "planner-dialog-heading");
    const title = el("h2", "", "编辑待办");
    title.id = "planner-editor-title";
    const close = button2("×", "planner-dialog-close", () => dialog2.close());
    close.setAttribute("aria-label", "关闭编辑");
    heading.append(title, close);
    const titleField = field("标题", "title", "text", "", 180);
    const url = field("题目链接", "url", "url", "https://…", 2400);
    const details = field("补充说明（可选，最多 2000 字）", "details", "textarea", "补充步骤、备忘或资料…", 2e3);
    details.input.rows = 5;
    const due = field("截止时间（可选，本机时区）", "dueAt", "datetime-local", "");
    due.input.step = "any";
    const deadlinePicker = Deadline?.enhance(due.input);
    [titleField, url, details, due].forEach((value) => {
      value.wrap.firstChild.className = "planner-editor-label";
    });
    const error = el("p", "planner-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const footer = el("div", "planner-dialog-footer");
    const cancel = button2("取消", "planner-dialog-button", () => dialog2.close());
    const save = el("button", "planner-add-button", "保存");
    save.type = "submit";
    footer.append(cancel, save);
    form.append(heading, titleField.wrap, url.wrap, details.wrap, due.wrap, error, footer);
    dialog2.append(form);
    editor = { form, heading: title, title: titleField, url, details, due, deadlinePicker, error, item: null, kind: null, initialLocal: "" };
    dialog2.addEventListener("cancel", (event) => {
      if (busy) event.preventDefault();
    });
    dialog2.addEventListener("close", () => {
      if (lastFocus?.isConnected) lastFocus.focus();
      else if (editor.kind && cards[editor.kind]) cards[editor.kind].form.querySelector("input").focus();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !editor.item) return;
      try {
        const titleValue = editor.title.input.value.trim();
        if (!titleValue) throw new Error("标题不能为空。");
        if (titleValue.length > 180) throw new Error("标题请控制在 180 字以内。");
        let payload;
        if (editor.kind === "problems") payload = { id: editor.item.id, title: titleValue, url: safeURL2(editor.url.input.value) };
        else {
          if (editor.details.input.value.length > 2e3) throw new Error("补充说明请控制在 2000 字以内。");
          if (editor.due.input.validity.badInput) throw new Error("请填写完整的截止时间，或留空。");
          const dueAt = editor.due.input.value === editor.initialLocal ? editor.item.dueAt || "" : toISO(editor.due.input.value);
          payload = { id: editor.item.id, title: titleValue, details: editor.details.input.value, dueAt };
        }
        await mutate2(editor.kind === "problems" ? "updateProblem" : "updateTask", payload, editor.error, () => dialog2.close());
      } catch (error2) {
        showError2(editor.error, errorText2(error2));
      }
    });
  }
  function openTaskDetail(item) {
    if (busy || dialog2.open) return;
    const origin = document.activeElement;
    const detail = el("dialog", "planner-dialog planner-task-detail");
    detail.setAttribute("aria-labelledby", "planner-task-detail-title");
    const heading = el("div", "planner-dialog-heading");
    const title = el("h2", "", item.title || "学习任务");
    title.id = "planner-task-detail-title";
    const close = button2("×", "planner-dialog-close", () => detail.close());
    close.setAttribute("aria-label", "关闭任务详情");
    heading.append(title, close);
    const due = deadline(item);
    const deadlineBlock = el("section", "planner-detail-deadline");
    deadlineBlock.append(el("h3", "", "截止时间"), el("p", "", item.dueAt ? new Date(item.dueAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "未设置截止时间"));
    if (item.dueAt) deadlineBlock.append(el("span", `planner-row-meta${due.overdue ? " is-overdue" : ""}`, due.text));
    const description = el("section", "planner-detail-description");
    description.append(el("h3", "", "任务说明"), el("p", "", item.details || "暂无说明"));
    const footer = el("div", "planner-dialog-footer");
    footer.append(button2("关闭", "planner-dialog-button", () => detail.close()));
    detail.append(heading, deadlineBlock, description, footer);
    detail.addEventListener("close", () => {
      detail.remove();
      if (origin?.isConnected) origin.focus();
    }, { once: true });
    document.body.append(detail);
    detail.showModal();
    close.focus();
  }
  function openEditor(kind, item) {
    if (busy || dialog2.open) return;
    lastFocus = document.activeElement;
    editor.kind = kind;
    editor.item = { ...item };
    editor.heading.textContent = kind === "problems" ? "编辑题目" : "编辑待办";
    editor.title.input.value = item.title || "";
    editor.url.input.value = item.url || "";
    editor.details.input.value = item.details || "";
    editor.due.input.value = localDate(item.dueAt);
    editor.initialLocal = editor.due.input.value;
    editor.deadlinePicker?.refresh();
    editor.url.wrap.hidden = kind !== "problems";
    editor.details.wrap.hidden = kind !== "tasks";
    editor.due.wrap.hidden = kind !== "tasks";
    showError2(editor.error, "");
    dialog2.showModal();
    editor.title.input.focus();
  }
  function attach() {
    const host = document.getElementById("home-planner");
    if (!host) return false;
    if (!root) build();
    if (root.parentNode !== host) host.append(root);
    if (!dialog2.isConnected) document.body.append(dialog2);
    if (!mounted) {
      mounted = true;
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && deleteTarget && !busy) {
          deleteTarget = "";
          render2(state2);
        }
      });
    }
    return true;
  }
  function render2(next) {
    if (next && typeof next === "object") {
      const raw = next;
      state2 = { ...raw, problems: Array.isArray(raw.problems) ? raw.problems : [], tasks: Array.isArray(raw.tasks) ? raw.tasks : [], layout: raw.layout || "balanced" };
    }
    if (!attach()) return;
    const focus = captureFocus();
    drawCard("problems");
    drawCard("tasks");
    restoreFocus(focus);
  }
  var Planner = {
    init(options = {}) {
      bridge2 = options.bridge;
      onChange = options.onChange;
      attach();
      return Planner;
    },
    render: render2
  };

  // src/renderer/home/contests.ts
  function create({ demo, getSettings, setSettings, getView, getLoading, canRefresh, call, writeDemo, toast, errorMessage, openExternal }) {
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.forEach((child) => {
        if (child) parent.append(child);
      });
      return parent;
    }
    function button8(label, className, action2) {
      const node3 = element5("button", className, label);
      node3.type = "button";
      node3.addEventListener("click", action2);
      return node3;
    }
    const contestPlatforms = [
      { id: "luogu", name: "洛谷", url: "https://www.luogu.com.cn/contest/list" },
      { id: "codeforces", name: "Codeforces", url: "https://codeforces.com/contests" },
      { id: "atcoder", name: "AtCoder", url: "https://atcoder.jp/contests/" },
      { id: "nowcoder", name: "牛客", url: "https://ac.nowcoder.com/acm/contest/vip-index" }
    ];
    let contestData = null, contestsPending = false, contestsFailed = false, contestSignature = "", contestPreferencePending = false;
    let contestRestoreEntries = [], contestRestoreSelection = /* @__PURE__ */ new Set();
    const contestRefreshPeriod = 10 * 60 * 1e3;
    let lastContestAttempt = null, contestRefreshTimer;
    const contestTimeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    let started = false;
    function acceptContests(payload) {
      if (!payload || !Array.isArray(payload.platforms)) return false;
      const incoming = payload;
      const previous = contestData;
      contestData = { ...incoming, platforms: contestPlatforms.map((platform) => {
        const source = incoming.platforms.find((item) => item?.id === platform.id);
        if (!source) return previous?.platforms.find((item) => item.id === platform.id) || { ...platform, contests: [], updatedAt: null, stale: false, error: null };
        const old = previous?.platforms.find((item) => item.id === platform.id);
        const contests = Array.isArray(source.contests) ? source.contests : [];
        return { ...platform, ...source, contests: source.error && !contests.length && old?.contests.length ? old.contests : contests, updatedAt: source.updatedAt || (source.error ? old?.updatedAt : null), stale: !!source.stale || !!source.error };
      }) };
      return true;
    }
    function contestTimestamp(value) {
      const time2 = typeof value === "string" ? Date.parse(value) : NaN;
      return Number.isFinite(time2) ? time2 : null;
    }
    function contestTime(value) {
      const time2 = contestTimestamp(value);
      return time2 === null ? "暂无更新时间" : contestTimeFormat.format(time2);
    }
    function contestDuration(milliseconds) {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1e3));
      const days = Math.floor(seconds / 86400), hours = Math.floor(seconds / 3600) % 24, minutes = Math.floor(seconds / 60) % 60, rest = seconds % 60;
      return `${days ? `${days}天 ` : ""}${days || hours ? `${hours}小时 ` : ""}${days || hours || minutes ? `${minutes}分 ` : ""}${rest}秒`;
    }
    function atcoderContestType(platformId, contest) {
      if (platformId !== "atcoder") return null;
      const definitions = [
        ["ABC", "AtCoder Beginner Contest"],
        ["ARC", "AtCoder Regular Contest"],
        ["AGC", "AtCoder Grand Contest"],
        ["AHC", "AtCoder Heuristic Contest"]
      ];
      const idType = /^(abc|arc|agc|ahc)\d+$/i.exec(String(contest.id || ""))?.[1].toUpperCase();
      const definition = definitions.find(([type]) => type === idType) || definitions.find(([, name]) => String(contest.title || "").toLowerCase().includes(name.toLowerCase()));
      return definition ? { label: definition[0], name: definition[1] } : null;
    }
    function contestTypeBadge(platformId, contest) {
      const type = atcoderContestType(platformId, contest);
      if (!type) return null;
      const badge = element5("span", "contest-type-badge", type.label);
      badge.title = type.name;
      badge.setAttribute("aria-label", `${type.label} · ${type.name}`);
      return badge;
    }
    function contestKey(platformId, contestId) {
      return `${platformId}:${String(contestId)}`;
    }
    function optedOutContests() {
      const settings = getSettings();
      return Array.isArray(settings?.contestOptOuts) ? settings.contestOptOuts.map(String) : [];
    }
    function isContestOptedOut(platformId, contestId) {
      return optedOutContests().includes(contestKey(platformId, contestId));
    }
    async function setContestOptOut(platformId, contestId, optedOut) {
      if (contestPreferencePending) return;
      contestPreferencePending = true;
      const key = contestKey(platformId, contestId), previous = optedOutContests();
      const next = optedOut ? [.../* @__PURE__ */ new Set([...previous, key])] : previous.filter((item) => item !== key);
      setSettings({ ...getSettings(), contestOptOuts: next });
      renderContestCards();
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { ...getSettings() });
        toast(optedOut ? "已标记为不参加，比赛已隐藏" : "已恢复这场比赛");
      } catch (error) {
        setSettings({ ...getSettings(), contestOptOuts: previous });
        renderContestCards();
        toast(`比赛偏好未保存：${errorMessage(error)}`);
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
      }
    }
    function visibleContests(platform, now) {
      return (platform?.contests || []).map((contest) => ({ ...contest, start: contestTimestamp(contest.startTime), end: contestTimestamp(contest.endTime) })).filter((contest) => contest.start !== null && contest.end !== null && contest.end > contest.start && contest.end > now && !isContestOptedOut(platform.id, contest.id)).sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id))).slice(0, 3);
    }
    function contestLink(label, url, className, focusKey) {
      const link = element5("a", className, label);
      link.href = url;
      link.dataset.contestFocus = focusKey;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void openExternal(url);
      });
      return link;
    }
    function updateContestStatus() {
      const refresh = $("#contests-refresh"), status = $("#contests-status");
      if (!refresh || !status) return;
      const available = canRefresh();
      refresh.disabled = contestsPending || !available;
      refresh.textContent = contestsPending ? "刷新中…" : "刷新赛程";
      refresh.setAttribute("aria-busy", String(contestsPending));
      status.classList.toggle("contest-status-error", contestsFailed);
      status.textContent = !available ? contestData ? "当前客户端暂不支持刷新赛程，正在显示已保存的安排。请以官方赛程为准。" : "当前预览或客户端未提供赛程，暂无可用日程。可前往各平台查看官方安排。" : contestsPending ? contestData ? "正在更新赛程，先显示已保存的安排。" : "正在获取各平台赛程…" : contestsFailed ? contestData ? "赛程刷新失败，已保留上次安排。请稍后重试，或查看官方赛程。" : "赛程获取失败，暂无可用日程。请稍后重试，或查看官方赛程。" : contestData ? "已显示最近的进行中与即将开始比赛；赛程以官方安排为准。" : "暂无可用赛程，请刷新或查看官方安排。";
    }
    function updateContestPreferenceControls() {
      const restore = $("#contests-restore");
      if (restore) {
        const count = optedOutContests().length;
        restore.hidden = count === 0;
        restore.disabled = contestPreferencePending;
        restore.textContent = `已隐藏 ${count} 场 · 恢复`;
      }
      $$(".contest-decline").forEach((node3) => {
        node3.disabled = contestPreferencePending;
      });
    }
    function mergedContests(now) {
      return contestPlatforms.flatMap((platform) => visibleContests(contestData?.platforms.find((item) => item.id === platform.id), now).map((contest) => ({ ...contest, platform }))).sort((a, b) => Number(b.start <= now) - Number(a.start <= now) || a.start - b.start || a.platform.id.localeCompare(b.platform.id) || String(a.id).localeCompare(String(b.id)));
    }
    function renderContestCards(now = Date.now()) {
      const grid = $("#contest-platforms");
      if (!grid) return;
      const activeFocusNode = grid.contains(document.activeElement) ? document.activeElement : null;
      const focus = activeFocusNode?.dataset.contestFocus || null;
      grid.replaceChildren();
      const sources2 = element5("div", "contest-sources");
      for (const platform of contestPlatforms) {
        const source = contestData?.platforms.find((item) => item.id === platform.id);
        const items2 = visibleContests(source, now);
        const chip = element5("div", "contest-source");
        chip.dataset.platform = platform.id;
        const status = !source ? "尚未获取" : source.error ? items2.length ? "更新失败 · 保留赛程" : "获取失败" : source.stale ? "缓存待更新" : items2.length ? "已更新" : "暂无赛程";
        chip.title = `${platform.name} · ${status} · ${source?.updatedAt ? `更新于 ${contestTime(source.updatedAt)} · 北京时间` : "尚无成功更新时间"}`;
        append(chip, contestLink(`${platform.name} ↗`, platform.url, "contest-official-link", `${platform.id}:official`), element5("span", `contest-source-status${source?.error ? " is-error" : source?.stale ? " is-stale" : ""}`, status));
        sources2.append(chip);
      }
      const list = element5("div", "contest-list");
      const items = mergedContests(now);
      for (const contest of items) {
        const { platform } = contest, active3 = contest.start <= now;
        const row2 = element5("article", `contest-card${active3 ? " is-active" : ""}`);
        row2.dataset.platform = platform.id;
        row2.dataset.contestId = String(contest.id);
        const label = element5("span", "contest-phase", active3 ? "正在进行" : "即将开始");
        const title = contestLink(contest.title || "未命名比赛", contest.url, "contest-title", `${platform.id}:${contest.id}`);
        title.title = contest.title;
        const start2 = element5("time", "", contestTime(contest.startTime));
        start2.dateTime = contest.startTime;
        start2.title = `开始 ${contestTime(contest.startTime)} · 结束 ${contestTime(contest.endTime)} · 北京时间`;
        const schedule = element5("span", "contest-schedule");
        schedule.append(start2);
        const countdown = element5("span", "contest-countdown");
        countdown.dataset.target = String(active3 ? contest.end : contest.start);
        countdown.dataset.phase = active3 ? "active" : "upcoming";
        countdown.textContent = `${active3 ? "距结束" : "距开始"} ${contestDuration(Number(countdown.dataset.target) - now)}`;
        const duration = element5("span", "contest-duration", `赛时 ${contestDuration(contest.end - contest.start).replace(/ 0秒$/, "").trim()}`);
        const decline = button8("不参加", "contest-decline", () => {
          void setContestOptOut(platform.id, contest.id, true);
        });
        decline.dataset.contestFocus = `${platform.id}:${contest.id}:decline`;
        decline.setAttribute("aria-label", `不参加：${contest.title}`);
        const titleGroup = append(element5("span", "contest-title-group"), contestTypeBadge(platform.id, contest), title);
        append(row2, element5("span", "contest-platform-label", platform.name), titleGroup, label, schedule, duration, countdown, decline);
        list.append(row2);
      }
      if (!items.length) list.append(element5("p", "contest-empty", contestsPending ? "正在载入比赛…" : "暂无可显示的比赛，可通过上方平台链接查看官方赛程。"));
      grid.append(sources2, list);
      contestSignature = JSON.stringify(items.map((contest) => [contest.platform.id, contest.id, contest.start <= now ? "active" : "upcoming"]));
      updateContestPreferenceControls();
      if (focus) {
        const target = $$("[data-contest-focus]", grid).find((node3) => node3.dataset.contestFocus === focus) || $$("[data-contest-focus]", grid).find((node3) => node3.dataset.contestFocus === `${focus.split(":")[0]}:official`);
        target?.focus({ preventScroll: true });
      }
    }
    function tickContests() {
      if (getView() !== "home" || !$("#contest-platforms")) return;
      const now = Date.now();
      const signature = JSON.stringify(mergedContests(now).map((contest) => [contest.platform.id, contest.id, contest.start <= now ? "active" : "upcoming"]));
      if (signature !== contestSignature) {
        renderContestCards(now);
        return;
      }
      $$(".contest-countdown").forEach((node3) => {
        node3.textContent = `${node3.dataset.phase === "active" ? "距结束" : "距开始"} ${contestDuration(Number(node3.dataset.target) - now)}`;
      });
    }
    function refreshVisibleContests() {
      if (getLoading() || getView() !== "home" || document.hidden || !canRefresh()) return;
      if (lastContestAttempt === null || Date.now() - lastContestAttempt >= contestRefreshPeriod) void refreshContests(false);
    }
    async function refreshContests(force = false) {
      if (contestsPending || !canRefresh()) return;
      lastContestAttempt = Date.now();
      clearTimeout(contestRefreshTimer);
      contestsPending = true;
      contestsFailed = false;
      updateContestStatus();
      try {
        const payload = await call("getContests", force);
        if (!acceptContests(payload)) throw new Error("Invalid schedule");
      } catch (_) {
        contestsFailed = true;
      } finally {
        contestsPending = false;
        contestRefreshTimer = setTimeout(refreshVisibleContests, contestRefreshPeriod);
        if (getView() === "home") {
          updateContestStatus();
          renderContestCards();
        }
      }
    }
    function hiddenContestEntries() {
      return [...new Set(optedOutContests())].map((key) => {
        const separator = key.indexOf(":"), platformId = key.slice(0, separator), id = key.slice(separator + 1);
        const platform = contestPlatforms.find((item) => item.id === platformId) || { id: platformId, name: platformId };
        const contest = contestData?.platforms.find((source) => source.id === platformId)?.contests.find((item) => String(item.id) === id);
        return { ...contest, id, platform, key, start: contestTimestamp(contest?.startTime), end: contestTimestamp(contest?.endTime) };
      }).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || a.platform.id.localeCompare(b.platform.id) || a.id.localeCompare(b.id));
    }
    function updateContestRestoreCount() {
      const count = $("#contest-restore-count");
      if (count) count.textContent = `已选择 ${contestRestoreSelection.size} 场`;
      const confirm = $("#contest-restore-confirm");
      if (confirm) confirm.disabled = contestPreferencePending || contestRestoreSelection.size === 0;
      ["contest-restore-all", "contest-restore-none", "contest-restore-close", "contest-restore-cancel"].forEach((id) => {
        const node3 = $("#" + id);
        if (node3) node3.disabled = contestPreferencePending;
      });
      $$("#contest-restore-options input").forEach((node3) => {
        node3.disabled = contestPreferencePending;
      });
    }
    function renderContestRestoreOptions() {
      const options = $("#contest-restore-options");
      if (!options) return;
      options.replaceChildren();
      for (const entry2 of contestRestoreEntries) {
        const label = element5("label", "contest-restore-option");
        const checkbox = element5("input");
        checkbox.type = "checkbox";
        checkbox.value = entry2.key;
        checkbox.checked = contestRestoreSelection.has(entry2.key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) contestRestoreSelection.add(entry2.key);
          else contestRestoreSelection.delete(entry2.key);
          updateContestRestoreCount();
        });
        const text3 = element5("span", "contest-restore-option-copy");
        const details = entry2.start !== null && entry2.end !== null && entry2.end > entry2.start ? `${contestTime(entry2.startTime)} · 赛时 ${contestDuration(entry2.end - entry2.start).replace(/ 0秒$/, "").trim()}${entry2.end <= Date.now() ? " · 已结束" : ""}` : "暂无赛程详情（可恢复隐藏偏好）";
        const heading = append(element5("span", "contest-restore-option-heading"), contestTypeBadge(entry2.platform.id, entry2), element5("strong", "", `${entry2.platform.name} · ${entry2.title || `比赛 ${entry2.id}`}`));
        append(text3, heading, element5("small", "", details));
        label.title = `${entry2.platform.name} · ${entry2.title || `比赛 ${entry2.id}`}`;
        append(label, checkbox, text3);
        options.append(label);
      }
      if (!contestRestoreEntries.length) options.append(element5("p", "contest-empty", "当前缓存中找不到已隐藏的比赛，刷新赛程后再试。"));
      updateContestRestoreCount();
    }
    function openContestRestore() {
      if (contestPreferencePending) return;
      contestRestoreEntries = hiddenContestEntries();
      contestRestoreSelection = new Set(contestRestoreEntries.map((entry2) => entry2.key));
      $("#contest-restore-error").hidden = true;
      renderContestRestoreOptions();
      $("#contest-restore-dialog").showModal();
    }
    async function restoreSelectedContests() {
      if (contestPreferencePending) return;
      const selected2 = new Set(contestRestoreSelection);
      if (!selected2.size) return;
      contestPreferencePending = true;
      const previous = optedOutContests();
      const next = previous.filter((key) => !selected2.has(key));
      setSettings({ ...getSettings(), contestOptOuts: next });
      renderContestCards();
      updateContestRestoreCount();
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { ...getSettings() });
        $("#contest-restore-dialog").close();
        toast(`已恢复 ${selected2.size} 场比赛`);
      } catch (error) {
        setSettings({ ...getSettings(), contestOptOuts: previous });
        renderContestCards();
        const errorNode = $("#contest-restore-error");
        errorNode.textContent = `比赛偏好未保存：${errorMessage(error)}`;
        errorNode.hidden = false;
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
        updateContestRestoreCount();
      }
    }
    function renderHomeContests() {
      const panel = element5("section", "home-contests");
      panel.setAttribute("aria-labelledby", "contests-title");
      const title = element5("h2", "", "比赛提醒");
      title.id = "contests-title";
      const refresh = button8("刷新赛程", "button secondary", () => {
        void refreshContests(true);
      });
      refresh.id = "contests-refresh";
      const restore = button8("", "button subtle contest-restore", openContestRestore);
      restore.id = "contests-restore";
      const actions = append(element5("div", "contest-actions"), restore, refresh);
      const status = element5("p", "contests-status");
      status.id = "contests-status";
      status.setAttribute("role", "status");
      const grid = element5("div", "contest-platforms");
      grid.id = "contest-platforms";
      append(panel, append(element5("div", "contests-heading"), append(element5("div"), element5("div", "eyebrow", "CONTEST COUNTDOWN"), title, element5("p", "contest-timezone", "所有时间均为北京时间（UTC+8）")), actions), status, grid);
      return panel;
    }
    function closeContestRestore() {
      $("#contest-restore-dialog").close();
    }
    function selectAllContestRestore() {
      contestRestoreSelection = new Set(contestRestoreEntries.map((entry2) => entry2.key));
      renderContestRestoreOptions();
    }
    function selectNoContestRestore() {
      contestRestoreSelection.clear();
      renderContestRestoreOptions();
    }
    function cancelContestRestore(event) {
      if (contestPreferencePending) event.preventDefault();
    }
    function start() {
      if (started) return;
      started = true;
      $("#contest-restore-close").addEventListener("click", closeContestRestore);
      $("#contest-restore-cancel").addEventListener("click", closeContestRestore);
      $("#contest-restore-all").addEventListener("click", selectAllContestRestore);
      $("#contest-restore-none").addEventListener("click", selectNoContestRestore);
      $("#contest-restore-confirm").addEventListener("click", () => {
        void restoreSelectedContests();
      });
      $("#contest-restore-dialog").addEventListener("cancel", cancelContestRestore);
      setInterval(tickContests, 1e3);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          tickContests();
          refreshVisibleContests();
        }
      });
      window.addEventListener("focus", () => {
        tickContests();
        refreshVisibleContests();
      });
    }
    return { acceptContests, renderHomeContests, updateContestStatus, updateContestPreferenceControls, renderContestCards, tickContests, refreshVisibleContests, refreshContests, openContestRestore, restoreSelectedContests, renderContestRestoreOptions, updateContestRestoreCount, closeContestRestore, selectAllContestRestore, selectNoContestRestore, cancelContestRestore, start };
  }
  var HomeContests = Object.freeze({ create });

  // src/renderer/home/daily-problem.ts
  var cachedResult = null;
  var autoDrawStarted = false;
  var sources = [["all", "全部来源"], ["local", "本地题库"], ["public", "公共题库"], ["CF", "Codeforces"], ["LG", "洛谷"], ["AT", "AtCoder"], ["NC", "牛客"], ["LC", "LeetCode"], ["LOJ", "LibreOJ"]];
  var luoguLevels2 = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
  function node2(tag, className = "", text3) {
    const element5 = document.createElement(tag);
    element5.className = className;
    if (text3 !== void 0) element5.textContent = text3;
    return element5;
  }
  function button3(label, className, onClick) {
    const element5 = node2("button", className, label);
    element5.type = "button";
    element5.addEventListener("click", onClick);
    return element5;
  }
  function option(value, label) {
    const element5 = node2("option", "", label);
    element5.value = value;
    return element5;
  }
  function create2({ draw: drawApi, openExternal, chooseTags, updateLibrary, autoDraw = false }) {
    const section = node2("section", "daily-problem");
    section.setAttribute("aria-labelledby", "daily-problem-title");
    const heading = node2("div", "daily-problem-heading"), titleGroup = node2("div", "daily-problem-title-group");
    const title = node2("h2", "", "每日一题");
    title.id = "daily-problem-title";
    titleGroup.append(node2("span", "eyebrow", "DAILY PRACTICE"), title);
    const aside = node2("div", "daily-problem-heading-aside");
    const refresh = button3("刷新题库", "button subtle daily-refresh", () => refreshLibrary());
    refresh.title = "增量更新本地题库索引";
    aside.append(node2("span", "daily-problem-caption", "按今天的状态，抽一道值得做的题"), refresh);
    heading.append(titleGroup, aside);
    const filters = node2("div", "daily-problem-filters");
    const source = node2("select", "daily-filter-source");
    source.setAttribute("aria-label", "题目来源");
    sources.forEach(([value, label]) => source.append(option(value, label)));
    const ratingMin = node2("input", "daily-filter-rating");
    ratingMin.type = "number";
    ratingMin.min = "0";
    ratingMin.max = "3500";
    ratingMin.step = "100";
    ratingMin.placeholder = "Rating ≥";
    ratingMin.setAttribute("aria-label", "最低 Codeforces Rating");
    const ratingMax = node2("input", "daily-filter-rating");
    ratingMax.type = "number";
    ratingMax.min = "0";
    ratingMax.max = "3500";
    ratingMax.step = "100";
    ratingMax.placeholder = "Rating ≤";
    ratingMax.setAttribute("aria-label", "最高 Codeforces Rating");
    const lg = node2("select", "daily-filter-luogu");
    lg.setAttribute("aria-label", "洛谷难度");
    lg.append(option("", "洛谷难度不限"));
    luoguLevels2.forEach((level) => lg.append(option(level, level)));
    let selectedTags = /* @__PURE__ */ new Set();
    const tags = button3("算法标签…", "button secondary daily-filter-tags", () => chooseTags(selectedTags, (selected2) => {
      selectedTags = new Set(selected2);
      tags.textContent = selectedTags.size ? `算法标签…（已选 ${selectedTags.size}）` : "算法标签…";
    }));
    const presetNames = ["动态规划", "图论", "数据结构", "数学", "字符串", "贪心", "二分", "搜索", "树", "构造"];
    const presets = document.createElement("datalist");
    presets.id = `daily-tag-suggestions-${Math.random().toString(36).slice(2)}`;
    presetNames.forEach((tag) => presets.append(option(tag, tag)));
    tags.setAttribute("aria-label", "算法标签");
    tags.setAttribute("aria-haspopup", "dialog");
    filters.append(source, ratingMin, ratingMax, lg, tags, presets);
    const result = node2("article", "daily-problem-result");
    const loading = node2("div", "daily-problem-loading");
    loading.hidden = true;
    loading.setAttribute("role", "status");
    const loadingCopy = node2("div", "daily-loading-copy");
    loadingCopy.append(node2("strong", "", "正在抽题…"), node2("span", "", "正在请求各平台题库，可能需要十几秒"));
    loading.append(node2("span", "daily-loading-spinner"), loadingCopy);
    const error = node2("p", "daily-problem-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const empty = node2("p", "daily-problem-empty", "调整筛选后，试试手气。");
    result.append(empty, loading, error);
    const actions = node2("div", "daily-problem-actions");
    const draw2 = button3("试试手气", "button primary daily-draw", () => drawProblem());
    const change = button3("换一道", "button subtle daily-change", () => drawProblem(true));
    change.hidden = true;
    const easier = button3("− 难度", "button subtle daily-easier", () => shiftDifficulty(-1));
    const harder = button3("＋ 难度", "button subtle daily-harder", () => shiftDifficulty(1));
    const currentDifficulty = node2("span", "daily-current-difficulty", "当前难度：洛谷不限");
    lg.addEventListener("change", updateDifficulty);
    const copy = button3("复制链接", "button subtle daily-copy", () => copyLink());
    copy.hidden = true;
    actions.append(draw2, copy, change, easier, currentDifficulty, harder);
    section.append(heading, filters, result, actions);
    let current = null, busy2 = false;
    function readFilters() {
      return {
        source: source.value || void 0,
        platform: ["CF", "LG", "AT", "NC", "LC", "LOJ"].includes(source.value) ? source.value : void 0,
        ratingMin: ratingMin.value ? Number(ratingMin.value) : void 0,
        ratingMax: ratingMax.value ? Number(ratingMax.value) : void 0,
        luoguDifficulty: lg.value || void 0,
        difficulty: lg.value || void 0,
        tags: [...selectedTags]
      };
    }
    function updateDifficulty() {
      currentDifficulty.textContent = `当前难度：洛谷${lg.value || "不限"}`;
    }
    function shiftDifficulty(delta) {
      lg.selectedIndex = Math.max(0, Math.min(luoguLevels2.length, lg.selectedIndex + delta));
      updateDifficulty();
    }
    function render6(value) {
      current = value.problem;
      cachedResult = value;
      result.replaceChildren();
      const meta = node2("div", "daily-problem-meta");
      meta.append(node2("span", "daily-source", current.source));
      if (current.rating != null) meta.append(node2("span", "daily-rating", `CF ${current.rating}`));
      else if (current.estimatedCfRating != null) meta.append(node2("span", "daily-rating daily-estimated", `CF 估算 ${current.estimatedCfRating}`));
      if (current.luoguDifficulty) meta.append(node2("span", "daily-luogu", `洛谷 ${current.luoguDifficulty}`));
      if (current.estimatedLuoguDifficulty) meta.append(node2("span", "daily-luogu daily-estimated", `洛谷估算 ${current.estimatedLuoguDifficulty}`));
      const footer = node2("div", "daily-problem-footer");
      if (current.id) footer.append(node2("span", "daily-problem-pid", current.id));
      const url = current.url;
      if (url) {
        const link = node2("a", "daily-problem-link", url);
        link.href = url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openExternal(url);
        });
        footer.append(link);
      }
      result.append(node2("strong", "daily-result-label", "抽取结果："), meta, node2("h3", "daily-problem-title", current.title), footer);
      if (current.ratingEstimateReason) result.append(node2("p", "daily-problem-note", current.ratingEstimateReason));
      if (value.note) result.append(node2("p", "daily-problem-note", value.note));
      result.append(loading, error);
      error.hidden = true;
      change.hidden = false;
      copy.hidden = !url;
    }
    function setBusy(value) {
      busy2 = value;
      draw2.disabled = value;
      change.disabled = value;
      loading.hidden = !value;
      if (value) result.dataset.loading = "true";
      else delete result.dataset.loading;
      result.setAttribute("aria-busy", value ? "true" : "false");
    }
    let refreshing = false;
    async function refreshLibrary() {
      if (refreshing || !updateLibrary) return;
      refreshing = true;
      refresh.disabled = true;
      const label = refresh.textContent;
      refresh.textContent = "更新中…";
      error.hidden = true;
      try {
        const report = await updateLibrary();
        const entries = Object.entries(report?.platforms ?? {});
        const added = entries.reduce((sum, [, item]) => sum + (typeof item?.added === "number" ? item.added : 0), 0);
        const failed = entries.filter(([, item]) => item?.status === "failed").map(([name]) => name);
        refresh.textContent = failed.length ? `已更新 ${added} 题，${failed.join("、")} 失败` : `已更新 ${added} 题`;
        setTimeout(() => {
          if (!refreshing) refresh.textContent = label;
        }, 2600);
      } catch (cause) {
        refresh.textContent = label;
        error.textContent = cause instanceof Error ? cause.message : "题库更新失败";
        error.hidden = false;
      } finally {
        refreshing = false;
        refresh.disabled = false;
      }
    }
    async function drawProblem(excludeCurrent = false) {
      if (busy2) return;
      setBusy(true);
      empty.hidden = true;
      error.hidden = true;
      const filters2 = readFilters();
      if (excludeCurrent && current) filters2.excludedIds = [...new Set([current.id, current.url].filter(Boolean))];
      try {
        render6(await drawApi(filters2));
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : "抽题失败，请稍后重试。";
        error.hidden = false;
      } finally {
        setBusy(false);
      }
    }
    async function copyLink() {
      if (!current?.url) return;
      try {
        await navigator.clipboard.writeText(current.url);
        copy.textContent = "已复制";
        setTimeout(() => {
          copy.textContent = "复制链接";
        }, 1400);
      } catch (_) {
        error.textContent = "复制失败，请手动打开题目链接。";
        error.hidden = false;
      }
    }
    if (cachedResult) render6(cachedResult);
    else if (autoDraw && !autoDrawStarted) {
      autoDrawStarted = true;
      setTimeout(() => {
        void drawProblem();
      }, 260);
    }
    return section;
  }
  var DailyProblem = { create: create2 };

  // src/renderer/account/updates.ts
  function create3(options) {
    const { demo, bridge: bridge3, getAppVersion, getUpdate, setUpdate, getUpdateCapability, getBusy, setBusy, call, cancelDraftSave, getLocalWrite, resetLocalWrite, hasEditor, saveDraft, persistLocal, renderAccount, toast, errorMessage } = options;
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    let updateRunning = false;
    let updateReady = false;
    function renderUpdate() {
      $("#app-version").textContent = getAppVersion() || (demo ? "浏览器预览（非桌面客户端）" : "尚未获取");
      const update = getUpdate() || {};
      if (getUpdateCapability()?.supported === false) $("#update-notice").textContent = getUpdateCapability().reason;
      const latest = update.latestVersion ? ` ${update.latestVersion}` : "";
      const labels = { checking: "正在检查更新…", available: `发现新版本${latest}，可点击检查更新进行升级。`, downloading: `正在下载新版本${latest}…`, ready: `新版本${latest}的签名和文件已校验，正在准备更新。`, installing: "本地记录已备份，退出后将备份并替换程序文件，完成后自动重启。", error: "更新失败，请点击检查更新重试。" };
      let text3 = labels[update.phase] || (update.available === false && !!update.message ? `当前版本 ${getAppVersion() || update.currentVersion || "未知"}，暂无可用更新。` : "可随时检查更新，无需登录 GitHub。");
      if (update.phase === "checking" || update.phase === "available" || update.phase === "downloading" || update.phase === "ready" || update.phase === "installing" || update.phase === "error" || update.available === false) {
        if (update.message) text3 += ` ${update.message}`;
      }
      const progress = $("#update-progress");
      progress.hidden = update.phase !== "downloading";
      const percent = typeof update.percent === "number" && Number.isFinite(update.percent) ? update.percent : typeof update.total === "number" && update.total > 0 && Number.isFinite(update.downloaded) ? update.downloaded / update.total * 100 : null;
      if (percent === null) progress.removeAttribute("value");
      else {
        progress.value = Math.min(100, Math.max(0, percent));
        if (!progress.hidden) text3 += ` ${Math.round(progress.value)}%`;
      }
      if (!progress.hidden && Number.isFinite(update.downloaded) && Number.isFinite(update.total) && update.total > 0) text3 += `（${(update.downloaded / 1048576).toFixed(1)} / ${(update.total / 1048576).toFixed(1)} MB）`;
      if (update.downloadKind === "delta" && Number.isFinite(update.total) && Number.isFinite(update.fullSize) && update.fullSize > update.total) {
        text3 += ` 差分下载 ${(update.total / 1048576).toFixed(2)} MB，完整包 ${(update.fullSize / 1048576).toFixed(1)} MB。`;
      }
      if (update.downloadKind === "delta" && update.deltaSteps > 1) text3 += ` 连续应用 ${update.deltaSteps} 个补丁，完成后统一安装。`;
      if (update.downloadKind === "full" && ["available", "downloading", "ready"].includes(update.phase)) {
        const reasons = { "no-patch-path": "未找到从当前版本到新版的完整补丁链", "base-mismatch": "本机应用文件与补丁基础包不匹配", "metadata-unavailable": "差分清单或历史记录暂不可用", "patch-failed": "补丁下载、重建或校验失败" };
        if (reasons[update.deltaReason]) text3 += ` 使用完整包：${reasons[update.deltaReason]}。`;
      }
      $("#update-status").textContent = text3;
      $("#update-status").classList.toggle("update-error", update.phase === "error");
      $("#check-update-button").textContent = updateReady && update.phase === "error" ? "重试安装" : "检查更新";
    }
    function receiveUpdate(update) {
      if (!update || typeof update !== "object") return;
      setUpdate(update.phase === "checking" ? { ...update } : { ...getUpdate(), ...update });
      renderUpdate();
    }
    async function saveBeforeUpdate() {
      cancelDraftSave();
      try {
        await getLocalWrite();
      } catch (error) {
        resetLocalWrite();
        throw new Error(`本地数据尚未保存，更新已停止：${errorMessage(error)}`);
      }
      try {
        if (hasEditor()) await saveDraft(true);
        else await persistLocal();
      } catch (error) {
        resetLocalWrite();
        throw error;
      }
    }
    async function checkForUpdates() {
      if (getBusy() || updateRunning) return;
      if (demo) {
        receiveUpdate({ phase: "error", message: "浏览器预览不连接更新服务，请在桌面客户端检查更新。" });
        return;
      }
      updateRunning = true;
      setBusy(true);
      let installing = false;
      try {
        if (!updateReady) {
          receiveUpdate({ phase: "checking" });
          const checked = await call("checkForUpdates");
          if (!checked || checked.phase === "error") throw new Error(checked?.message || "检查更新失败");
          receiveUpdate(checked);
          if (!checked.available) return;
          if (getUpdateCapability()?.supported === false) {
            receiveUpdate({ ...checked, message: getUpdateCapability().reason });
            toast(getUpdateCapability().reason);
            return;
          }
          await saveBeforeUpdate();
          receiveUpdate({ phase: "downloading", percent: 0, downloaded: 0, total: 0 });
          const downloaded = await call("downloadUpdate");
          if (downloaded?.phase !== "ready") throw new Error(downloaded?.message || "下载未完成或安装包未通过校验");
          updateReady = true;
          receiveUpdate(downloaded);
        }
        await saveBeforeUpdate();
        const result = await call("installUpdate");
        if (result?.installing !== true) throw new Error(result?.message || "安装程序未能启动");
        installing = true;
        receiveUpdate({ phase: "installing" });
      } catch (error) {
        receiveUpdate({ phase: "error", message: errorMessage(error) });
      } finally {
        if (!installing) {
          setBusy(false);
          updateRunning = false;
        }
      }
    }
    if (typeof bridge3?.onUpdateProgress === "function") bridge3.onUpdateProgress((update) => {
      if (update?.phase === "error") updateReady = false;
      receiveUpdate(update);
    });
    $("#check-update-button").addEventListener("click", checkForUpdates);
    let startupUpdatePending = null;
    function showStartupUpdate() {
      if (!startupUpdatePending || getBusy() || updateRunning || document.querySelector("dialog[open]")) return;
      $("#startup-update-version").textContent = startupUpdatePending.latestVersion || startupUpdatePending.version;
      startupUpdatePending = null;
      $("#startup-update-dialog").showModal();
    }
    async function checkStartupUpdates() {
      if (demo || typeof bridge3?.checkStartupUpdates !== "function") return;
      try {
        const result = await call("checkStartupUpdates");
        if (!result?.available || result.phase !== "available") return;
        startupUpdatePending = result;
        showStartupUpdate();
      } catch {
      }
    }
    function dismissStartupUpdate() {
      startupUpdatePending = null;
      $("#startup-update-dialog").close();
    }
    $("#startup-update-close").addEventListener("click", dismissStartupUpdate);
    $("#startup-update-later").addEventListener("click", dismissStartupUpdate);
    $("#startup-update-dialog").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismissStartupUpdate();
    });
    $("#startup-update-now").addEventListener("click", () => {
      dismissStartupUpdate();
      renderAccount();
      $("#account-dialog").showModal();
      void checkForUpdates();
    });
    $$("dialog").forEach((dialog3) => dialog3.addEventListener("close", showStartupUpdate));
    return { renderUpdate, receiveUpdate, saveBeforeUpdate, checkForUpdates, showStartupUpdate, checkStartupUpdates, dismissStartupUpdate, get updateRunning() {
      return updateRunning;
    }, get updateReady() {
      return updateReady;
    } };
  }
  var Updates = Object.freeze({ create: create3 });

  // src/renderer/ipc/boundary.ts
  function createNotebookIPC(bridge3) {
    return {
      openExternal: (...args) => bridge3.openExternal(...args),
      openAuthUrl: (...args) => bridge3.openAuthUrl(...args),
      formatCode: (...args) => bridge3.formatCode(...args),
      cancelLogin: (...args) => bridge3.cancelLogin(...args),
      exportLocal: (...args) => bridge3.exportLocal(...args),
      bootstrap: (...args) => bridge3.bootstrap(...args),
      updateLocal: (...args) => bridge3.updateLocal(...args),
      plannerAction: (...args) => bridge3.plannerAction(...args)
    };
  }

  // src/renderer/reading/code-blocks.ts
  var CodeBlocks = { create: create4 };
  function create4({ toast, errorMessage }) {
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    const codeLanguageAliases = { "c++": "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", py: "python", python3: "python", js: "javascript", node: "javascript", nodejs: "javascript", ts: "typescript", "c#": "csharp", cs: "csharp", objc: "objectivec", "objective-c": "objectivec", golang: "go", rs: "rust", sh: "bash", shell: "bash", yml: "yaml", html: "markup", xml: "markup" };
    const formattableLanguages = /* @__PURE__ */ new Set(["c", "cpp", "java", "javascript", "typescript", "csharp", "objectivec", "python", "rust"]);
    function normalizeCodeLanguage(language) {
      const name = String(language || "").toLowerCase();
      return codeLanguageAliases[name] || name;
    }
    function codeLanguage(pre) {
      const node3 = pre.querySelector("code") || pre;
      const match2 = /\blanguage-([\w#+.-]+)/i.exec(node3.className || "");
      return normalizeCodeLanguage(match2 ? match2[1] : "");
    }
    function codeBlockText(pre) {
      const code = pre.querySelector("code");
      if (!code) return pre.textContent || "";
      const clone = code.cloneNode(true);
      $$(".line-numbers-rows, .line-numbers-sizer", clone).forEach((node3) => node3.remove());
      return clone.textContent || "";
    }
    function highlightCodeBlock(code) {
      const language = codeLanguage(code.parentElement || code);
      if (language) {
        Array.from(code.classList).filter((name) => /^language-/i.test(name)).forEach((name) => code.classList.remove(name));
        code.classList.add("language-" + language);
      }
      try {
        window.Prism?.highlightElement(code);
      } catch (_) {
      }
    }
    function announceCodeStatus(pre, message) {
      const status = pre.closest(".code-block")?.querySelector(".code-status");
      if (status) status.textContent = message;
    }
    function preserveCodeScroll(pre, mutate3) {
      const scroller = pre.closest(".detail-panel");
      const outerTop = scroller ? scroller.scrollTop : 0, preTop = pre.scrollTop, preLeft = pre.scrollLeft;
      mutate3();
      if (scroller) scroller.scrollTop = Math.min(outerTop, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
      pre.scrollTop = Math.min(preTop, Math.max(0, pre.scrollHeight - pre.clientHeight));
      pre.scrollLeft = preLeft;
    }
    function legacyCopyText(text3) {
      const area = element5("textarea", "clipboard-helper");
      area.value = text3;
      area.setAttribute("readonly", "");
      area.setAttribute("aria-hidden", "true");
      document.body.append(area);
      let ok = false;
      try {
        area.focus({ preventScroll: true });
        area.select();
        ok = document.execCommand("copy");
      } catch (_) {
      }
      area.remove();
      return ok;
    }
    async function copyCodeBlock(pre, actionButton) {
      const text3 = codeBlockText(pre);
      if (!text3) {
        toast("代码块为空");
        return;
      }
      let copied = false;
      try {
        await navigator.clipboard.writeText(text3);
        copied = true;
      } catch (_) {
        copied = legacyCopyText(text3);
      }
      clearTimeout(actionButton._codeResetTimer);
      if (copied) {
        actionButton.textContent = "已复制";
        actionButton.setAttribute("aria-label", "已复制");
        actionButton.classList.add("is-copied");
        actionButton.dataset.state = "copied";
        announceCodeStatus(pre, "已复制");
      } else {
        actionButton.textContent = "失败";
        actionButton.setAttribute("aria-label", "复制失败");
        actionButton.dataset.state = "error";
        announceCodeStatus(pre, "复制失败，请手动选择代码复制");
        toast("复制失败，请手动复制");
      }
      actionButton._codeResetTimer = window.setTimeout(() => {
        actionButton.textContent = "复制";
        actionButton.setAttribute("aria-label", "复制代码");
        actionButton.classList.remove("is-copied");
        delete actionButton.dataset.state;
        announceCodeStatus(pre, "");
      }, 1600);
    }
    async function formatCodeBlock(pre, actionButton) {
      if (actionButton.disabled) return;
      const code = pre.querySelector("code") || pre;
      const language = codeLanguage(pre), source = codeBlockText(pre);
      if (!formattableLanguages.has(language)) {
        toast(language ? `暂不支持 ${language} 代码的格式化` : "未能识别代码语言，无法格式化");
        return;
      }
      const format = typeof window.notebook?.formatCode === "function" ? (text3, lang) => createNotebookIPC(window.notebook).formatCode(text3, lang) : typeof window.formatCode === "function" ? (text3, lang) => Promise.resolve(window.formatCode(text3, lang)) : null;
      if (!format) {
        toast("格式化功能尚未启用");
        return;
      }
      actionButton.disabled = true;
      actionButton.setAttribute("aria-busy", "true");
      const original = actionButton.textContent;
      actionButton.textContent = "格式化中…";
      try {
        const result = await format(source, language);
        if (typeof result !== "string" && result?.error) throw new Error(errorMessage(result.error));
        const formatted = typeof result === "string" ? result : result?.code;
        if (typeof formatted !== "string" || !formatted.trim()) {
          toast(language ? `暂不支持 ${language} 代码的格式化` : "未能识别代码语言，无法格式化");
          return;
        }
        if (formatted === source) {
          toast("代码格式已是最新");
          return;
        }
        preserveCodeScroll(pre, () => {
          code.textContent = formatted;
          highlightCodeBlock(code);
        });
        toast("已格式化代码块");
        announceCodeStatus(pre, "已格式化");
      } catch (error) {
        const message = "格式化失败：" + errorMessage(error);
        toast(message);
        announceCodeStatus(pre, message);
      } finally {
        actionButton.disabled = false;
        actionButton.removeAttribute("aria-busy");
        actionButton.textContent = original;
      }
    }
    function decorateCodeBlocks(container) {
      $$("pre", container).forEach((pre) => {
        if (pre.closest(".code-block")) return;
        const block = element5("div", "code-block");
        pre.replaceWith(block);
        block.append(pre);
        const actions = element5("div", "code-actions");
        actions.setAttribute("role", "group");
        actions.setAttribute("aria-label", "代码块操作");
        const copy = element5("button", "code-action-button", "复制");
        copy.type = "button";
        copy.dataset.action = "copy";
        copy.title = "复制代码";
        copy.setAttribute("aria-label", "复制代码");
        const format = element5("button", "code-action-button", "格式化");
        format.type = "button";
        format.dataset.action = "format";
        format.title = "格式化代码";
        format.setAttribute("aria-label", "格式化代码");
        const language = codeLanguage(pre);
        if (!formattableLanguages.has(language)) {
          format.disabled = true;
          format.title = language ? `暂不支持 ${language} 代码的格式化` : "未能识别代码语言，无法格式化";
          format.setAttribute("aria-label", format.title);
        }
        const status = element5("span", "code-status");
        status.setAttribute("role", "status");
        append(actions, copy, format, status);
        block.append(actions);
      });
    }
    function codeBlockClick(event) {
      if (!(event.target instanceof Element)) return;
      const actionButton = event.target.closest(".code-action-button");
      if (!actionButton) return;
      const pre = actionButton.closest(".code-block")?.querySelector("pre");
      if (!pre) return;
      if (actionButton.dataset.action === "copy") void copyCodeBlock(pre, actionButton);
      else if (actionButton.dataset.action === "format") void formatCodeBlock(pre, actionButton);
    }
    return { highlightCodeBlock, decorateCodeBlocks, codeBlockClick };
  }

  // src/renderer/reading/markdown-table.ts
  function isEscaped(source, index) {
    let count = 0;
    while (index > 0 && source[--index] === "\\") count++;
    return count % 2 === 1;
  }
  function codeEnd(source, index) {
    const opening = /^`+/.exec(source.slice(index))[0];
    const runs = /`+/g;
    runs.lastIndex = index + opening.length;
    let match2;
    while (match2 = runs.exec(source)) if (match2[0].length === opening.length) return match2.index + opening.length;
    return -1;
  }
  function splitCells(row2, count, formula2) {
    const cells = [];
    let cell = "", leadingDelimiter = false, lastDelimiter = -1;
    for (let i = 0; i < row2.length; i++) {
      const ch = row2[i];
      if (!isEscaped(row2, i)) {
        const math = (ch === "$" || ch === "\\") && formula2(row2.slice(i));
        if (math && math.raw) {
          cell += math.raw;
          i += math.raw.length - 1;
          continue;
        }
        if (ch === "`") {
          const end = codeEnd(row2, i);
          if (end !== -1) {
            cell += row2.slice(i, end);
            i = end - 1;
            continue;
          }
        }
      }
      if (ch === "|") {
        if (isEscaped(row2, i)) cell = cell.slice(0, -1) + "|";
        else {
          if (!cells.length && !cell.trim()) leadingDelimiter = true;
          lastDelimiter = i;
          cells.push(cell.trim());
          cell = "";
        }
      } else cell += ch;
    }
    cells.push(cell.trim());
    if (leadingDelimiter) cells.shift();
    if (lastDelimiter >= 0 && !row2.slice(lastDelimiter + 1).trim()) cells.pop();
    if (count !== void 0) {
      cells.length = Math.min(cells.length, count);
      while (cells.length < count) cells.push("");
    }
    return cells;
  }
  function tokenize(source, tokenizer, formula2) {
    const cap = tokenizer.rules.block.table.exec(source);
    if (!cap || !tokenizer.rules.other.tableDelimiter.test(cap[2])) return;
    const headers = splitCells(cap[1], void 0, formula2);
    const aligns = cap[2].replace(tokenizer.rules.other.tableAlignChars, "").split("|");
    if (headers.length !== aligns.length) return;
    const align = aligns.map((value) => tokenizer.rules.other.tableAlignRight.test(value) ? "right" : tokenizer.rules.other.tableAlignCenter.test(value) ? "center" : tokenizer.rules.other.tableAlignLeft.test(value) ? "left" : null);
    const cells = (values, header) => values.map((text3, index) => ({ text: text3, tokens: tokenizer.lexer.inline(text3), header, align: align[index] }));
    const rows = cap[3]?.trim() ? cap[3].replace(tokenizer.rules.other.tableRowBlankLine, "").split("\n") : [];
    return { type: "table", raw: cap[0], header: cells(headers, true), align, rows: rows.map((row2) => cells(splitCells(row2, headers.length, formula2), false)) };
  }
  var MarkdownTable = Object.freeze({ tokenize });

  // src/renderer/reading/markdown-math.ts
  var parsers = /* @__PURE__ */ new WeakMap();
  var scanBudget = Infinity;
  function spend() {
    return --scanBudget >= 0;
  }
  var environments = /* @__PURE__ */ new Set(["equation", "equation*", "align", "align*", "alignat", "alignat*", "gather", "gather*", "multline", "multline*", "displaymath", "math", "aligned", "alignedat", "gathered", "split", "cases", "dcases", "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix", "array"]);
  var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  function escaped(source, index) {
    let count = 0;
    while (index > 0 && source[--index] === "\\") count++;
    return count % 2 === 1;
  }
  function verbEnd(source, index) {
    const match2 = /^\\verb\*?([^\w\s])/.exec(source.slice(index));
    if (!match2) return -1;
    const end = source.indexOf(match2[1], index + match2[0].length);
    return end === -1 ? -1 : end;
  }
  function closing(source, delimiter, from) {
    let braces = 0;
    for (let index = from; index < source.length; index++) {
      if (!spend()) return -1;
      if (braces === 0 && source.startsWith(delimiter, index)) {
        if (delimiter !== "$" || source[index + 1] !== "$" && !/\s/.test(source[index - 1]) && !/\d/.test(source[index + 1] || "")) return index;
        if (delimiter === "$") return -1;
      }
      const ch = source[index];
      if (ch === "\\") {
        const verb = verbEnd(source, index);
        index = verb === -1 ? index + 1 : verb;
      } else if (ch === "%") {
        const newline = source.indexOf("\n", index);
        if (newline === -1) return -1;
        index = newline - 1;
      } else if (ch === "{") braces++;
      else if (ch === "}") braces = Math.max(0, braces - 1);
      else if (delimiter === "$" && ch === "\n") return -1;
    }
    return -1;
  }
  function formula(source) {
    let left, right, display = false, environment;
    if (source.startsWith("$$")) {
      left = right = "$$";
      display = true;
    } else if (source.startsWith("\\[")) {
      left = "\\[";
      right = "\\]";
      display = true;
    } else if (source.startsWith("\\(")) {
      left = "\\(";
      right = "\\)";
    } else if (source[0] === "$" && source.length > 1 && !/\s/.test(source[1])) left = right = "$";
    else {
      const match2 = /^\\begin\{([A-Za-z]+\*?)\}/.exec(source);
      if (!match2 || !environments.has(match2[1])) return;
      environment = match2[1];
      left = match2[0];
      right = `\\end{${environment}}`;
      display = environment !== "math";
    }
    if (!left || scanBudget <= 0) return;
    if (source.indexOf(right, left.length) === -1) return;
    let end;
    if (environment) {
      let depth = 1;
      for (let index = left.length; index < source.length; index++) {
        if (!spend()) return;
        if (source[index] === "%") {
          const newline = source.indexOf("\n", index);
          if (newline === -1) break;
          index = newline;
          continue;
        }
        if (source[index] !== "\\") continue;
        const verb = verbEnd(source, index);
        if (verb !== -1) {
          index = verb;
          continue;
        }
        const match2 = /^\\(begin|end)\{([A-Za-z]+\*?)\}/.exec(source.slice(index));
        if (match2 && match2[2] === environment) {
          depth += match2[1] === "begin" ? 1 : -1;
          if (!depth) {
            end = index;
            break;
          }
          index += match2[0].length - 1;
        } else index++;
      }
    } else end = closing(source, right, left.length);
    if (end === void 0 || end < left.length) return;
    const raw = source.slice(0, end + right.length);
    let text3 = environment ? raw : source.slice(left.length, end);
    if (!text3.trim()) return;
    const aliases = { displaymath: "", math: "" };
    const wrapper = environment || /^\s*\\begin\{([A-Za-z]+\*?)\}([\s\S]*)\\end\{\1\}\s*$/.exec(text3)?.[1];
    if (Object.prototype.hasOwnProperty.call(aliases, wrapper)) {
      const inner = environment ? source.slice(left.length, end) : text3.replace(/^\s*\\begin\{[^}]+\}/, "").replace(/\\end\{[^}]+\}\s*$/, "");
      text3 = aliases[wrapper] ? `\\begin{${aliases[wrapper]}}${inner}\\end{${aliases[wrapper]}}` : inner;
    }
    return { raw, text: text3, display };
  }
  function mathToken(source, block) {
    const indent = block ? /^ {0,3}/.exec(source)[0].length : 0;
    const token = formula(source.slice(indent));
    if (!token || block && !token.display) return;
    let raw = source.slice(0, indent + token.raw.length);
    if (block) {
      const tail = /^[ \t]*(?:\n|$)/.exec(source.slice(raw.length));
      if (!tail) return;
      raw += tail[0];
    }
    return { type: block ? "notebookMathBlock" : "notebookMathInline", raw, text: token.text, display: token.display };
  }
  function renderToken(token) {
    return `<${token.type === "notebookMathBlock" ? "div" : "span"} class="notebook-math-source" data-math-display="${token.display}">${escapeHtml(token.text)}</${token.type === "notebookMathBlock" ? "div" : "span"}>`;
  }
  function mathStart(source) {
    for (let i = 0; i < source.length; i++) {
      if ((source[i] === "$" || source[i] === "\\") && !escaped(source, i) && formula(source.slice(i))) return i;
    }
    return -1;
  }
  function parse(source, marked) {
    let parser = parsers.get(marked);
    if (!parser) {
      parser = new marked.Marked({
        gfm: true,
        breaks: false,
        renderer: { checkbox(token) {
          return `<span class="markdown-task-marker" role="img" aria-label="${token.checked ? "已完成" : "未完成"}">${token.checked ? "☑" : "☐"}</span> `;
        } },
        tokenizer: {
          table(source2) {
            return MarkdownTable?.tokenize(source2, this, formula) || false;
          }
        },
        extensions: [
          { name: "notebookMathBlock", level: "block", start(source2) {
            const match2 = /(?:^|\n) {0,3}(?:\$\$|\\\[|\\begin\{)/.exec(source2);
            return match2?.index;
          }, tokenizer(source2) {
            return mathToken(source2, true);
          }, renderer: renderToken },
          { name: "notebookMathInline", level: "inline", start: mathStart, tokenizer(source2) {
            return mathToken(source2, false);
          }, renderer: renderToken }
        ]
      });
      parsers.set(marked, parser);
    }
    const previousBudget = scanBudget;
    scanBudget = 1e5 + source.length * 30;
    try {
      return parser.parse(source);
    } finally {
      scanBudget = previousBudget;
    }
  }
  function render3(container, katex) {
    if (!katex?.render) return;
    let macros = {};
    for (const node3 of container.querySelectorAll(".notebook-math-source")) {
      if (node3.classList.contains("notebook-math-rendered") || node3.classList.contains("notebook-math-error") || node3.closest("pre,code,kbd,samp,script,style,textarea")) continue;
      const text3 = node3.textContent;
      try {
        const nextMacros = structuredClone(macros);
        katex.render(text3, node3, { displayMode: node3.dataset.mathDisplay === "true", throwOnError: true, trust: false, strict: "ignore", maxExpand: 1e3, maxSize: 20, macros: nextMacros, globalGroup: true, output: "htmlAndMathml" });
        macros = nextMacros;
        node3.classList.add("notebook-math-rendered");
      } catch (error) {
        node3.replaceChildren(container.ownerDocument.createTextNode(text3));
        node3.classList.add("notebook-math-error");
        node3.setAttribute("role", "note");
        node3.title = `公式语法或命令不受支持：${String(error.message || error).slice(0, 500)}`;
      }
    }
  }
  var MarkdownMath = Object.freeze({ parse, render: render3 });

  // src/renderer/reading/markdown-color.ts
  function color(value, document2) {
    const text3 = String(value || "").trim();
    if (!/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/degturnrad]+\))$/i.test(text3)) return "";
    if (/^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(text3)) return "";
    const style = document2.createElement("span").style;
    style.color = text3;
    return style.color;
  }
  function foreground(node3, document2) {
    let result = "";
    for (const declaration of (node3.getAttribute("style") || "").split(";")) {
      const match2 = /^\s*color\s*:\s*(.*?)\s*$/i.exec(declaration);
      if (match2) result = color(match2[1], document2) || result;
    }
    return result || (node3.nodeName === "FONT" ? color(node3.getAttribute("color"), document2) : "");
  }
  function sanitize(html, purifier, document2) {
    const colors = /* @__PURE__ */ new WeakMap();
    const capture = (node3) => {
      if (node3.nodeName !== "SPAN" && node3.nodeName !== "FONT") return;
      const value = foreground(node3, document2);
      if (value) colors.set(node3, value);
    };
    purifier.addHook("uponSanitizeElement", capture);
    let fragment;
    try {
      fragment = purifier.sanitize(html, {
        FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
        FORBID_ATTR: ["style", "color"],
        RETURN_DOM_FRAGMENT: true
      });
    } finally {
      purifier.removeHook("uponSanitizeElement", capture);
    }
    for (const node3 of fragment.querySelectorAll("span,font")) {
      const value = colors.get(node3);
      if (value) {
        node3.style.color = value;
        node3.classList.add("notebook-foreground");
      }
    }
    return fragment;
  }
  var MarkdownColor = Object.freeze({ sanitize });

  // src/renderer/reading/reading-detail.ts
  var global = typeof window !== "undefined" ? window : globalThis;
  var stack = [];
  function open({ content, title = "阅读详情", mount, path = [], onClose } = {}) {
    if (!content?.parentNode) return;
    const doc = content.ownerDocument;
    mount ||= content.closest(".algorithm-view-content") || doc.querySelector("#algorithm-panel .algorithm-view-content");
    if (!mount) return;
    const mountElement = mount;
    const previousFocus = doc.activeElement;
    const scroll = content.scrollTop, pageScroll = global.scrollY;
    const modes = mount.parentElement?.querySelector(".algorithm-view-modes");
    if (modes) global.scrollTo(0, Math.max(0, global.scrollY + modes.getBoundingClientRect().top - 100));
    const context = content.closest(".alg-browser,.alp");
    const marker = doc.createComment("reading-detail-return");
    content.before(marker);
    const view = doc.createElement("section");
    view.className = "reading-detail-view";
    view.setAttribute("aria-label", title);
    function sizeView() {
      view.style.height = `${Math.max(360, global.innerHeight - Math.max(0, mountElement.getBoundingClientRect().top) - 24)}px`;
    }
    sizeView();
    global.addEventListener("resize", sizeView);
    const bar = doc.createElement("header");
    bar.className = "reading-detail-bar";
    const back = doc.createElement("button");
    back.type = "button";
    back.className = "button secondary reading-detail-back";
    back.textContent = "← 返回上一级";
    const nav = doc.createElement("nav");
    nav.className = "reading-detail-path";
    nav.setAttribute("aria-label", "详情路径");
    bar.append(back, nav);
    const wrapper = doc.createElement("div");
    wrapper.className = `${context?.className || ""} reading-expanded`;
    wrapper.append(content);
    view.append(bar, wrapper);
    const lifted = [];
    for (const dialog3 of mount.querySelectorAll("dialog")) {
      const anchor = doc.createComment("reading-form-return");
      dialog3.before(anchor);
      mount.append(dialog3);
      lifted.push({ dialog: dialog3, anchor });
    }
    const hidden = Array.from(mount.children).filter((node3) => node3 !== view && node3.tagName !== "DIALOG" && !node3.hidden);
    hidden.forEach((node3) => {
      node3.hidden = true;
    });
    mount.append(view);
    let closed = false;
    function setPath(items) {
      nav.replaceChildren();
      const crumbs = items.length ? items : [{ label: title }];
      crumbs.forEach((item, index) => {
        if (index) {
          const separator = doc.createElement("span");
          separator.textContent = "/";
          separator.setAttribute("aria-hidden", "true");
          nav.append(separator);
        }
        const crumb = doc.createElement(item.onClick ? "button" : "span");
        crumb.textContent = String(item.label || "详情");
        if (item.onClick) {
          crumb.type = "button";
          crumb.addEventListener("click", item.onClick);
        }
        if (index === crumbs.length - 1) crumb.setAttribute("aria-current", "page");
        nav.append(crumb);
      });
    }
    const controller = {
      setPath,
      close() {
        if (closed) return;
        while (stack.length && stack[stack.length - 1] !== controller) stack[stack.length - 1].close();
        closed = true;
        const currentScroll = content.scrollTop;
        if (marker.isConnected) marker.replaceWith(content);
        view.remove();
        hidden.forEach((node3) => {
          node3.hidden = false;
        });
        lifted.forEach(({ dialog: dialog3, anchor }) => {
          if (anchor.isConnected) anchor.replaceWith(dialog3);
        });
        stack.pop();
        content.scrollTop = currentScroll;
        doc.removeEventListener("keydown", onKey);
        global.removeEventListener("resize", sizeView);
        onClose?.();
        const focus = previousFocus?.isConnected && !previousFocus.closest("[hidden]") ? previousFocus : content.querySelector(".reading-detail-trigger");
        focus?.focus({ preventScroll: true });
        global.scrollTo(0, pageScroll);
      }
    };
    function onKey(event) {
      if (event.key !== "Escape" || event.defaultPrevented || stack[stack.length - 1] !== controller || doc.querySelector("dialog[open]")) return;
      event.preventDefault();
      controller.close();
    }
    back.addEventListener("click", () => controller.close());
    doc.addEventListener("keydown", onKey);
    stack.push(controller);
    setPath(path);
    content.scrollTop = scroll;
    back.focus({ preventScroll: true });
    return controller;
  }
  function closeAll() {
    while (stack.length) stack[stack.length - 1].close();
  }
  var ReadingDetail = Object.freeze({ open, closeAll });

  // src/renderer/records/local.ts
  function createNormalizer(uuid) {
    const migratedClientIds = /* @__PURE__ */ new Map();
    return function normalizeLocal(local) {
      const raw = local;
      return {
        records: (Array.isArray(raw?.records) ? raw.records : []).filter((record) => record?.kind === "local").map((record) => {
          const legacyKey = record.id == null ? null : String(record.id);
          const clientId = record.clientId || legacyKey && migratedClientIds.get(legacyKey) || uuid();
          if (legacyKey) migratedClientIds.set(legacyKey, clientId);
          return {
            ...record,
            clientId,
            id: record.id ?? `local:${clientId}`,
            ownerId: record.ownerId == null ? null : String(record.ownerId)
          };
        }),
        favorites: Array.isArray(raw?.favorites) ? raw.favorites : [],
        mastery: raw?.mastery && typeof raw.mastery === "object" ? raw.mastery : {},
        draft: raw?.draft && typeof raw.draft === "object" ? raw.draft : {},
        learningPaths: raw?.learningPaths && typeof raw.learningPaths === "object" && !Array.isArray(raw.learningPaths) ? raw.learningPaths : {}
      };
    };
  }

  // src/renderer/library/filters.ts
  function createFilters({ getRecords, getView, getScope, getTagCatalog, getBusy, favorite, mastery, isLocal, isOwnSolution, recordAuthorName: recordAuthorName2, render: render6 }) {
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button8(label, className, action2) {
      const node3 = element5("button", className, label);
      node3.type = "button";
      node3.addEventListener("click", action2);
      return node3;
    }
    const stateLabels = { unreviewed: "待复习", reviewing: "复习中", mastered: "已掌握" };
    const facets = { platform: /* @__PURE__ */ new Set(), tags: /* @__PURE__ */ new Set(), authors: /* @__PURE__ */ new Set(), native: /* @__PURE__ */ new Set() };
    const facetNames = { platform: "平台", tags: "标签", authors: "作者", native: "难度" };
    const platformNames = { CF: "Codeforces", LG: "洛谷", AT: "AtCoder", NC: "牛客", LC: "LeetCode", Oth: "其他平台" };
    function facetValue(record, group) {
      return group === "platform" ? Search.normalizePlatform(record.platform) : group === "authors" ? recordAuthorName2(record) : "";
    }
    function fillFacetOptions(container, group, values, search = "") {
      container.replaceChildren();
      const counts = /* @__PURE__ */ new Map();
      values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
      const options = [.../* @__PURE__ */ new Set([...counts.keys(), ...facets[group]])].sort((a, b) => a.localeCompare(b, "zh-CN"));
      options.filter((value) => (group === "platform" ? platformNames[value] || value : value).toLowerCase().includes(search.toLowerCase())).forEach((value) => {
        const label = element5("label", "facet-option");
        const input2 = element5("input");
        input2.type = "checkbox";
        input2.value = value;
        input2.checked = facets[group].has(value);
        input2.addEventListener("change", () => {
          input2.checked ? facets[group].add(value) : facets[group].delete(value);
          if (group === "platform" && facets.platform.size === 1) {
            const selected2 = [...facets.platform][0];
            setDifficultyPlatform(["CF", "LG"].includes(selected2) ? selected2 : "native");
          }
          updateFacetCounts();
          render6();
        });
        append(label, input2, element5("span", "", group === "platform" ? platformNames[value] || value : value), element5("small", "", counts.get(value) || 0));
        container.append(label);
      });
      if (!container.children.length) container.append(element5("p", "facet-help", "没有匹配的选项"));
    }
    function refreshFilters() {
      const all = getRecords();
      for (const group of ["platform", "tags", "authors"]) {
        const host = $(group === "tags" ? "#tag-filter" : group === "authors" ? "#author-filter" : "#platform-filter");
        const values = group === "tags" ? all.flatMap((r) => Array.isArray(r.tags) ? r.tags : []) : all.map((r) => facetValue(r, group));
        if (group === "tags") {
          const trigger = button8("", "facet-trigger", () => openTagPicker("filter"));
          append(trigger, document.createTextNode(facetNames[group] + " "), element5("span", "facet-chevron", "⌄"));
          trigger.id = "tag-filter-trigger";
          trigger.setAttribute("aria-haspopup", "dialog");
          host.replaceChildren(trigger);
        } else {
          const wasOpen = host.querySelector("details")?.open;
          const query = host.querySelector('input[type="search"]')?.value || "";
          const details = element5("details");
          details.open = !!wasOpen;
          const summary = element5("summary");
          append(summary, document.createTextNode(facetNames[group] + " "), element5("span", "facet-count"), element5("span", "facet-chevron", "⌄"));
          const popover = element5("div", "facet-popover");
          const search = element5("input", "facet-search");
          search.type = "search";
          search.placeholder = `查找${facetNames[group]}`;
          search.setAttribute("aria-label", `查找${facetNames[group]}`);
          search.value = query;
          const options = element5("div", "facet-options");
          search.addEventListener("input", () => fillFacetOptions(options, group, values, search.value));
          append(popover, search, options, button8("清除本组", "facet-clear", () => {
            facets[group].clear();
            fillFacetOptions(options, group, values, search.value);
            updateFacetCounts();
            render6();
          }));
          append(details, summary, popover);
          host.replaceChildren(details);
          fillFacetOptions(options, group, values, query);
        }
      }
      const native = all.filter((r) => !["CF", "LG"].includes(Search.normalizePlatform(r.platform))).map((r) => String(r.difficulty || "").trim()).filter(Boolean);
      fillFacetOptions($("#native-difficulty-options"), "native", native);
      updateFacetCounts();
    }
    function tagGroups(extra = []) {
      const groups = (getTagCatalog()?.categories || []).map((c) => ({ id: String(c.id), name: String(c.name), tags: (c.tags || []).map((t) => String(t.name)) }));
      const known2 = new Set(groups.flatMap((c) => c.tags));
      const historical = [.../* @__PURE__ */ new Set([...getRecords().flatMap((r) => Array.isArray(r.tags) ? r.tags.map(String) : []), ...extra])].filter((t) => !known2.has(t));
      if (historical.length) groups.push({ id: "history", name: "历史标签", tags: historical, historical: true });
      return groups;
    }
    const tagOptionsViews = /* @__PURE__ */ new WeakMap();
    function fillTagOptions(container, selected2, query, onChange2) {
      let view = tagOptionsViews.get(container);
      if (!view || view.selected !== selected2) {
        const counts = /* @__PURE__ */ new Map();
        getRecords().forEach((r) => new Set(r.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
        const inputs = /* @__PURE__ */ new Map();
        const fragment = document.createDocumentFragment();
        const groups = tagGroups([...selected2]).map((group) => {
          const heading = element5("strong", "tag-category-heading", group.name);
          fragment.append(heading);
          const options = group.tags.map((value) => {
            const label = element5("label", "facet-option"), input2 = element5("input");
            input2.type = "checkbox";
            input2.value = value;
            input2.checked = selected2.has(value);
            input2.disabled = getBusy();
            const duplicates = inputs.get(value) || [];
            duplicates.push(input2);
            inputs.set(value, duplicates);
            append(label, input2, element5("span", "", value + (group.historical ? " · 历史" : "")), element5("small", "", counts.get(value) || 0));
            fragment.append(label);
            return { label, input: input2, search: `${group.name} ${value}`.toLowerCase() };
          });
          return { heading, options };
        });
        const empty = element5("p", "facet-help", "没有匹配的标签");
        fragment.append(empty);
        view = { selected: selected2, onChange: onChange2, groups, inputs, empty };
        tagOptionsViews.set(container, view);
        container.onchange = (event) => {
          const current = tagOptionsViews.get(container), input2 = event.target;
          if (!current || !(input2 instanceof HTMLInputElement) || input2.type !== "checkbox") return;
          if (getBusy()) {
            input2.checked = current.selected.has(input2.value);
            return;
          }
          input2.checked ? current.selected.add(input2.value) : current.selected.delete(input2.value);
          current.inputs.get(input2.value)?.forEach((node3) => {
            node3.checked = input2.checked;
          });
          current.onChange();
        };
        container.replaceChildren(fragment);
      }
      view.onChange = onChange2;
      const search = query.toLowerCase();
      let matches = 0;
      view.groups.forEach((group) => {
        let groupMatches = 0;
        group.options.forEach((option2) => {
          const visible = option2.search.includes(search);
          if (option2.label.hidden !== !visible) option2.label.hidden = !visible;
          if (visible) groupMatches++;
        });
        if (group.heading.hidden !== !groupMatches) group.heading.hidden = !groupMatches;
        matches += groupMatches;
      });
      view.empty.hidden = matches > 0;
    }
    let tagPickerContext = null;
    function openTagPicker(mode, selection) {
      if (getBusy()) return;
      const source = selection?.selected ?? (mode === "filter" ? facets.tags : new Set($("#submit-form").elements.tags.value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)));
      tagPickerContext = { mode, original: new Set(source), selected: new Set(source), onApply: selection?.onApply };
      $("#tag-picker-title").textContent = mode === "filter" ? "筛选算法标签" : mode === "daily" ? "选择每日一题算法标签" : "选择算法标签";
      $("#tag-picker-hint").textContent = mode === "daily" ? "选择每日一题的算法标签。" : mode === "filter" ? "命中任一已选标签的题目将显示；确定后应用筛选。" : "选择一个或多个标签，点击确定后加入错题。";
      $("#tag-picker-search").value = "";
      fillTagOptions($("#tag-picker-dialog-options"), tagPickerContext.selected, "", () => {
      });
      document.body.classList.add("tag-picker-open");
      $("#tag-picker-dialog").showModal();
      $("#tag-picker-search").focus();
    }
    function closeTagPicker(apply) {
      if (!tagPickerContext) return;
      const context = tagPickerContext;
      tagPickerContext = null;
      $("#tag-picker-dialog").close();
      document.body.classList.remove("tag-picker-open");
      if (!apply) return;
      if (context.onApply) {
        context.onApply(context.selected);
        return;
      }
      if (context.mode === "filter") {
        facets.tags.clear();
        context.selected.forEach((tag) => facets.tags.add(tag));
        refreshFilters();
        render6();
      } else {
        const field2 = $("#submit-form").elements.tags;
        field2.value = [...context.selected].join(", ");
        renderEditorTags();
        field2.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    function renderEditorTags() {
      const field2 = $("#submit-form").elements.tags;
      const selected2 = new Set(field2.value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean));
      const host = $("#record-tag-selected");
      host.replaceChildren();
      selected2.forEach((t) => host.append(button8(t + " ×", "filter-chip", () => {
        if (getBusy()) return;
        selected2.delete(t);
        field2.value = [...selected2].join(", ");
        renderEditorTags();
        field2.dispatchEvent(new Event("input", { bubbles: true }));
      })));
      $("#record-tag-open").textContent = selected2.size ? `选择标签…（已选 ${selected2.size}）` : "选择标签…";
    }
    function ranges() {
      return ["rating-min", "rating-max", "luogu-min", "luogu-max"].map((id) => {
        const v = $("#" + id).value;
        return v === "" ? null : Number(v);
      });
    }
    function updateFacetCounts() {
      ["rating-min", "rating-max"].forEach((id) => colorRatingInput($("#" + id)));
      for (const group of ["platform", "tags", "authors"]) {
        const count2 = facets[group].size;
        const node3 = $(`[data-facet="${group}"] .facet-count`);
        if (node3) node3.textContent = count2 || "";
      }
      const range = ranges();
      const count = range.filter((v) => v !== null).length + facets.native.size;
      $("#difficulty-count").textContent = count ? "已选" : "";
      const chips = $("#active-filters");
      chips.replaceChildren();
      for (const group of Object.keys(facets)) for (const value of facets[group]) chips.append(button8(`${facetNames[group]} · ${group === "platform" ? platformNames[value] || value : value} ×`, "filter-chip", () => {
        facets[group].delete(value);
        refreshFilters();
        render6();
      }));
      if (range.some((v) => v !== null)) chips.append(button8("难度区间 ×", "filter-chip", () => {
        clearDifficulty();
        render6();
      }));
      chips.hidden = !chips.children.length;
      $("#range-error").hidden = !(range[0] !== null && range[1] !== null && range[0] > range[1] || range[2] !== null && range[3] !== null && range[2] > range[3]);
    }
    function setDifficultyPlatform(platform) {
      const select = $("#difficulty-platform");
      if (select.value !== platform) {
        select.value = platform;
        ["rating-min", "rating-max", "luogu-min", "luogu-max"].forEach((id) => {
          $("#" + id).value = "";
        });
        facets.native.clear();
      }
      for (const [code, id] of [["CF", "cf-difficulty-fields"], ["LG", "lg-difficulty-fields"], ["native", "native-difficulty-fields"]]) $("#" + id).hidden = code !== platform;
      ["luogu-min", "luogu-max"].forEach((id) => colorLuoguSelection($("#" + id)));
      ["rating-min", "rating-max"].forEach((id) => colorRatingInput($("#" + id)));
    }
    function clearDifficulty() {
      ["rating-min", "rating-max", "luogu-min", "luogu-max"].forEach((id) => $("#" + id).value = "");
      facets.native.clear();
      ["luogu-min", "luogu-max"].forEach((id) => colorLuoguSelection($("#" + id)));
      refreshFilters();
    }
    function filteredRecords() {
      const search = $("#search-input").value.trim();
      const status = $("#state-filter").value;
      const [min, max, lgMin, lgMax] = ranges();
      const scores = /* @__PURE__ */ new Map();
      const difficultyActive = [min, max, lgMin, lgMax].some((v) => v !== null) || facets.native.size > 0;
      return getRecords().filter((record) => {
        if (getView() === "public" && (getScope() === "local" ? !isOwnSolution(record) : record.kind !== "document")) return false;
        if (getView() === "favorites" && !favorite(record)) return false;
        if (facets.platform.size && !facets.platform.has(facetValue(record, "platform"))) return false;
        if (facets.tags.size && !(record.tags || []).some((tag) => facets.tags.has(String(tag)))) return false;
        if (facets.authors.size && !facets.authors.has(facetValue(record, "authors"))) return false;
        if (difficultyActive) {
          const code = Search.normalizePlatform(record.platform), info = Search.difficulty(record);
          const cf = code === "CF" && (min !== null || max !== null) && info.level !== null && (min === null || info.level >= min) && (max === null || info.level <= max);
          const lgInfo = code === "LG" ? info : Search.difficulty({ platform: "LG", difficulty: record.luoguDifficulty });
          const lg = (lgMin !== null || lgMax !== null) && lgInfo.level !== null && (lgMin === null || lgInfo.level >= lgMin) && (lgMax === null || lgInfo.level <= lgMax);
          const native = !["CF", "LG"].includes(code) && facets.native.has(String(record.difficulty || "").trim());
          if (!cf && !lg && !native) return false;
        }
        if (status === "local" && !isLocal(record) || status === "shared" && isLocal(record)) return false;
        if (stateLabels[status] && mastery(record) !== status) return false;
        const score2 = Search.match(record, search);
        scores.set(record, score2);
        return score2 > 0;
      }).sort((a, b) => Search.tagHits(b, facets.tags) - Search.tagHits(a, facets.tags) || (search ? scores.get(b) - scores.get(a) : 0) || (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0));
    }
    function clearFilters() {
      $("#search-input").value = "";
      $("#state-filter").value = "";
      Object.values(facets).forEach((set) => set.clear());
      clearDifficulty();
      render6();
    }
    const luoguLevels3 = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
    const luoguTones = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "black"];
    function colorRatingInput(input2) {
      const valid = input2.value !== "" && !input2.validity.badInput && Number.isInteger(input2.valueAsNumber) && input2.valueAsNumber >= 0 && input2.valueAsNumber <= 1e4;
      const info = valid ? Search.difficulty({ platform: "CF", rating: input2.valueAsNumber }) : null;
      input2.className = `rating-range${info ? ` tone-${info.tone}` : ""}`;
      input2.style.caretColor = info ? "var(--difficulty-color)" : "";
    }
    function colorLuoguSelection(select) {
      select.className = select.value ? `luogu-range tone-${luoguTones[Number(select.value) - 1]}` : "luogu-range";
    }
    return { facets, facetNames, platformNames, facetValue, fillFacetOptions, refreshFilters, tagGroups, fillTagOptions, get tagPickerContext() {
      return tagPickerContext;
    }, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, luoguLevels: luoguLevels3, luoguTones, colorRatingInput, colorLuoguSelection };
  }

  // src/renderer/library/authors.ts
  function text2(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function identity(value) {
    const id = typeof value === "number" || typeof value === "string" ? String(value) : "";
    return /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
  }
  function githubSource(record) {
    if (record.kind === "local") return true;
    if (record.sourceKey) return record.sourceKey.startsWith("https://api.github.com|");
    return !record.serverUrl || /^https:\/\/(?:api\.)?github\.com\/?$/i.test(record.serverUrl);
  }
  function recordAuthor(record, account) {
    const value = record.author && typeof record.author === "object" ? record.author : null;
    const explicit = text2(record.author) || text2(value?.name) || text2(value?.login);
    const owner = record.kind === "local" ? identity(record.ownerId) : identity(record.authorId);
    const currentOwner = githubSource(record) && owner !== null && owner === identity(account?.id);
    const accountLogin = currentOwner ? text2(account?.login) : "";
    const name = explicit || accountLogin || (record.kind === "local" ? "本地学习者" : "匿名学习者");
    if (!githubSource(record)) return { name, avatarUrl: null, avatarData: null };
    const id = record.kind === "local" ? identity(record.ownerId) : identity(record.authorId);
    const login = text2(value?.login) || (record.kind === "local" ? accountLogin : text2(record.author));
    const validLogin = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) && !login.includes("--") && !["unknown", "anonymous"].includes(login.toLowerCase());
    const avatarUrl = id ? `https://avatars.githubusercontent.com/u/${id}?s=64` : record.kind !== "local" && validLogin ? `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64` : null;
    const avatarData = currentOwner && typeof account?.avatarData === "string" && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(account.avatarData) ? account.avatarData : null;
    return { name, avatarUrl, avatarData };
  }
  function recordAuthorName(record, account) {
    return recordAuthor(record, account).name;
  }
  function authorAvatar(author) {
    const avatar = document.createElement("span");
    avatar.className = "mini-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = author.name.slice(0, 1);
    const source = author.avatarData || author.avatarUrl;
    if (source) {
      const image = document.createElement("img");
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => image.remove(), { once: true });
      image.src = source;
      avatar.append(image);
    }
    return avatar;
  }

  // src/renderer/library/editor.ts
  function createEditor(options) {
    const { demo, getEditor, setEditor, getLocal, setLocal, getRecords, setRecords, getIssues, setIssues, getComments, getSelected, setSelected, getBusy, setBusy, getAccount, getPermissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave, persistLocal, call, refreshFilters, navigate, render: render6, openDetail, toast, errorMessage } = options;
    const $ = (selector) => document.querySelector(selector);
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function formDraft() {
      const form = $("#submit-form");
      return Object.fromEntries(["url", "title", "pid", "platform", "tags", "reason", "body", "trick", "rating", "difficulty", "luoguDifficulty"].map((name) => [name, String(form.elements.namedItem(name)?.value || "")]));
    }
    function fillForm(draft) {
      const form = $("#submit-form");
      form.reset();
      for (const name of ["tags", "rating", "difficulty", "luoguDifficulty"]) form.elements[name].value = "";
      Object.entries(draft || {}).forEach(([name, value]) => {
        const input2 = form.elements.namedItem(name);
        if (input2) input2.value = String(value ?? "");
      });
    }
    const editorLuoguLevels = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
    const editorLuoguTones = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "black"];
    function renderEditorDifficulty() {
      const form = $("#submit-form"), host = $("#editor-difficulty-picker");
      const platform = platformCode(form.elements.platform.value);
      const rating = form.elements.rating, native = form.elements.difficulty;
      const wrapper = element5("div", "editor-difficulty-controls");
      if (platform === "CF") {
        const ratingField = element5("label", "range-field");
        ratingField.append(element5("span", "", "Codeforces Rating"));
        const input2 = element5("input", "rating-range");
        input2.type = "number";
        input2.min = "0";
        input2.max = "10000";
        input2.step = "100";
        input2.placeholder = "未指定";
        input2.setAttribute("aria-label", "Codeforces Rating");
        input2.value = rating.value;
        native.value = "";
        const color2 = () => colorRatingInput(input2);
        input2.addEventListener("input", () => {
          rating.value = input2.value;
          native.value = "";
          color2();
        });
        color2();
        ratingField.append(input2);
        wrapper.append(ratingField);
      } else if (platform === "LG") {
        const select = element5("select", "luogu-range");
        select.setAttribute("aria-label", "洛谷原生难度");
        [["", "未指定"], ...editorLuoguLevels.map((name) => [name, name])].forEach(([value, label], index) => {
          const option2 = element5("option", index ? `tone-${editorLuoguTones[index - 1]}` : "", label);
          option2.value = value;
          select.append(option2);
        });
        const current = Search.difficulty({ platform: "LG", difficulty: native.value });
        const known2 = current.level ? editorLuoguLevels[current.level - 1] : editorLuoguLevels.find((level) => level === native.value);
        if (known2) select.value = known2;
        else if (native.value) {
          const legacy = element5("option", "", native.value);
          legacy.value = native.value;
          select.append(legacy);
          select.value = native.value;
        }
        rating.value = "";
        const color2 = () => {
          const level = editorLuoguLevels.indexOf(select.value);
          select.className = `luogu-range${level >= 0 ? ` tone-${editorLuoguTones[level]}` : ""}`;
        };
        select.addEventListener("change", () => {
          native.value = select.value;
          color2();
        });
        color2();
        const field2 = element5("label", "range-field");
        field2.append(element5("span", "", "洛谷难度"), select);
        wrapper.append(field2);
      } else if (platform === "LC") {
        const select = element5("select", "luogu-range");
        select.setAttribute("aria-label", "LeetCode 原生难度");
        [["", "未指定", ""], ["Easy", "Easy / 简单", "green"], ["Medium", "Medium / 中等", "yellow"], ["Hard", "Hard / 困难", "red"]].forEach(([value, label, tone]) => {
          const option2 = element5("option", tone ? `tone-${tone}` : "", label);
          option2.value = value;
          select.append(option2);
        });
        const level = Search.difficulty({ platform: "LC", difficulty: native.value }).level;
        const known2 = ["Easy", "Medium", "Hard"][level - 1];
        if (known2) select.value = known2;
        else if (native.value) {
          const legacy = element5("option", "", native.value);
          legacy.value = native.value;
          select.append(legacy);
          select.value = native.value;
        }
        const color2 = () => {
          const tone = { Easy: "green", Medium: "yellow", Hard: "red" }[select.value];
          select.className = `luogu-range${tone ? ` tone-${tone}` : ""}`;
        };
        select.addEventListener("change", () => {
          native.value = select.value;
          color2();
        });
        color2();
        wrapper.append(select);
      } else {
        const input2 = element5("input");
        input2.type = "text";
        input2.maxLength = 60;
        input2.placeholder = "原生难度，如 ABC D / 3";
        input2.setAttribute("aria-label", "平台原生难度");
        input2.value = native.value;
        const datalist = element5("datalist");
        datalist.id = "editor-native-difficulties";
        const values = platform === "AT" ? ["ABC A", "ABC B", "ABC C", "ABC D", "ABC E", "ABC F", "ARC A", "ARC B", "ARC C", "ARC D", "ARC E", "ARC F"] : platform === "NC" ? ["简单", "中等", "困难"] : [];
        values.forEach((value) => {
          const option2 = element5("option");
          option2.value = value;
          datalist.append(option2);
        });
        input2.setAttribute("list", datalist.id);
        input2.addEventListener("input", () => {
          native.value = input2.value;
        });
        wrapper.append(input2, datalist);
      }
      if (platform !== "LG") {
        const field2 = element5("label", "range-field");
        field2.append(element5("span", "", "洛谷难度（可选）"));
        const select = element5("select", "luogu-range");
        select.setAttribute("aria-label", "补充洛谷难度");
        [["", "未指定"], ...editorLuoguLevels.map((name) => [name, name])].forEach(([value, label], index) => {
          const option2 = element5("option", index ? `tone-${editorLuoguTones[index - 1]}` : "", label);
          option2.value = value;
          select.append(option2);
        });
        select.value = form.elements.luoguDifficulty.value;
        const color2 = () => {
          const level = editorLuoguLevels.indexOf(select.value);
          select.className = `luogu-range${level >= 0 ? ` tone-${editorLuoguTones[level]}` : ""}`;
        };
        select.addEventListener("change", () => {
          form.elements.luoguDifficulty.value = select.value;
          color2();
        });
        color2();
        field2.append(select);
        wrapper.append(field2);
      }
      host.replaceChildren(wrapper);
    }
    function setEditorPlatform(value, clearDifficulty = true) {
      const form = $("#submit-form"), next = platformCode(value);
      if (form.elements.platform.value !== next) {
        form.elements.platform.value = next;
        if (clearDifficulty) {
          form.elements.rating.value = "";
          form.elements.difficulty.value = "";
        }
      }
      renderEditorDifficulty();
    }
    function draftKey(source, ownerId) {
      return JSON.stringify([source || "new", ownerId]);
    }
    function editorError(error) {
      $("#submit-error").textContent = errorMessage(error);
      $("#submit-error").hidden = false;
    }
    function openLocalSolution(problem) {
      if (getBusy() || problem.kind !== "document") return;
      const ownerId = accountId();
      const sourceUrl = problem.problemUrl || problem.url;
      const sameProblem = (record) => {
        if (record.sourceProblemId === key(problem) && record.sourceProblemRepo === problem.repo) return true;
        if (sourceUrl && (record.problemUrl || record.url) === sourceUrl) return true;
        return !!problem.pid && platformCode(record.platform) === platformCode(problem.platform) && String(record.pid || "").replace(/^CF/i, "").toLowerCase() === String(problem.pid).replace(/^CF/i, "").toLowerCase();
      };
      const matches = getLocal().records.filter((record) => visibleLocal(record) && sameProblem(record));
      const existing = matches.find((record) => record.ownerId === ownerId) || matches[0];
      if (existing) {
        openSubmit(existing);
        return;
      }
      const source = `problem:${JSON.stringify([problem.repo, key(problem)])}`;
      const draft = { url: sourceUrl || "", title: problem.title || "", pid: problem.pid || "", platform: platformCode(problem.platform), tags: (problem.tags || []).join(", "), body: "", rating: problem.rating ?? "", difficulty: problem.difficulty || "", luoguDifficulty: problem.luoguDifficulty || "" };
      openSubmit(null, { source, data: draft, sourceProblemId: key(problem), sourceProblemRepo: problem.repo });
      $("#submit-title").textContent = "写本地题解";
    }
    function openSubmit(record, seed = null) {
      if (getBusy()) return;
      if (record && !(isLocal(record) && visibleLocal(record) || canEditRemote(record))) {
        toast("当前账户无权编辑这条记录");
        return;
      }
      const source = record ? key(record) : seed?.source || "new", ownerId = accountId();
      const candidate = getLocal().draft[draftKey(source, ownerId)];
      const saved = candidate?.source === source && candidate.ownerId === ownerId ? candidate : null;
      const original = record ? structuredClone(record) : null;
      if (original?.kind === "document" && saved?.base?.path === original.path && saved.base.repo === original.repo) original.sha = saved.base.sha;
      setEditor({ source, ownerId, clientId: saved?.clientId || record?.clientId || uuid(), record: original, ...seed ? { sourceProblemId: seed.sourceProblemId, sourceProblemRepo: seed.sourceProblemRepo } : {} });
      const data = record ? { url: record.problemUrl || record.url, title: record.title, pid: record.pid, platform: platformCode(record.platform), tags: (record.tags || []).join(", "), body: record.body || "", rating: record.rating ?? "", difficulty: record.difficulty || "", luoguDifficulty: record.luoguDifficulty || "" } : {};
      fillForm(saved?.source === source && saved.ownerId === ownerId ? saved.data : seed?.data || data);
      renderEditorDifficulty();
      renderEditorTags();
      const editing = !!record;
      $("#creation-extras").hidden = editing;
      $("#save-local-button").disabled = record?.kind === "document";
      $("#save-local-button").title = record?.kind === "document" ? "在线题解修改保存在独立编辑草稿中，请直接更新原文档" : "";
      $("#submit-title").textContent = record?.kind === "document" ? "编辑正式题解" : editing ? "编辑本地记录" : "记下一道错题";
      $("#submit-error").hidden = true;
      $("#draft-hint").textContent = saved ? "已恢复此来源与当前账户的编辑草稿" : record?.kind === "document" ? "保留完整 Markdown 原文，失败后编辑内容仍在此处" : "草稿按来源与当前账户保存在本机";
      $("#publish-button").textContent = record?.kind === "document" ? "更新原文档" : "上传正式题解";
      $("#submit-dialog").showModal();
    }
    async function saveDraft(required = false) {
      if (!getEditor() || getEditor().ownerId !== accountId()) return;
      const { source, ownerId, clientId, record } = getEditor();
      getLocal().draft[draftKey(source, ownerId)] = { source, ownerId, clientId, ...record?.kind === "document" ? { base: { path: record.path, repo: record.repo, sha: record.sha } } : {}, data: formDraft() };
      try {
        await persistLocal();
        $("#draft-hint").textContent = "编辑草稿已保存到当前设备";
      } catch (error) {
        $("#draft-hint").textContent = `编辑草稿保存失败：${errorMessage(error)}；请勿关闭窗口`;
        if (required) throw new Error(`无法持久化编辑标识，尚未写入 GitHub：${errorMessage(error)}`);
      }
    }
    async function saveRecord(remote) {
      const form = $("#submit-form");
      if (getBusy() || !form.reportValidity() || !getEditor()) return;
      if (getEditor().ownerId !== accountId()) {
        editorError("账户已变更，请重新打开编辑器");
        return;
      }
      cancelDraftSave();
      const data = formDraft(), existing = getEditor().record;
      if (!data.body.trim()) {
        editorError("请填写完整 Markdown 题解正文");
        return;
      }
      let parsed;
      try {
        parsed = new URL(data.url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch (_) {
        editorError("请输入有效的 http 或 https 题目链接");
        return;
      }
      if (existing?.kind === "document" && (!remote || !canEditRemote(existing))) {
        editorError("当前账户无权执行此操作；在线编辑只能更新原文档");
        return;
      }
      if (remote) {
        if (demo) {
          editorError("浏览器演示不会写入 GitHub，请保存本地记录");
          return;
        }
        if (!getAccount() || getPermissions().push !== true || !repo()) {
          editorError("请登录具有当前仓库 push 权限的 GitHub 账户并刷新账户");
          return;
        }
        if (existing?.proposalUrl) {
          editorError("这是旧版已投稿副本，请先查看原投稿，不能重复上传");
          return;
        }
        if (!navigator.onLine) {
          editorError("当前离线，编辑内容保留，请联网后重试或保存本地记录");
          await saveDraft();
          return;
        }
        const binding = existing?.kind === "local" && existing.ownerId == null;
        if (!window.confirm(existing?.kind === "document" ? `确认直接更新 ${existing.repo} 中的原文档 ${existing.path}？` : `确认上传正式题解到 ${repo()}？${binding ? " 此未绑定本地记录将绑定当前 GitHub ID " + accountId() + "。" : ""}`)) return;
      }
      const clientId = getEditor().clientId;
      const body = !existing ? [data.body, data.reason.trim() ? `## 错因分析
${data.reason.trim()}` : "", data.trick.trim() ? `## Trick
${data.trick.trim()}` : ""].filter(Boolean).join("\n\n") : data.body;
      const record = { ...existing || {}, ...getEditor().sourceProblemId ? { sourceProblemId: getEditor().sourceProblemId, sourceProblemRepo: getEditor().sourceProblemRepo } : {}, clientId, ownerId: existing && !remote ? existing.ownerId : existing?.ownerId ?? accountId(), title: data.title.trim() || data.pid.trim() || "未命名错题", pid: data.platform === "CF" && data.pid.trim() ? `CF${data.pid.trim().replace(/^CF/i, "")}` : data.pid.trim(), platform: data.platform, rating: data.rating.trim() ? Number(data.rating) : null, difficulty: data.difficulty.trim(), luoguDifficulty: data.platform === "LG" ? "" : data.luoguDifficulty.trim(), tags: data.tags.split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean), problemUrl: parsed.href, url: parsed.href, body, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      if (!remote && !record.author) {
        const ownerIsCurrent = record.ownerId != null && String(record.ownerId) === accountId();
        record.author = ownerIsCurrent ? getAccount()?.login || "本地学习者" : "本地学习者";
      }
      setBusy(true);
      $("#submit-error").hidden = true;
      let wroteRemote = false;
      const previousLocal = structuredClone(getLocal());
      try {
        if (remote && existing?.kind === "local" && existing.ownerId == null) {
          const source = getLocal().records.find((item) => key(item) === getEditor().source && item.clientId === existing.clientId && item.ownerId == null);
          if (!source) throw new Error("本地来源记录已变化，请重新打开编辑器");
          source.ownerId = accountId();
          existing.ownerId = accountId();
        }
        await saveDraft(remote);
        if (remote) {
          const response = await call("saveDocument", { ...record, repo: existing?.kind === "document" ? existing.repo : repo(), ...existing?.kind === "document" ? { path: existing.path, sha: existing.sha } : {} });
          const documentRecord = response?.document || response?.record || response;
          if (documentRecord?.kind !== "document" || !documentRecord.path || !documentRecord.sha) throw new Error("客户端返回的文档不完整，请同步核实；编辑草稿已保留");
          wroteRemote = true;
          setRecords([...getRecords().filter((item) => !(item.path === documentRecord.path && item.repo === documentRecord.repo)), documentRecord]);
          if (existing?.kind === "local") getLocal().records = getLocal().records.filter((item) => !(key(item) === getEditor().source && item.clientId === existing.clientId && item.ownerId === existing.ownerId));
          setSelected(key(documentRecord));
        } else {
          const localRecord = { ...record, id: existing?.id ?? `local:${clientId}`, kind: "local" };
          getLocal().records = [...getLocal().records.filter((item) => !(existing?.kind === "local" && key(item) === getEditor().source && item.clientId === existing.clientId && item.ownerId === existing.ownerId)), localRecord];
          setSelected(key(localRecord));
        }
        delete getLocal().draft[draftKey(getEditor().source, getEditor().ownerId)];
        try {
          await persistLocal();
        } catch (error) {
          if (wroteRemote) {
            toast("GitHub 已更新，本地清理未保存，请同步核实");
          } else throw error;
        }
        const savedRecord = records().find((item) => key(item) === getSelected());
        fillForm(void 0);
        renderEditorTags();
        $("#submit-dialog").close();
        setEditor(null);
        refreshFilters();
        navigate("public");
        if (remote) {
          setSelected(key(savedRecord));
          render6();
        } else openDetail(savedRecord);
        toast(remote ? "正式题解已保存到 GitHub" : "已保存本地记录，收藏后可从个人收藏访问");
      } catch (error) {
        if (!remote) setLocal(previousLocal);
        editorError(error);
        await saveDraft();
      } finally {
        setBusy(false);
      }
    }
    async function deleteDiscussion(record) {
      if (getBusy()) return;
      if (demo) {
        toast("浏览器演示不会删除 GitHub 讨论");
        return;
      }
      if (!sameRepo(record) || !getAccount() || getPermissions().admin !== true) {
        toast("永久删除讨论需要当前仓库管理员权限");
        return;
      }
      if (!window.confirm(`永久删除 GitHub 仓库 ${record.repo} 的 Issue #${record.number}「${record.title}」及其讨论？此操作不能撤销，不会删除正式题解文件。`)) return;
      setBusy(true);
      try {
        const result = await call("deleteIssue", { number: record.number, repo: record.repo });
        if (!result?.deleted) throw new Error("GitHub 未确认删除，请同步核实");
        setIssues(getIssues().filter((item) => !(item.repo === record.repo && item.number === record.number)));
        getComments().delete(key(record));
        getLocal().favorites = getLocal().favorites.filter((id) => String(id) !== key(record));
        delete getLocal().mastery[key(record)];
        try {
          await persistLocal();
        } catch (_) {
          toast("讨论已删除，本地复习状态清理未保存，请同步");
        }
        setSelected(null);
        refreshFilters();
        render6();
        toast("GitHub 讨论已永久删除");
      } catch (error) {
        toast(`删除讨论失败：${errorMessage(error)}`);
      } finally {
        setBusy(false);
      }
    }
    async function deleteRecord(record) {
      if (getBusy()) return;
      const local = isLocal(record);
      if (!(local && visibleLocal(record) || canEditRemote(record))) {
        toast("当前账户没有删除权限");
        return;
      }
      if (demo && !local) {
        toast("浏览器演示不会删除 GitHub 文档");
        return;
      }
      if (!window.confirm(local ? "确认删除这条本地记录？此操作只修改本机。" : `确认从 GitHub 仓库 ${record.repo} 删除 ${record.path}？`)) return;
      setBusy(true);
      try {
        if (local) {
          const previous = structuredClone(getLocal());
          getLocal().records = getLocal().records.filter((item) => item.clientId !== record.clientId);
          try {
            await persistLocal();
          } catch (error) {
            setLocal(previous);
            throw error;
          }
        } else {
          await call("deleteDocument", { path: record.path, sha: record.sha, repo: record.repo });
          setRecords(getRecords().filter((item) => !(item.path === record.path && item.repo === record.repo)));
        }
        setSelected(null);
        refreshFilters();
        render6();
        toast(local ? "本地记录已删除" : "GitHub 文档已删除");
      } catch (error) {
        toast(`删除失败：${errorMessage(error)}`);
      } finally {
        setBusy(false);
      }
    }
    return { formDraft, fillForm, renderEditorDifficulty, setEditorPlatform, draftKey, editorError, openLocalSolution, openSubmit, saveDraft, saveRecord, deleteDiscussion, deleteRecord };
  }

  // src/renderer/library/reader.ts
  function createLibraryReader(options) {
    const global2 = window;
    const { demo, stateLabels, getLocal, setLocal, getAccount, getPermissions, getView, getLibraryScope, getSelected, setSelected, getComments, getBusy, setBusy, getLoading, getError, getRecords, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName, date, quotaBlocked, renderMarkdown, persistLocal, call, render: render6, clearFilters, openSubmit, openLocalSolution, deleteRecord, deleteDiscussion, openExternal, toast, errorMessage } = options;
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button8(label, className, action2) {
      const node3 = element5("button", className, label);
      node3.type = "button";
      node3.addEventListener("click", action2);
      return node3;
    }
    function favorite(record) {
      return getLocal().favorites.some((value) => String(value) === key(record));
    }
    function mastery(record) {
      return stateLabels[getLocal().mastery[key(record)]] ? getLocal().mastery[key(record)] : "unreviewed";
    }
    function badge(record) {
      return element5("span", `badge ${isLocal(record) ? "local" : "shared"}`, isLocal(record) ? record.proposalUrl ? "旧版已投稿副本" : "仅本地 · 未上传" : record.kind === "document" ? "正式题解" : "讨论 Issue");
    }
    function platformLabel(record) {
      const code = platformCode(record.platform);
      const names = { CF: "Codeforces", AT: "AtCoder", LG: "洛谷", NC: "牛客", LC: "LeetCode" };
      const label = element5("span", "platform-label", names[code] || record.platform || "其他平台");
      label.dataset.platform = ["CF", "AT", "LG", "NC", "LC"].includes(code) ? code : "Oth";
      return label;
    }
    function supplementaryDifficultyBadge(record) {
      if (platformCode(record.platform) === "LG" || !record.luoguDifficulty) return element5("span");
      const info = Search.difficulty({ platform: "LG", difficulty: record.luoguDifficulty });
      return element5("span", `difficulty-badge tone-${info.tone}`, `洛谷 · ${record.luoguDifficulty}`);
    }
    function difficultyBadge(record) {
      const { tone, rank, label: text3 } = Search.difficulty(record);
      if (!text3) return null;
      const code = Search.normalizePlatform(record.platform);
      const label = element5("span", `difficulty-badge tone-${tone}${rank ? ` rank-${rank}` : ""}`, text3);
      label.title = `${demo ? "演示值 · " : ""}${code === "CF" ? "Codeforces 原生 Rating 色阶" : code === "LG" ? "洛谷原生难度名称 · 颜色仅用于界面展示" : "平台原始数值 / 难度"}，不跨平台换算`;
      return label;
    }
    function tags(record) {
      const row2 = element5("div", "tag-row");
      (Array.isArray(record.tags) ? record.tags : []).forEach((tag) => {
        let hash = 0;
        for (const char of String(tag)) hash = (hash + char.codePointAt(0)) % 5;
        row2.append(element5("span", `tag tag-color-${hash}`, tag));
      });
      return row2;
    }
    function empty(title, description, action2) {
      const box = element5("div", "empty-state");
      append(box, element5("div", "empty-icon", "⌑"), element5("h3", "", title), element5("p", "", description));
      if (action2) box.append(button8(action2.label, "button secondary", action2.fn));
      return box;
    }
    let focusedDetail = false;
    let readerPosition = null;
    let commentRequest = 0;
    function openDetail(record) {
      if (focusedDetail) return;
      setSelected(key(record));
      readerPosition = { window: global2.scrollY, list: $("#record-list").scrollTop, horizontal: $("#record-list").scrollLeft, panel: $("#detail-panel").scrollTop, focus: document.activeElement };
      focusedDetail = true;
      document.body.classList.add("reading-detail");
      render6();
      $("#detail-back-button")?.focus();
      global2.scrollTo(0, 0);
    }
    function resetDetail() {
      focusedDetail = false;
      document.body.classList.remove("reading-detail");
    }
    function isFocusedDetail() {
      return focusedDetail;
    }
    function closeDetail() {
      resetDetail();
      render6();
      if (readerPosition) {
        $("#record-list").scrollTop = readerPosition.list;
        $("#record-list").scrollLeft = readerPosition.horizontal;
        $("#detail-panel").scrollTop = readerPosition.panel;
        global2.scrollTo(0, readerPosition.window);
        const card = $$(".record-card").find((n) => n.dataset.key === getSelected());
        card?.focus({ preventScroll: true });
      }
    }
    function renderFocusedDetail() {
      if (!focusedDetail) return false;
      const selected2 = getRecords().find((record) => key(record) === getSelected());
      if (selected2) {
        renderDetail(selected2);
        return true;
      }
      resetDetail();
      return false;
    }
    function renderLibrary(items) {
      if (!items.some((record2) => key(record2) === getSelected())) setSelected(items[0] ? key(items[0]) : null);
      const list = $("#record-list");
      list.replaceChildren();
      const publicList = getView() === "public";
      $("#library-panel").classList.toggle("public-problem-list", publicList);
      if (publicList) {
        const heading = element5("div", "problem-list-columns");
        heading.setAttribute("aria-hidden", "true");
        ["平台", "题号", "算法标签", "题目", "难度", "作者", "更新"].forEach((label) => heading.append(element5("span", "", label)));
        list.append(heading);
      }
      const fragment = document.createDocumentFragment();
      items.forEach((record2) => {
        const card = button8("", `record-card${!publicList && key(record2) === getSelected() ? " selected" : ""}`, () => {
          if (publicList) {
            openDetail(record2);
            return;
          }
          setSelected(key(record2));
          $$(".record-card").forEach((n) => {
            const active3 = n.dataset.key === getSelected();
            n.classList.toggle("selected", active3);
            n.setAttribute("aria-pressed", String(active3));
          });
          renderDetail(record2);
        });
        card.dataset.key = key(record2);
        card.title = publicList ? "点击题目阅读题解；返回后保留列表位置" : "单击预览，双击打开详情；Enter 打开详情";
        if (!publicList) card.setAttribute("aria-pressed", key(record2) === getSelected() ? "true" : "false");
        card.addEventListener("dblclick", () => openDetail(record2));
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            openDetail(record2);
          }
        });
        if (publicList) {
          card.classList.add("problem-list-row");
          const platform = platformLabel(record2);
          const identity2 = element5("span", "problem-id", record2.pid || "—");
          const algorithms = tags(record2);
          algorithms.classList.add("problem-algorithms");
          algorithms.title = (record2.tags || []).join(" · ");
          const problem = append(element5("div", "problem-summary"), element5("h2", "card-title", record2.title || "未命名错题"));
          const difficulty2 = element5("span", "problem-difficulty");
          const native = difficultyBadge(record2);
          if (native) difficulty2.append(native);
          if (platformCode(record2.platform) !== "LG" && record2.luoguDifficulty) difficulty2.append(supplementaryDifficultyBadge(record2));
          if (!difficulty2.childElementCount) difficulty2.append(element5("span", "problem-difficulty-empty", "未标注"));
          const author = recordAuthor(record2, getAccount());
          const authorCell = append(element5("span", "problem-author"), authorAvatar(author), element5("span", "record-author-name", author.name));
          authorCell.title = author.name;
          authorCell.setAttribute("aria-label", `作者 ${author.name}`);
          const updated = element5("time", "problem-updated", date(record2.updatedAt));
          const timestamp = new Date(record2.updatedAt);
          if (Number.isFinite(timestamp.getTime())) updated.dateTime = timestamp.toISOString();
          append(card, platform, identity2, algorithms, problem, difficulty2, authorCell, updated);
          if (favorite(record2)) {
            const mark = element5("span", "problem-favorite", "★");
            mark.setAttribute("aria-label", "已收藏");
            problem.querySelector("h2").append(mark);
          }
        } else {
          const author = recordAuthor(record2, getAccount());
          const authorLine = append(element5("div", "card-author"), authorAvatar(author), element5("span", "record-author-name", author.name));
          authorLine.setAttribute("aria-label", `作者 ${author.name}`);
          append(card, append(element5("div", "card-meta"), platformLabel(record2), element5("span", "", record2.pid || `#${record2.number || "本地"}`), difficultyBadge(record2), supplementaryDifficultyBadge(record2), badge(record2)), element5("h2", "card-title", record2.title || "未命名错题"), tags(record2), authorLine, append(element5("div", "card-footer"), element5("span", `card-state ${mastery(record2)}`, stateLabels[mastery(record2)]), element5("span", "", `${favorite(record2) ? "★ · " : ""}${date(record2.updatedAt)}`)));
        }
        fragment.append(card);
      });
      list.append(fragment);
      if (!items.length) list.append(empty(getLoading() ? "正在载入题库" : getView() === "public" && getLibraryScope() === "local" ? "还没有本地题解" : "这里还没有题目", getLoading() ? "等待客户端返回你的学习数据。" : "试试调整筛选，或记下第一道值得回顾的错题。", { label: "清空筛选", fn: clearFilters }));
      if (publicList) {
        $("#detail-panel").replaceChildren();
        return;
      }
      const record = items.find((item) => key(item) === getSelected());
      if (record) renderDetail(record);
      else {
        const quota = quotaBlocked();
        $("#detail-panel").replaceChildren(empty("给思考留一个位置", quota ? "GitHub 请求额度已用完，登录 GitHub 账户后即可同步题库，或先保存一道本地错题。" : getError() ? "客户端连接暂不可用。你可以重试同步，或先保存一道本地错题。" : getView() === "favorites" ? "点击题目详情中的收藏，把想反复理解的思路留在这里。" : "从左侧选择题目，阅读分析、记录理解，再迈进一步。", { label: "＋ 记一道错题", fn: () => openSubmit() }));
      }
    }
    async function changeLocal(change) {
      if (getBusy()) return;
      setBusy(true);
      const before = structuredClone(getLocal());
      change();
      render6();
      try {
        await persistLocal();
      } catch (error) {
        setLocal(before);
        render6();
        toast(`未能保存：${errorMessage(error)}`);
      } finally {
        setBusy(false);
      }
    }
    function renderDetail(record) {
      const panel = $("#detail-panel");
      const scroll = panel.scrollTop;
      panel.replaceChildren();
      if (focusedDetail) {
        const back = button8("← 返回题目列表", "button secondary detail-back", closeDetail);
        back.id = "detail-back-button";
        panel.append(back);
      } else {
        const open2 = button8("打开详情 ↗", "button primary detail-open", () => openDetail(record));
        open2.id = "open-detail-button";
        panel.append(open2);
      }
      const actions = append(element5("div", "detail-actions"), button8(favorite(record) ? "★ 已收藏" : "☆ 收藏", "button secondary", () => changeLocal(() => {
        getLocal().favorites = favorite(record) ? getLocal().favorites.filter((value) => String(value) !== key(record)) : [...getLocal().favorites, key(record)];
      })), button8("原题 ↗", "button subtle", () => openExternal(record.problemUrl || record.url)));
      if (record.kind === "document") {
        const localSolution = button8("＋ 本地题解", "button subtle public-local-solution", () => openLocalSolution(record));
        localSolution.id = "local-solution-button";
        localSolution.title = "为这道题写自己的本地题解；已有本地记录时继续编辑";
        actions.append(localSolution);
      }
      append(panel, append(element5("div", "detail-top"), append(element5("div", "detail-meta"), platformLabel(record), element5("span", "", record.pid || `#${record.number || "本地"}`), difficultyBadge(record), supplementaryDifficultyBadge(record), badge(record)), actions), element5("h2", "detail-title", record.title || "未命名错题"));
      const author = recordAuthor(record, getAccount());
      append(panel, append(element5("div", "author-row"), authorAvatar(author), element5("span", "record-author-name", author.name), element5("span", "separator", "·"), element5("span", "", `更新于 ${date(record.updatedAt)}`), record.kind === "document" ? element5("span", "badge document", "正式题解") : null));
      const tagrow = tags(record);
      tagrow.classList.add("detail-tags");
      append(panel, tagrow, element5("hr", "detail-divider"), element5("div", "body-label", "思路与复盘"));
      const body = element5("div", "markdown-body");
      renderMarkdown(body, record.body);
      panel.append(body);
      const masteryButtons = element5("div", "mastery-buttons");
      Object.entries(stateLabels).forEach(([value, label]) => {
        const control = button8(label, mastery(record) === value ? "active" : "", () => changeLocal(() => {
          getLocal().mastery[key(record)] = value;
        }));
        control.setAttribute("aria-pressed", mastery(record) === value ? "true" : "false");
        masteryButtons.append(control);
      });
      append(panel, append(element5("div", "mastery-box"), append(element5("div"), element5("strong", "", "这个思路，掌握了吗？"), element5("small", "", "复习进度仅记录在你的学习空间")), masteryButtons));
      const edits = element5("div", "record-edit-actions");
      if (record.proposalUrl) edits.append(button8("旧版已投稿副本 · 查看投稿 ↗", "button secondary", () => openExternal(record.proposalUrl)));
      if (isLocal(record) && visibleLocal(record) || canEditRemote(record)) {
        const edit = button8(isLocal(record) ? "编辑本地记录" : "编辑正式题解", "button secondary", () => openSubmit(record));
        edit.id = "edit-record-button";
        const remove = button8(isLocal(record) ? "删除本地记录" : "删除正式题解", "button danger", () => deleteRecord(record));
        remove.id = "delete-record-button";
        append(edits, edit, remove);
      }
      if (record.kind === "issue" && sameRepo(record) && getAccount() && getPermissions().admin === true) {
        const remove = button8("永久删除讨论 Issue", "button danger", () => deleteDiscussion(record));
        remove.id = "delete-issue-button";
        edits.append(remove);
      }
      panel.append(edits);
      panel.scrollTop = scroll;
      if (record.kind !== "issue" || !record.number) return;
      const comments = element5("section", "comments-section");
      append(comments, append(element5("div", "section-heading"), element5("h3", "", "一起讨论")));
      const commentList = element5("div");
      comments.append(commentList);
      panel.append(comments);
      const form = element5("form", "comment-form");
      const input2 = element5("textarea");
      input2.rows = 2;
      input2.placeholder = "分享你的观察，或提出一个问题…";
      input2.setAttribute("aria-label", "评论内容");
      input2.required = true;
      input2.maxLength = 1e4;
      const submit = element5("button", "button secondary", demo ? "演示评论" : "发表讨论");
      submit.type = "submit";
      append(form, input2, submit);
      comments.append(form);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body2 = input2.value.trim();
        if (!body2 || getBusy()) return;
        if (!getAccount() && !demo) {
          toast("请先登录 GitHub 账户再评论");
          return;
        }
        if (!navigator.onLine && !demo) {
          toast("当前离线，请联网后发表评论");
          return;
        }
        setBusy(true);
        submit.disabled = true;
        try {
          if (demo) {
            const items = getComments().get(key(record)) || [];
            getComments().set(key(record), [...items, { author: "我 · 演示", body: body2 }]);
          } else {
            await call("comment", { number: record.number, repo: record.repo, body: body2 });
            getComments().delete(key(record));
          }
          input2.value = "";
          await loadComments(record, commentList);
          toast(demo ? "演示评论已添加，未向外部发送" : "评论已发表");
        } catch (error) {
          toast(errorMessage(error));
        } finally {
          setBusy(false);
          submit.disabled = false;
        }
      });
      void loadComments(record, commentList);
    }
    async function loadComments(record, container) {
      const request = ++commentRequest;
      container.replaceChildren(element5("div", "comment-empty", "正在加载讨论…"));
      try {
        let comments = getComments().get(key(record));
        if (!comments) {
          if (Array.isArray(record.comments)) comments = record.comments;
          else if (demo) comments = [];
          else {
            const response = await call("getComments", record.number);
            comments = Array.isArray(response) ? response : response?.comments || [];
          }
          getComments().set(key(record), comments);
        }
        if (request !== commentRequest || !container.isConnected) return;
        container.replaceChildren();
        if (!comments.length) container.append(element5("div", "comment-empty", demo ? "演示讨论区 · 留下第一条思考，不会发送到外部。" : "还没有讨论，你的观察也许就是别人的突破口。"));
        comments.forEach((comment) => {
          container.append(append(element5("article", "comment-item"), element5("strong", "", authorName(comment.author || comment.user)), element5("p", "", comment.body || "")));
        });
      } catch (error) {
        if (container.isConnected) container.replaceChildren(element5("div", "comment-empty", `讨论暂不可用：${errorMessage(error)}`));
      }
    }
    return { favorite, mastery, tags, openDetail, closeDetail, resetDetail, isFocusedDetail, renderFocusedDetail, renderLibrary, renderDetail, loadComments, changeLocal };
  }

  // src/renderer/account/settings.ts
  function createSettings(options) {
    const { demo, bridge: bridge3, themeStorage, paletteStorage, getBusy, setBusy, getSettings, setSettings, getAccount, getAuthStatus, getPermissions, setPermissionsRepo, getError, setError, getLocal, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData, resetSourceView, clearComments, refreshFilters, render: render6, renderUpdate, updateStatus, sync, writeDemo, toast, errorMessage } = options;
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    const escapeHtml2 = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    let settingsPreview = null;
    let appearanceBeforePreview = null;
    let editingRepos = [];
    let editingActiveId = "";
    let authUrl = "";
    function clistApi() {
      const candidate = window.notebook;
      return candidate && typeof candidate.saveClistCredentials === "function" && typeof candidate.clearClistCredentials === "function" && typeof candidate.getClistStatus === "function" ? candidate : null;
    }
    function clistStatusText(status) {
      const value = status && typeof status === "object" ? status : {};
      return value.configured === true ? `已配置${typeof value.username === "string" && value.username.trim() ? ` · ${value.username.trim()}` : ""}` : "未配置";
    }
    async function renderClistStatus() {
      const statusNode = $("#clist-status");
      if (!statusNode) return;
      const api = clistApi();
      if (!api) {
        statusNode.textContent = "桌面端未接入";
        return;
      }
      try {
        statusNode.textContent = clistStatusText(await api.getClistStatus());
      } catch (_) {
        statusNode.textContent = "状态不可用";
      }
    }
    async function saveClistCredentials() {
      const usernameNode = $("#clist-username");
      const apiKeyNode = $("#clist-api-key");
      const errorNode = $("#clist-error");
      if (!usernameNode || !apiKeyNode) return;
      const username2 = usernameNode.value.trim();
      const apiKey = apiKeyNode.value;
      apiKeyNode.value = "";
      if (!username2 || !apiKey) {
        if (errorNode) {
          errorNode.textContent = "请输入 CLIST 用户名和 API key";
          errorNode.hidden = false;
        }
        return;
      }
      const api = clistApi();
      if (!api) {
        if (errorNode) {
          errorNode.textContent = "当前桌面端未接入 CLIST 配置接口";
          errorNode.hidden = false;
        }
        return;
      }
      if (errorNode) errorNode.hidden = true;
      const saveButton2 = $("#clist-save-button");
      if (saveButton2) saveButton2.disabled = true;
      try {
        await api.saveClistCredentials({ username: username2, apiKey });
        usernameNode.value = username2;
        await renderClistStatus();
        toast("CLIST 配置已保存");
      } catch (error) {
        if (errorNode) {
          errorNode.textContent = errorMessage(error);
          errorNode.hidden = false;
        }
      } finally {
        if (saveButton2) saveButton2.disabled = false;
      }
    }
    async function clearClistCredentials() {
      const apiKeyNode = $("#clist-api-key");
      if (apiKeyNode) apiKeyNode.value = "";
      const errorNode = $("#clist-error");
      const api = clistApi();
      if (!api) {
        if (errorNode) {
          errorNode.textContent = "当前桌面端未接入 CLIST 配置接口";
          errorNode.hidden = false;
        }
        return;
      }
      if (errorNode) errorNode.hidden = true;
      const clearButton = $("#clist-clear-button");
      if (clearButton) clearButton.disabled = true;
      try {
        await api.clearClistCredentials();
        const usernameNode = $("#clist-username");
        if (usernameNode) usernameNode.value = "";
        await renderClistStatus();
        toast("CLIST 配置已删除");
      } catch (error) {
        const errorNode2 = $("#clist-error");
        if (errorNode2) {
          errorNode2.textContent = errorMessage(error);
          errorNode2.hidden = false;
        }
      } finally {
        if (clearButton) clearButton.disabled = false;
      }
    }
    function normalizeTheme(theme) {
      return theme === "dark" ? "dark" : "light";
    }
    function normalizePalette(palette, fallback = "porcelain") {
      switch (palette) {
        case "porcelain":
        case "blue":
        case "violet":
        case "rose":
        case "amber":
        case "teal":
          return palette;
        default:
          return fallback;
      }
    }
    function readTheme() {
      try {
        return localStorage.getItem(themeStorage) || "light";
      } catch (_) {
        return "light";
      }
    }
    function readPalette() {
      try {
        const palette = localStorage.getItem(paletteStorage);
        return normalizePalette(palette, palette === null && readTheme() === "cards" ? "amber" : "porcelain");
      } catch (_) {
        return "porcelain";
      }
    }
    function applyTheme(theme) {
      const mode = normalizeTheme(theme);
      document.body.dataset.theme = mode;
      $("#theme-select").value = mode;
      try {
        localStorage.setItem(themeStorage, mode);
      } catch (_) {
      }
    }
    function applyPalette(palette) {
      const value = normalizePalette(palette);
      document.body.dataset.palette = value;
      $("#palette-select").value = value;
      try {
        localStorage.setItem(paletteStorage, value);
      } catch (_) {
      }
    }
    function applyAppearance(settings) {
      const theme = normalizeTheme(settings.theme);
      const palette = normalizePalette(settings.palette, settings.theme === "cards" && settings.palette === void 0 ? "amber" : "porcelain");
      settings.theme = theme;
      settings.palette = palette;
      applyTheme(theme);
      applyPalette(palette);
    }
    function applyCodeSettings(settings = settingsPreview || getSettings()) {
      const size = Math.round(Number(settings.codeFontSize));
      document.body.style.setProperty("--code-font-size", (Number.isFinite(size) && size >= 10 && size <= 18 ? size : 11) + "px");
    }
    function renderRepoSelector() {
      const select = $("#repo-select");
      if (!select) return;
      const settings = getSettings();
      const repos = Array.isArray(settings?.repositories) && settings.repositories.length ? settings.repositories : [
        { id: "repo-current", name: "当前题库", repo: settings?.repo || "qmx-acm-data/2026", serverUrl: settings?.serverUrl || "" }
      ];
      const activeId = settings?.activeRepoId || repos[0].id;
      select.replaceChildren();
      repos.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `${r.name || r.repo} (${r.repo})`;
        if (r.id === activeId) opt.selected = true;
        select.append(opt);
      });
    }
    function renderSettingsRepoList() {
      const container = $("#settings-repo-list");
      if (!container) return;
      container.replaceChildren();
      editingRepos.forEach((r, idx) => {
        const item = document.createElement("div");
        item.className = "repo-card-item" + (r.id === editingActiveId ? " active" : "");
        item.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border:1px solid var(--line);border-radius:6px;margin-bottom:6px;background:var(--surface-soft);font-size:11px;";
        if (r.id === editingActiveId) {
          item.style.borderColor = "var(--accent)";
          item.style.background = "var(--accent-soft)";
        }
        const meta = document.createElement("div");
        meta.style.cssText = "min-width:0;flex:1;";
        meta.innerHTML = `<div><strong>${escapeHtml2(r.name || r.repo)}</strong> ${r.id === editingActiveId ? '<span style="color:var(--accent);font-size:10px;font-weight:600;">[当前使用]</span>' : ""}</div><div style="font-size:10px;color:var(--muted);">${escapeHtml2(r.serverUrl ? r.serverUrl + " · " : "GitHub · ")}${escapeHtml2(r.repo)}</div>`;
        const actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:6px;align-items:center;";
        if (r.id !== editingActiveId) {
          const switchBtn = document.createElement("button");
          switchBtn.type = "button";
          switchBtn.className = "button secondary";
          switchBtn.style.padding = "4px 8px";
          switchBtn.style.fontSize = "10px";
          switchBtn.textContent = "设为当前";
          switchBtn.onclick = () => {
            editingActiveId = r.id;
            renderSettingsRepoList();
          };
          actions.append(switchBtn);
        }
        if (editingRepos.length > 1) {
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "icon-button";
          delBtn.style.fontSize = "12px";
          delBtn.title = "删除此仓库";
          delBtn.textContent = "✕";
          delBtn.onclick = () => {
            editingRepos.splice(idx, 1);
            if (editingActiveId === r.id) editingActiveId = editingRepos[0].id;
            renderSettingsRepoList();
          };
          actions.append(delBtn);
        }
        item.append(meta, actions);
        container.append(item);
      });
    }
    async function switchRepository(event) {
      const selectedId = event.target.value;
      if (selectedId === getSettings().activeRepoId) return;
      if (getBusy() || $("#submit-dialog").open || document.querySelector("dialog[open]")) {
        event.target.value = getSettings().activeRepoId;
        toast("请先完成当前操作或关闭弹窗");
        return;
      }
      setBusy(true);
      try {
        if (!demo) {
          await call("saveSettings", { activeRepoId: selectedId });
          applyPayload(await call("bootstrap"));
        } else {
          const settings = getSettings();
          settings.activeRepoId = selectedId;
          const target = (settings.repositories || []).find((r) => r.id === selectedId);
          if (target) {
            settings.repo = target.repo;
            settings.serverUrl = target.serverUrl;
            setPermissionsRepo(target.repo);
          }
          writeDemo();
          resetRepositoryData();
          renderRepoSelector();
        }
        resetSourceView();
        refreshFilters();
        render6();
        toast("已切换到仓库：" + (getSettings().repo || ""));
      } catch (err) {
        renderRepoSelector();
        toast(errorMessage(err));
        return;
      } finally {
        setBusy(false);
      }
      await sync();
    }
    function addRepository() {
      const nameInput = $("#new-repo-name"), serverInput = $("#new-repo-server"), pathInput = $("#new-repo-path");
      const name = nameInput.value.trim();
      const serverUrl = serverInput.value.trim();
      const repoPath = pathInput.value.trim();
      if (!repoPath || !/^[\w.-]+\/[\w.-]+$/.test(repoPath)) {
        toast("仓库路径格式不正确，应为 owner/repo");
        return;
      }
      if (serverUrl) {
        try {
          const url = new URL(serverUrl);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || /[\s\\]/.test(serverUrl)) throw new Error();
        } catch {
          toast("Git 服务地址须为不含账号密码、查询参数和锚点的 HTTP/HTTPS 地址");
          return;
        }
      }
      const id = "repo-" + Math.random().toString(36).slice(2, 9);
      editingRepos.push({ id, name: name || repoPath, serverUrl, repo: repoPath });
      nameInput.value = "";
      serverInput.value = "";
      pathInput.value = "";
      renderSettingsRepoList();
      toast("已添加仓库：" + (name || repoPath));
    }
    async function changeAppearance(field2, event) {
      if (getBusy()) return;
      const previous = { ...getSettings() };
      const settings = getSettings();
      if (field2 === "theme") {
        settings.theme = normalizeTheme(event.target.value);
        applyTheme(settings.theme);
      } else {
        settings.palette = normalizePalette(event.target.value);
        applyPalette(settings.palette);
      }
      setBusy(true);
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { [field2]: settings[field2] });
      } catch (error) {
        setSettings(previous);
        toast(`当前外观已预览，设置未保存：${errorMessage(error)}`);
      } finally {
        setBusy(false);
      }
    }
    function changeTheme(event) {
      return changeAppearance("theme", event);
    }
    function changePalette(event) {
      return changeAppearance("palette", event);
    }
    function previewAppearance() {
      if (!settingsPreview) return;
      const form = $("#settings-form");
      settingsPreview.theme = normalizeTheme(form.elements.theme.value);
      settingsPreview.palette = normalizePalette(form.elements.palette.value);
      applyTheme(settingsPreview.theme);
      applyPalette(settingsPreview.palette);
    }
    function openSettings() {
      if (getBusy() || $("#submit-dialog").open) {
        toast("请先完成或关闭编辑");
        return;
      }
      try {
        const settings = getSettings();
        appearanceBeforePreview = { theme: normalizeTheme(document.body.dataset.theme), palette: normalizePalette(document.body.dataset.palette) };
        settingsPreview = { ...settings, ...appearanceBeforePreview };
        const form = $("#settings-form");
        if (form.elements.theme) form.elements.theme.value = settingsPreview.theme;
        if (form.elements.palette) form.elements.palette.value = settingsPreview.palette;
        editingRepos = Array.isArray(settings.repositories) && settings.repositories.length ? structuredClone(settings.repositories) : [
          { id: "repo-current", name: "当前题库", serverUrl: settings.serverUrl || "", repo: settings.repo || "qmx-acm-data/2026" }
        ];
        editingActiveId = settings.activeRepoId || editingRepos[0]?.id || "repo-current";
        renderSettingsRepoList();
        if (form.elements.clientId) form.elements.clientId.value = settings.clientId || "";
        if (form.elements.displayName) form.elements.displayName.value = settings.displayName || "";
        if (form.elements.autoSync) form.elements.autoSync.checked = settings.autoSync !== false;
        if (form.elements.codeFontSize) form.elements.codeFontSize.value = String(settings.codeFontSize || 11);
        const fontSizeNode = $("#code-font-size-value");
        if (fontSizeNode) fontSizeNode.textContent = (settings.codeFontSize || 11) + "px";
        if (form.elements.codeLineNumbers) form.elements.codeLineNumbers.checked = settings.codeLineNumbers === true;
      } catch (e) {
        console.error("Settings init error:", e);
      }
      $("#settings-dialog").showModal();
    }
    async function saveSettings(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const previousSource = repoSource();
      let saved = false;
      const activeRepoObj = editingRepos.find((r) => r.id === editingActiveId) || editingRepos[0];
      const currentSettings = getSettings();
      const settings = {
        ...currentSettings,
        theme: normalizeTheme(form.elements.theme.value),
        palette: normalizePalette(form.elements.palette.value),
        repositories: editingRepos,
        activeRepoId: editingActiveId,
        serverUrl: activeRepoObj ? activeRepoObj.serverUrl : currentSettings.serverUrl || "",
        repo: activeRepoObj ? activeRepoObj.repo : currentSettings.repo || "qmx-acm-data/2026",
        clientId: form.elements.clientId.value.trim(),
        displayName: form.elements.displayName.value.trim(),
        autoSync: form.elements.autoSync.checked,
        codeFontSize: Number(form.elements.codeFontSize.value),
        codeLineNumbers: form.elements.codeLineNumbers.checked
      };
      if (getBusy()) return;
      setBusy(true);
      try {
        if (!demo) {
          await call("saveSettings", settings);
          applyPayload(await call("bootstrap"));
        } else {
          setSettings(settings);
          setPermissionsRepo(settings.repo);
          if (previousSource !== repoSource()) resetRepositoryData();
        }
        if (previousSource !== repoSource()) resetSourceView();
        saved = true;
        settingsPreview = null;
        appearanceBeforePreview = null;
        applyCodeSettings();
        applyAppearance(getSettings());
        renderRepoSelector();
        writeDemo();
        $("#settings-dialog").close();
        refreshFilters();
        render6();
        toast("设置已保存");
      } catch (error) {
        toast(errorMessage(error));
      } finally {
        setBusy(false);
      }
      if (saved && previousSource !== repoSource()) await sync();
    }
    function previewCodeFontSize() {
      if (!settingsPreview) return;
      const size = Number($("#settings-form").elements.codeFontSize.value);
      settingsPreview.codeFontSize = size;
      applyCodeSettings();
      $("#code-font-size-value").textContent = size + "px";
    }
    function previewCodeLineNumbers() {
      if (!settingsPreview) return;
      settingsPreview.codeLineNumbers = $("#settings-form").elements.codeLineNumbers.checked;
      render6();
    }
    function closeSettings() {
      if (!settingsPreview) return;
      settingsPreview = null;
      if (appearanceBeforePreview) {
        applyTheme(appearanceBeforePreview.theme);
        applyPalette(appearanceBeforePreview.palette);
      }
      appearanceBeforePreview = null;
      applyCodeSettings();
      render6();
    }
    function renderAccount() {
      renderUpdate();
      const account = getAccount(), permissions = getPermissions(), authStatus = getAuthStatus();
      const box = $("#account-details");
      box.replaceChildren();
      for (const [label, value] of [["姓名", account?.name || "未设置"], ["GitHub 登录名", account?.login || "未登录"], ["GitHub ID", account?.id ?? "未登录"], ["当前仓库", repo() || "未配置"], ["权限", account ? permissions.admin ? "管理员 · 可直接维护自己的题解" : permissions.push ? "可推送 · 可直接维护自己的题解" : "只读 · 可使用本地记录" : "未登录 · 仅本地编辑"]]) append(box, element5("dt", "", label), element5("dd", "", value));
      const clistUsername = $("#clist-username");
      if (clistUsername) clistUsername.value = "";
      void renderClistStatus();
      const authLabel = { anonymous: "未登录", restored: "已恢复，等待验证", verified: "已验证", expired: "授权已过期，请重新登录", unverified: "尚未验证，请联网刷新", "recovery-required": "凭证恢复失败，请重新授权" };
      if (authLabel[authStatus?.status]) append(box, element5("dt", "", "认证状态"), element5("dd", "", authLabel[authStatus.status]));
      $("#account-login").textContent = ["expired", "recovery-required"].includes(authStatus?.status) ? "重新授权 GitHub" : "登录 GitHub";
      $("#account-login").hidden = !!account && !["expired", "recovery-required"].includes(authStatus?.status);
      ["account-switch", "account-logout", "account-refresh"].forEach((id) => {
        document.getElementById(id).hidden = !account;
      });
    }
    function openAccount() {
      if (getBusy()) return;
      if ($("#submit-dialog").open) {
        toast("请先完成或关闭编辑，草稿不会跨账户恢复");
        return;
      }
      renderAccount();
      $("#account-error").hidden = true;
      $("#account-dialog").showModal();
    }
    async function startLoginFromBanner() {
      if (getBusy() || demo) return;
      renderAccount();
      $("#account-error").hidden = true;
      $("#account-dialog").showModal();
      const ok = await accountAction("login");
      if (ok) $("#account-dialog").close();
    }
    async function accountAction(action2) {
      if (getBusy()) return false;
      if (demo) {
        $("#account-error").hidden = false;
        $("#account-error").textContent = "浏览器演示不连接 GitHub，账户功能请在桌面客户端使用";
        return false;
      }
      setBusy(true);
      $("#account-error").hidden = true;
      const resumeSync = action2 === "login" || action2 === "switch" ? reauthNeeded() || quotaBlocked() : false;
      const previousError = getError();
      let loggedIn = false;
      try {
        if (action2 === "refresh") applyPayload(await call("refreshAccount"));
        else {
          if (action2 === "logout" || action2 === "switch") await call("logout");
          if (action2 === "login" || action2 === "switch") {
            $("#auth-message").textContent = "正在请求设备授权…";
            $("#auth-code").textContent = "";
            $("#auth-open-button").hidden = true;
            $("#auth-copy-button").hidden = true;
            $("#auth-dialog").showModal();
            await call("login");
            loggedIn = true;
          }
          applyPayload(await call("bootstrap"));
        }
        clearComments();
        refreshFilters();
        render6();
        renderAccount();
        toast("账户与仓库权限已更新");
        return true;
      } catch (error) {
        $("#account-error").hidden = false;
        $("#account-error").textContent = errorMessage(error);
        try {
          applyPayload(await call("bootstrap"));
          refreshFilters();
          render6();
          renderAccount();
        } catch (_) {
        }
        if (!loggedIn && previousError && (action2 === "login" || action2 === "switch")) {
          setError(previousError);
          updateStatus();
        }
        return false;
      } finally {
        $("#auth-dialog").close();
        setBusy(false);
        if (loggedIn && resumeSync) void sync();
      }
    }
    function receiveAuthProgress(progress) {
      $("#auth-message").textContent = progress?.message || "请在 GitHub 页面完成授权，当前窗口会自动更新。";
      $("#auth-code").textContent = progress?.userCode || progress?.user_code || "";
      authUrl = progress?.verificationUri || progress?.verification_uri || progress?.verificationUrl || progress?.url || "";
      $("#auth-open-button").hidden = !authUrl;
      $("#auth-copy-button").hidden = !authUrl;
      $("#auth-url").textContent = authUrl;
      $("#auth-url").hidden = !authUrl;
      if (!$("#auth-dialog").open) $("#auth-dialog").showModal();
    }
    async function openAuthUrl() {
      if (!authUrl) return;
      try {
        await call("openAuthUrl", authUrl);
      } catch (error) {
        toast(`无法打开浏览器：${errorMessage(error)}。可复制下方链接手动授权`);
      }
    }
    async function copyAuthUrl() {
      if (!authUrl) return;
      try {
        await navigator.clipboard.writeText(authUrl);
        toast("授权链接已复制，可粘贴到浏览器打开");
      } catch (_) {
        toast("复制失败，请手动复制链接");
      }
    }
    async function cancelLogin() {
      try {
        if (!demo) await call("cancelLogin");
      } catch (error) {
        toast(errorMessage(error));
      }
      $("#auth-dialog").close();
    }
    async function loginFromSettings() {
      if (getBusy()) return;
      if (demo) {
        toast("浏览器演示不连接 GitHub，账户功能请在桌面客户端使用");
        return;
      }
      $("#settings-dialog").close();
      await startLoginFromBanner();
    }
    async function exportLocal() {
      try {
        if (demo) {
          const blob = new Blob([JSON.stringify(getLocal(), null, 2)], { type: "application/json" });
          const href = URL.createObjectURL(blob);
          const link = element5("a");
          link.href = href;
          link.download = "acm-notebook-demo-local.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(href), 1e3);
          toast("演示本地数据已导出");
        } else {
          const result = await call("exportLocal");
          if (result !== false && !result?.canceled) toast("本地数据已导出");
        }
      } catch (error) {
        toast(errorMessage(error));
      }
    }
    $("#repo-select")?.addEventListener("change", switchRepository);
    $("#new-repo-add-btn")?.addEventListener("click", addRepository);
    $("#theme-select").addEventListener("change", changeTheme);
    $("#palette-select").addEventListener("change", changePalette);
    $("#settings-form").elements.theme.addEventListener("change", previewAppearance);
    $("#settings-form").elements.palette.addEventListener("change", previewAppearance);
    $("#settings-button").addEventListener("click", openSettings);
    $("#settings-form").addEventListener("submit", saveSettings);
    $("#settings-form").elements.codeFontSize.addEventListener("input", previewCodeFontSize);
    $("#settings-form").elements.codeLineNumbers.addEventListener("change", previewCodeLineNumbers);
    $("#settings-dialog").addEventListener("close", closeSettings);
    $("#settings-login-button").addEventListener("click", loginFromSettings);
    $("#account-button").addEventListener("click", openAccount);
    $("#account-dialog").addEventListener("close", () => {
      const apiKeyNode = $("#clist-api-key");
      if (apiKeyNode) apiKeyNode.value = "";
    });
    $("#clist-save-button")?.addEventListener("click", () => void saveClistCredentials());
    $("#clist-clear-button")?.addEventListener("click", () => void clearClistCredentials());
    ["login", "logout", "switch", "refresh"].forEach((action2) => {
      document.getElementById(`account-${action2}`).addEventListener("click", () => accountAction(action2));
    });
    if (typeof bridge3?.onAuthProgress === "function") bridge3.onAuthProgress(receiveAuthProgress);
    $("#auth-open-button").addEventListener("click", openAuthUrl);
    $("#auth-copy-button").addEventListener("click", copyAuthUrl);
    $("#cancel-login-button").addEventListener("click", cancelLogin);
    $("#auth-dialog").addEventListener("cancel", (event) => {
      event.preventDefault();
      void cancelLogin();
    });
    $("#export-local-button").addEventListener("click", exportLocal);
    return {
      readTheme,
      readPalette,
      applyTheme,
      applyPalette,
      applyAppearance,
      applyCodeSettings,
      renderRepoSelector,
      renderSettingsRepoList,
      switchRepository,
      addRepository,
      changeTheme,
      changePalette,
      previewAppearance,
      openSettings,
      saveSettings,
      previewCodeFontSize,
      previewCodeLineNumbers,
      closeSettings,
      renderAccount,
      openAccount,
      startLoginFromBanner,
      accountAction,
      receiveAuthProgress,
      openAuthUrl,
      copyAuthUrl,
      cancelLogin,
      loginFromSettings,
      exportLocal,
      get settingsPreview() {
        return settingsPreview;
      },
      get editingRepos() {
        return editingRepos;
      },
      get editingActiveId() {
        return editingActiveId;
      },
      get authUrl() {
        return authUrl;
      }
    };
  }

  // src/shared/algorithm-leaf.ts
  function isAlgorithmLeaf(node3) {
    return node3.kind === "algorithm" && !(node3.children || []).length;
  }
  function resolveAlgorithmLeaf(tree, id) {
    if (typeof id !== "string") return null;
    const index = /* @__PURE__ */ new Map();
    function walk(node3) {
      index.set(node3.id, node3);
      for (const alias of node3.legacyIds || []) index.set(alias, node3);
      (node3.children || []).forEach(walk);
    }
    walk(tree);
    let current = index.get(id);
    const seen = /* @__PURE__ */ new Set();
    while (current && !seen.has(current.id)) {
      if (isAlgorithmLeaf(current)) return current;
      seen.add(current.id);
      const parentId = current.id;
      current = (current.children || []).find((child) => child.contentOf === parentId || child.id === current?.algorithmContentId);
    }
    return null;
  }

  // src/renderer/algorithms/leaf-reading.ts
  function element2(tag, cls = "", text3) {
    const n = document.createElement(tag);
    n.className = cls;
    if (text3 !== void 0) n.textContent = text3;
    return n;
  }
  function button4(label, cls, run) {
    const n = element2("button", cls, label);
    n.type = "button";
    n.addEventListener("click", run);
    return n;
  }
  function noteKey(note) {
    return String(note.path || note.id || note.clientId || `${String(note.nodeId)}:${String(note.title)}:${String(note.authorId)}`);
  }
  function renderLeafReading(options) {
    const root2 = element2("section", "alg-leaf-reading");
    root2.dataset.nodeId = options.node.id;
    let current = options.content || null;
    function markdown(host, text3) {
      if (options.renderMarkdown) options.renderMarkdown(host, text3);
      else host.textContent = text3;
    }
    function render6() {
      root2.replaceChildren();
      const intro = element2("section", "alg-leaf-introduction"), heading = element2("div", "alg-section-heading");
      heading.append(element2("h3", "", "简介"));
      if (options.canManage && options.onSave) heading.append(button4("编辑简介与精选", "alg-text-button alg-edit-leaf-content", edit));
      intro.append(heading);
      const body = element2("div", "markdown-body alg-introduction-markdown");
      const introduction = current?.introduction ?? options.node.scope ?? "";
      if (introduction.trim()) markdown(body, introduction);
      else body.append(element2("p", "alg-inline-empty", "暂无简介。"));
      intro.append(body);
      root2.append(intro);
      const selectedPaths = new Set(current?.featuredNotePaths || []);
      const isFeatured = (note) => current ? typeof note.path === "string" && selectedPaths.has(note.path) : note.featured === true;
      const featured = options.notes.filter(isFeatured), ordinary = options.notes.filter((note) => !isFeatured(note));
      for (const [title, notes, cls] of [["精选笔记", featured, "alg-featured-section"], ["全部笔记", ordinary, "alg-all-notes-section"]]) {
        const section = element2("section", cls), row2 = element2("div", "alg-section-heading");
        row2.append(element2("h3", "", title), element2("span", "alg-section-count", String(notes.length)));
        section.append(row2);
        const list = element2("div", "alg-note-list");
        for (const note of notes) {
          const card = button4("", `alg-note-card${isFeatured(note) ? " alg-note-featured" : ""}`, () => options.onRead(note));
          card.dataset.noteKey = noteKey(note);
          const meta = element2("div", "alg-note-meta");
          if (isFeatured(note)) meta.append(element2("span", "alg-featured", "精选"));
          if (note.author) meta.append(element2("span", "alg-note-author", String(options.authorName?.(note.author) || note.author)));
          if (note.updatedAt) meta.append(element2("span", "", String(options.formatDate?.(note.updatedAt) || note.updatedAt)));
          card.append(element2("h4", "alg-note-title", String(note.title || "未命名笔记")), meta);
          if (Array.isArray(note.tags) && note.tags.length) {
            const tags = element2("div", "alg-note-tags");
            note.tags.forEach((tag) => tags.append(element2("span", "alg-tag", String(tag))));
            card.append(tags);
          }
          list.append(card);
        }
        if (notes.length) section.append(list);
        else section.append(element2("p", "alg-inline-empty", title === "精选笔记" ? "暂无精选笔记。" : "暂无其他笔记。"));
        if (title === "全部笔记" && options.onUpload) section.append(button4("＋ 上传笔记", "alg-text-button alg-leaf-upload", options.onUpload));
        root2.append(section);
      }
    }
    function edit() {
      if (!options.canManage || !options.onSave) return;
      const previous = document.activeElement, dialog3 = element2("dialog", "alg-leaf-editor");
      dialog3.setAttribute("aria-label", "编辑简介与精选笔记");
      const form = element2("form", "alg-leaf-content-form");
      form.noValidate = true;
      const header = element2("header", "alg-leaf-editor-header");
      header.append(element2("h2", "", `${options.node.label} · 简介与精选`));
      const introduction = element2("textarea", "alg-leaf-markdown-input");
      introduction.name = "introduction";
      introduction.rows = 11;
      introduction.value = current?.introduction ?? options.node.scope ?? "";
      introduction.setAttribute("aria-label", "Markdown简介");
      const label = element2("label", "alg-leaf-field");
      label.append(element2("strong", "", "简介（Markdown）"), introduction);
      const preview = element2("section", "alg-leaf-preview");
      preview.append(element2("h3", "", "预览"));
      const previewBody = element2("div", "markdown-body");
      preview.append(previewBody);
      const renderPreview = () => markdown(previewBody, introduction.value);
      introduction.addEventListener("input", renderPreview);
      renderPreview();
      const choices = element2("fieldset", "alg-featured-choices");
      choices.append(element2("legend", "", "精选笔记（可多选）"));
      const visiblePaths = new Set(options.notes.flatMap((note) => typeof note.path === "string" ? [note.path] : []));
      const chosen = new Set(current?.featuredNotePaths || options.notes.filter((note) => note.featured === true).flatMap((note) => typeof note.path === "string" ? [note.path] : []));
      for (const note of options.notes) {
        if (typeof note.path !== "string") continue;
        const row2 = element2("label", "alg-featured-choice"), check = element2("input");
        check.type = "checkbox";
        check.value = note.path;
        check.checked = chosen.has(note.path);
        check.name = "featuredNotePaths";
        check.addEventListener("change", () => {
          if (check.checked) chosen.add(check.value);
          else chosen.delete(check.value);
        });
        row2.append(check, element2("span", "", String(note.title || "未命名笔记")));
        choices.append(row2);
      }
      for (const path of [...chosen].filter((path2) => !visiblePaths.has(path2))) {
        const row2 = element2("label", "alg-featured-choice alg-featured-unavailable"), check = element2("input");
        check.type = "checkbox";
        check.checked = true;
        check.name = "featuredNotePaths";
        check.value = path;
        check.addEventListener("change", () => {
          if (check.checked) chosen.add(path);
          else chosen.delete(path);
        });
        row2.append(check, element2("span", "", "其他范围或已不可用的精选引用（取消勾选可移除）"));
        choices.append(row2);
      }
      if (!visiblePaths.size) choices.append(element2("p", "alg-inline-empty", "当前范围暂无可新增的精选。不可用的旧引用可在上方移除。"));
      const error = element2("p", "alg-inline-error");
      error.hidden = true;
      error.setAttribute("role", "alert");
      let busy2 = false;
      function close() {
        if (busy2) return;
        dialog3.close();
        dialog3.remove();
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      }
      const actions = element2("div", "alg-leaf-editor-actions"), cancel = button4("取消", "alg-button", close), save = element2("button", "alg-button alg-button-primary", "保存");
      save.type = "submit";
      actions.append(cancel, save);
      form.append(header, label, preview, choices, error, actions);
      dialog3.append(form);
      root2.append(dialog3);
      dialog3.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy2) return;
        const text3 = introduction.value;
        if (new TextEncoder().encode(text3).length > 1e5 || chosen.size > 100) {
          error.textContent = "简介最多100000字节，精选最多100篇。";
          error.hidden = false;
          return;
        }
        busy2 = true;
        error.hidden = true;
        form.querySelectorAll("input,textarea,button").forEach((n) => {
          n.disabled = true;
        });
        try {
          const saved = await options.onSave({ nodeId: options.node.id, introduction: text3, featuredNotePaths: [...chosen], sha: current?.sha || null, ...current?.storageNodeId ? { storageNodeId: current.storageNodeId } : {} });
          current = saved;
          busy2 = false;
          close();
          render6();
        } catch (cause) {
          busy2 = false;
          error.textContent = cause instanceof Error ? cause.message : "保存失败，请重试";
          error.hidden = false;
          form.querySelectorAll("input,textarea,button").forEach((n) => {
            n.disabled = false;
          });
        }
      });
      dialog3.showModal();
      introduction.focus();
    }
    render6();
    return root2;
  }

  // src/renderer/algorithms/browser.ts
  var LEVELS = [
    { id: "basic", label: "入门", tone: "cyan", number: "01" },
    { id: "beginner", label: "初级", tone: "green", number: "02" },
    { id: "intermediate", label: "中级", tone: "blue", number: "03" },
    { id: "advanced", label: "高级", tone: "orange", number: "04" },
    { id: "expert", label: "挑战", tone: "red", number: "05" }
  ];
  var ATTRIBUTES = { board: "模板", useful: "常用", useless: "低频" };
  var state3 = {
    search: "",
    level: "",
    attribute: "",
    draftSearch: "",
    draftLevel: "",
    draftAttribute: "",
    selectedNode: null,
    expanded: /* @__PURE__ */ new Set(),
    scope: "public",
    hasNotes: false,
    reading: null,
    listScroll: 0,
    paneScroll: 0,
    treeScroll: 0
  };
  var active2 = null;
  var instanceId = 0;
  function element3(tag, className, text3) {
    const el3 = document.createElement(tag);
    if (className) el3.className = className;
    if (text3 !== void 0) el3.textContent = String(text3);
    return el3;
  }
  function button5(text3, className, action2) {
    const el3 = element3("button", className, text3);
    el3.type = "button";
    el3.addEventListener("click", action2);
    return el3;
  }
  function isDirectory(node3) {
    return !isAlgorithmLeaf(node3);
  }
  function levelOf(node3) {
    return isDirectory(node3) ? void 0 : LEVELS.find((level) => level.id === node3.color);
  }
  function attributesOf(node3) {
    return [.../* @__PURE__ */ new Set([...Array.isArray(node3.attributes) ? node3.attributes : [], ...ATTRIBUTES[node3.color] ? [node3.color] : []])].filter((key) => ATTRIBUTES[key]);
  }
  function tagsOf(note) {
    return Array.isArray(note.tags) ? note.tags.map(String) : [];
  }
  function noteKey2(note) {
    return String(note.path || note.id || note.clientId || `${note.nodeId}:${note.title}:${note.authorId}`);
  }
  function excerpt(body) {
    return String(body || "").replace(/```[\s\S]*?```/g, " [代码] ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]*>/g, "").replace(/[#*_`>~|]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
  }
  function snapshot() {
    return {
      search: state3.search,
      level: state3.level,
      attribute: state3.attribute,
      draftSearch: state3.draftSearch,
      draftLevel: state3.draftLevel,
      selectedNode: state3.selectedNode,
      expanded: Array.from(state3.expanded),
      scope: state3.scope,
      hasNotes: state3.hasNotes
    };
  }
  function render4(options) {
    if (!options || !options.host || !options.tree) throw new TypeError("NotebookAlgorithms.render requires host and tree.");
    if (active2) active2.destroy();
    const opts = options;
    const host = opts.host;
    const root2 = opts.tree;
    const byId = /* @__PURE__ */ new Map();
    const all = [];
    function index(node3, parent, depth, path) {
      const entry2 = { node: node3, parent, depth, path: path.concat(String(node3.label || "未命名节点")), descendants: 0 };
      byId.set(node3.id, entry2);
      (node3.legacyIds || []).forEach((id) => {
        if (!byId.has(id)) byId.set(id, entry2);
      });
      all.push(entry2);
      (node3.children || []).forEach((child) => {
        index(child, node3.id, depth + 1, entry2.path);
        entry2.descendants += 1 + byId.get(child.id).descendants;
      });
    }
    index(root2, null, 0, []);
    if (!(state3.search.trim() || state3.level || state3.attribute || state3.hasNotes)) {
      state3.expanded = /* @__PURE__ */ new Set([root2.id]);
      state3.selectedNode = root2.id;
      state3.reading = null;
      state3.treeScroll = 0;
      state3.paneScroll = 0;
    }
    state3.selectedNode = byId.get(state3.selectedNode)?.node.id || root2.id;
    const nextScope = opts.scope === "personal" ? "personal" : opts.scope === "public" ? "public" : state3.scope;
    if (nextScope !== state3.scope) {
      state3.reading = null;
      state3.paneScroll = 0;
    }
    state3.scope = nextScope;
    const accountId = opts.account && opts.account.id;
    const notes = (Array.isArray(opts.notes) ? opts.notes : []).filter((note) => state3.scope === "personal" ? note.noteScope === "personal" && accountId != null && String(note.authorId) === String(accountId) : note.noteScope === "public").map((note) => {
      const original = byId.get(note.nodeId)?.node;
      const canonicalId = original ? resolveAlgorithmLeaf(root2, original.id)?.id : void 0;
      return canonicalId && canonicalId !== note.nodeId ? { ...note, nodeId: canonicalId } : note;
    }).filter((note) => {
      const node3 = byId.get(note.nodeId)?.node;
      return Boolean(node3 && isAlgorithmLeaf(node3));
    });
    const nameOf = (author) => {
      try {
        return String(opts.authorName ? opts.authorName(author) : author && (author.name || author.login) || author || "匿名作者");
      } catch (_) {
        return "未知作者";
      }
    };
    const dateOf = (value) => {
      try {
        return opts.formatDate ? opts.formatDate(value) : value ? new Date(value).toLocaleDateString("zh-CN") : "";
      } catch (_) {
        return "";
      }
    };
    const sortedNotes = notes.slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    const counts = new Map(all.map((entry2) => [entry2.node.id, 0]));
    notes.forEach((note) => {
      let entry2 = byId.get(note.nodeId);
      while (entry2) {
        counts.set(entry2.node.id, counts.get(entry2.node.id) + 1);
        entry2 = byId.get(entry2.parent);
      }
    });
    function expandAncestors(id) {
      let entry2 = byId.get(id);
      while (entry2 && entry2.parent != null) {
        state3.expanded.add(entry2.parent);
        entry2 = byId.get(entry2.parent);
      }
    }
    if (state3.reading && !notes.some((note) => noteKey2(note) === state3.reading)) state3.reading = null;
    const shell = element3("section", "alg-browser");
    shell.setAttribute("aria-label", "算法知识与笔记浏览器");
    const uid = `alg-browser-${++instanceId}`;
    const top = element3("header", "alg-toolbar");
    const brand = element3("div", "alg-brand");
    brand.append(element3("span", "alg-eyebrow", "KNOWLEDGE EXPLORER"), element3("h2", "alg-title", "算法知识库"));
    const scopeSwitch = element3("div", "alg-scope");
    scopeSwitch.setAttribute("role", "group");
    scopeSwitch.setAttribute("aria-label", "笔记范围");
    ["public", "personal"].forEach((scope2) => {
      const control = button5(scope2 === "public" ? "公开笔记" : "我的笔记", "alg-scope-button", () => {
        if (scope2 === state3.scope) return;
        if (typeof opts.onScopeChange === "function") opts.onScopeChange(scope2);
        else if (scope2 !== "personal" || opts.account) {
          state3.scope = scope2;
          state3.reading = null;
          render4({ ...opts, scope: scope2 });
        }
      });
      control.setAttribute("aria-pressed", String(scope2 === state3.scope));
      scopeSwitch.append(control);
    });
    const uploadWrap = element3("div", "alg-upload-wrap");
    const upload = button5("＋ 上传笔记", "alg-button alg-button-primary", () => {
      if (!opts.canUpload || !opts.account || typeof opts.onUpload !== "function" || !isAlgorithmLeaf(byId.get(state3.selectedNode).node)) return;
      if (typeof opts.onSelect === "function") opts.onSelect(state3.selectedNode);
      opts.onUpload(state3.selectedNode);
    });
    upload.disabled = !opts.canUpload || !opts.account || typeof opts.onUpload !== "function";
    upload.id = "algorithm-upload-button";
    uploadWrap.append(upload);
    uploadWrap.hidden = !isAlgorithmLeaf(byId.get(state3.selectedNode).node);
    if (upload.disabled) {
      const explanation = element3("span", "alg-upload-hint", opts.account ? "需要仓库写入权限才能上传" : "登录具有写入权限的账户后可上传");
      explanation.id = `${uid}-upload-hint`;
      upload.setAttribute("aria-describedby", explanation.id);
      uploadWrap.append(explanation);
    }
    top.append(brand, scopeSwitch, uploadWrap);
    const filters = element3("section", "alg-filters");
    filters.setAttribute("aria-label", "检索与筛选");
    const searchRow = element3("div", "alg-search-row");
    const searchWrap = element3("label", "alg-search-wrap");
    const searchIcon = element3("span", "alg-search-icon", "⌕");
    searchIcon.setAttribute("aria-hidden", "true");
    const search = element3("input", "alg-search");
    search.type = "search";
    search.value = state3.draftSearch;
    search.placeholder = "搜索算法、路径、笔记标题、标签或作者";
    search.setAttribute("aria-label", "搜索算法、路径、笔记标题、标签或作者");
    searchWrap.append(searchIcon, search);
    const attributeLabel = element3("label", "alg-attribute-label", "属性");
    const attribute = element3("select", "alg-attribute");
    attribute.setAttribute("aria-label", "按类型或使用频率筛选");
    [["", "全部属性"], ...Object.entries(ATTRIBUTES)].forEach(([value, label]) => {
      const option2 = element3("option", "", label);
      option2.value = value;
      attribute.append(option2);
    });
    attribute.value = state3.draftAttribute;
    attributeLabel.append(attribute);
    const submitSearch = button5("搜索", "alg-button alg-button-primary alg-search-submit", applySearch);
    const clear = button5("清除筛选", "alg-text-button alg-clear", () => {
      state3.search = "";
      state3.level = "";
      state3.attribute = "";
      state3.draftSearch = "";
      state3.draftLevel = "";
      state3.draftAttribute = "";
      state3.hasNotes = false;
      state3.reading = null;
      search.value = "";
      attribute.value = "";
      refresh({ reset: true, newQuery: true });
      search.focus();
    });
    const hasNotes = button5("仅看已有笔记", "alg-button alg-has-notes", () => {
      state3.hasNotes = !state3.hasNotes;
      state3.reading = null;
      refresh({ reset: !state3.hasNotes && !(state3.search.trim() || state3.level || state3.attribute), newQuery: true });
    });
    hasNotes.setAttribute("aria-pressed", String(state3.hasNotes));
    searchRow.append(searchWrap, submitSearch, attributeLabel, hasNotes, clear);
    const legend = element3("div", "alg-legend");
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "学习参考难度筛选");
    const legendButtons = [];
    const levelCounts = new Map([...LEVELS.map((level) => [level.id, 0]), ["unrated", 0]]);
    all.forEach((entry2) => {
      if (isDirectory(entry2.node)) return;
      const level = levelOf(entry2.node);
      const key = level ? level.id : "unrated";
      levelCounts.set(key, levelCounts.get(key) + 1);
    });
    const allLevel = button5(`全部 ${all.length}`, "alg-legend-button alg-tone-neutral", () => {
      state3.draftLevel = "";
      updateDraftControls();
    });
    allLevel.dataset.level = "";
    legendButtons.push(allLevel);
    legend.append(allLevel);
    [...LEVELS, ...levelCounts.get("unrated") ? [{ id: "unrated", label: "未分级", tone: "neutral", number: "—" }] : []].forEach((level) => {
      const control = button5("", `alg-legend-button alg-tone-${level.tone}`, () => {
        state3.draftLevel = state3.draftLevel === level.id ? "" : level.id;
        updateDraftControls();
      });
      control.dataset.level = level.id;
      control.append(element3("span", "alg-legend-dot"), element3("span", "", `${level.number} ${level.label}`), element3("span", "alg-legend-count", levelCounts.get(level.id)));
      control.title = `${level.label}：${levelCounts.get(level.id)} 个节点；点击筛选，再次点击取消`;
      legendButtons.push(control);
      legend.append(control);
    });
    const searchHint = element3("p", "alg-tier-hint alg-search-hint");
    searchHint.append(element3("strong", "", "点击搜索按钮才会进行跳转哦，也可以按回车确认。"));
    searchHint.id = `${uid}-search-hint`;
    search.setAttribute("aria-describedby", searchHint.id);
    filters.append(searchRow, searchHint, legend, element3("p", "alg-tier-hint", "目录用于组织知识，不设难度。难度筛选只匹配具体算法与知识点，并保留其上级目录。模板、常用、低频是独立属性。"));
    const workspace = element3("div", "alg-workspace");
    const sidebar = element3("aside", "alg-sidebar");
    const treeHeading = element3("div", "alg-tree-heading");
    const treeStatus = element3("span", "alg-tree-status");
    treeHeading.append(element3("strong", "", "知识目录"), treeStatus);
    const treeScroller = element3("div", "alg-tree-scroll");
    const tree = element3("div", "alg-tree");
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "算法知识目录");
    tree.setAttribute("aria-describedby", `${uid}-tree-help`);
    treeScroller.append(tree);
    const treeHelp = element3("p", "alg-tree-help", "↑ ↓ 移动 · ← → 折叠 / 展开 · Enter 查看");
    treeHelp.id = `${uid}-tree-help`;
    sidebar.append(treeHeading, treeScroller, treeHelp);
    const pane = element3("section", "alg-pane");
    pane.setAttribute("aria-label", "算法与笔记详情");
    pane.tabIndex = -1;
    const live = element3("span", "alg-sr-only");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    workspace.append(sidebar, pane);
    shell.append(top, filters, workspace, live);
    host.replaceChildren(shell);
    let visible = [];
    let included = /* @__PURE__ */ new Set();
    let matched = /* @__PURE__ */ new Set();
    let matchingNotes = [];
    let focusedId = state3.selectedNode;
    let disposed = false, expandedReader = null;
    const treeItems = /* @__PURE__ */ new Map();
    const tooltip = element3("div", "alg-tooltip");
    tooltip.id = `${uid}-tooltip`;
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);
    const tooltipEvents = new AbortController();
    let tooltipTarget = null;
    function hideTooltip() {
      if (tooltipTarget) {
        const ids = (tooltipTarget.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== tooltip.id);
        if (ids.length) tooltipTarget.setAttribute("aria-describedby", ids.join(" "));
        else tooltipTarget.removeAttribute("aria-describedby");
      }
      tooltipTarget = null;
      tooltip.hidden = true;
    }
    function tooltipFor(target) {
      if (!(target instanceof Element)) return null;
      const item = target.closest("[data-alg-tooltip]") || target.closest(".alg-tree-item")?.querySelector(":scope > .alg-tree-row[data-alg-tooltip]");
      return item && (shell.contains(item) || pane.contains(item)) ? item : null;
    }
    function showTooltip(target) {
      if (target === tooltipTarget) return;
      hideTooltip();
      if (!target?.dataset.algTooltip) return;
      tooltipTarget = target;
      tooltip.textContent = target.dataset.algTooltip;
      target.setAttribute("aria-describedby", [target.getAttribute("aria-describedby"), tooltip.id].filter(Boolean).join(" "));
      tooltip.hidden = false;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top2 = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      tooltip.style.maxWidth = `${Math.min(420, Math.max(0, width - 16))}px`;
      tooltip.style.maxHeight = `${Math.max(0, height - 16)}px`;
      const anchor = target.getBoundingClientRect(), rect = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - rect.width - 8))}px`;
      const below = anchor.bottom + 8;
      tooltip.style.top = `${Math.max(top2 + 8, Math.min(below + rect.height <= top2 + height - 8 ? below : anchor.top - rect.height - 8, top2 + height - rect.height - 8))}px`;
    }
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "touch") showTooltip(tooltipFor(event.target));
    }, { signal: tooltipEvents.signal });
    document.addEventListener("pointerout", (event) => {
      if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) showTooltip(tooltipFor(event.relatedTarget));
    }, { signal: tooltipEvents.signal });
    document.addEventListener("focusin", (event) => showTooltip(tooltipFor(event.target)), { signal: tooltipEvents.signal });
    document.addEventListener("focusout", (event) => {
      if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) hideTooltip();
    }, { signal: tooltipEvents.signal });
    document.addEventListener("scroll", hideTooltip, { capture: true, passive: true, signal: tooltipEvents.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    }, { signal: tooltipEvents.signal });
    document.addEventListener("pointerdown", hideTooltip, { signal: tooltipEvents.signal });
    window.addEventListener("resize", hideTooltip, { passive: true, signal: tooltipEvents.signal });
    window.addEventListener("blur", hideTooltip, { signal: tooltipEvents.signal });
    function detailPath() {
      const reading = state3.reading && notes.find((note) => noteKey2(note) === state3.reading);
      const entries = [];
      let entry2 = byId.get(reading?.nodeId || state3.selectedNode);
      while (entry2) {
        entries.unshift(entry2);
        entry2 = byId.get(entry2.parent);
      }
      const result = [{ label: "知识树", onClick() {
        expandedReader?.close();
      } }, ...entries.map((item) => ({ label: item.node.label, onClick() {
        selectNode(item.node.id);
      } }))];
      if (reading) result.push({ label: reading.title || "未命名笔记" });
      return result;
    }
    function openDetail() {
      expandedReader = ReadingDetail?.open({ content: pane, mount: host, title: state3.reading ? "算法笔记详情" : "知识节点详情", path: detailPath(), onClose() {
        expandedReader = null;
      } });
    }
    let filtering = false;
    function badge(node3) {
      if (isDirectory(node3)) {
        const directory = element3("span", "alg-node-kind", "目录");
        directory.dataset.algTooltip = "目录用于组织知识，请选择算法叶子阅读笔记";
        return directory;
      }
      const level = levelOf(node3);
      const el3 = element3("span", `alg-badge alg-tone-${level ? level.tone : "neutral"}`, level ? level.label : node3.color === "parent" ? "目录" : "未分级");
      const origin = node3.difficultySource?.kind === "user-md" ? "用户颜色文档" : node3.rating?.type === "category" ? "分类基础门槛" : node3.rating?.type === "entry" ? "入口或任务形式" : "本项目逐项定稿";
      const range = node3.rating?.range;
      const coverage2 = range && node3.children?.length ? `；覆盖 D${range.min}–D${range.max}` : "";
      el3.dataset.algTooltip = level ? `学习难度：${level.label}；依据：${origin}${coverage2}${node3.scope ? `。学习范围：${node3.scope}` : ""}${node3.rationale ? `。${node3.rationale}` : ""}` : node3.color === "parent" ? "目录" : "未指定难度";
      return el3;
    }
    function attributeBadge(node3) {
      const names = attributesOf(node3).map((key) => ATTRIBUTES[key]);
      return names.length ? element3("span", "alg-attribute-badge", names.join(" · ")) : null;
    }
    function pathOf(id) {
      return byId.get(id)?.path.join(" / ") || "未关联目录";
    }
    function matchesFacets(node3) {
      const level = levelOf(node3);
      return (!state3.level || !isDirectory(node3) && (state3.level === "unrated" ? !level : node3.color === state3.level)) && (!state3.attribute || attributesOf(node3).includes(state3.attribute));
    }
    const relevance = AlgorithmDirectory;
    const topicScores = /* @__PURE__ */ new Map();
    function computeResults() {
      const q = state3.search.trim();
      topicScores.clear();
      filtering = Boolean(q || state3.level || state3.attribute || state3.hasNotes);
      matchingNotes = sortedNotes.filter((note) => {
        const entry2 = byId.get(note.nodeId);
        if ((state3.level || state3.attribute) && (!entry2 || !matchesFacets(entry2.node))) return false;
        return relevance.noteScore(note, entry2?.node, entry2?.path || [], q, nameOf(note.author)) > 0;
      }).sort((a, b) => {
        if (!q) return 0;
        const ae = byId.get(a.nodeId), be = byId.get(b.nodeId);
        return relevance.noteScore(b, be?.node, be?.path || [], q, nameOf(b.author)) - relevance.noteScore(a, ae?.node, ae?.path || [], q, nameOf(a.author));
      });
      const noteNodes = new Set(matchingNotes.map((note) => note.nodeId));
      matched = /* @__PURE__ */ new Set();
      included = /* @__PURE__ */ new Set();
      all.forEach((entry2) => {
        const score2 = relevance.topicScore(entry2.node, entry2.path, q);
        topicScores.set(entry2.node.id, score2);
        if (!filtering || matchesFacets(entry2.node) && (!state3.hasNotes || isAlgorithmLeaf(entry2.node) && (counts.get(entry2.node.id) || 0) > 0) && (score2 > 0 || noteNodes.has(entry2.node.id))) matched.add(entry2.node.id);
      });
      matched.forEach((id) => {
        let entry2 = byId.get(id);
        while (entry2) {
          included.add(entry2.node.id);
          entry2 = byId.get(entry2.parent);
        }
      });
    }
    function selectNode(id, focusPane) {
      const target = byId.get(id);
      if (!target) return;
      id = target.node.id;
      expandedReader?.close();
      hideTooltip();
      const previous = state3.selectedNode;
      state3.selectedNode = id;
      state3.reading = null;
      state3.listScroll = 0;
      state3.paneScroll = 0;
      const previousFocus = focusedId;
      focusedId = id;
      expandAncestors(id);
      const oldScroll = treeScroller.scrollTop;
      if (treeItems.has(id)) {
        if (previous) treeItems.get(previous)?.setAttribute("aria-selected", "false");
        if (previousFocus) {
          const row3 = treeItems.get(previousFocus);
          if (row3) row3.tabIndex = -1;
        }
        const row2 = treeItems.get(id);
        row2.setAttribute("aria-selected", "true");
        row2.tabIndex = 0;
      } else renderTree();
      treeScroller.scrollTop = oldScroll;
      renderPane();
      pane.scrollTop = 0;
      if (typeof opts.onSelect === "function") opts.onSelect(id);
      if (focusPane) pane.focus({ preventScroll: true });
    }
    function focusRow(id) {
      focusedId = id;
      treeItems.forEach((row2, nodeId) => {
        if (row2.tabIndex === 0 && nodeId !== id) row2.tabIndex = -1;
      });
      const target = treeItems.get(id);
      if (target) target.tabIndex = 0;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
    function isExpanded(id) {
      return filtering ? included.has(id) && !state3.expanded.has(`collapsed-filter:${id}`) : state3.expanded.has(id);
    }
    function toggle(id, expanded2) {
      if (filtering) {
        const key = `collapsed-filter:${id}`;
        if (expanded2) state3.expanded.delete(key);
        else state3.expanded.add(key);
      } else if (expanded2) state3.expanded.add(id);
      else state3.expanded.delete(id);
      const oldScroll = treeScroller.scrollTop;
      renderTree();
      treeScroller.scrollTop = oldScroll;
      focusRow(id);
    }
    function renderTree() {
      hideTooltip();
      treeItems.clear();
      tree.replaceChildren();
      visible = [];
      const hasResults = included.size > 0;
      if (!hasResults) {
        tree.append(element3("p", "alg-tree-empty", "没有匹配的目录或笔记。试试更短的关键词，或清除筛选。"));
      } else {
        let walk2 = function(entry2, group, position, size) {
          if (!included.has(entry2.node.id)) return;
          const kids = (entry2.node.children || []).filter((child) => included.has(child.id));
          const item = element3("div", "alg-tree-item");
          item.setAttribute("role", "treeitem");
          item.dataset.nodeId = entry2.node.id;
          treeItems.set(entry2.node.id, item);
          item.dataset.depth = String(entry2.depth);
          item.dataset.kind = isDirectory(entry2.node) ? "directory" : "topic";
          item.setAttribute("aria-level", String(entry2.depth + 1));
          item.setAttribute("aria-posinset", String(position));
          item.setAttribute("aria-setsize", String(size));
          item.setAttribute("aria-selected", String(state3.selectedNode === entry2.node.id));
          item.setAttribute("aria-label", `${entry2.node.label}，${levelOf(entry2.node)?.label || (isDirectory(entry2.node) ? "目录" : "未分级")}${attributesOf(entry2.node).length ? `，${attributesOf(entry2.node).map((key) => ATTRIBUTES[key]).join("、")}` : ""}，${counts.get(entry2.node.id)} 篇笔记`);
          item.tabIndex = -1;
          if (kids.length) item.setAttribute("aria-expanded", String(isExpanded(entry2.node.id)));
          const row2 = element3("div", "alg-tree-row");
          row2.style.setProperty("--alg-depth", String(entry2.depth));
          if (kids.length) {
            const disclosure = button5(isExpanded(entry2.node.id) ? "▾" : "▸", "alg-disclosure", (event) => {
              event.stopPropagation();
              toggle(entry2.node.id, !isExpanded(entry2.node.id));
            });
            disclosure.tabIndex = -1;
            disclosure.setAttribute("aria-label", `${isExpanded(entry2.node.id) ? "折叠" : "展开"} ${entry2.node.label}`);
            row2.append(disclosure);
          } else {
            const spacer = element3("span", "alg-disclosure alg-leaf", "·");
            spacer.setAttribute("aria-hidden", "true");
            row2.append(spacer);
          }
          const copy = element3("span", "alg-tree-copy");
          copy.append(element3("span", "alg-tree-label", entry2.node.label));
          const metadata2 = element3("span", "alg-tree-meta");
          metadata2.append(badge(entry2.node));
          const attr = attributeBadge(entry2.node);
          if (attr) metadata2.append(attr);
          copy.append(metadata2);
          row2.append(copy);
          const count = element3("span", "alg-node-count", counts.get(entry2.node.id));
          count.title = "当前范围内含子目录的笔记总数";
          row2.append(count);
          row2.dataset.algTooltip = `${entry2.path.join(" / ")}${entry2.node.fullLabel && entry2.node.fullLabel !== entry2.node.label ? `
${entry2.node.fullLabel}` : ""}`;
          if (opts.canManage && typeof opts.onAddTopic === "function") {
            const add = button5("＋", "alg-add-topic", (event) => {
              event.stopPropagation();
              opts.onAddTopic(entry2.node.id);
            });
            add.title = `在“${entry2.node.label}”下添加算法`;
            add.setAttribute("aria-label", add.title);
            row2.append(add);
          }
          row2.addEventListener("click", () => {
            selectNode(entry2.node.id);
            focusRow(entry2.node.id);
          });
          item.addEventListener("focus", (event) => {
            if (event.target === item) {
              focusedId = entry2.node.id;
            }
          });
          item.append(row2);
          group.append(item);
          visible.push(entry2);
          if (kids.length && isExpanded(entry2.node.id)) {
            const childGroup = element3("div", "alg-tree-group");
            childGroup.setAttribute("role", "group");
            item.append(childGroup);
            kids.forEach((child, i) => walk2(byId.get(child.id), childGroup, i + 1, kids.length));
          }
        };
        var walk = walk2;
        walk2(byId.get(root2.id), tree, 1, 1);
      }
      if (!visible.some((entry2) => entry2.node.id === focusedId)) focusedId = visible.some((entry2) => entry2.node.id === state3.selectedNode) ? state3.selectedNode : visible[0]?.node.id;
      tree.querySelectorAll('[role="treeitem"]').forEach((row2) => {
        row2.tabIndex = row2.dataset.nodeId === focusedId ? 0 : -1;
      });
      treeStatus.textContent = filtering ? `${matched.size} 个匹配` : `${all.length} 个节点`;
    }
    tree.addEventListener("keydown", (event) => {
      if (event.target.closest(".alg-add-topic")) return;
      const item = event.target.closest('[role="treeitem"]');
      if (!item) return;
      const id = item.dataset.nodeId;
      const entry2 = byId.get(id);
      const i = visible.findIndex((value) => value.node.id === id);
      let next = null;
      if (event.key === "ArrowDown") next = visible[Math.min(i + 1, visible.length - 1)]?.node.id;
      else if (event.key === "ArrowUp") next = visible[Math.max(i - 1, 0)]?.node.id;
      else if (event.key === "Home") next = visible[0]?.node.id;
      else if (event.key === "End") next = visible[visible.length - 1]?.node.id;
      else if (event.key === "ArrowRight") {
        if (item.hasAttribute("aria-expanded")) {
          if (!isExpanded(id)) toggle(id, true);
          else next = visible[i + 1]?.node.id;
        }
      } else if (event.key === "ArrowLeft") {
        if (item.getAttribute("aria-expanded") === "true") toggle(id, false);
        else next = entry2.parent;
      } else if (event.key === "Enter" || event.key === " ") {
        selectNode(id);
        focusRow(id);
      } else return;
      event.preventDefault();
      event.stopPropagation();
      if (next != null) focusRow(next);
    });
    function breadcrumbs(id) {
      const nav = element3("nav", "alg-breadcrumbs");
      nav.setAttribute("aria-label", "当前算法路径");
      const ancestors = [];
      let entry2 = byId.get(id);
      while (entry2) {
        ancestors.unshift(entry2);
        entry2 = byId.get(entry2.parent);
      }
      ancestors.forEach((ancestor, i) => {
        if (i) {
          const separator = element3("span", "alg-crumb-separator", "/");
          separator.setAttribute("aria-hidden", "true");
          nav.append(separator);
        }
        const crumb = button5(ancestor.node.label, "alg-crumb", () => selectNode(ancestor.node.id));
        if (i === ancestors.length - 1) crumb.setAttribute("aria-current", "page");
        nav.append(crumb);
      });
      return nav;
    }
    function noteMetadata(note) {
      const meta = element3("div", "alg-note-meta");
      if (note.featured) meta.append(element3("span", "alg-featured", "精选"));
      meta.append(element3("span", "alg-note-author", nameOf(note.author)));
      const date = dateOf(note.updatedAt || note.createdAt);
      if (date) meta.append(element3("span", "", date));
      return meta;
    }
    function noteTags(note) {
      const tags = element3("div", "alg-note-tags");
      tagsOf(note).forEach((tag) => tags.append(element3("span", "alg-tag", tag)));
      return tags;
    }
    function openNote(note) {
      state3.listScroll = pane.scrollTop;
      state3.reading = noteKey2(note);
      state3.paneScroll = 0;
      renderPane();
      pane.scrollTop = 0;
      pane.querySelector(".alg-reading-title")?.focus({ preventScroll: true });
    }
    function noteCard(note, globalResult) {
      const card = button5("", `alg-note-card${note.featured ? " alg-note-featured" : ""}`, () => openNote(note));
      card.append(noteMetadata(note), element3("h4", "alg-note-title", note.title || "未命名笔记"));
      const preview = excerpt(note.body);
      if (preview) card.append(element3("p", "alg-note-excerpt", preview));
      card.append(noteTags(note));
      if (globalResult) card.append(element3("span", "alg-note-path", pathOf(note.nodeId)));
      return card;
    }
    function heading(title, count) {
      const row2 = element3("div", "alg-section-heading");
      row2.append(element3("h3", "", title));
      if (count !== void 0) row2.append(element3("span", "alg-section-count", count));
      return row2;
    }
    function topicCard(entry2) {
      const card = button5("", "alg-topic-card", () => selectNode(entry2.node.id));
      const name = element3("div", "alg-topic-name");
      name.append(element3("strong", "", entry2.node.label), element3("span", "alg-card-arrow", "↗"));
      const meta = element3("div", "alg-topic-meta");
      meta.append(badge(entry2.node));
      const attr = attributeBadge(entry2.node);
      if (attr) meta.append(attr);
      card.append(name, meta, element3("span", "alg-topic-count", `${entry2.descendants} 个子节点 · ${counts.get(entry2.node.id)} 篇笔记`));
      return card;
    }
    function renderPane() {
      hideTooltip();
      expandedReader?.setPath(detailPath());
      pane.replaceChildren();
      const selected2 = byId.get(state3.selectedNode);
      const reading = state3.reading && notes.find((note) => noteKey2(note) === state3.reading);
      if (reading) {
        const back = button5("← 返回目录与笔记", "alg-text-button alg-reader-back", () => {
          state3.reading = null;
          renderPane();
          pane.scrollTop = state3.listScroll;
          pane.querySelector(".alg-detail-title")?.focus({ preventScroll: true });
        });
        const actions = element3("div", "reading-detail-actions");
        actions.append(back, button5("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
        pane.append(actions, breadcrumbs(reading.nodeId));
        const article = element3("article", "alg-reading");
        const title2 = element3("h2", "alg-reading-title", reading.title || "未命名笔记");
        title2.tabIndex = -1;
        article.append(title2, noteMetadata(reading), noteTags(reading));
        const body = element3("div", "alg-markdown markdown-body");
        if (typeof opts.renderMarkdown === "function") opts.renderMarkdown(body, String(reading.body || ""));
        else body.textContent = String(reading.body || "");
        article.append(body);
        if (byId.has(reading.nodeId)) article.append(button5(`在目录中查看：${byId.get(reading.nodeId).node.label}`, "alg-text-button alg-note-location", () => selectNode(reading.nodeId)));
        pane.append(article);
        return;
      }
      pane.append(breadcrumbs(selected2.node.id));
      const detail = element3("header", "alg-detail-heading");
      const detailBar = element3("div", "alg-detail-toolbar");
      detailBar.append(element3("span", "alg-eyebrow", isDirectory(selected2.node) ? "知识目录" : "算法知识点"), button5("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
      detail.append(detailBar);
      const titleRow = element3("div", "alg-detail-title-row");
      const title = element3("h2", "alg-detail-title", selected2.node.fullLabel || selected2.node.label);
      title.tabIndex = -1;
      titleRow.append(title, badge(selected2.node));
      const attr = attributeBadge(selected2.node);
      if (attr) titleRow.append(attr);
      detail.append(titleRow);
      pane.append(detail);
      uploadWrap.hidden = !isAlgorithmLeaf(selected2.node);
      const utilities = element3("footer", "alg-detail-utilities");
      if (opts.canManage && typeof opts.onAddTopic === "function") utilities.append(button5("＋ 添加算法", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onAddTopic(selected2.node.id);
      }));
      if (typeof opts.onLearningPath === "function") utilities.append(button5("在学习路线中查看 →", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onLearningPath(selected2.node.id);
      }));
      if (isAlgorithmLeaf(selected2.node)) {
        const storedContent = opts.nodeContents?.find((item) => resolveAlgorithmLeaf(root2, item.nodeId)?.id === selected2.node.id);
        const content = storedContent && storedContent.nodeId !== selected2.node.id ? { ...storedContent, nodeId: selected2.node.id, storageNodeId: storedContent.storageNodeId || storedContent.nodeId } : storedContent;
        pane.append(renderLeafReading({
          node: selected2.node,
          content,
          notes: sortedNotes.filter((note) => note.nodeId === selected2.node.id),
          canManage: Boolean(opts.canManage),
          onSave: opts.onSaveNodeContent ? async (input2) => {
            const saved = await opts.onSaveNodeContent(input2);
            opts.nodeContents = [...(opts.nodeContents || []).filter((item) => resolveAlgorithmLeaf(root2, item.nodeId)?.id !== selected2.node.id), saved];
            return saved;
          } : void 0,
          renderMarkdown: opts.renderMarkdown,
          onRead: openNote,
          onUpload: upload.disabled ? void 0 : () => upload.click(),
          authorName: nameOf,
          formatDate: dateOf
        }));
      } else {
        const children = (selected2.node.children || []).filter((child) => !filtering || included.has(child.id));
        pane.append(heading(selected2.node.id === root2.id ? "选择知识主线" : "目录内容", children.length));
        const grid = element3("div", "alg-topic-grid");
        children.forEach((child) => grid.append(topicCard(byId.get(child.id))));
        pane.append(grid);
      }
      if (utilities.childNodes.length) pane.append(utilities);
    }
    function refresh({ reset = false, newQuery = false } = {}) {
      if (disposed) return;
      const oldScroll = treeScroller.scrollTop;
      if (reset) {
        state3.expanded = /* @__PURE__ */ new Set([root2.id]);
        state3.selectedNode = root2.id;
        focusedId = root2.id;
        state3.reading = null;
        state3.treeScroll = 0;
      }
      if (newQuery) state3.expanded.forEach((key) => {
        if (String(key).startsWith("collapsed-filter:")) state3.expanded.delete(key);
      });
      computeResults();
      updateDraftControls();
      clear.hidden = !filtering;
      hasNotes.setAttribute("aria-pressed", String(state3.hasNotes));
      renderTree();
      treeScroller.scrollTop = reset ? 0 : oldScroll;
      renderPane();
      pane.scrollTop = 0;
      live.textContent = filtering ? `找到 ${matched.size} 个知识节点、${matchingNotes.length} 篇笔记` : `${all.length} 个知识节点、${notes.length} 篇笔记`;
    }
    function updateDraftControls() {
      legendButtons.forEach((control) => control.setAttribute("aria-pressed", String(control.dataset.level === state3.draftLevel)));
      const changed = state3.draftSearch !== state3.search || state3.draftLevel !== state3.level || state3.draftAttribute !== state3.attribute;
      submitSearch.title = changed ? "应用当前关键词、难度和属性" : "刷新搜索结果";
      submitSearch.dataset.pending = String(changed);
      clear.hidden = !(filtering || state3.draftSearch || state3.draftLevel || state3.draftAttribute);
    }
    function applySearch() {
      state3.search = state3.draftSearch.trim();
      state3.level = state3.draftLevel;
      state3.attribute = state3.draftAttribute;
      state3.reading = null;
      state3.listScroll = 0;
      refresh({ reset: !(state3.search.trim() || state3.level || state3.attribute || state3.hasNotes), newQuery: true });
    }
    search.addEventListener("input", () => {
      state3.draftSearch = search.value;
      updateDraftControls();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        applySearch();
      }
    });
    attribute.addEventListener("change", () => {
      state3.draftAttribute = attribute.value;
      updateDraftControls();
    });
    treeScroller.addEventListener("scroll", () => {
      state3.treeScroll = treeScroller.scrollTop;
    }, { passive: true });
    pane.addEventListener("scroll", () => {
      state3.paneScroll = pane.scrollTop;
    }, { passive: true });
    refresh();
    treeScroller.scrollTop = state3.treeScroll;
    pane.scrollTop = state3.paneScroll;
    const controller = {
      selectNode(id) {
        if (!byId.has(id)) return;
        state3.search = "";
        state3.level = "";
        state3.attribute = "";
        state3.draftSearch = "";
        state3.draftLevel = "";
        state3.draftAttribute = "";
        state3.hasNotes = false;
        search.value = "";
        attribute.value = "";
        selectNode(id);
        refresh({ newQuery: true });
      },
      getState: snapshot,
      openNote(note, { fullscreen = false } = {}) {
        const found = notes.find((item) => noteKey2(item) === noteKey2(note));
        if (!found) return;
        openNote(found);
        if (fullscreen) openDetail();
      },
      destroy() {
        if (disposed) return;
        expandedReader?.close();
        hideTooltip();
        tooltipEvents.abort();
        tooltip.remove();
        treeItems.clear();
        state3.treeScroll = treeScroller.scrollTop;
        state3.paneScroll = pane.scrollTop;
        disposed = true;
        if (active2 === controller) active2 = null;
      }
    };
    active2 = controller;
    return controller;
  }
  var AlgorithmBrowser = Object.freeze({ render: render4 });

  // src/renderer/algorithms/roadmap.ts
  function roadmapIntroduction(node3) {
    return [node3.detail[0], node3.detail[1], node3.detail[2].map((text3) => `- ${text3}`).join("\n")].filter(Boolean).join("\n\n");
  }
  function roadmapLeaves(tree, node3) {
    const leaves = /* @__PURE__ */ new Map();
    for (const id of node3.topicIds || []) {
      const leaf = resolveAlgorithmLeaf(tree, id);
      if (leaf) leaves.set(leaf.id, leaf);
    }
    return [...leaves.values()];
  }
  var WIDTH = 1500;
  var HEIGHT = 1240;
  var BAND_STARTS = [16, 324, 646, 986];
  var BAND_HEIGHTS = [250, 304, 310, 180];
  var serial = 0;
  function element4(tag, className, text3) {
    const node3 = document.createElement(tag);
    node3.className = className;
    if (text3 !== void 0) node3.textContent = text3;
    return node3;
  }
  function button6(label, className, run) {
    const node3 = element4("button", `arm-button ${className}`, label);
    node3.type = "button";
    node3.addEventListener("click", run);
    return node3;
  }
  function svgElement2(tag, attributes) {
    const node3 = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) node3.setAttribute(name, value);
    return node3;
  }
  function route(a, b, nodes) {
    const same = Math.abs(a.y - b.y) < 2, up = b.y < a.y;
    const start = [a.cx, up ? a.y - 14 : a.y + a.h + 14];
    const end = [b.cx, same || up ? b.y + b.h + 14 : b.y - 14];
    const xs = [.../* @__PURE__ */ new Set([18, 1482, start[0], end[0], ...nodes.flatMap((n) => [n.x - 14, n.x + n.w + 14, n.cx])])].sort((x, y) => x - y);
    const ys = [.../* @__PURE__ */ new Set([10, 1170, start[1], end[1], ...nodes.flatMap((n) => [n.y - 14, n.y + n.h + 14])])].sort((x, y) => x - y);
    const nx = xs.length, ny = ys.length, tx = xs.indexOf(end[0]), ty = ys.indexOf(end[1]);
    const initial = (ys.indexOf(start[1]) * nx + xs.indexOf(start[0])) * 3;
    const heap = [], best = /* @__PURE__ */ new Map([[initial, 0]]), previous = /* @__PURE__ */ new Map();
    function push(entry2) {
      heap.push(entry2);
      let index = heap.length - 1;
      while (index) {
        const parent = index - 1 >> 1;
        if (heap[parent].f <= entry2.f) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = entry2;
    }
    function pop() {
      const first = heap[0], last = heap.pop();
      if (heap.length && last) {
        let index = 0;
        while (index * 2 + 1 < heap.length) {
          let child = index * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
          if (heap[child].f >= last.f) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = last;
      }
      return first;
    }
    function free(x1, y1, x2, y2) {
      return !nodes.some((n) => x1 === x2 ? x1 > n.x - 5 && x1 < n.x + n.w + 5 && Math.max(y1, y2) > n.y - 5 && Math.min(y1, y2) < n.y + n.h + 5 : y1 > n.y - 5 && y1 < n.y + n.h + 5 && Math.max(x1, x2) > n.x - 5 && Math.min(x1, x2) < n.x + n.w + 5);
    }
    push({ key: initial, g: 0, f: 0 });
    let finish;
    while (heap.length) {
      const entry2 = pop();
      if (!entry2 || entry2.g !== best.get(entry2.key)) continue;
      const direction = entry2.key % 3, position = Math.floor(entry2.key / 3), x = position % nx, y = Math.floor(position / nx);
      if (x === tx && y === ty) {
        finish = entry2.key;
        break;
      }
      const neighbours = [[x - 1, y, 1], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 2]];
      for (const [xx, yy, nextDirection] of neighbours) {
        if (xx < 0 || xx >= nx || yy < 0 || yy >= ny || !free(xs[x], ys[y], xs[xx], ys[yy])) continue;
        const key = (yy * nx + xx) * 3 + nextDirection;
        const cost = entry2.g + Math.abs(xs[x] - xs[xx]) + Math.abs(ys[y] - ys[yy]) + (direction && direction !== nextDirection ? 25 : 0);
        if (cost >= (best.get(key) ?? Infinity)) continue;
        best.set(key, cost);
        previous.set(key, entry2.key);
        push({ key, g: cost, f: cost + Math.abs(xs[xx] - end[0]) + Math.abs(ys[yy] - end[1]) });
      }
    }
    if (finish === void 0) throw new Error(`No clear roadmap route: ${a.id} → ${b.id}`);
    const middle = [];
    for (let key = finish; key !== void 0; key = previous.get(key)) {
      const position = Math.floor(key / 3);
      middle.push([xs[position % nx], ys[Math.floor(position / nx)]]);
    }
    middle.reverse();
    const points = [[a.cx, up ? a.y : a.y + a.h], ...middle, [b.cx, same || up ? b.y + b.h : b.y]];
    const simplified = [];
    for (const point of points) {
      while (simplified.length >= 2) {
        const before = simplified[simplified.length - 2], last = simplified[simplified.length - 1];
        if (before[0] === last[0] && last[0] === point[0] || before[1] === last[1] && last[1] === point[1]) simplified.pop();
        else break;
      }
      simplified.push(point);
    }
    return simplified;
  }
  function render5(options) {
    const { host, data } = options, uid = `arm-${++serial}`;
    const nodes = data.nodes.map((node3) => ({ ...node3, x: node3.px, y: node3.py, w: 164, h: 74, cx: node3.px + 82 }));
    const graphById = new Map(nodes.map((node3) => [node3.id, node3]));
    const byId = new Map([...data.nodes, ...data.indexEntries].map((node3) => [node3.id, node3]));
    const cards2 = /* @__PURE__ */ new Map(), edgeElements = [];
    const stageButtons = [];
    let selected2 = null, hovered = null, stage = null, query = "";
    let position = typeof options.progress?.roadmapFocus === "string" ? options.progress.roadmapFocus : null;
    let autoFit = true, zoom = 1, listMode = false, highlight = true, destroyed = false, pending2 = false, frame = 0;
    let detailNode = null, previousFocus = null;
    const root2 = element4("section", "arm");
    root2.setAttribute("aria-label", "学习路线");
    root2.dataset.view = "graph";
    const header = element4("header", "arm-header");
    const heading = element4("div", "arm-heading");
    heading.append(element4("span", "arm-eyebrow", "C++ · ALGORITHM ROADMAP"), element4("h2", "arm-title", "由广入深，看清知识怎样连接。"), element4("p", "arm-subtitle", "初窥、入门、基础、进阶，沿知识联系逐步展开。点击节点查看范围，按问题跳学与回补。"));
    const readingHint = element4("aside", "arm-reading-hint");
    readingHint.append(element4("strong", "", "读图方式"), element4("p", "", "纵向看层次，横向看分支。悬停看关联，点击看知识范围。"));
    header.append(heading, readingHint);
    root2.append(header);
    const top = element4("section", "arm-top-stages");
    top.setAttribute("aria-label", "四个知识阶段");
    const navigation = element4("nav", "arm-stage-nav");
    navigation.setAttribute("aria-label", "阶段定位");
    data.rows.forEach((row2, index) => {
      const card = button6("", "arm-stage-button", () => {
        stage = stage === index ? null : index;
        selected2 = null;
        hovered = null;
        paint();
        if (stage !== null && !listMode) bands[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      card.dataset.stage = String(index);
      card.style.setProperty("--arm-stage", row2.color);
      card.style.setProperty("--arm-stage-soft", row2.bg);
      card.append(element4("span", "arm-stage-number", `阶段 ${index + 1}`), element4("strong", "", row2.name), element4("p", "", data.goals[index] || ""));
      card.setAttribute("aria-pressed", "false");
      navigation.append(card);
      stageButtons.push(card);
    });
    top.append(navigation, element4("p", "arm-color-note", "绿 · 蓝 · 金 · 红表示内容由浅入深。同一阶段可以有多条并行分支；虚线节点可在遇到时补学。"));
    root2.append(top);
    const controls = element4("div", "arm-controls"), controlLeft = element4("div", "arm-control-left"), controlRight = element4("div", "arm-control-right");
    const search = element4("input", "arm-search");
    search.type = "search";
    search.placeholder = "找知识，例如：线性基、STL、BFS";
    search.setAttribute("aria-label", "搜索知识节点");
    search.addEventListener("input", () => {
      query = search.value.trim().normalize("NFKC").toLowerCase();
      stage = null;
      selected2 = null;
      hovered = null;
      paint();
    });
    const reset = button6("显示全图", "arm-reset-button", () => {
      query = "";
      search.value = "";
      stage = null;
      selected2 = null;
      hovered = null;
      paint();
    });
    const listButton = button6("列表视图", "arm-list-button", () => {
      listMode = !listMode;
      root2.dataset.view = listMode ? "list" : "graph";
      scroll.hidden = listMode;
      list.hidden = !listMode;
      listButton.setAttribute("aria-pressed", String(listMode));
      listButton.textContent = listMode ? "返回关系图" : "列表视图";
      if (!listMode) scheduleFit();
    });
    listButton.setAttribute("aria-pressed", "false");
    const highlightButton = button6("关联高亮：开", "arm-highlight-button", () => {
      highlight = !highlight;
      highlightButton.textContent = `关联高亮：${highlight ? "开" : "关"}`;
      highlightButton.setAttribute("aria-pressed", String(highlight));
      paint();
    });
    highlightButton.setAttribute("aria-pressed", "true");
    const fitButton = button6("适应窗口", "arm-fit-button", () => {
      autoFit = true;
      resize();
      scroll.scrollLeft = 0;
    });
    const actualButton = button6("100%", "arm-actual-button", () => {
      autoFit = false;
      zoom = 1;
      resize();
    });
    const zoomControls = element4("div", "arm-zoom");
    const zoomOut = button6("−", "arm-zoom-out", () => {
      autoFit = false;
      zoom = Math.max(0.2, Math.round((zoom - 0.1) * 100) / 100);
      resize();
    });
    zoomOut.setAttribute("aria-label", "缩小");
    const zoomIn = button6("＋", "arm-zoom-in", () => {
      autoFit = false;
      zoom = Math.min(2, Math.round((zoom + 0.1) * 100) / 100);
      resize();
    });
    zoomIn.setAttribute("aria-label", "放大");
    const zoomValue = element4("output", "arm-zoom-value", "100%");
    zoomValue.setAttribute("aria-label", "路线图缩放比例");
    zoomControls.append(zoomOut, zoomValue, zoomIn);
    controlLeft.append(search, reset);
    controlRight.append(listButton, highlightButton, fitButton, actualButton, zoomControls);
    controls.append(controlLeft, controlRight);
    root2.append(controls);
    const panel = element4("div", "arm-graph-panel"), captionRow = element4("div", "arm-caption-row"), caption = element4("strong", "arm-caption");
    captionRow.append(caption, element4("span", "arm-legend", "实线：学习联系　虚线：相关基础　双向：对照理解"));
    const scroll = element4("div", "arm-graph-scroll");
    scroll.setAttribute("aria-label", "知识关系图");
    const space = element4("div", "arm-canvas-space"), canvas = element4("div", "arm-canvas");
    const svg = svgElement2("svg", { class: "arm-edges", width: String(WIDTH), height: String(HEIGHT), viewBox: `0 0 ${WIDTH} ${HEIGHT}`, "aria-hidden": "true" });
    const defs = svgElement2("defs", {});
    for (const [name, color2] of [["arrow", "#92a4bf"], ["arrow-lit", "#4778be"], ["arrow-compare", "#ad7755"]]) {
      const marker = svgElement2("marker", { id: `${uid}-${name}`, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" });
      marker.append(svgElement2("path", { d: "M0 0L10 5L0 10z", fill: color2 }));
      defs.append(marker);
    }
    svg.append(defs);
    const bands = data.rows.map((row2, index) => {
      const band = element4("div", "arm-band");
      band.dataset.stage = String(index);
      band.style.top = `${BAND_STARTS[index]}px`;
      band.style.height = `${BAND_HEIGHTS[index]}px`;
      band.style.setProperty("--arm-stage", row2.color);
      band.style.setProperty("--arm-stage-soft", row2.bg);
      band.append(element4("span", "arm-band-label", `0${index + 1} / ${row2.name}`));
      canvas.append(band);
      return band;
    });
    for (const edge of data.edges) {
      const from = graphById.get(edge.from), to = graphById.get(edge.to);
      if (!from || !to) continue;
      const points = route(from, to, nodes);
      const path = svgElement2("path", { class: `arm-edge${edge.bidir ? " arm-compare" : ""}${edge.relation === "foundation" ? " arm-foundation" : ""}`, d: points.map((point, index) => `${index ? "L" : "M"}${point.join(" ")}`).join(" "), "data-from": edge.from, "data-to": edge.to, "data-points": JSON.stringify(points), "marker-end": `url(#${uid}-${edge.bidir ? "arrow-compare" : "arrow"})` });
      if (edge.bidir) path.setAttribute("marker-start", `url(#${uid}-arrow-compare)`);
      svg.append(path);
      edgeElements.push({ edge, path });
    }
    canvas.append(svg);
    function nodeCard(node3, graph) {
      const card = button6("", graph ? `arm-node arm-kind-${node3.kind}${node3.contextual ? " arm-contextual" : ""}` : "arm-list-node", () => open2(node3.id));
      card.dataset.node = node3.id;
      card.dataset.stage = String(node3.row);
      const row2 = data.rows[node3.row];
      card.style.setProperty("--arm-stage", row2?.color || "#4778be");
      card.style.setProperty("--arm-stage-soft", row2?.bg || "#edf4ff");
      card.setAttribute("aria-label", `${row2?.name || "专题"}：${node3.label}，打开详情`);
      card.setAttribute("aria-haspopup", "dialog");
      card.append(element4("strong", "", node3.label));
      const sub = node3.sub || (node3.id === "g" ? "表达与实现" : node3.id === "ds" ? "容器与常用接口" : node3.id === "ssr" ? "状态与转移" : "");
      if (!graph || sub) card.append(element4("small", "", graph ? sub : node3.detail[0]));
      if (graph && node3.contextual) card.append(element4("span", "arm-context-badge", "遇到再学"));
      if (graph) card.append(element4("span", "arm-open-icon", "↗"));
      card.addEventListener("pointerenter", () => {
        hovered = node3.id;
        paint();
      });
      card.addEventListener("pointerleave", () => {
        hovered = null;
        paint();
      });
      card.addEventListener("focus", () => {
        hovered = node3.id;
        paint();
      });
      card.addEventListener("blur", () => {
        hovered = null;
        paint();
      });
      const existing = cards2.get(node3.id) || [];
      existing.push(card);
      cards2.set(node3.id, existing);
      return card;
    }
    for (const node3 of nodes) {
      const card = nodeCard(node3, true);
      card.style.left = `${node3.x}px`;
      card.style.top = `${node3.y}px`;
      canvas.append(card);
    }
    space.append(canvas);
    scroll.append(space);
    const list = element4("div", "arm-list");
    list.hidden = true;
    data.rows.forEach((row2, index) => {
      const section = element4("section", "arm-list-stage");
      section.dataset.stage = String(index);
      section.style.setProperty("--arm-stage", row2.color);
      section.append(element4("h3", "", row2.name), element4("p", "", data.goals[index] || ""));
      const group = element4("div", "arm-list-nodes");
      data.nodes.filter((node3) => node3.row === index).forEach((node3) => group.append(nodeCard(node3, false)));
      section.append(group);
      list.append(section);
    });
    const empty = element4("p", "arm-empty", "没有找到对应知识，试试其他名称或关键词。");
    empty.hidden = true;
    empty.setAttribute("role", "status");
    panel.append(captionRow, scroll, list, empty);
    root2.append(panel);
    const insight = element4("div", "arm-insight");
    const insightCopy = element4("p", "arm-insight-copy", "选一个节点，查看它的知识范围与前后联系。");
    const insightOpen = button6("查看节点详情", "arm-insight-open", () => {
      if (selected2) open2(selected2);
    });
    insightOpen.hidden = true;
    insight.append(insightCopy, insightOpen);
    root2.append(insight);
    for (const entry2 of data.indexEntries) {
      const index = element4("section", "arm-topic-index"), text3 = element4("div", "");
      text3.append(element4("strong", "", entry2.label), element4("p", "", "CDQ 分治、整体二分、莫队与特殊题型，按需要查阅专项索引。"));
      const action2 = button6("查看专项索引 →", "arm-index-button", () => open2(entry2.id));
      action2.dataset.node = entry2.id;
      index.append(text3, action2);
      root2.append(index);
    }
    const dialog3 = element4("dialog", "arm-detail-dialog");
    dialog3.setAttribute("aria-labelledby", `${uid}-detail-title`);
    const dialogHeader = element4("div", "arm-dialog-header"), breadcrumb = element4("span", "arm-breadcrumb");
    const close = button6("关闭 ×", "arm-close-button", () => dialog3.close());
    close.setAttribute("aria-label", "关闭节点详情");
    dialogHeader.append(breadcrumb, close);
    const detailBody = element4("div", "arm-detail-body");
    dialog3.append(dialogHeader, detailBody);
    root2.append(dialog3);
    dialog3.addEventListener("close", () => {
      if (!destroyed && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    });
    dialog3.addEventListener("click", (event) => {
      if (event.target === dialog3) {
        const box = dialog3.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog3.close();
      }
    });
    function matches(node3) {
      return [node3.label, node3.sub || "", ...node3.detail.flat()].join(" ").normalize("NFKC").toLowerCase().includes(query);
    }
    function paint() {
      const active3 = highlight ? hovered || selected2 : null;
      const related = active3 ? /* @__PURE__ */ new Set([active3, ...data.edges.flatMap((edge) => edge.from === active3 ? [edge.to] : edge.to === active3 ? [edge.from] : [])]) : null;
      let matchCount = 0;
      for (const node3 of data.nodes) {
        const match2 = !query || matches(node3);
        if (match2) matchCount++;
        for (const card of cards2.get(node3.id) || []) {
          card.classList.toggle("arm-dim", !match2 || stage !== null && node3.row !== stage || !query && stage === null && !!related && !related.has(node3.id));
          card.classList.toggle("arm-match", !!query && match2);
          card.classList.toggle("arm-selected", node3.id === selected2);
          card.classList.toggle("arm-related", !!related?.has(node3.id));
          card.classList.toggle("arm-position", node3.id === position);
          card.dataset.focused = String(node3.id === position);
          card.setAttribute("aria-pressed", String(node3.id === selected2));
        }
      }
      for (const { edge, path } of edgeElements) {
        const from = byId.get(edge.from), to = byId.get(edge.to), lit = !!active3 && (edge.from === active3 || edge.to === active3);
        path.classList.toggle("arm-lit", lit);
        path.classList.toggle("arm-dim", !!query && !!from && !!to && !matches(from) && !matches(to) || stage !== null && (from?.row !== stage || to?.row !== stage) || !query && stage === null && !!related && !lit);
        path.setAttribute("marker-end", `url(#${uid}-${edge.bidir ? "arrow-compare" : lit ? "arrow-lit" : "arrow"})`);
      }
      stageButtons.forEach((card, index) => card.setAttribute("aria-pressed", String(stage === index)));
      const indexMatch = data.indexEntries.some((entry2) => query && matches(entry2));
      empty.hidden = !query || matchCount > 0 || indexMatch;
      root2.querySelectorAll(".arm-index-button").forEach((card) => {
        const node3 = byId.get(card.dataset.node || "");
        card.classList.toggle("arm-match", !!query && !!node3 && matches(node3));
      });
      caption.textContent = query ? `搜索结果 · ${matchCount} 个知识节点${indexMatch ? " · 含专项索引" : ""}` : stage === null ? `完整框架 · ${data.rows.length} 层 / ${data.nodes.length} 个知识节点` : `${data.rows[stage].name} · ${data.goals[stage] || ""}`;
      const current = selected2 ? byId.get(selected2) : null;
      const bookmark = position ? byId.get(position) : null;
      insightCopy.textContent = current ? `${current.label} · ${current.detail[0]}` : bookmark ? `当前关注：${bookmark.label}。可以随时沿相关基础回补，或选择其他分支。` : "选一个节点，查看它的知识范围与前后联系。";
      insightOpen.hidden = !current;
    }
    const introductions = /* @__PURE__ */ new Map();
    function renderDetail(node3) {
      detailBody.replaceChildren();
      const row2 = data.rows[node3.row];
      breadcrumb.textContent = `四层大纲 / ${row2?.name || "专项索引"} / 目录`;
      const title = element4("h2", "arm-detail-title", node3.label);
      title.id = `${uid}-detail-title`;
      detailBody.append(title);
      const introduction = element4("section", "arm-directory-introduction");
      const heading2 = element4("div", "arm-directory-heading");
      heading2.append(element4("h3", "", "简介"));
      const markdown = introductions.get(node3.id) ?? options.getIntroduction?.(node3) ?? roadmapIntroduction(node3);
      const body = element4("div", "markdown-body arm-directory-markdown");
      if (options.renderMarkdown) options.renderMarkdown(body, markdown);
      else body.textContent = markdown;
      introduction.append(heading2, body);
      detailBody.append(introduction);
      if (options.canManage && options.onSaveIntroduction) heading2.append(button6("编辑简介", "arm-edit-introduction", () => {
        const form = element4("form", "arm-introduction-form"), input2 = element4("textarea", "arm-introduction-input");
        input2.name = "introduction";
        input2.rows = 12;
        input2.value = markdown;
        input2.setAttribute("aria-label", "目录简介（Markdown）");
        const error2 = element4("p", "arm-focus-error");
        error2.hidden = true;
        error2.setAttribute("role", "alert");
        const actions2 = element4("div", "arm-resource-actions");
        const cancel = button6("取消", "", () => renderDetail(node3)), save = element4("button", "arm-button", "保存简介");
        save.type = "submit";
        actions2.append(cancel, save);
        form.append(input2, error2, actions2);
        introduction.replaceChildren(form);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (save.disabled) return;
          if (!input2.value.trim() || input2.value.length > 6e3) {
            error2.textContent = "简介须为1–6000字。";
            error2.hidden = false;
            return;
          }
          input2.disabled = cancel.disabled = save.disabled = true;
          const isCurrentEditor = () => !destroyed && dialog3.open && detailNode?.id === node3.id && form.isConnected;
          try {
            await options.onSaveIntroduction(node3.id, input2.value);
            introductions.set(node3.id, input2.value);
            if (isCurrentEditor()) renderDetail(node3);
          } catch (cause) {
            if (isCurrentEditor()) {
              error2.textContent = cause instanceof Error ? cause.message : "简介保存失败，请重试。";
              error2.hidden = false;
              input2.disabled = cancel.disabled = save.disabled = false;
            }
          }
        });
        input2.focus();
      }));
      const choices = element4("section", "arm-leaf-choices");
      choices.append(element4("h3", "", "知识点"));
      const links = element4("div", "arm-resource-links");
      for (const leaf of options.tree ? roadmapLeaves(options.tree, node3) : []) {
        const action2 = button6(leaf.label, "arm-leaf-link", () => {
          dialog3.close();
          options.onOpenLeaf?.(leaf.id);
        });
        action2.dataset.topicId = leaf.id;
        links.append(action2);
      }
      if (links.childElementCount) choices.append(links);
      else choices.append(element4("p", "arm-fine-print", "暂无可浏览的知识点。"));
      detailBody.append(choices);
      const actions = element4("div", "arm-detail-actions");
      if (options.onOpenResources) actions.append(button6("浏览知识点", "arm-resources-button", () => {
        dialog3.close();
        options.onOpenResources?.(node3);
      }));
      if (options.onFocus) {
        const focus = button6(position === node3.id ? "取消当前关注" : "设为当前关注", "arm-focus-button", () => {
          void saveFocus(node3);
        });
        focus.disabled = pending2;
        focus.setAttribute("aria-pressed", String(position === node3.id));
        actions.append(focus);
      }
      const error = element4("p", "arm-focus-error");
      error.hidden = true;
      error.setAttribute("role", "alert");
      detailBody.append(actions, error);
    }
    async function saveFocus(node3) {
      if (pending2 || destroyed || !options.onFocus) return;
      const before = position, next = position === node3.id ? null : node3.id;
      pending2 = true;
      position = next;
      paint();
      if (detailNode) renderDetail(detailNode);
      try {
        await options.onFocus(next);
        if (!destroyed) options.toast?.(next ? `当前关注：${node3.label}` : "已取消当前关注");
      } catch (error) {
        if (!destroyed) {
          position = before;
          paint();
          if (detailNode) renderDetail(detailNode);
          const message = error instanceof Error ? error.message : "当前关注保存失败，请重试。";
          const errorNode = detailBody.querySelector(".arm-focus-error");
          if (errorNode) {
            errorNode.textContent = message;
            errorNode.hidden = false;
          }
          options.toast?.(message);
        }
      } finally {
        pending2 = false;
        if (!destroyed) {
          const action2 = detailBody.querySelector(".arm-focus-button");
          if (action2) action2.disabled = !options.onFocus;
        }
      }
    }
    function open2(id) {
      const node3 = byId.get(id);
      if (!node3 || destroyed) return false;
      if (!dialog3.open) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      selected2 = id;
      hovered = null;
      detailNode = node3;
      paint();
      renderDetail(node3);
      if (!dialog3.open) dialog3.showModal();
      detailBody.scrollTop = 0;
      return true;
    }
    function resize() {
      if (destroyed) return;
      if (autoFit && scroll.clientWidth > 0) zoom = Math.min(1.5, Math.max(0.15, (scroll.clientWidth - 2) / WIDTH));
      canvas.style.transform = `scale(${zoom})`;
      space.style.width = `${WIDTH * zoom}px`;
      space.style.height = `${HEIGHT * zoom}px`;
      zoomValue.textContent = `${Math.round(zoom * 100)}%`;
      root2.dataset.zoomMode = autoFit ? "fit" : "manual";
      fitButton.setAttribute("aria-pressed", String(autoFit));
      actualButton.setAttribute("aria-pressed", String(!autoFit && zoom === 1));
    }
    function scheduleFit() {
      if (frame || destroyed) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!listMode) resize();
      });
    }
    host.replaceChildren(root2);
    paint();
    resize();
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(scroll);
    return {
      selectGate(id) {
        const node3 = data.nodes.find((entry2) => entry2.gateIds?.includes(id));
        return node3 ? open2(node3.id) : false;
      },
      selectTopic(id) {
        const leafId = options.tree ? resolveAlgorithmLeaf(options.tree, id)?.id : void 0;
        const node3 = [...data.nodes, ...data.indexEntries].find((entry2) => entry2.topicIds?.includes(id) || leafId && options.tree && roadmapLeaves(options.tree, entry2).some((leaf) => leaf.id === leafId));
        return node3 ? open2(node3.id) : false;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        observer.disconnect();
        if (frame) cancelAnimationFrame(frame);
        if (dialog3.open) dialog3.close();
        root2.remove();
      }
    };
  }
  var LearningRoadmap = Object.freeze({ render: render5 });

  // src/renderer/algorithms/roadmap-data.ts
  var roadmapData = {
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

  // src/renderer/algorithms/roadmap-resources.ts
  function el2(tag, text3, className = "") {
    const n = document.createElement(tag);
    n.className = className;
    if (text3 !== void 0) n.textContent = text3;
    return n;
  }
  function button7(text3, cls, action2) {
    const b = el2("button", text3, `arm-button ${cls}`);
    b.type = "button";
    b.addEventListener("click", action2);
    return b;
  }
  function directoryTree(node3) {
    return { ...node3, label: node3.label || node3.id, color: node3.color || "parent", children: (node3.children || []).map(directoryTree) };
  }
  function openRoadmapResources(options) {
    const { host, node: node3 } = options, previous = document.activeElement, tree = directoryTree(options.tree);
    const allGates = (options.curriculum.stages || []).flatMap((stage) => stage.gates || []);
    let introduction = options.getIntroduction?.(node3) ?? options.nodeContents?.find((content) => content.nodeId === `roadmap:${node3.id}`)?.introduction ?? roadmapIntroduction(node3);
    let selected2 = options.topicId ? resolveAlgorithmLeaf(tree, options.topicId) : null;
    let scope2 = options.scope === "personal" ? "personal" : "public", destroyed = false, busy2 = false;
    const dialog3 = el2("dialog", void 0, "arm-detail-dialog arm-resource-dialog");
    const heading = el2("header", void 0, "arm-dialog-header"), title = el2("h2", "", "arm-detail-title");
    const close = button7("关闭 ×", "arm-resource-close", () => {
      if (!busy2) destroy();
    });
    close.setAttribute("aria-label", "关闭知识点浏览");
    heading.append(title, close);
    const body = el2("div", void 0, "arm-dialog-body");
    dialog3.append(heading, body);
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (dialog3.open) dialog3.close();
      dialog3.remove();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    }
    dialog3.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (!busy2) destroy();
    });
    function renderMarkdown(target, markdown) {
      if (options.renderMarkdown) options.renderMarkdown(target, markdown);
      else target.textContent = markdown;
    }
    function renderIntroduction() {
      const section = el2("section", void 0, "arm-directory-introduction"), row2 = el2("div", void 0, "arm-directory-heading");
      row2.append(el2("h3", "简介"));
      const markdown = el2("div", void 0, "markdown-body arm-directory-markdown");
      renderMarkdown(markdown, introduction);
      section.append(row2, markdown);
      if (options.canManage && options.onSaveIntroduction) row2.append(button7("编辑简介", "arm-edit-introduction", () => {
        const form = el2("form", void 0, "arm-introduction-form"), input2 = el2("textarea", void 0, "arm-introduction-input");
        input2.name = "introduction";
        input2.rows = 12;
        input2.value = introduction;
        input2.setAttribute("aria-label", "目录简介（Markdown）");
        const error = el2("p", "", "arm-focus-error");
        error.hidden = true;
        error.setAttribute("role", "alert");
        const cancel = button7("取消", "", render6), save = el2("button", "保存简介", "arm-button");
        save.type = "submit";
        const actions = el2("div", void 0, "arm-resource-actions");
        actions.append(cancel, save);
        form.append(input2, error, actions);
        section.replaceChildren(form);
        input2.focus();
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (busy2) return;
          if (!input2.value.trim() || input2.value.length > 6e3) {
            error.textContent = "简介须为1–6000字。";
            error.hidden = false;
            return;
          }
          busy2 = true;
          input2.disabled = cancel.disabled = save.disabled = true;
          try {
            await options.onSaveIntroduction(node3.id, input2.value);
            introduction = input2.value;
            if (!destroyed) render6();
          } catch (cause) {
            error.textContent = cause instanceof Error ? cause.message : "简介保存失败，请重试";
            error.hidden = false;
          } finally {
            busy2 = false;
            input2.disabled = cancel.disabled = save.disabled = false;
          }
        });
      }));
      return section;
    }
    function render6() {
      body.replaceChildren();
      title.textContent = selected2 ? selected2.label : `${node3.label} · 目录`;
      dialog3.setAttribute("aria-label", selected2 ? `${selected2.label}知识点` : `${node3.label}目录`);
      const scopes = el2("nav", void 0, "arm-note-scope");
      scopes.setAttribute("aria-label", "笔记范围");
      for (const value of ["public", "personal"]) {
        const control = button7(value === "public" ? "公开笔记" : "我的笔记", "arm-scope-button", () => {
          scope2 = value;
          render6();
        });
        control.dataset.scope = value;
        control.setAttribute("aria-pressed", String(value === scope2));
        scopes.append(control);
      }
      body.append(scopes);
      if (!selected2) {
        body.append(renderIntroduction());
        const choices = el2("section", void 0, "arm-leaf-choices");
        choices.append(el2("h3", "知识点"));
        const links = el2("div", void 0, "arm-resource-links");
        for (const leaf2 of roadmapLeaves(tree, node3)) {
          const action2 = button7(leaf2.label, "arm-leaf-link", () => {
            selected2 = leaf2;
            dialog3.scrollTop = 0;
            render6();
          });
          action2.dataset.topicId = leaf2.id;
          links.append(action2);
        }
        if (links.childElementCount) choices.append(links);
        else choices.append(el2("p", "暂无可浏览的知识点。", "arm-fine-print"));
        body.append(choices);
        return;
      }
      const leaf = selected2;
      body.append(button7("返回目录", "arm-back-directory", () => {
        selected2 = null;
        render6();
      }));
      const originals = /* @__PURE__ */ new Map();
      const notes = options.notes.filter((note) => scope2 === "public" ? note.noteScope === "public" : note.noteScope === "personal" && options.account?.id != null && String(note.authorId) === String(options.account.id)).flatMap((note) => {
        if (resolveAlgorithmLeaf(tree, note.nodeId)?.id !== leaf.id) return [];
        const canonical = { ...note, nodeId: leaf.id };
        originals.set(canonical, note);
        return [canonical];
      });
      const rawContent = options.nodeContents?.find((content2) => content2.nodeId === leaf.id) || options.nodeContents?.find((content2) => resolveAlgorithmLeaf(tree, content2.nodeId)?.id === leaf.id);
      const content = rawContent ? { ...rawContent, storageNodeId: rawContent.storageNodeId || rawContent.nodeId, nodeId: leaf.id } : null;
      const gateId = allGates.find((gate) => (gate.topicIds || []).some((id) => resolveAlgorithmLeaf(tree, id)?.id === leaf.id))?.id || "";
      const reading = renderLeafReading({
        node: leaf,
        content,
        notes,
        canManage: options.canManage,
        onSave: options.onSaveNodeContent ? async (input2) => {
          const saved = await options.onSaveNodeContent(input2);
          options.nodeContents = [...(options.nodeContents || []).filter((entry2) => resolveAlgorithmLeaf(tree, entry2.nodeId)?.id !== leaf.id), saved];
          return saved;
        } : void 0,
        renderMarkdown: options.renderMarkdown,
        onRead: (note) => {
          const original = originals.get(note);
          if (original) {
            destroy();
            options.onNote({ ...original, nodeId: leaf.id }, gateId);
          }
        },
        onUpload: options.onUploadLeaf ? () => {
          destroy();
          options.onUploadLeaf(leaf.id);
        } : void 0
      });
      reading.id = `topic-${leaf.id}`;
      body.append(reading);
    }
    render6();
    host.append(dialog3);
    dialog3.showModal();
    return { destroy };
  }

  // src/shared/learning-curriculum.ts
  function applyCurriculumLayout(base, layout) {
    const originalStages = new Map((base.stages || []).map((stage) => [stage.id, stage]));
    const activeIds = new Set(layout.stages.flatMap((stage) => stage.gates.map((gate) => gate.id)));
    const oldNames = new Map((base.legacyGates || []).map((gate) => [gate.id, gate]));
    for (const stage of base.stages || []) {
      for (const gate of stage.gates || []) {
        if (!activeIds.has(gate.id)) oldNames.set(gate.id, { id: gate.id, title: gate.title || gate.id, stageTitle: stage.title || stage.id });
      }
    }
    const stages = layout.stages.map((entry2) => {
      const original = originalStages.get(entry2.id);
      if (!original) throw new Error("课程编排包含未知章节，请重新同步");
      const gatesById = new Map((original.gates || []).map((gate) => [gate.id, gate]));
      const sections = new Map((original.sections || []).map((section) => [section.id, section]));
      const gates = entry2.gates.map((item) => {
        const previous = gatesById.get(item.id), section = sections.get(item.sectionId);
        return {
          ...previous || { id: item.id, description: item.description || "", learningDescription: item.description || "", goals: [...item.goals || []], topicIds: [...item.topicIds || []], threadGateIds: [], prerequisites: { gateIds: [], topicIds: [] } },
          title: item.title,
          kind: item.kind,
          sectionId: item.sectionId,
          sectionTitle: section?.title,
          scope: item.scope,
          optional: item.scope !== "core",
          routeId: section?.routeId || null,
          prerequisites: previous?.prerequisites ? { ...previous.prerequisites, gateIds: (previous.prerequisites.gateIds || []).filter((id) => activeIds.has(id)) } : { gateIds: [], topicIds: [] },
          threadGateIds: (previous?.threadGateIds || []).filter((id) => activeIds.has(id))
        };
      });
      return {
        ...original,
        title: entry2.title,
        gates,
        sections: (original.sections || []).map((section) => ({
          ...section,
          gateIds: gates.filter((gate) => gate.sectionId === section.id).map((gate) => gate.id),
          prerequisites: section.prerequisites ? { ...section.prerequisites, gateIds: (section.prerequisites.gateIds || []).filter((id) => activeIds.has(id)) } : void 0
        })).filter((section) => section.gateIds.length > 0)
      };
    });
    return { ...base, stages, legacyGates: [...oldNames.values()] };
  }

  // src/renderer/algorithms/workspace.ts
  function createAlgorithmWorkspace(options) {
    const global2 = window;
    const { getAlgorithmNotes, setAlgorithmNotes, getAlgorithmTopics, setAlgorithmTopics, getAlgorithmTree, setAlgorithmTree, getAccount, getPermissions, getLocal, getBusy, getReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render: render6, renderMarkdown, authorName, date, tags, toast, errorMessage } = options;
    const $ = (selector) => document.querySelector(selector);
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button8(label, className, action2) {
      const node3 = element5("button", className, label);
      node3.type = "button";
      node3.addEventListener("click", action2);
      return node3;
    }
    let algorithmSelectedNode = "root";
    function flattenTree(node3, depth = 0, parent = null, out = []) {
      out.push({ ...node3, depth, parent });
      (node3.children || []).forEach((child) => flattenTree(child, depth + 1, node3.id, out));
      return out;
    }
    function algorithmNodes() {
      return flattenTree(getAlgorithmTree());
    }
    async function saveNodeContent(input2) {
      if (getBusy()) throw new Error("请等待当前操作完成");
      if (!getAccount() || getPermissions().admin !== true) throw new Error("只有管理员可以修改简介与精选");
      const source = options.repoSource(), owner = accountId();
      setBusy(true);
      try {
        const saved = await options.saveAlgorithmNodeContent({ ...input2, repo: repo() });
        if (source !== options.repoSource() || owner !== accountId()) throw new Error("账号或资料来源已改变，请重新同步");
        options.setAlgorithmNodeContents([...options.getAlgorithmNodeContents().filter((content) => content.nodeId !== saved.nodeId), saved]);
        return saved;
      } finally {
        setBusy(false);
      }
    }
    async function saveRouteIntroduction(nodeId, introduction) {
      if (getBusy()) throw new Error("请等待当前操作完成");
      if (!getAccount() || getPermissions().admin !== true) throw new Error("只有管理员可以修改简介");
      const target = `roadmap:${nodeId}`;
      const current = options.getAlgorithmNodeContents().find((item) => item.nodeId === target);
      await saveNodeContent({ nodeId: target, introduction, featuredNotePaths: [], sha: current?.sha || null });
    }
    let algorithmMode = "tree";
    let algorithmPendingTopic = null;
    let algorithmController = null;
    let learningController = null;
    let resources = null;
    function effectiveCurriculum() {
      const base = global2.QMX_ALGORITHM_LEARNING_PATH;
      const document2 = options.getLearningCurriculum();
      return base && document2 ? applyCurriculumLayout(base, document2.layout) : base;
    }
    function learningProgressKey() {
      return JSON.stringify([options.repoSource(), accountId() || "anonymous", global2.QMX_ALGORITHM_LEARNING_PATH?.id || "xcpc-learning"]);
    }
    function learningProgress() {
      const current = getLocal().learningPaths?.[learningProgressKey()];
      if (current) return current;
      if (options.repoSource().startsWith("https://api.github.com|")) {
        const legacy = JSON.stringify([repo(), accountId() || "anonymous", global2.QMX_ALGORITHM_LEARNING_PATH?.id || "xcpc-learning"]);
        return getLocal().learningPaths?.[legacy] || { gates: {} };
      }
      return { gates: {} };
    }
    async function saveRoadmapProgress(next) {
      if (getBusy()) throw new Error("请等待当前操作完成");
      const key = learningProgressKey(), previous = getLocal().learningPaths?.[key];
      setBusy(true);
      getLocal().learningPaths = { ...getLocal().learningPaths || {}, [key]: structuredClone(next) };
      try {
        await persistLocal();
      } catch (error) {
        if (previous === void 0) delete getLocal().learningPaths[key];
        else getLocal().learningPaths[key] = previous;
        throw error;
      } finally {
        setBusy(false);
      }
    }
    function setAlgorithmMode(mode) {
      if (getBusy()) return;
      algorithmMode = mode;
      renderAlgorithmNotes();
    }
    function openLearningTopic(id) {
      algorithmPendingTopic = id;
      setAlgorithmMode("tree");
    }
    async function saveLearningProgress(value) {
      if (getBusy()) throw new Error("请等待当前操作完成后再保存学习进度");
      const id = learningProgressKey(), previous = getLocal().learningPaths?.[id];
      setBusy(true);
      getLocal().learningPaths = { ...getLocal().learningPaths || {}, [id]: structuredClone(value) };
      try {
        await persistLocal();
      } catch (error) {
        if (previous === void 0) delete getLocal().learningPaths[id];
        else getLocal().learningPaths[id] = previous;
        throw error;
      } finally {
        setBusy(false);
      }
    }
    function renderAlgorithmNotes() {
      getReadingDetail()?.closeAll();
      const panel = $("#algorithm-panel");
      resources?.destroy();
      resources = null;
      algorithmController?.destroy();
      learningController?.destroy();
      learningController = null;
      panel.replaceChildren();
      const modes = element5("div", "algorithm-view-modes");
      modes.setAttribute("role", "group");
      modes.setAttribute("aria-label", "算法学习方式");
      for (const [mode, title] of [["tree", "知识树"], ["path", "学习路线"]]) {
        const control = button8(title, "button secondary", () => setAlgorithmMode(mode));
        control.dataset.mode = mode;
        control.setAttribute("aria-pressed", String(algorithmMode === mode));
        modes.append(control);
      }
      panel.append(modes);
      const host = element5("div", "algorithm-view-content");
      panel.append(host);
      if (algorithmMode === "path") {
        let openLeaf2 = function(topicId) {
          const node3 = [...mapped.nodes, ...mapped.indexEntries].find((item) => (item.topicIds || []).some((id) => resolveAlgorithmLeaf(getAlgorithmTree(), id)?.id === topicId));
          if (!node3 || !curriculum) return;
          resources?.destroy();
          resources = openRoadmapResources({
            host: host.querySelector(".arm") || host,
            node: node3,
            topicId,
            curriculum,
            tree: getAlgorithmTree(),
            notes: getAlgorithmNotes(),
            contents: options.getLearningGateContents(),
            progress: structuredClone(learningProgress()),
            canManage: Boolean(getAccount() && getPermissions().admin === true),
            nodeContents: options.getAlgorithmNodeContents(),
            onSaveNodeContent: saveNodeContent,
            renderMarkdown,
            scope: panel.dataset.scope === "personal" ? "personal" : "public",
            account: getAccount(),
            onSaveGate: async () => {
              throw new Error("请通过简介编辑入口保存");
            },
            onPersonal: async () => {
            },
            onTopic: openLearningTopic,
            onNote: (note, gateId) => openAlgorithmNoteDetail(note, { gateId }),
            onExternal: options.openExternal,
            onUploadLeaf: getAccount() && getPermissions().push ? (id) => {
              algorithmSelectedNode = id;
              openAlgorithmNoteEditor();
            } : void 0,
            onSaveIntroduction: saveRouteIntroduction
          });
        };
        var openLeaf = openLeaf2;
        const curriculum = effectiveCurriculum();
        const mapped = { ...roadmapData, nodes: roadmapData.nodes.map((node3) => ({ ...node3 })), indexEntries: roadmapData.indexEntries.map((node3) => ({ ...node3 })) };
        const allGates = (curriculum?.stages || []).flatMap((stage) => stage.gates || []);
        for (const node3 of [...mapped.nodes, ...mapped.indexEntries]) {
          const known2 = new Set(node3.topicIds || []);
          const added = allGates.filter((gate) => gate.id.startsWith("custom-") && (gate.topicIds || []).some((id) => known2.has(id)));
          node3.gateIds = [.../* @__PURE__ */ new Set([...node3.gateIds || [], ...added.map((gate) => gate.id)])];
          node3.topicIds = [.../* @__PURE__ */ new Set([...node3.topicIds || [], ...added.flatMap((gate) => gate.topicIds || [])])];
        }
        learningController = LearningRoadmap.render({
          host,
          data: mapped,
          progress: learningProgress(),
          tree: getAlgorithmTree(),
          nodeContents: options.getAlgorithmNodeContents(),
          renderMarkdown,
          canManage: Boolean(getAccount() && getPermissions().admin === true),
          onSaveIntroduction: saveRouteIntroduction,
          getIntroduction: (node3) => options.getAlgorithmNodeContents().find((item) => item.nodeId === `roadmap:${node3.id}`)?.introduction,
          onOpenLeaf: openLeaf2,
          onFocus: async (id) => {
            await saveRoadmapProgress({ ...learningProgress(), roadmapFocus: id });
          },
          toast,
          onOpenResources: (node3) => {
            if (!curriculum || getBusy()) return;
            resources?.destroy();
            resources = openRoadmapResources({
              host: host.querySelector(".arm") || host,
              node: node3,
              curriculum,
              tree: getAlgorithmTree(),
              notes: getAlgorithmNotes(),
              progress: structuredClone(learningProgress()),
              contents: options.getLearningGateContents(),
              canManage: Boolean(getAccount() && getPermissions().admin === true),
              nodeContents: options.getAlgorithmNodeContents(),
              onSaveNodeContent: saveNodeContent,
              renderMarkdown,
              scope: panel.dataset.scope === "personal" ? "personal" : "public",
              account: getAccount(),
              onUploadLeaf: getAccount() && getPermissions().push ? (id) => {
                algorithmSelectedNode = id;
                openAlgorithmNoteEditor();
              } : void 0,
              onSaveIntroduction: saveRouteIntroduction,
              onSaveGate: async (input2) => {
                if (getBusy()) throw new Error("请等待当前操作完成");
                if (!getAccount() || getPermissions().admin !== true) throw new Error("只有管理员可以修改公共资料");
                const source = options.repoSource(), owner = accountId();
                setBusy(true);
                try {
                  const saved = await options.saveLearningGate({ ...input2, repo: repo() });
                  if (source !== options.repoSource() || owner !== accountId()) throw new Error("账号或资料库已改变，请重新同步");
                  options.setLearningGateContents([...options.getLearningGateContents().filter((content) => content.gateId !== saved.gateId), saved]);
                  return saved;
                } finally {
                  setBusy(false);
                }
              },
              onPersonal: async (gateId, url) => {
                const previous = learningProgress(), record = previous.gates?.[gateId];
                const fields = record && typeof record === "object" && !Array.isArray(record) ? record : {};
                await saveRoadmapProgress({ ...previous, gates: { ...previous.gates || {}, [gateId]: { ...fields, practiceUrl: url } } });
              },
              onTopic: openLearningTopic,
              onNote: (note, gateId) => openAlgorithmNoteDetail(note, { gateId }),
              onExternal: options.openExternal
            });
          }
        });
        return;
      }
      algorithmController = AlgorithmBrowser.render({
        host,
        tree: getAlgorithmTree(),
        notes: getAlgorithmNotes(),
        nodeContents: options.getAlgorithmNodeContents(),
        onSaveNodeContent: saveNodeContent,
        onLearningPath(id) {
          setAlgorithmMode("path");
          learningController?.selectTopic?.(id);
        },
        scope: panel.dataset.scope || "public",
        account: getAccount(),
        canUpload: Boolean(getAccount() && getPermissions().push),
        canManage: Boolean(getAccount() && getPermissions().admin),
        onAddTopic: openAlgorithmTopicEditor,
        onScopeChange(scope2) {
          if (scope2 === "personal" && !getAccount()) {
            toast("请先登录 GitHub 账户");
            return;
          }
          panel.dataset.scope = scope2;
          renderAlgorithmNotes();
        },
        onSelect(id) {
          algorithmSelectedNode = id;
        },
        onUpload(id) {
          algorithmSelectedNode = id;
          openAlgorithmNoteEditor();
        },
        renderMarkdown,
        authorName,
        formatDate: date
      });
      if (algorithmPendingTopic) {
        const id = algorithmPendingTopic;
        algorithmPendingTopic = null;
        algorithmController.selectNode(id);
      }
    }
    let algorithmTopicRequest = null;
    function updateAlgorithmTopicKind() {
      const form = $("#algorithm-topic-form"), directory = form.elements.kind.value === "directory";
      $("#algorithm-topic-difficulty").hidden = directory;
      form.elements.color.disabled = directory;
      form.elements.color.required = !directory;
      $("#algorithm-topic-submit").textContent = directory ? "保存目录" : "保存算法";
    }
    document.querySelector('#algorithm-topic-form [name="kind"]').addEventListener("change", updateAlgorithmTopicKind);
    function openAlgorithmTopicEditor(parentId) {
      if (!getAccount() || !getPermissions().admin) return;
      const parent = algorithmNodes().find((node3) => node3.id === parentId);
      if (!parent) return;
      const form = $("#algorithm-topic-form");
      form.reset();
      form.elements.parentId.value = parent.id;
      $("#algorithm-topic-parent").textContent = parent.fullLabel || parent.label;
      updateAlgorithmTopicKind();
      $("#algorithm-topic-kind-hint").textContent = parent.kind === "algorithm" ? "添加子项后，此节点将保留为目录，原算法及难度移入同名叶子，笔记保存在具体知识点。" : "算法需要选择难度；目录只组织子节点，不保存笔记。";
      $("#algorithm-topic-error").hidden = true;
      algorithmTopicRequest = uuid();
      $("#algorithm-topic-dialog").showModal();
      form.elements.label.focus();
    }
    $("#algorithm-topic-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (getBusy() || !getPermissions().admin || !getAccount()) return;
      const form = event.currentTarget, data = Object.fromEntries(new FormData(form));
      setBusy(true);
      $("#algorithm-topic-error").hidden = true;
      try {
        const topic = await call("saveAlgorithmTopic", { repo: repo(), parentId: data.parentId, label: data.label.trim(), fullLabel: data.fullLabel.trim() || data.label.trim(), kind: data.kind, color: data.kind === "directory" ? "parent" : data.color, scope: data.scope.trim(), requestId: algorithmTopicRequest });
        setAlgorithmTopics([...(getAlgorithmTopics() || []).filter((record) => record.id !== topic.id), topic]);
        setAlgorithmTree(AlgorithmDirectory.hydrate(global2.QMX_ALGORITHM_TREE, getAlgorithmTopics()));
        algorithmSelectedNode = topic.id;
        $("#algorithm-topic-dialog").close();
        renderAlgorithmNotes();
        algorithmController?.selectNode?.(topic.id);
        toast(topic.kind === "directory" ? "目录已添加，可继续添加子项或上传笔记" : "算法已添加，可继续上传笔记");
      } catch (error) {
        $("#algorithm-topic-error").textContent = errorMessage(error);
        $("#algorithm-topic-error").hidden = false;
      } finally {
        setBusy(false);
      }
    });
    function isMineNote(note) {
      return accountId() !== null && String(note.authorId || "") === accountId();
    }
    function openAlgorithmNoteDetail(note, { gateId } = {}) {
      const holder = element5("div", "alg-browser"), pane = element5("div", "alg-pane");
      holder.hidden = true;
      const article = element5("article", "alg-reading"), title = element5("h2", "alg-reading-title", note.title || "未命名笔记");
      const meta = element5("div", "alg-note-meta");
      if (note.featured) meta.append(element5("span", "alg-featured", "精选"));
      append(meta, element5("span", "alg-note-author", authorName(note.author)), element5("span", "", date(note.updatedAt)));
      const body = element5("div", "markdown-body alg-markdown");
      renderMarkdown(body, note.body);
      append(article, title, meta, tags(note), body);
      pane.append(article);
      holder.append(pane);
      $("#algorithm-panel").append(holder);
      const path = [];
      const stage = global2.QMX_ALGORITHM_LEARNING_PATH?.stages.find((item) => item.gates.some((gate2) => gateId ? gate2.id === gateId : gate2.topicIds.includes(note.nodeId)));
      const gate = stage?.gates.find((item) => gateId ? item.id === gateId : item.topicIds.includes(note.nodeId));
      path.push({ label: "学习路线", onClick() {
        getReadingDetail().closeAll();
      } });
      if (stage) path.push({ label: `第${stage.index}章 ${stage.title}`, onClick() {
        getReadingDetail().closeAll();
        if (gate) learningController?.selectGate(gate.id);
      } });
      if (gate) path.push({ label: gate.title, onClick() {
        noteDetail?.close();
      } });
      path.push({ label: note.title || "未命名笔记" });
      const noteDetail = getReadingDetail().open({ content: pane, title: "算法笔记详情", path, onClose() {
        holder.remove();
      } });
    }
    function openAlgorithmNoteEditor() {
      if (!getAccount() || !getPermissions().push) {
        toast("请先登录具有仓库写入权限的 GitHub 账户");
        return;
      }
      const form = $("#algorithm-note-form");
      form.reset();
      const node3 = form.elements.nodeId;
      node3.replaceChildren(...algorithmNodes().filter(isAlgorithmLeaf).map((n) => {
        const o = element5("option", "", n.label);
        o.value = n.id;
        return o;
      }));
      const selectedLeaf = resolveAlgorithmLeaf(getAlgorithmTree(), algorithmSelectedNode);
      if (selectedLeaf) node3.value = selectedLeaf.id;
      form.elements.noteScope.value = getPermissions().admin ? "public" : "personal";
      form.elements.noteScope.disabled = !getPermissions().admin;
      $("#algorithm-note-error").hidden = true;
      $("#algorithm-note-dialog").showModal();
    }
    $("#algorithm-note-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (getBusy()) return;
      const data = Object.fromEntries(new FormData(form));
      const note = { title: data.noteTitle, noteScope: getPermissions().admin ? form.elements.noteScope.value : "personal", nodeId: data.nodeId, tags: String(data.noteTags || "").split(/[,，、]/).map((x) => x.trim()).filter(Boolean), body: data.body, featured: data.featured === "on", clientId: uuid(), repo: repo() };
      setBusy(true);
      try {
        const result = await call("saveAlgorithmNote", note);
        setAlgorithmNotes([...getAlgorithmNotes().filter((x) => x.path !== result.path), result]);
        $("#algorithm-note-dialog").close();
        render6();
        toast("算法笔记已保存");
      } catch (error) {
        $("#algorithm-note-error").textContent = errorMessage(error);
        $("#algorithm-note-error").hidden = false;
      } finally {
        setBusy(false);
      }
    });
    function setSelectedNode(id) {
      algorithmSelectedNode = id;
    }
    function resetRepository() {
      setAlgorithmNotes([]);
      options.setLearningGateContents([]);
      options.setLearningCurriculum(null);
      options.setAlgorithmNodeContents([]);
      setAlgorithmTopics([]);
      setAlgorithmTree(AlgorithmDirectory.hydrate(global2.QMX_ALGORITHM_TREE, []));
    }
    return { get algorithmSelectedNode() {
      return algorithmSelectedNode;
    }, get algorithmMode() {
      return algorithmMode;
    }, get algorithmPendingTopic() {
      return algorithmPendingTopic;
    }, get learningController() {
      return learningController;
    }, get algorithmTopicRequest() {
      return algorithmTopicRequest;
    }, setSelectedNode, algorithmNodes, learningProgressKey, setAlgorithmMode, openLearningTopic, saveLearningProgress, renderAlgorithmNotes, updateAlgorithmTopicKind, openAlgorithmTopicEditor, isMineNote, openAlgorithmNoteDetail, openAlgorithmNoteEditor, resetRepository };
  }

  // src/renderer/app/app.ts
  (() => {
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    const bridge3 = window.notebook;
    const demo = !bridge3;
    const webPreview = demo && ["http:", "https:"].includes(location.protocol);
    const STORAGE = "acm-notebook.demo.v1";
    const THEME_STORAGE = "acm-notebook.theme";
    const PALETTE_STORAGE = "acm-notebook.palette";
    const SIDEBAR_STORAGE = "acm-notebook.sidebar";
    const stateLabels = { unreviewed: "待复习", reviewing: "复习中", mastered: "已掌握" };
    const views = {
      home: ["主页", "从这里开始，继续积累今天的理解。", "WELCOME TO YOUR LEARNING SPACE"],
      tricks: ["tricks", "把灵光一现，留给下一次解题。", "SMALL IDEAS, NEW POSSIBILITIES"],
      algorithms: ["算法笔记", "整理知识，连接思路。", "BUILD YOUR KNOWLEDGE"],
      public: ["公共题库", "在他人的思路里，找到自己的突破口。", "A LITTLE BETTER, EVERY DAY"],
      favorites: ["个人收藏", "再想一遍，让解题思路真正成为自己的。", "REVISIT. UNDERSTAND. REMEMBER."]
    };
    const examples = [
      { id: "demo-issue-1", number: 101, kind: "issue", title: "D. 数对计数：从枚举到贡献法", pid: "CF1900D", platform: "Codeforces", rating: 1900, tags: ["数论", "贡献法", "枚举优化"], author: "林间的二分树", body: "## 错因分析\n直接枚举三个位置会退化到 O(n³)。我一直试图优化判断过程，却没有先调整统计的顺序。\n\n## 关键观察\n排序后，固定中间位置，把左侧数字按因子归类。统计一个数对的贡献，比逐个寻找合法三元组更容易。\n\n> 先问「谁在产生贡献」，再问「如何更快地枚举」。\n\n## 复盘笔记\n1. 先用小数据写暴力，确认统计对象。\n2. 把 gcd 条件拆解为因子计数。\n3. 注意重复元素与 64 位整数溢出。\n\n```cpp\nlong long answer = 0;\n// 先计算贡献，再更新计数，避免重复统计。\n```\n\n*此内容为界面演示示例，并非该题的正式题解。*", url: "https://codeforces.com/problemset/problem/1900/D", updatedAt: "2026-10-29T10:20:00Z", comments: 0, state: "open" },
      { id: "demo-document-2", number: 102, kind: "document", title: "二分答案里的「最后一个正确」", pid: "P1873", platform: "洛谷", difficulty: "普及−", tags: ["二分", "边界处理"], author: "不再 RE", body: "## 错因分析\n循环可以结束，不代表返回的位置正确。左闭右闭和左闭右开混用，让答案偏移了一个位置。\n\n## 解题 Trick\n先画出可行性序列：真、真、真、假、假。题目要找的是最后一个真。\n\n每次更新前，确认不变量仍然成立；最后用只有一个元素、全部可行和全部不可行三个边界检查。\n\n*此内容为演示正式题解样式，非真实题解。*", url: "https://www.luogu.com.cn/problem/P1873", updatedAt: "2026-10-27T08:00:00Z", comments: 0, state: "open" },
      { id: "demo-local-3", kind: "local", title: "B. 边界条件：贪心之前先看约束", pid: "CF1791B", platform: "Codeforces", rating: 800, tags: ["贪心", "边界处理"], author: "我", body: "## 错因分析\n忽略了起点和终点之间的边界条件，在动手写贪心前没有先用最小规模数据模拟。\n\n## 下一次要记住\n先确认约束，再检查每一步是否保持可行。空路径、单步路径和提前到达终点都值得单独测试。\n\n这是只存在当前设备的演示错题。Rating 仅为展示数据，并非平台核验结果。收藏和复习状态都可以试着调整。", url: "https://codeforces.com/problemset/problem/1791/B", updatedAt: "2026-10-25T09:00:00Z", comments: 0, state: "open" }
    ];
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(STORAGE) || "null");
    } catch (_) {
    }
    const s = { view: "home", libraryScope: "public", records: [], algorithmNotes: [], algorithmTree: window.QMX_ALGORITHM_TREE || { id: "root", label: "XCPC算法", children: [] }, local: { records: [], favorites: [], mastery: {}, draft: {} }, settings: {}, account: null, authStatus: { status: "anonymous" }, permissions: {}, issues: [], editor: null, lastSync: null, error: "", selected: null, comments: /* @__PURE__ */ new Map(), loading: true, busy: false, tagCatalog: window.QMX_TAG_PRESETS || { version: "local", source: "local", categories: [] }, tagReview: null };
    s.appVersion = "";
    s.update = null;
    Platforms?.init({ bridge: bridge3, onSettings: () => $("#settings-button").click() });
    s.planner = { problems: [], tasks: [], layout: "balanced" };
    Planner?.init({ bridge: bridge3 ? createNotebookIPC(bridge3) : bridge3, onChange: (value) => {
      s.planner = value;
    } });
    let toastTimer;
    let draftTimer;
    function element5(tag, className, text3) {
      const node3 = document.createElement(tag);
      if (className) node3.className = className;
      if (text3 !== void 0) node3.textContent = String(text3);
      return node3;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button8(label, className, action2) {
      const node3 = element5("button", className, label);
      node3.type = "button";
      node3.addEventListener("click", action2);
      return node3;
    }
    function toast(message) {
      $("#toast").textContent = message;
      $("#toast").hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        $("#toast").hidden = true;
      }, 3400);
    }
    function errorMessage(error) {
      const message = typeof error === "string" ? error : error?.message || "操作未完成，请稍后重试";
      return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "");
    }
    function key(record) {
      const id = String(record.id ?? record.number ?? `${record.platform}:${record.pid}:${record.url}`);
      return record.kind !== "local" && record.sourceKey && record.sourceKey !== "https://api.github.com|qmx-acm-data/2026" ? `${record.sourceKey}:${id}` : id;
    }
    function uuid() {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : r & 3 | 8;
        return v.toString(16);
      });
    }
    function accountId() {
      return s.account?.id == null ? null : String(s.account.id);
    }
    function repo() {
      return s.permissions.repo || s.settings.repo || "";
    }
    function repoSource(repoPath = repo(), serverUrl = s.settings.serverUrl) {
      let server = String(serverUrl || "").replace(/\/+$/, "").replace(/\/api\/v1$/, "");
      if (!server || ["https://github.com", "https://api.github.com"].includes(server)) server = "https://api.github.com";
      return `${server}|${String(repoPath).toLowerCase()}`;
    }
    function sameRepo(record) {
      return !!record.repo && String(record.repo).toLowerCase() === String(repo()).toLowerCase() && (record.sourceKey ? record.sourceKey === repoSource() : repoSource(record.repo, record.serverUrl) === repoSource());
    }
    const normalizeLocal = createNormalizer(uuid);
    function visibleLocal(record) {
      return record.ownerId == null || accountId() !== null && String(record.ownerId) === accountId();
    }
    function records() {
      return [...s.records.filter((record) => record.kind === "document" && sameRepo(record)), ...s.issues.filter((record) => record.kind === "issue" && sameRepo(record)), ...s.local.records.filter((record) => record.kind === "local" && visibleLocal(record))];
    }
    function isLocal(record) {
      return record.kind === "local";
    }
    function isMine(record) {
      return isLocal(record) ? visibleLocal(record) : record.kind === "document" && accountId() !== null && String(record.authorId) === accountId();
    }
    function isOwnSolution(record) {
      if (isLocal(record)) return visibleLocal(record);
      return record.kind === "document" && sameRepo(record) && repoSource().startsWith("https://api.github.com|") && isMine(record);
    }
    function canEditRemote(record) {
      return record?.kind === "document" && isMine(record) && sameRepo(record) && s.permissions.push === true;
    }
    function favorite(record) {
      return reader.favorite(record);
    }
    function mastery(record) {
      return reader.mastery(record);
    }
    function tags(record) {
      return reader.tags(record);
    }
    function authorName(author) {
      return typeof author === "string" ? author : author?.name || author?.login || "匿名学习者";
    }
    function date(value) {
      const time2 = new Date(value);
      return Number.isNaN(time2.getTime()) ? "尚未同步" : time2.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    }
    function writeDemo() {
      if (!demo) return;
      try {
        localStorage.setItem(STORAGE, JSON.stringify({ local: s.local, settings: s.settings }));
      } catch (_) {
        toast("浏览器存储不可用，本次修改仅在当前页面保留");
      }
    }
    async function call(name, ...args) {
      if (typeof bridge3?.[name] !== "function") throw new Error(`客户端尚未提供 ${name} 接口`);
      const target = ["openExternal", "openAuthUrl", "formatCode", "cancelLogin", "exportLocal", "bootstrap", "updateLocal"].includes(name) ? createNotebookIPC(bridge3) : bridge3;
      const response = await target[name](...args);
      if (response?.error && !["bootstrap", "sync"].includes(name)) throw new Error(errorMessage(response.error));
      return response;
    }
    let localWrite = Promise.resolve();
    async function persistLocal() {
      if (demo) {
        writeDemo();
        return;
      }
      const snapshot2 = structuredClone(s.local);
      const write = localWrite.catch(() => {
      }).then(() => call("updateLocal", snapshot2));
      localWrite = write;
      await write;
    }
    function applyPayload(payload) {
      if (!payload || typeof payload !== "object") throw new Error("客户端未返回有效数据");
      if (payload.tagCatalog && Array.isArray(payload.tagCatalog.categories)) {
        s.tagCatalog = payload.tagCatalog;
        s.catalogFromPayload = true;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "contests")) acceptContests(payload.contests);
      if (payload.authStatus) s.authStatus = payload.authStatus;
      Platforms?.render(payload.platforms || {});
      if (payload.planner) s.planner = payload.planner;
      Planner?.render(s.planner);
      if (typeof payload.appVersion === "string") s.appVersion = payload.appVersion;
      if (payload.update && typeof payload.update === "object") s.update = { ...payload.update };
      if (payload.updateCapability) s.updateCapability = payload.updateCapability;
      updates.renderUpdate();
      s.records = (Array.isArray(payload.records) ? payload.records : []).filter((record) => record.kind === "document");
      s.algorithmNotes = (Array.isArray(payload.algorithmNotes) ? payload.algorithmNotes : []).filter((record) => record.kind === "algorithm-note");
      s.algorithmTopics = Array.isArray(payload.algorithmTopics) ? payload.algorithmTopics : [];
      s.algorithmNodeContents = Array.isArray(payload.algorithmNodeContents) ? payload.algorithmNodeContents : [];
      s.learningGateContents = Array.isArray(payload.learningGateContents) ? payload.learningGateContents : [];
      s.learningCurriculum = payload.learningCurriculum || null;
      s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, s.algorithmTopics);
      s.issues = (Array.isArray(payload.issues) ? payload.issues : []).filter((record) => record.kind === "issue");
      s.permissions = payload.permissions || {};
      s.settings = payload.settings && typeof payload.settings === "object" ? payload.settings : {};
      s.local = normalizeLocal(payload.local);
      s.account = payload.account || null;
      s.lastSync = payload.lastSync || null;
      s.error = payload.error ? errorMessage(payload.error) : "";
      applyAppearance(s.settings);
      applyCodeSettings();
      renderRepoSelector();
    }
    function quotaBlocked() {
      return !demo && (!s.account || ["anonymous", "expired", "recovery-required"].includes(s.authStatus?.status)) && /额度已用完|rate limit/i.test(s.error || "");
    }
    function reauthNeeded() {
      return !demo && (["expired", "recovery-required"].includes(s.authStatus?.status) || /登录已失效|重新授权|请重新登录/i.test(s.error || ""));
    }
    function readSidebar() {
      try {
        return localStorage.getItem(SIDEBAR_STORAGE) === "pinned";
      } catch (_) {
        return false;
      }
    }
    let sidebarPinned = readSidebar(), sidebarHovered = false, sidebarFocused = false;
    let sidebarOpenTimer;
    function clearSidebarTimers() {
      clearTimeout(sidebarOpenTimer);
    }
    function updateSidebar() {
      const expanded2 = sidebarPinned || sidebarHovered || sidebarFocused;
      $(".sidebar-drawer").inert = !expanded2;
      $(".sidebar-rail").inert = false;
      document.body.classList.toggle("sidebar-pinned", sidebarPinned);
      document.body.classList.toggle("sidebar-open", expanded2);
      const toggle = $("#sidebar-toggle");
      toggle.title = sidebarPinned ? "取消固定，恢复悬浮展开" : "固定展开导航栏";
      toggle.setAttribute("aria-label", toggle.title);
      toggle.setAttribute("aria-pressed", String(sidebarPinned));
      toggle.setAttribute("aria-expanded", String(expanded2));
      const railToggle = $("#sidebar-rail-toggle");
      if (railToggle) {
        railToggle.title = toggle.title;
        railToggle.setAttribute("aria-label", toggle.title);
        railToggle.setAttribute("aria-pressed", String(sidebarPinned));
      }
    }
    function applySidebar(pinned) {
      clearSidebarTimers();
      sidebarPinned = !!pinned;
      updateSidebar();
      try {
        localStorage.setItem(SIDEBAR_STORAGE, sidebarPinned ? "pinned" : "auto");
      } catch (_) {
      }
    }
    function updateStatus() {
      $("#demo-label").hidden = !demo;
      $("#sync-status").textContent = s.loading ? "正在载入…" : demo ? "浏览器预览 · 本地保存" : s.lastSync ? `最近同步 ${date(s.lastSync)}` : "尚未同步";
      const offline = !navigator.onLine;
      const banner = $("#status-banner");
      banner.replaceChildren();
      if (offline || s.error || reauthNeeded()) {
        banner.append(document.createTextNode(offline ? "当前处于离线状态。你仍可浏览已载入的题目、整理收藏和保存本地草稿，联网后可再次同步。" : s.error ? `连接提示：${s.error}。可稍后点击「同步」重试。` : "GitHub 授权需要恢复。"));
        const reauth = reauthNeeded();
        const quota = quotaBlocked();
        if (!demo && !offline && (reauth || quota)) {
          banner.append(document.createTextNode(reauth ? " 请重新登录 GitHub 以恢复同步。" : " 登录 GitHub 后，同步额度可由每小时 60 次提升至 5000 次。"));
          const login = button8(reauth ? "重新登录 GitHub" : "使用 GitHub 登录", "button secondary", startLoginFromBanner);
          login.id = "banner-login-button";
          login.disabled = s.busy;
          banner.append(login);
        }
        banner.hidden = false;
      } else banner.hidden = true;
      const account = s.account;
      $("#account-name").textContent = account?.name || account?.login || account?.username || s.settings.displayName || "本地学习者";
      $("#account-caption").textContent = s.authStatus?.status === "expired" ? "授权已过期 · 请重新登录" : s.authStatus?.status === "recovery-required" ? "凭证恢复失败 · 请重新授权" : s.authStatus?.status === "unverified" ? "账户尚未验证 · 请联网刷新" : account ? "账户已连接" : demo ? "演示模式 · 数据仅在本机" : quotaBlocked() ? "未登录 · 点此登录提升额度" : "未登录 · 可使用本地错题";
      for (const avatar of $$(".account-avatar")) {
        avatar.replaceChildren();
        if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(account?.avatarData || "")) {
          const image = element5("img");
          image.src = account.avatarData;
          image.alt = "";
          avatar.append(image);
        } else avatar.textContent = String($("#account-name").textContent).slice(0, 1);
      }
      const accountButton = $("#account-button");
      accountButton.title = account ? "GitHub 账户" : "登录 GitHub 账户";
      if (account) accountButton.removeAttribute("aria-label");
      else accountButton.setAttribute("aria-label", accountButton.title);
    }
    const filters = createFilters({ getRecords: records, getView: () => s.view, getScope: () => s.libraryScope, getTagCatalog: () => s.tagCatalog, getBusy: () => s.busy, favorite, mastery, isLocal, isOwnSolution, recordAuthorName: (record) => recordAuthorName(record, s.account), render: render6 });
    const { facets, facetNames, platformNames, luoguLevels: luoguLevels3, luoguTones, facetValue, fillFacetOptions, refreshFilters, tagGroups, fillTagOptions, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, colorRatingInput, colorLuoguSelection } = filters;
    async function openTagDialog() {
      const select = $("#request-tag-category");
      select.replaceChildren();
      (s.tagCatalog?.categories || []).forEach((c) => {
        const option2 = element5("option", "", c.name);
        option2.value = c.id;
        select.append(option2);
      });
      $("#tag-review-section").hidden = true;
      $("#tag-review-dialog").showModal();
      if (demo || typeof bridge3?.getTagReview !== "function") return;
      try {
        const result = await call("getTagReview");
        s.tagReview = result;
        if (!result?.canReview) return;
        $("#tag-review-section").hidden = false;
        const list = $("#tag-review-list");
        list.replaceChildren();
        (result.requests || []).forEach((request) => {
          const row2 = element5("article", "tag-request-row");
          append(row2, element5("strong", "", `${request.category} / ${request.name}`), element5("p", "facet-help", `#${request.number} · ${authorName(request.author)} · ${request.state || "open"}`));
          if (request.url) row2.append(button8("查看申请 ↗", "button subtle", () => openExternal(request.url)));
          ["approve", "reject"].forEach((decision) => row2.append(button8(decision === "approve" ? "批准" : "拒绝", "button secondary", async () => {
            if (s.busy || !s.tagReview?.canReview || demo) return;
            setBusy(true);
            try {
              await call("reviewTag", { number: request.number, decision, expected: request.expected || { category: request.category, name: request.name } });
              if (typeof bridge3.getTagCatalog === "function") {
                const catalog = await call("getTagCatalog");
                if (Array.isArray(catalog?.categories)) s.tagCatalog = catalog;
              }
              $("#tag-review-dialog").close();
              refreshFilters();
              if ($("#submit-dialog").open) renderEditorTags();
              toast("标签申请已处理");
            } catch (error) {
              toast(errorMessage(error));
            } finally {
              setBusy(false);
            }
          })));
          list.append(row2);
        });
        if (!list.children.length) list.append(element5("p", "facet-help", "暂无待审核申请"));
      } catch (error) {
        toast(errorMessage(error));
      }
    }
    function platformCode(value) {
      return Search.normalizePlatform(value);
    }
    const reader = createLibraryReader({ demo, stateLabels, getLocal: () => s.local, setLocal: (value) => {
      s.local = value;
    }, getAccount: () => s.account, getPermissions: () => s.permissions, getView: () => s.view, getLibraryScope: () => s.libraryScope, getSelected: () => s.selected, setSelected: (value) => {
      s.selected = value;
    }, getComments: () => s.comments, getBusy: () => s.busy, setBusy, getLoading: () => s.loading, getError: () => s.error, getRecords: records, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName, date, quotaBlocked, renderMarkdown, persistLocal, call, render: render6, clearFilters, openSubmit: (record) => editor2.openSubmit(record), openLocalSolution: (record) => editor2.openLocalSolution(record), deleteRecord: (record) => editor2.deleteRecord(record), deleteDiscussion: (record) => editor2.deleteDiscussion(record), openExternal, toast, errorMessage });
    const { openDetail, closeDetail, renderDetail, loadComments, changeLocal } = reader;
    function navigate(view) {
      if (!views[view]) return;
      reader.resetDetail();
      s.view = view;
      clearFilters();
      if (view === "home") refreshVisibleContests();
    }
    const contests = HomeContests.create({ demo, getSettings: () => s.settings, setSettings: (value) => {
      s.settings = value;
    }, getView: () => s.view, getLoading: () => s.loading, canRefresh: () => typeof bridge3?.getContests === "function", call, writeDemo, toast, errorMessage, openExternal });
    const { acceptContests, renderHomeContests, updateContestStatus, renderContestCards, refreshVisibleContests, refreshContests } = contests;
    function renderHome() {
      const panel = $("#home-panel");
      const overview = $("#platform-overview");
      overview.remove();
      panel.replaceChildren();
      const toolbar = element5("div", "home-toolbar");
      const intro = element5("div", "home-intro");
      append(intro, element5("span", "home-date", (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })), element5("h2", "", "今天，继续向前。"));
      append(toolbar, intro);
      const board = element5("div", "home-board");
      const planner = element5("section", "home-planner");
      planner.id = "home-planner";
      planner.setAttribute("aria-label", "题单与学习任务");
      append(board, planner);
      board.append(DailyProblem.create({
        draw: async (drawFilters) => {
          if (!window.notebook?.dailyDraw) throw new Error("每日一题接口尚未接入，请在桌面端启用每日一题。");
          return window.notebook.dailyDraw(drawFilters);
        },
        openExternal,
        chooseTags: (selected2, onApply) => filters.openTagPicker("daily", { selected: selected2, onApply }),
        updateLibrary: window.notebook?.updateLibrary ? () => window.notebook.updateLibrary() : void 0,
        autoDraw: true
      }));
      append(board, renderHomeContests(), overview);
      append(panel, toolbar, board);
      Planner?.render(s.planner);
      updateContestStatus();
      renderContestCards();
    }
    function render6() {
      updateStateFacet();
      document.body.dataset.view = s.view;
      const [title, description, eyebrow] = views[s.view];
      $("#page-title").replaceChildren(document.createTextNode(title), element5("span", "heading-dot", "."));
      $("#breadcrumb-view").textContent = title;
      $("#page-description").textContent = description;
      $("#page-eyebrow").textContent = eyebrow;
      $$(".nav-item,.rail-nav-item").forEach((node3) => {
        node3.classList.toggle("active", node3.dataset.view === s.view);
        if (node3.dataset.view === s.view) node3.setAttribute("aria-current", "page");
        else node3.removeAttribute("aria-current");
      });
      const all = records();
      $("#count-public").textContent = all.filter((record) => record.kind === "document").length;
      $("#count-favorites").textContent = all.filter(favorite).length;
      $("#home-panel").hidden = s.view !== "home";
      $("#platform-overview").hidden = s.view !== "home";
      $("#algorithm-panel").hidden = s.view !== "algorithms";
      const placeholder = ["tricks"].includes(s.view);
      $("#section-placeholder").hidden = !placeholder;
      $("#library-panel").hidden = s.view === "home" || placeholder || s.view === "algorithms";
      updateStatus();
      if (s.view === "home") {
        renderHome();
        return;
      }
      if (s.view === "algorithms") {
        renderAlgorithmNotes();
        return;
      }
      if (reader.renderFocusedDetail()) return;
      $("#library-scope-controls").hidden = s.view !== "public";
      $("#library-public-button").setAttribute("aria-pressed", String(s.libraryScope !== "local"));
      $("#library-local-button").setAttribute("aria-pressed", String(s.libraryScope === "local"));
      $("#library-local-count").textContent = all.filter(isOwnSolution).length;
      const items = filteredRecords();
      $("#result-count").textContent = items.length;
      $(".list-heading > span:last-child").textContent = facets.tags.size ? "标签命中数 ↓ · 相关度 / 更新时间" : $("#search-input").value.trim() ? "匹配程度 ↓" : "最近更新 ↓";
      reader.renderLibrary(items);
    }
    const { highlightCodeBlock, decorateCodeBlocks, codeBlockClick } = CodeBlocks.create({ toast, errorMessage });
    const algorithms = createAlgorithmWorkspace({ getAlgorithmNotes: () => s.algorithmNotes, setAlgorithmNotes: (value) => {
      s.algorithmNotes = value;
    }, getAlgorithmNodeContents: () => s.algorithmNodeContents || [], setAlgorithmNodeContents: (value) => {
      s.algorithmNodeContents = value;
    }, saveAlgorithmNodeContent: (input2) => {
      if (!bridge3) throw new Error("请在桌面客户端登录管理员账户后编辑简介与精选");
      return bridge3.saveAlgorithmNodeContent(input2);
    }, getLearningCurriculum: () => s.learningCurriculum || null, setLearningCurriculum: (value) => {
      s.learningCurriculum = value;
    }, saveLearningCurriculum: (input2) => {
      if (!bridge3) throw new Error("请在桌面客户端登录管理员账户后编排课程");
      return bridge3.saveLearningCurriculum(input2);
    }, getLearningGateContents: () => s.learningGateContents || [], setLearningGateContents: (value) => {
      s.learningGateContents = value;
    }, saveLearningGate: (input2) => {
      if (!bridge3) throw new Error("请在桌面客户端登录管理员账户后修改公共关卡");
      return bridge3.saveLearningGate(input2);
    }, getAlgorithmTopics: () => s.algorithmTopics, setAlgorithmTopics: (value) => {
      s.algorithmTopics = value;
    }, getAlgorithmTree: () => s.algorithmTree, setAlgorithmTree: (value) => {
      s.algorithmTree = value;
    }, getAccount: () => s.account, getPermissions: () => s.permissions, getLocal: () => s.local, getBusy: () => s.busy, getReadingDetail: () => ReadingDetail, accountId, repo, repoSource, uuid, setBusy, persistLocal, call, openExternal, render: render6, renderMarkdown, authorName, date, tags, toast, errorMessage });
    const { renderAlgorithmNotes } = algorithms;
    function renderMarkdown(container, body) {
      const source = String(body || "还没有题解内容。可以从记录错因开始。");
      if (window.marked && window.DOMPurify) {
        try {
          const parse2 = typeof window.marked.parse === "function" ? window.marked.parse.bind(window.marked) : window.marked;
          const html = MarkdownMath ? MarkdownMath.parse(source, window.marked) : parse2(source);
          if (MarkdownColor) container.replaceChildren(MarkdownColor.sanitize(html, window.DOMPurify, container.ownerDocument));
          else container.innerHTML = window.DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "iframe", "form", "input", "button"], FORBID_ATTR: ["style", "color"] });
          MarkdownMath?.render(container, window.katex);
          $$("pre code", container).forEach((code) => {
            if (code.parentElement && (settingsUI.settingsPreview || s.settings).codeLineNumbers) code.parentElement.classList.add("line-numbers");
            highlightCodeBlock(code);
          });
          decorateCodeBlocks(container);
          container.classList.add("rendered");
          $$("a", container).forEach((link) => link.addEventListener("click", (event) => {
            event.preventDefault();
            const href = link.getAttribute("href");
            if (href?.startsWith("#")) {
              let id;
              try {
                id = decodeURIComponent(href.slice(1));
              } catch (_) {
                return;
              }
              const target = Array.from(container.querySelectorAll("[id],a[name]")).find((node3) => node3.id === id || node3.getAttribute("name") === id);
              (target || (href === "#" ? container : null))?.scrollIntoView({ block: "start" });
              return;
            }
            openExternal(href);
          }));
          return;
        } catch (_) {
        }
      }
      container.textContent = source;
    }
    async function openExternal(url) {
      try {
        const parsed = new URL(String(url));
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("仅支持 http 或 https 题目链接");
        if (demo) window.open(parsed.href, "_blank", "noopener,noreferrer");
        else await call("openExternal", parsed.href);
      } catch (error) {
        toast(errorMessage(error));
      }
    }
    let updateLockedControls = null;
    function setBusy(value) {
      if (!value && updateLockedControls) {
        updateLockedControls.forEach(([node3, disabled]) => {
          node3.disabled = disabled;
        });
        updateLockedControls = null;
      }
      s.busy = value;
      ["sync-button", "account-button", "settings-button", "theme-select", "palette-select", "submit-button", "save-local-button", "publish-button", "account-login", "account-logout", "account-switch", "account-refresh", "banner-login-button"].forEach((id) => {
        const node3 = document.getElementById(id);
        if (node3) node3.disabled = value;
      });
      $$("[data-close], #settings-form input, #settings-form select, #settings-form button").forEach((node3) => {
        node3.disabled = value;
      });
      $$("#submit-form input, #submit-form textarea").forEach((node3) => {
        node3.readOnly = value;
      });
      $$("#submit-form select, #editor-difficulty-picker select, #editor-difficulty-picker button").forEach((node3) => {
        node3.disabled = value;
      });
      if (!value && s.editor?.record?.kind === "document") $("#save-local-button").disabled = true;
      if (value && updates.updateRunning) {
        const controls = $$("button, input, select, textarea");
        if (!updateLockedControls) updateLockedControls = controls.map((node3) => [node3, node3.disabled]);
        controls.forEach((node3) => {
          node3.disabled = true;
        });
      }
      $("#check-update-button").disabled = value;
      if (!value) queueMicrotask(updates.showStartupUpdate);
    }
    const editor2 = createEditor({ demo, getEditor: () => s.editor, setEditor: (value) => {
      s.editor = value;
    }, getLocal: () => s.local, setLocal: (value) => {
      s.local = value;
    }, getRecords: () => s.records, setRecords: (value) => {
      s.records = value;
    }, getIssues: () => s.issues, setIssues: (value) => {
      s.issues = value;
    }, getComments: () => s.comments, getSelected: () => s.selected, setSelected: (value) => {
      s.selected = value;
    }, getBusy: () => s.busy, setBusy, getAccount: () => s.account, getPermissions: () => s.permissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave: () => clearTimeout(draftTimer), persistLocal, call, refreshFilters, navigate, render: render6, openDetail, toast, errorMessage });
    const { formDraft, fillForm, renderEditorDifficulty, setEditorPlatform, draftKey, editorError, openLocalSolution, openSubmit, saveDraft, saveRecord, deleteDiscussion, deleteRecord } = editor2;
    async function sync() {
      if (s.busy || $("#submit-dialog").open) {
        toast("请先完成或关闭当前编辑");
        return;
      }
      setBusy(true);
      try {
        if (demo && !webPreview) {
          toast("演示模式：本地记录已保留，未连接公共题库");
          return;
        }
        if (demo) {
          const activeRepo = (s.settings.repositories || []).find((r) => r.id === s.settings.activeRepoId) || (s.settings.repositories || [])[0] || { repo: "qmx-acm-data/2026", serverUrl: "" };
          const currentRepo = activeRepo.repo || s.settings?.repo || "qmx-acm-data/2026";
          const currentServer = activeRepo.serverUrl !== void 0 ? activeRepo.serverUrl : s.settings?.serverUrl || "";
          s.settings.repo = currentRepo;
          s.permissions.repo = currentRepo;
          try {
            const res = await fetch(`/api/sync?repo=${encodeURIComponent(currentRepo)}&serverUrl=${encodeURIComponent(currentServer)}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.records)) {
                s.records = data.records.map((r) => ({ ...r, repo: currentRepo, serverUrl: currentServer, sourceKey: repoSource(currentRepo, currentServer) }));
                s.issues = (Array.isArray(data.issues) ? data.issues : []).map((r) => ({ ...r, repo: currentRepo, serverUrl: currentServer, sourceKey: repoSource(currentRepo, currentServer) }));
                s.algorithmNotes = Array.isArray(data.algorithmNotes) ? data.algorithmNotes : [];
                s.algorithmTopics = Array.isArray(data.algorithmTopics) ? data.algorithmTopics : [];
                s.algorithmNodeContents = Array.isArray(data.algorithmNodeContents) ? data.algorithmNodeContents : [];
                s.learningGateContents = Array.isArray(data.learningGateContents) ? data.learningGateContents : [];
                s.learningCurriculum = data.learningCurriculum || null;
                s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, s.algorithmTopics);
                s.lastSync = (/* @__PURE__ */ new Date()).toISOString();
                s.comments.clear();
                refreshFilters();
                render6();
                toast(`已从 ${currentRepo} 同步 ${s.records.length} 道题解`);
                return;
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              toast(`同步失败：${errData.error || res.statusText}`);
              return;
            }
          } catch (fetchErr) {
            toast(`网络请求失败：${errorMessage(fetchErr)}`);
            return;
          }
          toast("演示模式：本地记录已保留，未连接公共题库");
          return;
        }
        if (!navigator.onLine) throw new Error("当前离线，请连接网络后重试");
        applyPayload(await call("sync"));
        s.comments.clear();
        refreshFilters();
        render6();
        toast("学习空间已同步");
      } catch (error) {
        const message = errorMessage(error);
        try {
          applyPayload(await call("bootstrap"));
        } catch (_) {
        }
        s.error = message;
        refreshFilters();
        render6();
        toast(`同步失败：${message}`);
      } finally {
        setBusy(false);
      }
    }
    $$(".nav-item").forEach((node3) => node3.addEventListener("click", (event) => {
      navigate(node3.dataset.view);
      if (event.pointerType === "touch") {
        sidebarHovered = false;
        sidebarFocused = false;
        updateSidebar();
      }
    }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && reader.isFocusedDetail() && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        closeDetail();
      }
    });
    $("#record-tag-open").addEventListener("click", () => openTagPicker("editor"));
    $("#tag-picker-search").addEventListener("input", (event) => {
      if (filters.tagPickerContext) fillTagOptions($("#tag-picker-dialog-options"), filters.tagPickerContext.selected, event.target.value, () => {
      });
    });
    $("#tag-picker-confirm").addEventListener("click", () => closeTagPicker(true));
    $("#tag-picker-cancel").addEventListener("click", () => closeTagPicker(false));
    $("#tag-picker-close").addEventListener("click", () => closeTagPicker(false));
    $("#tag-picker-dialog").addEventListener("cancel", (event) => {
      event.preventDefault();
      closeTagPicker(false);
    });
    $("#request-tag-open").addEventListener("click", openTagDialog);
    const tagEntry = button8("＋ 添加标签", "button subtle", openTagDialog);
    tagEntry.id = "tag-manager-button";
    $(".topbar-actions").insertBefore(tagEntry, $("#sync-button"));
    $("#tag-request-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (s.busy) return;
      const category = $("#request-tag-category").value, name = $("#request-tag-dialog-name").value.trim();
      if (!category || !name) return;
      if (demo) {
        toast("演示模式：未发送标签申请，不会写入外部");
        return;
      }
      setBusy(true);
      try {
        await call("requestTag", { category, name });
        $("#request-tag-dialog-name").value = "";
        $("#tag-review-dialog").close();
        toast("标签申请已提交，审核后加入公共标签");
      } catch (error) {
        toast(errorMessage(error));
      } finally {
        setBusy(false);
      }
    });
    $(".brand").addEventListener("click", (event) => {
      event.preventDefault();
      if (s.busy) return;
      reader.resetDetail();
      s.view = "home";
      clearFilters();
    });
    const stateSelect = $("#state-filter");
    const stateFacet = element5("details", "facet state-facet");
    stateFacet.id = "state-facet";
    const stateSummary = element5("summary");
    const stateLabel = element5("span");
    append(stateSummary, stateLabel, element5("span", "facet-chevron", "⌄"));
    const stateOptions = element5("div", "facet-popover");
    stateOptions.setAttribute("aria-label", "状态筛选");
    [...stateSelect.options].forEach((option2) => {
      const label = element5("label", "facet-option");
      const input2 = element5("input");
      input2.type = "radio";
      input2.name = "state-choice";
      input2.value = option2.value;
      input2.addEventListener("change", () => {
        stateSelect.value = input2.value;
        stateFacet.open = false;
        render6();
      });
      append(label, input2, element5("span", "", option2.textContent));
      stateOptions.append(label);
    });
    append(stateFacet, stateSummary, stateOptions);
    stateSelect.hidden = true;
    stateSelect.after(stateFacet);
    function updateStateFacet() {
      stateLabel.textContent = stateSelect.selectedOptions[0]?.textContent || "全部状态";
      $$("input", stateOptions).forEach((input2) => {
        input2.checked = input2.value === stateSelect.value;
      });
    }
    for (const [id, scope2] of [["library-public-button", "public"], ["library-local-button", "local"]]) $("#" + id).addEventListener("click", () => {
      if (s.busy) return;
      s.libraryScope = scope2;
      s.selected = null;
      reader.resetDetail();
      clearFilters();
    });
    $("#search-input").addEventListener("input", render6);
    $("#state-filter").addEventListener("change", render6);
    $("#clear-filters").addEventListener("click", clearFilters);
    for (const id of ["luogu-min", "luogu-max"]) {
      const select = $("#" + id);
      const option2 = element5("option", "", "不限");
      option2.value = "";
      select.append(option2);
      luoguLevels3.forEach((name, i) => {
        const o = element5("option", `tone-${luoguTones[i]}`, name);
        o.value = String(i + 1);
        select.append(o);
      });
      colorLuoguSelection(select);
      select.addEventListener("input", () => colorLuoguSelection(select));
    }
    $("#difficulty-platform").addEventListener("change", (event) => {
      ["rating-min", "rating-max", "luogu-min", "luogu-max"].forEach((id) => {
        $("#" + id).value = "";
      });
      facets.native.clear();
      setDifficultyPlatform(event.target.value);
      updateFacetCounts();
      render6();
    });
    ["rating-min", "rating-max", "luogu-min", "luogu-max"].forEach((id) => $("#" + id).addEventListener("input", () => {
      updateFacetCounts();
      render6();
    }));
    $$("[data-rating]").forEach((node3) => node3.addEventListener("click", () => {
      const [min, max] = node3.dataset.rating.split(",");
      $("#rating-min").value = min;
      $("#rating-max").value = max;
      updateFacetCounts();
      render6();
    }));
    $("#clear-difficulty").addEventListener("click", () => {
      clearDifficulty();
      render6();
    });
    document.addEventListener("click", (event) => {
      $$(".facet details[open],details.facet[open]").forEach((node3) => {
        if (!node3.contains(event.target)) node3.open = false;
      });
    });
    document.addEventListener("click", codeBlockClick);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") $$(".facet details[open],details.facet[open]").forEach((node3) => node3.open = false);
    });
    $("#submit-button").addEventListener("click", () => openSubmit());
    $("#sync-button").addEventListener("click", sync);
    contests.start();
    $$("dialog").forEach((dialog3) => dialog3.addEventListener("cancel", (event) => {
      if (s.busy) event.preventDefault();
    }));
    $$("[data-close]").forEach((node3) => node3.addEventListener("click", async () => {
      if (s.busy) return;
      if (node3.dataset.close === "submit-dialog") {
        clearTimeout(draftTimer);
        setBusy(true);
        await saveDraft();
        setBusy(false);
      }
      document.getElementById(node3.dataset.close).close();
    }));
    $("#submit-dialog").addEventListener("cancel", async (event) => {
      event.preventDefault();
      if (s.busy) return;
      clearTimeout(draftTimer);
      setBusy(true);
      await saveDraft();
      setBusy(false);
      $("#submit-dialog").close();
    });
    $("#submit-form").addEventListener("input", () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 650);
    });
    $("#submit-form").elements.platform.addEventListener("change", () => {
      const form = $("#submit-form");
      form.elements.rating.value = "";
      form.elements.difficulty.value = "";
      setEditorPlatform(form.elements.platform.value, false);
    });
    $("#save-local-button").addEventListener("click", () => saveRecord(false));
    $("#submit-form").addEventListener("submit", (event) => {
      event.preventDefault();
      saveRecord(true);
    });
    const settingsUI = createSettings({ demo, bridge: bridge3, themeStorage: THEME_STORAGE, paletteStorage: PALETTE_STORAGE, getBusy: () => s.busy, setBusy, getSettings: () => s.settings, setSettings: (value) => {
      s.settings = value;
    }, getAccount: () => s.account, getAuthStatus: () => s.authStatus, getPermissions: () => s.permissions, setPermissionsRepo: (value) => {
      s.permissions.repo = value;
    }, getError: () => s.error, setError: (value) => {
      s.error = value;
    }, getLocal: () => s.local, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData: () => {
      s.records = [];
      s.issues = [];
      s.algorithmNotes = [];
      s.algorithmTopics = [];
      s.algorithmNodeContents = [];
      s.learningGateContents = [];
      s.learningCurriculum = null;
      s.lastSync = null;
      s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, []);
    }, resetSourceView: () => {
      s.comments.clear();
      s.selected = null;
      reader.resetDetail();
    }, clearComments: () => s.comments.clear(), refreshFilters, render: render6, renderUpdate: () => updates.renderUpdate(), updateStatus, sync, writeDemo, toast, errorMessage });
    const { readTheme, readPalette, applyTheme, applyPalette, applyAppearance, applyCodeSettings, renderRepoSelector, renderSettingsRepoList, renderAccount, startLoginFromBanner, accountAction, cancelLogin } = settingsUI;
    $("#sidebar-toggle").addEventListener("click", (event) => {
      const wasPinned = sidebarPinned;
      applySidebar(!wasPinned);
      if (wasPinned) {
        sidebarHovered = false;
        sidebarFocused = false;
        event.currentTarget.blur();
        updateSidebar();
      }
    });
    const sidebar = $(".sidebar");
    const rail = $(".sidebar-rail");
    for (const source of $$(".sidebar-drawer > *")) {
      const copy = source.cloneNode(true);
      for (const node3 of [copy, ...$$("[id]", copy)]) {
        if (node3.id) node3.removeAttribute("id");
      }
      for (const node3 of [copy, ...$$("button,a", copy)]) {
        if (!node3.matches("button,a")) continue;
        if (node3.classList.contains("sidebar-toggle")) {
          node3.id = "sidebar-rail-toggle";
          node3.addEventListener("click", (event) => {
            const wasPinned = sidebarPinned;
            applySidebar(!wasPinned);
            if (wasPinned) {
              sidebarHovered = false;
              sidebarFocused = false;
              event.currentTarget.blur();
              updateSidebar();
            }
          });
        } else if (node3.classList.contains("nav-item")) {
          node3.classList.replace("nav-item", "rail-nav-item");
          node3.addEventListener("click", () => navigate(node3.dataset.view));
        } else if (node3.classList.contains("brand")) {
          node3.classList.replace("brand", "rail-brand");
          node3.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("home");
          });
        } else if (node3.classList.contains("sidebar-bottom")) node3.addEventListener("click", () => $("#account-button").click());
      }
      rail.append(copy);
    }
    rail.querySelector(".sidebar-toggle").replaceWith($("#sidebar-toggle"));
    sidebar.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      clearSidebarTimers();
      sidebarOpenTimer = setTimeout(() => {
        sidebarHovered = true;
        updateSidebar();
      }, 100);
    });
    sidebar.addEventListener("pointerleave", () => {
      clearSidebarTimers();
      sidebarHovered = false;
      sidebarFocused = false;
      updateSidebar();
    });
    sidebar.addEventListener("focusin", (event) => {
      if (!event.target.matches(":focus-visible")) return;
      clearTimeout(sidebarOpenTimer);
      sidebarFocused = true;
      updateSidebar();
    });
    sidebar.addEventListener("focusout", () => {
      queueMicrotask(() => {
        if (!sidebar.contains(document.activeElement)) {
          sidebarFocused = false;
          updateSidebar();
        }
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !sidebarPinned && !document.querySelector("dialog[open]")) {
        clearSidebarTimers();
        sidebarHovered = false;
        sidebarFocused = false;
        if (sidebar.contains(document.activeElement)) document.activeElement.blur();
        updateSidebar();
      }
    });
    const updates = Updates.create({ demo, bridge: bridge3, getAppVersion: () => s.appVersion, getUpdate: () => s.update, setUpdate: (update) => {
      s.update = update;
    }, getUpdateCapability: () => s.updateCapability, getBusy: () => s.busy, setBusy, call, cancelDraftSave: () => clearTimeout(draftTimer), getLocalWrite: () => localWrite, resetLocalWrite: () => {
      localWrite = Promise.resolve();
    }, hasEditor: () => !!s.editor, saveDraft, persistLocal, renderAccount, toast, errorMessage });
    $("#submit-form").elements.url.addEventListener("blur", (event) => {
      try {
        const url = new URL(event.target.value);
        const form = $("#submit-form");
        let match2;
        if (url.hostname.endsWith("codeforces.com") && (match2 = url.pathname.match(/(?:problemset\/problem\/(\d+)\/([A-Za-z0-9]+)|contest\/(\d+)\/problem\/([A-Za-z0-9]+))/))) {
          setEditorPlatform("CF");
          form.elements.pid.value = `CF${match2[1] || match2[3]}${(match2[2] || match2[4]).toUpperCase()}`;
        } else if (url.hostname.endsWith("atcoder.jp") && (match2 = url.pathname.match(/\/tasks\/([^/]+)/))) {
          setEditorPlatform("AT");
          form.elements.pid.value = match2[1];
        } else if (url.hostname.endsWith("luogu.com.cn") && (match2 = url.pathname.match(/\/problem\/([^/]+)/))) {
          setEditorPlatform("LG");
          form.elements.pid.value = match2[1];
        } else if (url.hostname.endsWith("nowcoder.com")) {
          setEditorPlatform("NC");
          if (match2 = url.pathname.match(/\/acm\/problem\/(\d+)/)) form.elements.pid.value = match2[1];
        }
      } catch (_) {
      }
    });
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        if (["home", "tricks", "algorithms"].includes(s.view)) {
          navigate("public");
        }
        $("#search-input").focus();
      }
    });
    async function bootstrap() {
      const initialTheme = readTheme(), initialPalette = readPalette();
      applyTheme(initialTheme);
      applyPalette(initialPalette);
      applySidebar(readSidebar());
      render6();
      if (demo) {
        s.settings = cached?.settings || { theme: initialTheme, palette: initialPalette };
        if (!Array.isArray(s.settings.repositories) || !s.settings.repositories.length) {
          s.settings.repositories = [
            { id: "ctgu-2026", name: "三峡大学 2026 题解库 (校内)", repo: "ctguacm/2026", serverUrl: "http://172.25.5.128:3000" },
            { id: "official", name: "官方题解库 (GitHub)", repo: "qmx-acm-data/2026", serverUrl: "" }
          ];
          s.settings.activeRepoId = "official";
          s.settings.repo = s.settings.repo || "qmx-acm-data/2026";
          s.settings.serverUrl = s.settings.serverUrl || "";
        }
        s.permissions = { repo: s.settings.repo || "qmx-acm-data/2026", push: false, admin: false };
        s.records = examples.filter((record) => record.kind === "document").map((record) => ({ ...record, repo: s.permissions.repo }));
        s.issues = examples.filter((record) => record.kind === "issue").map((record) => ({ ...record, repo: s.permissions.repo }));
        s.local = normalizeLocal(cached?.local || { records: [examples[2]], favorites: [key(examples[1])], mastery: { [key(examples[1])]: "reviewing" }, draft: {} });
        s.local.records = s.local.records.map((record) => record.id === "demo-local-3" && record.pid === "dp_f" && record.rating == null ? { ...examples[2] } : record);
        applyAppearance(s.settings);
        applyCodeSettings();
        renderRepoSelector();
      } else {
        try {
          applyPayload(await call("bootstrap"));
        } catch (error) {
          s.error = errorMessage(error);
        }
      }
      s.loading = false;
      refreshFilters();
      render6();
      renderRepoSelector();
      void refreshContests(false);
      if (!demo && !s.catalogFromPayload && typeof bridge3?.getTagCatalog === "function") {
        try {
          const catalog = await call("getTagCatalog");
          if (Array.isArray(catalog?.categories)) s.tagCatalog = catalog;
        } catch (_) {
        }
      }
      void updates.checkStartupUpdates();
      if (!demo && !s.error && s.settings.autoSync !== false && navigator.onLine) await sync();
      else if (webPreview && s.settings.autoSync !== false && navigator.onLine) void sync();
    }
    bootstrap();
  })();
})();
