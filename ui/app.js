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
  function topicScore(node2, path, query) {
    return score(query, [
      { value: node2.label, weight: 12 },
      { value: node2.fullLabel, weight: 11 },
      ...(node2.aliases || []).map((value) => ({ value, weight: 10 })),
      { value: path.join(" / "), weight: 2 }
    ]);
  }
  function noteScore(note, node2, path, query, author) {
    return score(query, [
      { value: note.title, weight: 12 },
      ...(note.tags || []).map((value) => ({ value, weight: 9 })),
      { value: node2?.label, weight: 8 },
      { value: node2?.fullLabel, weight: 8 },
      ...(node2?.aliases || []).map((value) => ({ value, weight: 7 })),
      { value: author, weight: 5 },
      { value: path.join(" / "), weight: 2 },
      { value: note.body, weight: 1 }
    ]);
  }
  var COLORS = ["basic", "beginner", "intermediate", "advanced", "expert"];
  function splitMixed(tree) {
    function visit(node2) {
      node2.children = Array.isArray(node2.children) ? node2.children : [];
      if (node2.kind === "algorithm" && node2.children.length) {
        const content = { ...node2, id: `algorithm-content-${node2.id}`, children: [], kind: "algorithm", contentOf: node2.id };
        for (const key of ["legacyIds", "sourceHeading", "part", "nestedPart", "metadata"]) delete content[key];
        node2.children.unshift(content);
        node2.kind = "directory";
        node2.color = "parent";
        node2.algorithmContentId = content.id;
        node2.rating = { status: "not-applicable", type: "directory" };
        delete node2.difficultySource;
      }
      if (node2.kind === "directory" || node2.kind === "category") {
        node2.kind = "directory";
        node2.color = "parent";
        node2.rating = { status: "not-applicable", type: "directory" };
        delete node2.difficultySource;
      }
      node2.children.forEach(visit);
    }
    visit(tree);
    return tree;
  }
  function hydrate(base, topics = []) {
    const tree = JSON.parse(JSON.stringify(base)), byId = /* @__PURE__ */ new Map();
    function index(node2, depth) {
      node2.level = depth;
      node2.children = Array.isArray(node2.children) ? node2.children : [];
      node2.fullLabel = node2.fullLabel || node2.label;
      byId.set(node2.id, node2);
      for (const id of node2.legacyIds || []) byId.set(id, node2);
      node2.children.forEach((child) => index(child, depth + 1));
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
        const node2 = {
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
        parent.children.push(node2);
        splitMixed(tree);
        index(tree, 0);
        added++;
      }
      if (!added) break;
      pending2 = next;
    }
    function ranges(node2) {
      const values = [COLORS.indexOf(node2.color) + 1, ...node2.children.flatMap((child) => {
        const r = ranges(child);
        return r ? [r.min, r.max] : [];
      })].filter((n) => n > 0);
      const range = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
      if (node2.kind === "directory") node2.rating = { status: "not-applicable", type: "directory" };
      else node2.rating = { ...node2.rating || {}, ...range ? { range } : {} };
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
    const node2 = document.createElement(tag);
    if (className) node2.className = className;
    if (text3 !== void 0) node2.textContent = String(text3);
    return node2;
  }
  function button(text3, className, action2) {
    const node2 = element("button", className, text3);
    node2.type = "button";
    node2.addEventListener("click", action2);
    return node2;
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
    const node2 = element("div", "platform-metric");
    const strong = element("strong", "", number(value));
    strong.dataset.metric = key;
    if (typeof value !== "number" || !Number.isFinite(value)) strong.className = "platform-unknown";
    node2.append(strong, element("span", "", label));
    return node2;
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
      const node2 = metric(selected === "ALL" ? `${label} · 已知合计` : label, total, key);
      node2.append(element("small", "platform-coverage", coverage(values.length, scope().length)));
      metrics.append(node2);
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
    const node2 = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) node2.setAttribute(name, String(value));
    if (text3 !== void 0) node2.textContent = String(text3);
    return node2;
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
      const option = element("option", "", title);
      option.value = value;
      select.append(option);
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
        cells.forEach((node2) => {
          node2.tabIndex = -1;
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
    const monthLabels = new Map([...months.children].map((node2) => [Number(node2.dataset.week), node2.textContent]));
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
      const option = element("option", "", platform.code === "ALL" ? platform.name : `${platform.code} · ${platform.name}`);
      option.value = platform.code;
      select.append(option);
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
    const button4 = action("", "planner-deadline-trigger", () => {
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
    button4.append(icon, caption);
    button4.setAttribute("aria-haspopup", "dialog");
    button4.setAttribute("aria-expanded", "false");
    button4.setAttribute("aria-controls", id);
    input2.hidden = true;
    input2.insertAdjacentElement("afterend", button4);
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
      button4.classList.toggle("has-deadline", Boolean(value));
      button4.disabled = input2.disabled || input2.matches(":disabled");
      const label = input2.getAttribute("aria-label") || "截止时间（可选，使用本机时区）";
      button4.setAttribute("aria-label", value ? `${label}：${value[1]} ${value[2]}` : label);
      button4.title = value ? `${value[1]} ${input2.value.split("T")[1]}（本机时区）` : label;
      if (button4.disabled && opened) close();
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
      if (!button4.isConnected || button4.disabled) {
        close();
        return;
      }
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 8;
      const topEdge = (viewport?.offsetTop || 0) + 8;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
      popover.style.maxHeight = `${Math.max(0, bottomEdge - topEdge)}px`;
      const anchor = button4.getBoundingClientRect();
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
      button4.setAttribute("aria-expanded", "false");
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      queueMicrotask(() => {
        if (!active && button4.isConnected && !button4.disabled) button4.focus({ preventScroll: true });
      });
    }
    function close() {
      if (popover.matches(":popover-open")) popover.hidePopover();
      finishClose();
    }
    function open2() {
      refresh();
      if (opened || button4.disabled || !button4.isConnected) return;
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
      button4.setAttribute("aria-expanded", "true");
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
    const api = { input: input2, button: button4, popover, refresh, open: open2, close };
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
    const node2 = document.createElement(tag);
    if (className) node2.className = className;
    if (text3 !== void 0) node2.textContent = String(text3);
    return node2;
  };
  function button2(text3, className, action2) {
    const node2 = el("button", className, text3);
    node2.type = "button";
    node2.addEventListener("click", action2);
    return node2;
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
      area.querySelectorAll("button,input,textarea").forEach((node2) => {
        node2.disabled = value;
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
    const list2 = el("div", "planner-list");
    list2.id = `planner-${kind}-list`;
    list2.tabIndex = 0;
    list2.setAttribute("role", "region");
    list2.setAttribute("aria-label", kind === "problems" ? "待做题单，可向下滚动" : "学习任务，可向下滚动");
    const more = button2("收起 ▴", "planner-list-toggle", () => {
      collapsed[kind] = !collapsed[kind];
      drawCard(kind);
      more.focus();
    });
    more.setAttribute("aria-controls", list2.id);
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
    card.append(heading, form, error, list2, hint, completed);
    const refs = { card, count, form, error, list: list2, more, hint, completed, summary, doneList };
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
    const row2 = Array.from(card.card.querySelectorAll("[data-id]")).find((node2) => node2.dataset.id === focus.id);
    const target = row2 && Array.from(row2.querySelectorAll("[data-action]")).find((node2) => node2.dataset.action === focus.action);
    if (target && !target.closest("details:not([open])")) target.focus();
    else card.form.querySelector("input").focus();
  }
  function row(kind, item) {
    const refs = cards[kind];
    const node2 = el("div", `planner-row${item.done ? " is-done" : ""}`);
    node2.dataset.id = String(item.id);
    node2.dataset.kind = kind;
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
    node2.append(checkbox, copy, actions);
    return node2;
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
    if (busy) refs.card.querySelectorAll("button,input,textarea").forEach((node2) => {
      node2.disabled = true;
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
  function create({ demo, getSettings, setSettings, getView, getLoading, canRefresh, call, writeDemo, toast, errorMessage: errorMessage2, openExternal }) {
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.forEach((child) => {
        if (child) parent.append(child);
      });
      return parent;
    }
    function button4(label, className, action2) {
      const node2 = element3("button", className, label);
      node2.type = "button";
      node2.addEventListener("click", action2);
      return node2;
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
      const badge = element3("span", "contest-type-badge", type.label);
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
        toast(`比赛偏好未保存：${errorMessage2(error)}`);
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
      }
    }
    function visibleContests(platform, now) {
      return (platform?.contests || []).map((contest) => ({ ...contest, start: contestTimestamp(contest.startTime), end: contestTimestamp(contest.endTime) })).filter((contest) => contest.start !== null && contest.end !== null && contest.end > contest.start && contest.end > now && !isContestOptedOut(platform.id, contest.id)).sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id))).slice(0, 3);
    }
    function contestLink(label, url, className, focusKey) {
      const link = element3("a", className, label);
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
      $$(".contest-decline").forEach((node2) => {
        node2.disabled = contestPreferencePending;
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
      const sources = element3("div", "contest-sources");
      for (const platform of contestPlatforms) {
        const source = contestData?.platforms.find((item) => item.id === platform.id);
        const items2 = visibleContests(source, now);
        const chip = element3("div", "contest-source");
        chip.dataset.platform = platform.id;
        const status = !source ? "尚未获取" : source.error ? items2.length ? "更新失败 · 保留赛程" : "获取失败" : source.stale ? "缓存待更新" : items2.length ? "已更新" : "暂无赛程";
        chip.title = `${platform.name} · ${status} · ${source?.updatedAt ? `更新于 ${contestTime(source.updatedAt)} · 北京时间` : "尚无成功更新时间"}`;
        append(chip, contestLink(`${platform.name} ↗`, platform.url, "contest-official-link", `${platform.id}:official`), element3("span", `contest-source-status${source?.error ? " is-error" : source?.stale ? " is-stale" : ""}`, status));
        sources.append(chip);
      }
      const list2 = element3("div", "contest-list");
      const items = mergedContests(now);
      for (const contest of items) {
        const { platform } = contest, active3 = contest.start <= now;
        const row2 = element3("article", `contest-card${active3 ? " is-active" : ""}`);
        row2.dataset.platform = platform.id;
        row2.dataset.contestId = String(contest.id);
        const label = element3("span", "contest-phase", active3 ? "正在进行" : "即将开始");
        const title = contestLink(contest.title || "未命名比赛", contest.url, "contest-title", `${platform.id}:${contest.id}`);
        title.title = contest.title;
        const start2 = element3("time", "", contestTime(contest.startTime));
        start2.dateTime = contest.startTime;
        start2.title = `开始 ${contestTime(contest.startTime)} · 结束 ${contestTime(contest.endTime)} · 北京时间`;
        const schedule = element3("span", "contest-schedule");
        schedule.append(start2);
        const countdown = element3("span", "contest-countdown");
        countdown.dataset.target = String(active3 ? contest.end : contest.start);
        countdown.dataset.phase = active3 ? "active" : "upcoming";
        countdown.textContent = `${active3 ? "距结束" : "距开始"} ${contestDuration(Number(countdown.dataset.target) - now)}`;
        const duration = element3("span", "contest-duration", `赛时 ${contestDuration(contest.end - contest.start).replace(/ 0秒$/, "").trim()}`);
        const decline = button4("不参加", "contest-decline", () => {
          void setContestOptOut(platform.id, contest.id, true);
        });
        decline.dataset.contestFocus = `${platform.id}:${contest.id}:decline`;
        decline.setAttribute("aria-label", `不参加：${contest.title}`);
        const titleGroup = append(element3("span", "contest-title-group"), contestTypeBadge(platform.id, contest), title);
        append(row2, element3("span", "contest-platform-label", platform.name), titleGroup, label, schedule, duration, countdown, decline);
        list2.append(row2);
      }
      if (!items.length) list2.append(element3("p", "contest-empty", contestsPending ? "正在载入比赛…" : "暂无可显示的比赛，可通过上方平台链接查看官方赛程。"));
      grid.append(sources, list2);
      contestSignature = JSON.stringify(items.map((contest) => [contest.platform.id, contest.id, contest.start <= now ? "active" : "upcoming"]));
      updateContestPreferenceControls();
      if (focus) {
        const target = $$("[data-contest-focus]", grid).find((node2) => node2.dataset.contestFocus === focus) || $$("[data-contest-focus]", grid).find((node2) => node2.dataset.contestFocus === `${focus.split(":")[0]}:official`);
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
      $$(".contest-countdown").forEach((node2) => {
        node2.textContent = `${node2.dataset.phase === "active" ? "距结束" : "距开始"} ${contestDuration(Number(node2.dataset.target) - now)}`;
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
        const node2 = $("#" + id);
        if (node2) node2.disabled = contestPreferencePending;
      });
      $$("#contest-restore-options input").forEach((node2) => {
        node2.disabled = contestPreferencePending;
      });
    }
    function renderContestRestoreOptions() {
      const options = $("#contest-restore-options");
      if (!options) return;
      options.replaceChildren();
      for (const entry2 of contestRestoreEntries) {
        const label = element3("label", "contest-restore-option");
        const checkbox = element3("input");
        checkbox.type = "checkbox";
        checkbox.value = entry2.key;
        checkbox.checked = contestRestoreSelection.has(entry2.key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) contestRestoreSelection.add(entry2.key);
          else contestRestoreSelection.delete(entry2.key);
          updateContestRestoreCount();
        });
        const text3 = element3("span", "contest-restore-option-copy");
        const details = entry2.start !== null && entry2.end !== null && entry2.end > entry2.start ? `${contestTime(entry2.startTime)} · 赛时 ${contestDuration(entry2.end - entry2.start).replace(/ 0秒$/, "").trim()}${entry2.end <= Date.now() ? " · 已结束" : ""}` : "暂无赛程详情（可恢复隐藏偏好）";
        const heading = append(element3("span", "contest-restore-option-heading"), contestTypeBadge(entry2.platform.id, entry2), element3("strong", "", `${entry2.platform.name} · ${entry2.title || `比赛 ${entry2.id}`}`));
        append(text3, heading, element3("small", "", details));
        label.title = `${entry2.platform.name} · ${entry2.title || `比赛 ${entry2.id}`}`;
        append(label, checkbox, text3);
        options.append(label);
      }
      if (!contestRestoreEntries.length) options.append(element3("p", "contest-empty", "当前缓存中找不到已隐藏的比赛，刷新赛程后再试。"));
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
        errorNode.textContent = `比赛偏好未保存：${errorMessage2(error)}`;
        errorNode.hidden = false;
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
        updateContestRestoreCount();
      }
    }
    function renderHomeContests() {
      const panel = element3("section", "home-contests");
      panel.setAttribute("aria-labelledby", "contests-title");
      const title = element3("h2", "", "比赛提醒");
      title.id = "contests-title";
      const refresh = button4("刷新赛程", "button secondary", () => {
        void refreshContests(true);
      });
      refresh.id = "contests-refresh";
      const restore = button4("", "button subtle contest-restore", openContestRestore);
      restore.id = "contests-restore";
      const actions = append(element3("div", "contest-actions"), restore, refresh);
      const status = element3("p", "contests-status");
      status.id = "contests-status";
      status.setAttribute("role", "status");
      const grid = element3("div", "contest-platforms");
      grid.id = "contest-platforms";
      append(panel, append(element3("div", "contests-heading"), append(element3("div"), element3("div", "eyebrow", "CONTEST COUNTDOWN"), title, element3("p", "contest-timezone", "所有时间均为北京时间（UTC+8）")), actions), status, grid);
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

  // src/renderer/account/updates.ts
  function create2(options) {
    const { demo, bridge: bridge3, getAppVersion, getUpdate, setUpdate, getUpdateCapability, getBusy, setBusy, call, cancelDraftSave, getLocalWrite, resetLocalWrite, hasEditor, saveDraft, persistLocal, renderAccount, toast, errorMessage: errorMessage2 } = options;
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
        throw new Error(`本地数据尚未保存，更新已停止：${errorMessage2(error)}`);
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
        receiveUpdate({ phase: "error", message: errorMessage2(error) });
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
  var Updates = Object.freeze({ create: create2 });

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
  var CodeBlocks = { create: create3 };
  function create3({ toast, errorMessage: errorMessage2 }) {
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
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
      const node2 = pre.querySelector("code") || pre;
      const match2 = /\blanguage-([\w#+.-]+)/i.exec(node2.className || "");
      return normalizeCodeLanguage(match2 ? match2[1] : "");
    }
    function codeBlockText(pre) {
      const code = pre.querySelector("code");
      if (!code) return pre.textContent || "";
      const clone = code.cloneNode(true);
      $$(".line-numbers-rows, .line-numbers-sizer", clone).forEach((node2) => node2.remove());
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
      const area = element3("textarea", "clipboard-helper");
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
        if (typeof result !== "string" && result?.error) throw new Error(errorMessage2(result.error));
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
        const message = "格式化失败：" + errorMessage2(error);
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
        const block = element3("div", "code-block");
        pre.replaceWith(block);
        block.append(pre);
        const actions = element3("div", "code-actions");
        actions.setAttribute("role", "group");
        actions.setAttribute("aria-label", "代码块操作");
        const copy = element3("button", "code-action-button", "复制");
        copy.type = "button";
        copy.dataset.action = "copy";
        copy.title = "复制代码";
        copy.setAttribute("aria-label", "复制代码");
        const format = element3("button", "code-action-button", "格式化");
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
        const status = element3("span", "code-status");
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
    for (const node2 of container.querySelectorAll(".notebook-math-source")) {
      if (node2.classList.contains("notebook-math-rendered") || node2.classList.contains("notebook-math-error") || node2.closest("pre,code,kbd,samp,script,style,textarea")) continue;
      const text3 = node2.textContent;
      try {
        const nextMacros = structuredClone(macros);
        katex.render(text3, node2, { displayMode: node2.dataset.mathDisplay === "true", throwOnError: true, trust: false, strict: "ignore", maxExpand: 1e3, maxSize: 20, macros: nextMacros, globalGroup: true, output: "htmlAndMathml" });
        macros = nextMacros;
        node2.classList.add("notebook-math-rendered");
      } catch (error) {
        node2.replaceChildren(container.ownerDocument.createTextNode(text3));
        node2.classList.add("notebook-math-error");
        node2.setAttribute("role", "note");
        node2.title = `公式语法或命令不受支持：${String(error.message || error).slice(0, 500)}`;
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
  function foreground(node2, document2) {
    let result = "";
    for (const declaration of (node2.getAttribute("style") || "").split(";")) {
      const match2 = /^\s*color\s*:\s*(.*?)\s*$/i.exec(declaration);
      if (match2) result = color(match2[1], document2) || result;
    }
    return result || (node2.nodeName === "FONT" ? color(node2.getAttribute("color"), document2) : "");
  }
  function sanitize(html, purifier, document2) {
    const colors = /* @__PURE__ */ new WeakMap();
    const capture = (node2) => {
      if (node2.nodeName !== "SPAN" && node2.nodeName !== "FONT") return;
      const value = foreground(node2, document2);
      if (value) colors.set(node2, value);
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
    for (const node2 of fragment.querySelectorAll("span,font")) {
      const value = colors.get(node2);
      if (value) {
        node2.style.color = value;
        node2.classList.add("notebook-foreground");
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
    const hidden = Array.from(mount.children).filter((node2) => node2 !== view && node2.tagName !== "DIALOG" && !node2.hidden);
    hidden.forEach((node2) => {
      node2.hidden = true;
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
        hidden.forEach((node2) => {
          node2.hidden = false;
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
  function createFilters({ getRecords, getView, getScope, getAccount, getTagCatalog, getBusy, favorite, mastery, isLocal, authorName: authorName2, render: render6 }) {
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button4(label, className, action2) {
      const node2 = element3("button", className, label);
      node2.type = "button";
      node2.addEventListener("click", action2);
      return node2;
    }
    const stateLabels = { unreviewed: "待复习", reviewing: "复习中", mastered: "已掌握" };
    const facets = { platform: /* @__PURE__ */ new Set(), tags: /* @__PURE__ */ new Set(), authors: /* @__PURE__ */ new Set(), native: /* @__PURE__ */ new Set() };
    const facetNames = { platform: "平台", tags: "标签", authors: "作者", native: "难度" };
    const platformNames = { CF: "Codeforces", LG: "洛谷", AT: "AtCoder", NC: "牛客", LC: "LeetCode", Oth: "其他平台" };
    function facetValue(record, group) {
      return group === "platform" ? Search.normalizePlatform(record.platform) : group === "authors" ? authorName2(record.author || (isLocal(record) ? getAccount()?.login || "我（本地）" : "")) : "";
    }
    function fillFacetOptions(container, group, values, search = "") {
      container.replaceChildren();
      const counts = /* @__PURE__ */ new Map();
      values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
      const options = [.../* @__PURE__ */ new Set([...counts.keys(), ...facets[group]])].sort((a, b) => a.localeCompare(b, "zh-CN"));
      options.filter((value) => (group === "platform" ? platformNames[value] || value : value).toLowerCase().includes(search.toLowerCase())).forEach((value) => {
        const label = element3("label", "facet-option");
        const input2 = element3("input");
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
        append(label, input2, element3("span", "", group === "platform" ? platformNames[value] || value : value), element3("small", "", counts.get(value) || 0));
        container.append(label);
      });
      if (!container.children.length) container.append(element3("p", "facet-help", "没有匹配的选项"));
    }
    function refreshFilters() {
      const all = getRecords();
      for (const group of ["platform", "tags", "authors"]) {
        const host = $(group === "tags" ? "#tag-filter" : group === "authors" ? "#author-filter" : "#platform-filter");
        const values = group === "tags" ? all.flatMap((r) => Array.isArray(r.tags) ? r.tags : []) : all.map((r) => facetValue(r, group));
        if (group === "tags") {
          const trigger = button4("", "facet-trigger", () => openTagPicker("filter"));
          append(trigger, document.createTextNode(facetNames[group] + " "), element3("span", "facet-chevron", "⌄"));
          trigger.id = "tag-filter-trigger";
          trigger.setAttribute("aria-haspopup", "dialog");
          host.replaceChildren(trigger);
        } else {
          const wasOpen = host.querySelector("details")?.open;
          const query = host.querySelector('input[type="search"]')?.value || "";
          const details = element3("details");
          details.open = !!wasOpen;
          const summary = element3("summary");
          append(summary, document.createTextNode(facetNames[group] + " "), element3("span", "facet-count"), element3("span", "facet-chevron", "⌄"));
          const popover = element3("div", "facet-popover");
          const search = element3("input", "facet-search");
          search.type = "search";
          search.placeholder = `查找${facetNames[group]}`;
          search.setAttribute("aria-label", `查找${facetNames[group]}`);
          search.value = query;
          const options = element3("div", "facet-options");
          search.addEventListener("input", () => fillFacetOptions(options, group, values, search.value));
          append(popover, search, options, button4("清除本组", "facet-clear", () => {
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
    function fillTagOptions(container, selected2, query, onChange2) {
      container.replaceChildren();
      const counts = /* @__PURE__ */ new Map();
      getRecords().forEach((r) => new Set(r.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
      tagGroups([...selected2]).forEach((group) => {
        const matching = group.tags.filter((t) => `${group.name} ${t}`.toLowerCase().includes(query.toLowerCase()));
        if (!matching.length) return;
        container.append(element3("strong", "tag-category-heading", group.name));
        matching.forEach((value) => {
          const label = element3("label", "facet-option");
          const input2 = element3("input");
          input2.type = "checkbox";
          input2.value = value;
          input2.checked = selected2.has(value);
          input2.disabled = getBusy();
          input2.addEventListener("change", () => {
            input2.checked ? selected2.add(value) : selected2.delete(value);
            $$('input[type="checkbox"]', container).filter((n) => n.value === value).forEach((n) => n.checked = input2.checked);
            onChange2();
          });
          append(label, input2, element3("span", "", value + (group.historical ? " · 历史" : "")), element3("small", "", counts.get(value) || 0));
          container.append(label);
        });
      });
      if (!container.children.length) container.append(element3("p", "facet-help", "没有匹配的标签"));
    }
    let tagPickerContext = null;
    function openTagPicker(mode) {
      if (getBusy()) return;
      const source = mode === "filter" ? facets.tags : new Set($("#submit-form").elements.tags.value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean));
      tagPickerContext = { mode, original: new Set(source), selected: new Set(source) };
      $("#tag-picker-title").textContent = mode === "filter" ? "筛选算法标签" : "选择算法标签";
      $("#tag-picker-hint").textContent = mode === "filter" ? "命中任一已选标签的题目将显示；确定后应用筛选。" : "选择一个或多个标签，点击确定后加入错题。";
      $("#tag-picker-search").value = "";
      fillTagOptions($("#tag-picker-dialog-options"), tagPickerContext.selected, "", () => {
      });
      $("#tag-picker-dialog").showModal();
      $("#tag-picker-search").focus();
    }
    function closeTagPicker(apply) {
      if (!tagPickerContext) return;
      const context = tagPickerContext;
      tagPickerContext = null;
      $("#tag-picker-dialog").close();
      if (!apply) return;
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
      selected2.forEach((t) => host.append(button4(t + " ×", "filter-chip", () => {
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
        const node2 = $(`[data-facet="${group}"] .facet-count`);
        if (node2) node2.textContent = count2 || "";
      }
      const range = ranges();
      const count = range.filter((v) => v !== null).length + facets.native.size;
      $("#difficulty-count").textContent = count ? "已选" : "";
      const chips = $("#active-filters");
      chips.replaceChildren();
      for (const group of Object.keys(facets)) for (const value of facets[group]) chips.append(button4(`${facetNames[group]} · ${group === "platform" ? platformNames[value] || value : value} ×`, "filter-chip", () => {
        facets[group].delete(value);
        refreshFilters();
        render6();
      }));
      if (range.some((v) => v !== null)) chips.append(button4("难度区间 ×", "filter-chip", () => {
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
        if (getView() === "public" && record.kind !== (getScope() === "local" ? "local" : "document")) return false;
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
    const luoguLevels2 = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
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
    }, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, luoguLevels: luoguLevels2, luoguTones, colorRatingInput, colorLuoguSelection };
  }

  // src/renderer/library/editor.ts
  function createEditor(options) {
    const { demo, getEditor, setEditor, getLocal, setLocal, getRecords, setRecords, getIssues, setIssues, getComments, getSelected, setSelected, getBusy, setBusy, getAccount, getPermissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave, persistLocal, call, refreshFilters, navigate, render: render6, openDetail, toast, errorMessage: errorMessage2 } = options;
    const $ = (selector) => document.querySelector(selector);
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function formDraft() {
      const form = $("#submit-form");
      return Object.fromEntries(["url", "title", "pid", "platform", "tags", "reason", "body", "trick", "rating", "difficulty", "luoguDifficulty"].map((name) => [name, String(form.elements.namedItem(name)?.value || "")]));
    }
    function fillForm(draft) {
      const form = $("#submit-form");
      form.reset();
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
      const wrapper = element3("div", "editor-difficulty-controls");
      if (platform === "CF") {
        const ratingField = element3("label", "range-field");
        ratingField.append(element3("span", "", "Codeforces Rating"));
        const input2 = element3("input", "rating-range");
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
        const select = element3("select", "luogu-range");
        select.setAttribute("aria-label", "洛谷原生难度");
        [["", "未指定"], ...editorLuoguLevels.map((name) => [name, name])].forEach(([value, label], index) => {
          const option = element3("option", index ? `tone-${editorLuoguTones[index - 1]}` : "", label);
          option.value = value;
          select.append(option);
        });
        const current = Search.difficulty({ platform: "LG", difficulty: native.value });
        const known2 = current.level ? editorLuoguLevels[current.level - 1] : editorLuoguLevels.find((level) => level === native.value);
        if (known2) select.value = known2;
        else if (native.value) {
          const legacy = element3("option", "", native.value);
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
        const field2 = element3("label", "range-field");
        field2.append(element3("span", "", "洛谷难度"), select);
        wrapper.append(field2);
      } else if (platform === "LC") {
        const select = element3("select", "luogu-range");
        select.setAttribute("aria-label", "LeetCode 原生难度");
        [["", "未指定", ""], ["Easy", "Easy / 简单", "green"], ["Medium", "Medium / 中等", "yellow"], ["Hard", "Hard / 困难", "red"]].forEach(([value, label, tone]) => {
          const option = element3("option", tone ? `tone-${tone}` : "", label);
          option.value = value;
          select.append(option);
        });
        const level = Search.difficulty({ platform: "LC", difficulty: native.value }).level;
        const known2 = ["Easy", "Medium", "Hard"][level - 1];
        if (known2) select.value = known2;
        else if (native.value) {
          const legacy = element3("option", "", native.value);
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
        const input2 = element3("input");
        input2.type = "text";
        input2.maxLength = 60;
        input2.placeholder = "原生难度，如 ABC D / 3";
        input2.setAttribute("aria-label", "平台原生难度");
        input2.value = native.value;
        const datalist = element3("datalist");
        datalist.id = "editor-native-difficulties";
        const values = platform === "AT" ? ["ABC A", "ABC B", "ABC C", "ABC D", "ABC E", "ABC F", "ARC A", "ARC B", "ARC C", "ARC D", "ARC E", "ARC F"] : platform === "NC" ? ["简单", "中等", "困难"] : [];
        values.forEach((value) => {
          const option = element3("option");
          option.value = value;
          datalist.append(option);
        });
        input2.setAttribute("list", datalist.id);
        input2.addEventListener("input", () => {
          native.value = input2.value;
        });
        wrapper.append(input2, datalist);
      }
      if (platform !== "LG") {
        const field2 = element3("label", "range-field");
        field2.append(element3("span", "", "洛谷难度（可选）"));
        const select = element3("select", "luogu-range");
        select.setAttribute("aria-label", "补充洛谷难度");
        [["", "未指定"], ...editorLuoguLevels.map((name) => [name, name])].forEach(([value, label], index) => {
          const option = element3("option", index ? `tone-${editorLuoguTones[index - 1]}` : "", label);
          option.value = value;
          select.append(option);
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
      $("#submit-error").textContent = errorMessage2(error);
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
        $("#draft-hint").textContent = `编辑草稿保存失败：${errorMessage2(error)}；请勿关闭窗口`;
        if (required) throw new Error(`无法持久化编辑标识，尚未写入 GitHub：${errorMessage2(error)}`);
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
        form.reset();
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
        toast(`删除讨论失败：${errorMessage2(error)}`);
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
        toast(`删除失败：${errorMessage2(error)}`);
      } finally {
        setBusy(false);
      }
    }
    return { formDraft, fillForm, renderEditorDifficulty, setEditorPlatform, draftKey, editorError, openLocalSolution, openSubmit, saveDraft, saveRecord, deleteDiscussion, deleteRecord };
  }

  // src/renderer/library/reader.ts
  function createLibraryReader(options) {
    const global2 = window;
    const { demo, stateLabels, getLocal, setLocal, getAccount, getPermissions, getView, getLibraryScope, getSelected, setSelected, getComments, getBusy, setBusy, getLoading, getError, getRecords, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName: authorName2, date, quotaBlocked, renderMarkdown, persistLocal, call, render: render6, clearFilters, openSubmit, openLocalSolution, deleteRecord, deleteDiscussion, openExternal, toast, errorMessage: errorMessage2 } = options;
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    const $$ = (selector, root2 = document) => Array.from(root2.querySelectorAll(selector));
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button4(label, className, action2) {
      const node2 = element3("button", className, label);
      node2.type = "button";
      node2.addEventListener("click", action2);
      return node2;
    }
    function favorite(record) {
      return getLocal().favorites.some((value) => String(value) === key(record));
    }
    function mastery(record) {
      return stateLabels[getLocal().mastery[key(record)]] ? getLocal().mastery[key(record)] : "unreviewed";
    }
    function badge(record) {
      return element3("span", `badge ${isLocal(record) ? "local" : "shared"}`, isLocal(record) ? record.proposalUrl ? "旧版已投稿副本" : "仅本地 · 未上传" : record.kind === "document" ? "正式题解" : "讨论 Issue");
    }
    function platformLabel(record) {
      const code = platformCode(record.platform);
      const names = { CF: "Codeforces", AT: "AtCoder", LG: "洛谷", NC: "牛客", LC: "LeetCode" };
      const label = element3("span", "platform-label", names[code] || record.platform || "其他平台");
      label.dataset.platform = ["CF", "AT", "LG", "NC", "LC"].includes(code) ? code : "Oth";
      return label;
    }
    function supplementaryDifficultyBadge(record) {
      if (platformCode(record.platform) === "LG" || !record.luoguDifficulty) return element3("span");
      const info = Search.difficulty({ platform: "LG", difficulty: record.luoguDifficulty });
      return element3("span", `difficulty-badge tone-${info.tone}`, `洛谷 · ${record.luoguDifficulty}`);
    }
    function difficultyBadge(record) {
      const { tone, rank, label: text3 } = Search.difficulty(record);
      if (!text3) return null;
      const code = Search.normalizePlatform(record.platform);
      const label = element3("span", `difficulty-badge tone-${tone}${rank ? ` rank-${rank}` : ""}`, text3);
      label.title = `${demo ? "演示值 · " : ""}${code === "CF" ? "Codeforces 原生 Rating 色阶" : code === "LG" ? "洛谷原生难度名称 · 颜色仅用于界面展示" : "平台原始数值 / 难度"}，不跨平台换算`;
      return label;
    }
    function tags(record) {
      const row2 = element3("div", "tag-row");
      (Array.isArray(record.tags) ? record.tags : []).forEach((tag) => {
        let hash = 0;
        for (const char of String(tag)) hash = (hash + char.codePointAt(0)) % 5;
        row2.append(element3("span", `tag tag-color-${hash}`, tag));
      });
      return row2;
    }
    function empty(title, description, action2) {
      const box = element3("div", "empty-state");
      append(box, element3("div", "empty-icon", "⌑"), element3("h3", "", title), element3("p", "", description));
      if (action2) box.append(button4(action2.label, "button secondary", action2.fn));
      return box;
    }
    let focusedDetail = false;
    let readerPosition = null;
    let commentRequest = 0;
    function openDetail(record) {
      if (focusedDetail) return;
      setSelected(key(record));
      readerPosition = { window: global2.scrollY, list: $("#record-list").scrollTop, panel: $("#detail-panel").scrollTop, focus: document.activeElement };
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
      const list2 = $("#record-list");
      list2.replaceChildren();
      items.forEach((record2) => {
        const card = button4("", `record-card${key(record2) === getSelected() ? " selected" : ""}`, () => {
          setSelected(key(record2));
          $$(".record-card").forEach((n) => {
            const active3 = n.dataset.key === getSelected();
            n.classList.toggle("selected", active3);
            n.setAttribute("aria-pressed", String(active3));
          });
          renderDetail(record2);
        });
        card.dataset.key = key(record2);
        card.title = "单击预览，双击打开详情；Enter 打开详情";
        card.setAttribute("aria-pressed", key(record2) === getSelected() ? "true" : "false");
        card.addEventListener("dblclick", () => openDetail(record2));
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            openDetail(record2);
          }
        });
        append(card, append(element3("div", "card-meta"), platformLabel(record2), element3("span", "", record2.pid || `#${record2.number || "本地"}`), difficultyBadge(record2), supplementaryDifficultyBadge(record2), badge(record2)), element3("h2", "card-title", record2.title || "未命名错题"), tags(record2), append(element3("div", "card-footer"), element3("span", `card-state ${mastery(record2)}`, stateLabels[mastery(record2)]), element3("span", "", `${favorite(record2) ? "★ · " : ""}${date(record2.updatedAt)}`)));
        list2.append(card);
      });
      if (!items.length) list2.append(empty(getLoading() ? "正在载入题库" : getView() === "public" && getLibraryScope() === "local" ? "还没有本地题解" : "这里还没有题目", getLoading() ? "等待客户端返回你的学习数据。" : "试试调整筛选，或记下第一道值得回顾的错题。", { label: "清空筛选", fn: clearFilters }));
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
        toast(`未能保存：${errorMessage2(error)}`);
      } finally {
        setBusy(false);
      }
    }
    function renderDetail(record) {
      const panel = $("#detail-panel");
      const scroll = panel.scrollTop;
      panel.replaceChildren();
      if (focusedDetail) {
        const back = button4("← 返回题目网格", "button secondary detail-back", closeDetail);
        back.id = "detail-back-button";
        panel.append(back);
      } else {
        const open2 = button4("打开详情 ↗", "button primary detail-open", () => openDetail(record));
        open2.id = "open-detail-button";
        panel.append(open2);
      }
      const actions = append(element3("div", "detail-actions"), button4(favorite(record) ? "★ 已收藏" : "☆ 收藏", "button secondary", () => changeLocal(() => {
        getLocal().favorites = favorite(record) ? getLocal().favorites.filter((value) => String(value) !== key(record)) : [...getLocal().favorites, key(record)];
      })), button4("原题 ↗", "button subtle", () => openExternal(record.problemUrl || record.url)));
      if (record.kind === "document") {
        const localSolution = button4("＋ 本地题解", "button subtle public-local-solution", () => openLocalSolution(record));
        localSolution.id = "local-solution-button";
        localSolution.title = "为这道题写自己的本地题解；已有本地记录时继续编辑";
        actions.append(localSolution);
      }
      append(panel, append(element3("div", "detail-top"), append(element3("div", "detail-meta"), platformLabel(record), element3("span", "", record.pid || `#${record.number || "本地"}`), difficultyBadge(record), supplementaryDifficultyBadge(record), badge(record)), actions), element3("h2", "detail-title", record.title || "未命名错题"));
      const author = authorName2(record.author);
      append(panel, append(element3("div", "author-row"), element3("span", "mini-avatar", author.slice(0, 1)), element3("span", "", author), element3("span", "separator", "·"), element3("span", "", `更新于 ${date(record.updatedAt)}`), record.kind === "document" ? element3("span", "badge document", "正式题解") : null));
      const tagrow = tags(record);
      tagrow.classList.add("detail-tags");
      append(panel, tagrow, element3("hr", "detail-divider"), element3("div", "body-label", "思路与复盘"));
      const body = element3("div", "markdown-body");
      renderMarkdown(body, record.body);
      panel.append(body);
      const masteryButtons = element3("div", "mastery-buttons");
      Object.entries(stateLabels).forEach(([value, label]) => {
        const control2 = button4(label, mastery(record) === value ? "active" : "", () => changeLocal(() => {
          getLocal().mastery[key(record)] = value;
        }));
        control2.setAttribute("aria-pressed", mastery(record) === value ? "true" : "false");
        masteryButtons.append(control2);
      });
      append(panel, append(element3("div", "mastery-box"), append(element3("div"), element3("strong", "", "这个思路，掌握了吗？"), element3("small", "", "复习进度仅记录在你的学习空间")), masteryButtons));
      const edits = element3("div", "record-edit-actions");
      if (record.proposalUrl) edits.append(button4("旧版已投稿副本 · 查看投稿 ↗", "button secondary", () => openExternal(record.proposalUrl)));
      if (isLocal(record) && visibleLocal(record) || canEditRemote(record)) {
        const edit = button4(isLocal(record) ? "编辑本地记录" : "编辑正式题解", "button secondary", () => openSubmit(record));
        edit.id = "edit-record-button";
        const remove = button4(isLocal(record) ? "删除本地记录" : "删除正式题解", "button danger", () => deleteRecord(record));
        remove.id = "delete-record-button";
        append(edits, edit, remove);
      }
      if (record.kind === "issue" && sameRepo(record) && getAccount() && getPermissions().admin === true) {
        const remove = button4("永久删除讨论 Issue", "button danger", () => deleteDiscussion(record));
        remove.id = "delete-issue-button";
        edits.append(remove);
      }
      panel.append(edits);
      panel.scrollTop = scroll;
      if (record.kind !== "issue" || !record.number) return;
      const comments = element3("section", "comments-section");
      append(comments, append(element3("div", "section-heading"), element3("h3", "", "一起讨论")));
      const commentList = element3("div");
      comments.append(commentList);
      panel.append(comments);
      const form = element3("form", "comment-form");
      const input2 = element3("textarea");
      input2.rows = 2;
      input2.placeholder = "分享你的观察，或提出一个问题…";
      input2.setAttribute("aria-label", "评论内容");
      input2.required = true;
      input2.maxLength = 1e4;
      const submit = element3("button", "button secondary", demo ? "演示评论" : "发表讨论");
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
          toast(errorMessage2(error));
        } finally {
          setBusy(false);
          submit.disabled = false;
        }
      });
      void loadComments(record, commentList);
    }
    async function loadComments(record, container) {
      const request = ++commentRequest;
      container.replaceChildren(element3("div", "comment-empty", "正在加载讨论…"));
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
        if (!comments.length) container.append(element3("div", "comment-empty", demo ? "演示讨论区 · 留下第一条思考，不会发送到外部。" : "还没有讨论，你的观察也许就是别人的突破口。"));
        comments.forEach((comment) => {
          container.append(append(element3("article", "comment-item"), element3("strong", "", authorName2(comment.author || comment.user)), element3("p", "", comment.body || "")));
        });
      } catch (error) {
        if (container.isConnected) container.replaceChildren(element3("div", "comment-empty", `讨论暂不可用：${errorMessage2(error)}`));
      }
    }
    return { favorite, mastery, tags, openDetail, closeDetail, resetDetail, isFocusedDetail, renderFocusedDetail, renderLibrary, renderDetail, loadComments, changeLocal };
  }

  // src/renderer/account/settings.ts
  function createSettings(options) {
    const { demo, bridge: bridge3, themeStorage, getBusy, setBusy, getSettings, setSettings, getAccount, getAuthStatus, getPermissions, setPermissionsRepo, getError, setError, getLocal, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData, resetSourceView, clearComments, refreshFilters, render: render6, renderUpdate, updateStatus, sync, writeDemo, toast, errorMessage: errorMessage2 } = options;
    const $ = (selector, root2 = document) => root2.querySelector(selector);
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    const escapeHtml2 = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    let settingsPreview = null;
    let editingRepos = [];
    let editingActiveId = "";
    let authUrl = "";
    function readTheme() {
      try {
        return localStorage.getItem(themeStorage) || "light";
      } catch (_) {
        return "light";
      }
    }
    function applyTheme(theme) {
      theme = ["light", "dark", "cards"].includes(theme) ? theme : "light";
      document.body.dataset.theme = theme;
      $("#theme-select").value = theme;
      try {
        localStorage.setItem(themeStorage, theme);
      } catch (_) {
      }
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
        toast(errorMessage2(err));
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
    async function changeTheme(event) {
      const previous = { ...getSettings() };
      const settings = getSettings();
      settings.theme = event.target.value;
      applyTheme(settings.theme);
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { ...getSettings() });
      } catch (error) {
        setSettings(previous);
        toast(`当前风格已预览，设置未保存：${errorMessage2(error)}`);
      }
    }
    function openSettings() {
      if (getBusy() || $("#submit-dialog").open) {
        toast("请先完成或关闭编辑");
        return;
      }
      try {
        const settings = getSettings();
        settingsPreview = { ...settings, theme: document.body.dataset.theme };
        const form = $("#settings-form");
        if (form.elements.theme) form.elements.theme.value = settingsPreview.theme;
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
        theme: form.elements.theme.value,
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
        applyCodeSettings();
        applyTheme(settings.theme);
        renderRepoSelector();
        writeDemo();
        $("#settings-dialog").close();
        refreshFilters();
        render6();
        toast("设置已保存");
      } catch (error) {
        toast(errorMessage2(error));
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
      applyCodeSettings();
      render6();
    }
    function renderAccount() {
      renderUpdate();
      const account = getAccount(), permissions = getPermissions(), authStatus = getAuthStatus();
      const box = $("#account-details");
      box.replaceChildren();
      for (const [label, value] of [["姓名", account?.name || "未设置"], ["GitHub 登录名", account?.login || "未登录"], ["GitHub ID", account?.id ?? "未登录"], ["当前仓库", repo() || "未配置"], ["权限", account ? permissions.admin ? "管理员 · 可直接维护自己的题解" : permissions.push ? "可推送 · 可直接维护自己的题解" : "只读 · 可使用本地记录" : "未登录 · 仅本地编辑"]]) append(box, element3("dt", "", label), element3("dd", "", value));
      const authLabel = { anonymous: "未登录", restored: "已恢复，等待验证", verified: "已验证", expired: "授权已过期，请重新登录", unverified: "尚未验证，请联网刷新", "recovery-required": "凭证恢复失败，请重新授权" };
      if (authLabel[authStatus?.status]) append(box, element3("dt", "", "认证状态"), element3("dd", "", authLabel[authStatus.status]));
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
        $("#account-error").textContent = errorMessage2(error);
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
        toast(`无法打开浏览器：${errorMessage2(error)}。可复制下方链接手动授权`);
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
        toast(errorMessage2(error));
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
          const link = element3("a");
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
        toast(errorMessage2(error));
      }
    }
    $("#repo-select")?.addEventListener("change", switchRepository);
    $("#new-repo-add-btn")?.addEventListener("click", addRepository);
    $("#theme-select").addEventListener("change", changeTheme);
    $("#settings-button").addEventListener("click", openSettings);
    $("#settings-form").addEventListener("submit", saveSettings);
    $("#settings-form").elements.codeFontSize.addEventListener("input", previewCodeFontSize);
    $("#settings-form").elements.codeLineNumbers.addEventListener("change", previewCodeLineNumbers);
    $("#settings-dialog").addEventListener("close", closeSettings);
    $("#settings-login-button").addEventListener("click", loginFromSettings);
    $("#account-button").addEventListener("click", openAccount);
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
      applyTheme,
      applyCodeSettings,
      renderRepoSelector,
      renderSettingsRepoList,
      switchRepository,
      addRepository,
      changeTheme,
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
    initialized: false,
    reading: null,
    listScroll: 0,
    paneScroll: 0,
    treeScroll: 0
  };
  var active2 = null;
  var instanceId = 0;
  function element2(tag, className, text3) {
    const el3 = document.createElement(tag);
    if (className) el3.className = className;
    if (text3 !== void 0) el3.textContent = String(text3);
    return el3;
  }
  function button3(text3, className, action2) {
    const el3 = element2("button", className, text3);
    el3.type = "button";
    el3.addEventListener("click", action2);
    return el3;
  }
  function isDirectory(node2) {
    return node2.kind === "directory" || node2.kind === "category" || node2.color === "parent";
  }
  function levelOf(node2) {
    return isDirectory(node2) ? void 0 : LEVELS.find((level) => level.id === node2.color);
  }
  function attributesOf(node2) {
    return [.../* @__PURE__ */ new Set([...Array.isArray(node2.attributes) ? node2.attributes : [], ...ATTRIBUTES[node2.color] ? [node2.color] : []])].filter((key) => ATTRIBUTES[key]);
  }
  function tagsOf(note) {
    return Array.isArray(note.tags) ? note.tags.map(String) : [];
  }
  function noteKey(note) {
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
      scope: state3.scope
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
    function index(node2, parent, depth, path) {
      const entry2 = { node: node2, parent, depth, path: path.concat(String(node2.label || "未命名节点")), descendants: 0 };
      byId.set(node2.id, entry2);
      (node2.legacyIds || []).forEach((id) => {
        if (!byId.has(id)) byId.set(id, entry2);
      });
      all.push(entry2);
      (node2.children || []).forEach((child) => {
        index(child, node2.id, depth + 1, entry2.path);
        entry2.descendants += 1 + byId.get(child.id).descendants;
      });
    }
    index(root2, null, 0, []);
    if (!state3.initialized) {
      state3.expanded.add(root2.id);
      state3.initialized = true;
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
      const canonicalId = byId.get(note.nodeId)?.node.id;
      return canonicalId && canonicalId !== note.nodeId ? { ...note, nodeId: canonicalId } : note;
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
    expandAncestors(state3.selectedNode);
    if (state3.reading && !notes.some((note) => noteKey(note) === state3.reading)) state3.reading = null;
    const shell = element2("section", "alg-browser");
    shell.setAttribute("aria-label", "算法知识与笔记浏览器");
    const uid = `alg-browser-${++instanceId}`;
    const top = element2("header", "alg-toolbar");
    const brand = element2("div", "alg-brand");
    brand.append(element2("span", "alg-eyebrow", "KNOWLEDGE EXPLORER"), element2("h2", "alg-title", "算法知识库"));
    const scopeSwitch = element2("div", "alg-scope");
    scopeSwitch.setAttribute("role", "group");
    scopeSwitch.setAttribute("aria-label", "笔记范围");
    ["public", "personal"].forEach((scope2) => {
      const control2 = button3(scope2 === "public" ? "公开笔记" : "我的笔记", "alg-scope-button", () => {
        if (scope2 === state3.scope) return;
        if (typeof opts.onScopeChange === "function") opts.onScopeChange(scope2);
        else if (scope2 !== "personal" || opts.account) {
          state3.scope = scope2;
          state3.reading = null;
          render4({ ...opts, scope: scope2 });
        }
      });
      control2.setAttribute("aria-pressed", String(scope2 === state3.scope));
      scopeSwitch.append(control2);
    });
    const uploadWrap = element2("div", "alg-upload-wrap");
    const upload = button3("＋ 上传笔记", "alg-button alg-button-primary", () => {
      if (!opts.canUpload || !opts.account || typeof opts.onUpload !== "function") return;
      if (typeof opts.onSelect === "function") opts.onSelect(state3.selectedNode);
      opts.onUpload(state3.selectedNode);
    });
    upload.disabled = !opts.canUpload || !opts.account || typeof opts.onUpload !== "function";
    upload.id = "algorithm-upload-button";
    uploadWrap.append(upload);
    if (upload.disabled) {
      const explanation = element2("span", "alg-upload-hint", opts.account ? "需要仓库写入权限才能上传" : "登录具有写入权限的账户后可上传");
      explanation.id = `${uid}-upload-hint`;
      upload.setAttribute("aria-describedby", explanation.id);
      uploadWrap.append(explanation);
    }
    top.append(brand, scopeSwitch, uploadWrap);
    const filters = element2("section", "alg-filters");
    filters.setAttribute("aria-label", "检索与筛选");
    const searchRow = element2("div", "alg-search-row");
    const searchWrap = element2("label", "alg-search-wrap");
    const searchIcon = element2("span", "alg-search-icon", "⌕");
    searchIcon.setAttribute("aria-hidden", "true");
    const search = element2("input", "alg-search");
    search.type = "search";
    search.value = state3.draftSearch;
    search.placeholder = "搜索算法、路径、笔记标题、标签或作者";
    search.setAttribute("aria-label", "搜索算法、路径、笔记标题、标签或作者");
    searchWrap.append(searchIcon, search);
    const attributeLabel = element2("label", "alg-attribute-label", "属性");
    const attribute = element2("select", "alg-attribute");
    attribute.setAttribute("aria-label", "按类型或使用频率筛选");
    [["", "全部属性"], ...Object.entries(ATTRIBUTES)].forEach(([value, label]) => {
      const option = element2("option", "", label);
      option.value = value;
      attribute.append(option);
    });
    attribute.value = state3.draftAttribute;
    attributeLabel.append(attribute);
    const submitSearch = button3("搜索", "alg-button alg-button-primary alg-search-submit", applySearch);
    const clear = button3("清除筛选", "alg-text-button alg-clear", () => {
      state3.search = "";
      state3.level = "";
      state3.attribute = "";
      state3.draftSearch = "";
      state3.draftLevel = "";
      state3.draftAttribute = "";
      state3.reading = null;
      search.value = "";
      attribute.value = "";
      refresh();
      search.focus();
    });
    searchRow.append(searchWrap, submitSearch, attributeLabel, clear);
    const legend = element2("div", "alg-legend");
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
    const allLevel = button3(`全部 ${all.length}`, "alg-legend-button alg-tone-neutral", () => {
      state3.draftLevel = "";
      updateDraftControls();
    });
    allLevel.dataset.level = "";
    legendButtons.push(allLevel);
    legend.append(allLevel);
    [...LEVELS, ...levelCounts.get("unrated") ? [{ id: "unrated", label: "未分级", tone: "neutral", number: "—" }] : []].forEach((level) => {
      const control2 = button3("", `alg-legend-button alg-tone-${level.tone}`, () => {
        state3.draftLevel = state3.draftLevel === level.id ? "" : level.id;
        updateDraftControls();
      });
      control2.dataset.level = level.id;
      control2.append(element2("span", "alg-legend-dot"), element2("span", "", `${level.number} ${level.label}`), element2("span", "alg-legend-count", levelCounts.get(level.id)));
      control2.title = `${level.label}：${levelCounts.get(level.id)} 个节点；点击筛选，再次点击取消`;
      legendButtons.push(control2);
      legend.append(control2);
    });
    const searchHint = element2("p", "alg-tier-hint alg-search-hint");
    searchHint.append(element2("strong", "", "点击搜索按钮才会进行跳转哦，也可以按回车确认。"));
    searchHint.id = `${uid}-search-hint`;
    search.setAttribute("aria-describedby", searchHint.id);
    filters.append(searchRow, searchHint, legend, element2("p", "alg-tier-hint", "目录用于组织知识和保存说明，不设难度。难度筛选只匹配具体算法与知识点，并保留其上级目录。模板、常用、低频是独立属性。"));
    const workspace = element2("div", "alg-workspace");
    const sidebar = element2("aside", "alg-sidebar");
    const treeHeading = element2("div", "alg-tree-heading");
    const treeStatus = element2("span", "alg-tree-status");
    treeHeading.append(element2("strong", "", "知识目录"), treeStatus);
    const treeScroller = element2("div", "alg-tree-scroll");
    const tree = element2("div", "alg-tree");
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "算法知识目录");
    tree.setAttribute("aria-describedby", `${uid}-tree-help`);
    treeScroller.append(tree);
    const treeHelp = element2("p", "alg-tree-help", "↑ ↓ 移动 · ← → 折叠 / 展开 · Enter 查看");
    treeHelp.id = `${uid}-tree-help`;
    sidebar.append(treeHeading, treeScroller, treeHelp);
    const pane = element2("section", "alg-pane");
    pane.setAttribute("aria-label", "算法与笔记详情");
    pane.tabIndex = -1;
    const live = element2("span", "alg-sr-only");
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
    function detailPath() {
      const reading = state3.reading && notes.find((note) => noteKey(note) === state3.reading);
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
    function badge(node2) {
      if (isDirectory(node2)) {
        const directory = element2("span", "alg-node-kind", "目录");
        directory.title = "目录可保存说明和笔记，具体算法在子节点中分级";
        return directory;
      }
      const level = levelOf(node2);
      const el3 = element2("span", `alg-badge alg-tone-${level ? level.tone : "neutral"}`, level ? level.label : node2.color === "parent" ? "目录" : "未分级");
      const origin = node2.difficultySource?.kind === "user-md" ? "用户颜色文档" : node2.rating?.type === "category" ? "分类基础门槛" : node2.rating?.type === "entry" ? "入口或任务形式" : "本项目逐项定稿";
      const range = node2.rating?.range;
      const coverage2 = range && node2.children?.length ? `；覆盖 D${range.min}–D${range.max}` : "";
      el3.title = level ? `学习难度：${level.label}；依据：${origin}${coverage2}${node2.scope ? `。学习范围：${node2.scope}` : ""}${node2.rationale ? `。${node2.rationale}` : ""}` : node2.color === "parent" ? "目录" : "未指定难度";
      return el3;
    }
    function attributeBadge(node2) {
      const names = attributesOf(node2).map((key) => ATTRIBUTES[key]);
      return names.length ? element2("span", "alg-attribute-badge", names.join(" · ")) : null;
    }
    function pathOf(id) {
      return byId.get(id)?.path.join(" / ") || "未关联目录";
    }
    function matchesFacets(node2) {
      const level = levelOf(node2);
      return (!state3.level || !isDirectory(node2) && (state3.level === "unrated" ? !level : node2.color === state3.level)) && (!state3.attribute || attributesOf(node2).includes(state3.attribute));
    }
    const relevance = AlgorithmDirectory;
    const topicScores = /* @__PURE__ */ new Map();
    function computeResults() {
      const q = state3.search.trim();
      topicScores.clear();
      filtering = Boolean(q || state3.level || state3.attribute);
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
        if (!filtering || matchesFacets(entry2.node) && (score2 > 0 || noteNodes.has(entry2.node.id))) matched.add(entry2.node.id);
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
      if (!byId.has(id)) return;
      expandedReader?.close();
      state3.selectedNode = id;
      state3.reading = null;
      state3.listScroll = 0;
      state3.paneScroll = 0;
      focusedId = id;
      expandAncestors(id);
      const oldScroll = treeScroller.scrollTop;
      renderTree();
      treeScroller.scrollTop = oldScroll;
      renderPane();
      pane.scrollTop = 0;
      if (typeof opts.onSelect === "function") opts.onSelect(id);
      if (focusPane) pane.focus({ preventScroll: true });
    }
    function focusRow(id) {
      focusedId = id;
      tree.querySelectorAll('[role="treeitem"]').forEach((row2) => {
        row2.tabIndex = row2.dataset.nodeId === id ? 0 : -1;
      });
      const target = Array.from(tree.querySelectorAll('[role="treeitem"]')).find((row2) => row2.dataset.nodeId === id);
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
      tree.replaceChildren();
      visible = [];
      const hasResults = included.size > 0;
      if (!hasResults) {
        tree.append(element2("p", "alg-tree-empty", "没有匹配的目录或笔记。试试更短的关键词，或清除筛选。"));
      } else {
        let walk2 = function(entry2, group, position, size) {
          if (!included.has(entry2.node.id)) return;
          const kids = (entry2.node.children || []).filter((child) => included.has(child.id));
          const item = element2("div", "alg-tree-item");
          item.setAttribute("role", "treeitem");
          item.dataset.nodeId = entry2.node.id;
          item.dataset.depth = String(entry2.depth);
          item.dataset.kind = entry2.node.color === "parent" ? "directory" : "topic";
          item.setAttribute("aria-level", String(entry2.depth + 1));
          item.setAttribute("aria-posinset", String(position));
          item.setAttribute("aria-setsize", String(size));
          item.setAttribute("aria-selected", String(state3.selectedNode === entry2.node.id));
          item.setAttribute("aria-label", `${entry2.node.label}，${levelOf(entry2.node)?.label || (entry2.node.color === "parent" ? "目录" : "未分级")}${attributesOf(entry2.node).length ? `，${attributesOf(entry2.node).map((key) => ATTRIBUTES[key]).join("、")}` : ""}，${counts.get(entry2.node.id)} 篇笔记`);
          item.tabIndex = -1;
          if (kids.length) item.setAttribute("aria-expanded", String(isExpanded(entry2.node.id)));
          const row2 = element2("div", "alg-tree-row");
          row2.style.setProperty("--alg-depth", String(entry2.depth));
          if (kids.length) {
            const disclosure = button3(isExpanded(entry2.node.id) ? "▾" : "▸", "alg-disclosure", (event) => {
              event.stopPropagation();
              toggle(entry2.node.id, !isExpanded(entry2.node.id));
            });
            disclosure.tabIndex = -1;
            disclosure.setAttribute("aria-label", `${isExpanded(entry2.node.id) ? "折叠" : "展开"} ${entry2.node.label}`);
            row2.append(disclosure);
          } else {
            const spacer = element2("span", "alg-disclosure alg-leaf", "·");
            spacer.setAttribute("aria-hidden", "true");
            row2.append(spacer);
          }
          const copy = element2("span", "alg-tree-copy");
          copy.append(element2("span", "alg-tree-label", entry2.node.label));
          const metadata2 = element2("span", "alg-tree-meta");
          metadata2.append(badge(entry2.node));
          const attr = attributeBadge(entry2.node);
          if (attr) metadata2.append(attr);
          copy.append(metadata2);
          row2.append(copy);
          const count = element2("span", "alg-node-count", counts.get(entry2.node.id));
          count.title = "当前范围内含子目录的笔记总数";
          row2.append(count);
          row2.title = `${entry2.path.join(" / ")}${entry2.node.fullLabel && entry2.node.fullLabel !== entry2.node.label ? `
${entry2.node.fullLabel}` : ""}`;
          if (opts.canManage && typeof opts.onAddTopic === "function") {
            const add2 = button3("＋", "alg-add-topic", (event) => {
              event.stopPropagation();
              opts.onAddTopic(entry2.node.id);
            });
            add2.title = `在“${entry2.node.label}”下添加算法`;
            add2.setAttribute("aria-label", add2.title);
            row2.append(add2);
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
            const childGroup = element2("div", "alg-tree-group");
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
      const nav = element2("nav", "alg-breadcrumbs");
      nav.setAttribute("aria-label", "当前算法路径");
      const ancestors = [];
      let entry2 = byId.get(id);
      while (entry2) {
        ancestors.unshift(entry2);
        entry2 = byId.get(entry2.parent);
      }
      ancestors.forEach((ancestor, i) => {
        if (i) {
          const separator = element2("span", "alg-crumb-separator", "/");
          separator.setAttribute("aria-hidden", "true");
          nav.append(separator);
        }
        const crumb = button3(ancestor.node.label, "alg-crumb", () => selectNode(ancestor.node.id));
        if (i === ancestors.length - 1) crumb.setAttribute("aria-current", "page");
        nav.append(crumb);
      });
      return nav;
    }
    function noteMetadata(note) {
      const meta = element2("div", "alg-note-meta");
      if (note.featured) meta.append(element2("span", "alg-featured", "精选"));
      meta.append(element2("span", "alg-note-author", nameOf(note.author)));
      const date = dateOf(note.updatedAt || note.createdAt);
      if (date) meta.append(element2("span", "", date));
      return meta;
    }
    function noteTags(note) {
      const tags = element2("div", "alg-note-tags");
      tagsOf(note).forEach((tag) => tags.append(element2("span", "alg-tag", tag)));
      return tags;
    }
    function openNote(note) {
      state3.listScroll = pane.scrollTop;
      state3.reading = noteKey(note);
      state3.paneScroll = 0;
      renderPane();
      pane.scrollTop = 0;
      pane.querySelector(".alg-reading-title")?.focus({ preventScroll: true });
    }
    function noteCard(note, globalResult) {
      const card = button3("", `alg-note-card${note.featured ? " alg-note-featured" : ""}`, () => openNote(note));
      card.append(noteMetadata(note), element2("h4", "alg-note-title", note.title || "未命名笔记"));
      const preview = excerpt(note.body);
      if (preview) card.append(element2("p", "alg-note-excerpt", preview));
      card.append(noteTags(note));
      if (globalResult) card.append(element2("span", "alg-note-path", pathOf(note.nodeId)));
      return card;
    }
    function heading(title, count) {
      const row2 = element2("div", "alg-section-heading");
      row2.append(element2("h3", "", title));
      if (count !== void 0) row2.append(element2("span", "alg-section-count", count));
      return row2;
    }
    function topicCard(entry2) {
      const card = button3("", "alg-topic-card", () => selectNode(entry2.node.id));
      const name = element2("div", "alg-topic-name");
      name.append(element2("strong", "", entry2.node.label), element2("span", "alg-card-arrow", "↗"));
      const meta = element2("div", "alg-topic-meta");
      meta.append(badge(entry2.node));
      const attr = attributeBadge(entry2.node);
      if (attr) meta.append(attr);
      card.append(name, meta, element2("span", "alg-topic-count", `${entry2.descendants} 个子节点 · ${counts.get(entry2.node.id)} 篇笔记`));
      return card;
    }
    function renderPane() {
      expandedReader?.setPath(detailPath());
      pane.replaceChildren();
      const selected2 = byId.get(state3.selectedNode);
      const reading = state3.reading && notes.find((note) => noteKey(note) === state3.reading);
      if (reading) {
        const back = button3("← 返回目录与笔记", "alg-text-button alg-reader-back", () => {
          state3.reading = null;
          renderPane();
          pane.scrollTop = state3.listScroll;
          pane.querySelector(".alg-detail-title")?.focus({ preventScroll: true });
        });
        const actions = element2("div", "reading-detail-actions");
        actions.append(back, button3("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
        pane.append(actions, breadcrumbs(reading.nodeId));
        const article = element2("article", "alg-reading");
        const title2 = element2("h2", "alg-reading-title", reading.title || "未命名笔记");
        title2.tabIndex = -1;
        article.append(title2, noteMetadata(reading), noteTags(reading));
        const body = element2("div", "alg-markdown markdown-body");
        if (typeof opts.renderMarkdown === "function") opts.renderMarkdown(body, String(reading.body || ""));
        else body.textContent = String(reading.body || "");
        article.append(body);
        if (byId.has(reading.nodeId)) article.append(button3(`在目录中查看：${byId.get(reading.nodeId).node.label}`, "alg-text-button alg-note-location", () => selectNode(reading.nodeId)));
        pane.append(article);
        return;
      }
      pane.append(breadcrumbs(selected2.node.id));
      const detail = element2("header", "alg-detail-heading");
      const detailBar = element2("div", "alg-detail-toolbar");
      detailBar.append(element2("span", "alg-eyebrow", selected2.node.id === root2.id ? "知识目录" : "知识节点"), button3("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
      detail.append(detailBar);
      const titleRow = element2("div", "alg-detail-title-row");
      const title = element2("h2", "alg-detail-title", selected2.node.fullLabel || selected2.node.label);
      title.tabIndex = -1;
      titleRow.append(title, badge(selected2.node));
      const attr = attributeBadge(selected2.node);
      if (attr) titleRow.append(attr);
      detail.append(titleRow, element2("p", "alg-detail-stats", `${selected2.descendants} 个子节点 · ${counts.get(selected2.node.id)} 篇笔记（含子目录）`));
      const information = element2("section", "alg-node-information");
      if (selected2.node.id === root2.id) information.append(element2("p", "alg-intro", "从一条知识主线出发，逐步建立你的算法体系。展开左侧目录，或选择下方分类；每个节点都可以阅读和积累学习笔记。"));
      if (isDirectory(selected2.node)) information.append(element2("p", "alg-intro", selected2.node.scope || "此目录用于分类、专题说明和学习笔记，具体算法及难度请查看子节点。"));
      if (levelOf(selected2.node) && selected2.node.difficultySource) {
        const origin = selected2.node.difficultySource.kind === "user-md" ? "难度依据：用户颜色文档" : selected2.node.rating?.type === "category" ? "难度依据：分类基础学习门槛" : selected2.node.rating?.type === "entry" ? "难度依据：入口或任务形式的使用门槛" : "难度依据：本项目逐项定稿";
        const range = selected2.node.rating?.range;
        information.append(element2("p", "alg-intro", `${origin}${range && selected2.node.children?.length ? `；覆盖 D${range.min}–D${range.max}` : ""}${selected2.node.rationale ? `。${selected2.node.rationale}` : ""}${selected2.node.scope ? ` 学习范围：${selected2.node.scope}` : ""}`));
      }
      const utilities = element2("footer", "alg-detail-utilities");
      if (opts.canManage && typeof opts.onAddTopic === "function") utilities.append(button3("＋ 添加算法", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onAddTopic(selected2.node.id);
      }));
      if (typeof opts.onLearningPath === "function") utilities.append(button3("在学习路径中查看 →", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onLearningPath(selected2.node.id);
      }));
      function appendInformation() {
        if (information.childNodes.length) pane.append(information);
        if (utilities.childNodes.length) pane.append(utilities);
      }
      pane.append(detail);
      if (filtering) {
        if (selected2.node.id !== root2.id) {
          const selectedChildren = (selected2.node.children || []).filter((child) => matched.has(child.id));
          const selectedNotes = matchingNotes.filter((note) => note.nodeId === selected2.node.id);
          pane.append(heading("当前节点的笔记", selectedNotes.length));
          if (selectedNotes.length) {
            const selectedList = element2("div", "alg-note-list alg-selected-note-list");
            selectedNotes.forEach((note) => selectedList.append(noteCard(note, false)));
            pane.append(selectedList);
          } else pane.append(element2("p", "alg-inline-empty", "当前节点尚无笔记；下方保留所有全局匹配结果。"));
          if (selectedChildren.length) {
            pane.append(heading("当前节点 · 继续探索", selectedChildren.length));
            const childrenGrid = element2("div", "alg-topic-grid");
            selectedChildren.forEach((child) => childrenGrid.append(topicCard(byId.get(child.id))));
            pane.append(childrenGrid);
          }
        }
        const resultSummary = element2("div", "alg-result-summary");
        resultSummary.append(element2("strong", "", "全局筛选结果"), element2("span", "", `${matched.size} 个节点 · ${matchingNotes.length} 篇笔记`));
        pane.append(resultSummary);
        const topicMatches = all.filter((entry2) => matched.has(entry2.node.id)).sort((a, b) => (topicScores.get(b.node.id) || 0) - (topicScores.get(a.node.id) || 0));
        if (topicMatches.length) {
          pane.append(heading("匹配的知识节点", topicMatches.length));
          const resultTopics = element2("div", "alg-result-topics");
          topicMatches.forEach((entry2) => {
            const row2 = button3("", "alg-result-topic", () => selectNode(entry2.node.id));
            row2.append(element2("span", "alg-result-topic-name", entry2.node.label), badge(entry2.node), element2("span", "alg-result-topic-path", entry2.path.join(" / ")));
            const attributeTag = attributeBadge(entry2.node);
            if (attributeTag) row2.append(attributeTag);
            resultTopics.append(row2);
          });
          pane.append(resultTopics);
        }
        pane.append(heading("匹配的笔记", matchingNotes.length));
        if (matchingNotes.length) {
          const list2 = element2("div", "alg-note-list");
          matchingNotes.forEach((note) => list2.append(noteCard(note, true)));
          pane.append(list2);
        } else pane.append(element2("p", "alg-inline-empty", "当前范围内没有匹配的笔记。可以尝试算法名称、笔记标题、作者或标签。"));
        if (!topicMatches.length && !matchingNotes.length) pane.append(button3("清除全部筛选", "alg-button", () => clear.click()));
        appendInformation();
        return;
      }
      const children = selected2.node.children || [];
      const direct = sortedNotes.filter((note) => note.nodeId === selected2.node.id);
      const featured = direct.filter((note) => note.featured), ordinary = direct.filter((note) => !note.featured);
      const notesHeading = () => heading(state3.scope === "personal" ? "我的节点笔记" : "节点笔记", ordinary.length);
      if (featured.length) {
        const section = element2("section", "alg-featured-section");
        section.append(heading("精选笔记", featured.length));
        const list2 = element2("div", "alg-note-list");
        featured.forEach((note) => list2.append(noteCard(note, false)));
        section.append(list2);
        pane.append(section);
      }
      if (ordinary.length) {
        pane.append(notesHeading());
        const list2 = element2("div", "alg-note-list");
        ordinary.forEach((note) => list2.append(noteCard(note, false)));
        pane.append(list2);
      }
      if (children.length) {
        pane.append(heading(selected2.node.id === root2.id ? "选择知识主线" : "继续探索", children.length));
        const grid = element2("div", "alg-topic-grid");
        children.forEach((child) => grid.append(topicCard(byId.get(child.id))));
        pane.append(grid);
      }
      if (!direct.length) {
        pane.append(notesHeading());
        const empty = element2("div", "alg-empty");
        empty.append(
          element2("span", "alg-empty-symbol", "≡"),
          element2("strong", "", "这里的学习笔记，等待积累"),
          element2("p", "", state3.scope === "personal" ? "此节点还没有你的个人笔记。选择一个主题，记录思路、模板和复盘。" : "此节点还没有公开笔记。继续浏览子目录，或为这个主题补充一篇笔记。")
        );
        if (upload.disabled) empty.append(element2("span", "alg-empty-hint", opts.account ? "上传笔记需要仓库写入权限。" : "登录具有写入权限的账户后，即可上传算法笔记。"));
        else empty.append(button3("＋ 为此节点上传笔记", "alg-button", () => upload.click()));
        pane.append(empty);
      }
      appendInformation();
    }
    function refresh() {
      if (disposed) return;
      const oldScroll = treeScroller.scrollTop;
      state3.expanded.forEach((key) => {
        if (String(key).startsWith("collapsed-filter:")) state3.expanded.delete(key);
      });
      computeResults();
      updateDraftControls();
      clear.hidden = !filtering;
      renderTree();
      treeScroller.scrollTop = oldScroll;
      renderPane();
      pane.scrollTop = 0;
      live.textContent = filtering ? `找到 ${matched.size} 个知识节点、${matchingNotes.length} 篇笔记` : `${all.length} 个知识节点、${notes.length} 篇笔记`;
    }
    function updateDraftControls() {
      legendButtons.forEach((control2) => control2.setAttribute("aria-pressed", String(control2.dataset.level === state3.draftLevel)));
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
      refresh();
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
        search.value = "";
        attribute.value = "";
        selectNode(id);
        refresh();
      },
      getState: snapshot,
      openNote(note, { fullscreen = false } = {}) {
        const found = notes.find((item) => noteKey(item) === noteKey(note));
        if (!found) return;
        openNote(found);
        if (fullscreen) openDetail();
      },
      destroy() {
        if (disposed) return;
        expandedReader?.close();
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

  // src/renderer/algorithms/learning-path.ts
  function present(value) {
    return value !== null && value !== void 0;
  }
  function errorMessage(error, fallback) {
    return String(error?.message || fallback);
  }
  var views = /* @__PURE__ */ new Map();
  var serial = 0;
  var kinds = { learning: "学习关", mixed: "综合练习", challenge: "阶段挑战" };
  var grades = { basic: ["D1 · 入门", "basic"], beginner: ["D2 · 初级", "beginner"], intermediate: ["D3 · 中级", "intermediate"], advanced: ["D4 · 高级", "advanced"], expert: ["D5 · 挑战", "expert"] };
  function el2(tag, className, text3) {
    const node2 = document.createElement(tag);
    if (className) node2.className = className;
    if (text3 !== void 0 && text3 !== null) node2.textContent = String(text3);
    return node2;
  }
  function add(parent, ...children) {
    children.forEach((child) => {
      if (child) parent.append(child);
    });
    return parent;
  }
  function control(text3, className, action2) {
    const node2 = el2("button", className, text3);
    node2.type = "button";
    node2.addEventListener("click", action2);
    return node2;
  }
  function list(value) {
    return Array.isArray(value) ? value : [];
  }
  function text2(value) {
    return typeof value === "string" ? value : "";
  }
  function cfLabel(value) {
    if (!value || !Number.isFinite(value.min)) return "按关卡目标选题";
    return `CF ${value.min}${Number.isFinite(value.max) ? value.max === value.min ? "" : `–${value.max}` : "+"}`;
  }
  function authorName(author) {
    if (typeof author === "string") return author;
    const value = author;
    return text2(value?.name) || text2(value?.login) || "未署名";
  }
  function render5(options) {
    if (!options?.host) throw new TypeError("NotebookLearningPath.render requires a host.");
    const opts = options, host = opts.host, uid = `alp-${++serial}`;
    const stages = list(opts.curriculum?.stages).filter((stage) => stage && typeof stage.id === "string");
    const stageById = /* @__PURE__ */ new Map(), gateById = /* @__PURE__ */ new Map(), topics = /* @__PURE__ */ new Map();
    stages.forEach((stage, stageIndex) => {
      stageById.set(stage.id, { stage, index: stageIndex });
      list(stage.gates).forEach((gate, gateIndex) => {
        if (gate && typeof gate.id === "string") gateById.set(gate.id, { gate, stage, stageIndex, index: gateIndex });
      });
    });
    function walk(node2, path) {
      if (!node2 || typeof node2.id !== "string") return;
      const entry2 = { node: node2, path: [...path, text2(node2.label) || "未命名知识点"] };
      topics.set(node2.id, entry2);
      list(node2.legacyIds).forEach((id) => topics.set(id, entry2));
      list(node2.children).forEach((child) => walk(child, entry2.path));
    }
    walk(opts.tree, []);
    for (const [id, entry2] of topics) {
      if (entry2.node.kind !== "directory") continue;
      const concrete = list(entry2.node.children).find((child) => child.contentOf === entry2.node.id && child.kind === "algorithm");
      if (concrete && topics.has(concrete.id)) topics.set(id, topics.get(concrete.id));
    }
    const sharedNotes = list(opts.notes).filter((note) => note?.noteScope === "public" && topics.has(note.nodeId));
    const viewKey = text2(opts.progressKey) || `${opts.account?.id ?? "local"}:${text2(opts.curriculum?.id) || "main"}`;
    const remembered = views.get(viewKey);
    let progress = { ...opts.progress || {}, gates: { ...opts.progress?.gates || {} } };
    let stageId = stageById.has(remembered?.stageId) ? remembered.stageId : stageById.has(progress.stageId) ? progress.stageId : stages[0]?.id;
    let gateId = gateById.has(remembered?.gateId) && gateById.get(remembered.gateId).stage.id === stageId ? remembered.gateId : gateById.has(progress.gateId) && gateById.get(progress.gateId).stage.id === stageId ? progress.gateId : null;
    let destroyed = false, busy2 = false, celebrationTimer, saveError = "";
    let root2, routeScroll, detail, summary, stageButton;
    let stageDialog, evidenceDialog, shareDialog;
    let evidenceForm, evidenceError, evidenceGateId = null;
    let previousFocus, lastCelebrated = null;
    let detailController = null;
    const canSave = typeof opts.onProgress === "function";
    const records = () => [...gateById.values()];
    const gateProgress = (id) => {
      const value = progress.gates[id];
      if (!value || typeof value !== "object" && typeof value !== "function") return null;
      const record = value;
      return record.status === "learning" || record.status === "completed" ? record : null;
    };
    const isCompleted = (id) => gateProgress(id)?.status === "completed";
    const completedCount = (gates) => list(gates).filter((gate) => isCompleted(gate.id)).length;
    const validGates = (stage) => list(stage.gates).filter((gate) => gateById.has(gate.id));
    function stageCurrent(stage) {
      const gates = validGates(stage);
      return gates.find((gate) => gateProgress(gate.id)?.status === "learning") || gates.find((gate) => !isCompleted(gate.id)) || gates[0];
    }
    function currentEntry() {
      return gateById.get(gateId);
    }
    function remember() {
      views.set(viewKey, { stageId, gateId });
    }
    if (!gateId) gateId = stages.length ? stageCurrent(stageById.get(stageId).stage)?.id : null;
    function notify(message) {
      if (typeof opts.toast === "function") opts.toast(message);
    }
    function nodeButton(entry2, label, className = "alp-topic-link") {
      const button4 = control(label || entry2.node.label, className, () => opts.onTopic?.(entry2.node.id));
      button4.title = `${entry2.path.join(" / ")}${entry2.node.fullLabel && entry2.node.fullLabel !== entry2.node.label ? ` · ${entry2.node.fullLabel}` : ""}`;
      button4.disabled = typeof opts.onTopic !== "function";
      return button4;
    }
    function isOrientation(stage) {
      return stage.type === "orientation";
    }
    function learningPosition(stage, cf = stage.cf) {
      return isOrientation(stage) ? "入门导览" : cfLabel(cf);
    }
    function rangeTags(parent, cf, luogu, orientation = false) {
      if (orientation) {
        parent.append(el2("span", "alp-range", "入门导览"));
        return;
      }
      add(parent, el2("span", "alp-range alp-range-cf", cfLabel(cf)));
      if (list(luogu).length) parent.append(el2("span", "alp-range", `洛谷参考：${list(luogu).join(" / ")}`));
    }
    function statusOf(gate, stage) {
      if (isCompleted(gate.id)) return "completed";
      return gateProgress(gate.id)?.status === "learning" || stageCurrent(stage)?.id === gate.id ? "learning" : "todo";
    }
    function stageNumber(stage) {
      return Number.isInteger(stage.index) ? stage.index : stageById.get(stage.id).index + 1;
    }
    function gateNumber(gate) {
      return gateById.get(gate.id).index + 1;
    }
    function selectGate(id, { focus = false, center = true } = {}) {
      const entry2 = gateById.get(id);
      if (!entry2 || destroyed || busy2) return false;
      stageId = entry2.stage.id;
      gateId = entry2.gate.id;
      saveError = "";
      remember();
      renderMain({ center });
      if (focus) (detailController ? detail.querySelector(".alp-gate-title") : root2.querySelector('.alp-checkpoint[aria-pressed="true"]'))?.focus({ preventScroll: true });
      return true;
    }
    function renderSummary() {
      summary.replaceChildren();
      const done = records().filter(({ gate }) => isCompleted(gate.id)).length;
      for (const [value, label] of [[`${stages.length} 阶段`, "以综合做题能力为目标"], [`${gateById.size} 关`, "先广后深 · 学习与混练"], [`${done} / ${gateById.size}`, "已记录完成的关卡"]]) {
        const stat = el2("div", "alp-stat");
        add(stat, el2("strong", "", value), el2("span", "", label));
        summary.append(stat);
      }
      const resumed = records().find(({ gate }) => gateProgress(gate.id)?.status === "learning") || records().find(({ gate }) => !isCompleted(gate.id));
      if (resumed) summary.append(control(`继续 第${stageNumber(resumed.stage)}章 · 第${gateNumber(resumed.gate)}关 →`, "alp-button alp-button-primary alp-resume", () => selectGate(resumed.gate.id, { focus: true })));
      else summary.append(el2("span", "alp-all-complete", "✓ 已完成全部关卡记录，可随时回顾"));
    }
    function renderAchievements() {
      const container = root2.querySelector(".alp-achievements");
      container.replaceChildren();
      const completed = records().filter(({ gate }) => isCompleted(gate.id));
      const finishedStage = stages.some((stage) => validGates(stage).length && completedCount(validGates(stage)) === validGates(stage).length);
      const reflectionCount = records().filter(({ gate }) => text2(gateProgress(gate.id)?.reflection).trim()).length;
      const items = [
        ["迈出第一步", completed.length > 0, "完成第一关的学习记录"],
        ["综合初试", completed.some(({ gate }) => ["mixed", "challenge"].includes(gate.kind || "")), "完成一次综合练习或阶段挑战"],
        ["章节里程碑", finishedStage, "完成一章的全部关卡记录"],
        ["复盘积累", reflectionCount >= 3, `为至少 3 关留下复盘，当前 ${reflectionCount} 关`]
      ];
      container.append(el2("span", "alp-achievement-heading", "我的学习足迹"));
      items.forEach(([label, earned, description]) => {
        const badge = el2("span", "alp-achievement", `${earned ? "✓" : "○"} ${label}`);
        badge.dataset.earned = String(earned);
        badge.title = description;
        container.append(badge);
      });
    }
    function renderStagePicker() {
      const grid = stageDialog.querySelector(".alp-stage-grid");
      grid.replaceChildren();
      stages.forEach((stage) => {
        const gates = validGates(stage), done = completedCount(gates), complete = gates.length > 0 && done === gates.length;
        const card = control("", "alp-stage-card", () => {
          if (busy2) return;
          stageDialog.close();
          selectGate(stageCurrent(stage)?.id);
          stageButton.focus({ preventScroll: true });
        });
        card.dataset.stageId = stage.id;
        card.dataset.completed = String(complete);
        card.setAttribute("aria-current", String(stageId === stage.id));
        add(card, el2("span", "alp-stage-index", `${complete ? "✓ 已完成 · " : ""}第${stageNumber(stage)}章`), el2("strong", "alp-stage-name", stage.title), el2("span", "alp-stage-description", stage.description || stage.goal));
        const ranges = el2("div", "alp-ranges");
        rangeTags(ranges, stage.cf, stage.luoguDifficulty, isOrientation(stage));
        card.append(ranges);
        const bar = el2("progress", "alp-stage-progress");
        bar.max = gates.length || 1;
        bar.value = done;
        bar.setAttribute("aria-label", `第${stageNumber(stage)}章完成 ${done} / ${gates.length} 关`);
        add(card, el2("span", "alp-stage-count", `${done} / ${gates.length} 关已完成`), bar);
        grid.append(card);
      });
    }
    function openStagePicker() {
      if (busy2) return;
      renderStagePicker();
      previousFocus = stageButton;
      stageDialog.showModal();
      stageDialog.querySelector('[aria-current="true"]')?.focus();
    }
    function renderRoute(stage) {
      const route = el2("div", "alp-route");
      validGates(stage).forEach((gate) => {
        const status = statusOf(gate, stage), selected2 = gateId === gate.id;
        const row2 = control("", "alp-checkpoint", () => selectGate(gate.id, { focus: true, center: false }));
        row2.dataset.gateId = gate.id;
        row2.dataset.status = status;
        row2.dataset.kind = gate.kind || "learning";
        row2.setAttribute("aria-pressed", String(selected2));
        const statusText = status === "completed" ? "已完成" : gateProgress(gate.id)?.status === "learning" ? "学习中" : status === "learning" ? "下一关" : "未完成";
        row2.setAttribute("aria-label", `第${stageNumber(stage)}章 第${gateNumber(gate)}关 ${gate.title}，${statusText}${selected2 ? "，已选择" : ""}`);
        const symbol = status === "completed" ? "✓" : status === "learning" ? "▶" : String(gateNumber(gate));
        const copy = el2("span", "alp-checkpoint-copy");
        add(copy, el2("strong", "", `第${gateNumber(gate)}关 ${gate.title}`));
        if (gate.learningTitle) copy.append(el2("span", "alp-checkpoint-story", gate.learningTitle));
        copy.append(el2("span", "alp-checkpoint-subtitle", `${kinds[gate.kind || ""] || "学习关"}${gate.optional ? " · 选修" : ""} · ${learningPosition(stage, gate.cf || stage.cf)}`));
        add(row2, el2("span", "alp-checkpoint-number", symbol), copy, el2("span", "alp-checkpoint-status", `${status === "completed" ? "✓ " : status === "learning" ? "▶ " : "○ "}${statusText}`));
        route.append(row2);
        if (gate.kind === "mixed" || gate.kind === "challenge") {
          const checkpoint = el2("div", "alp-route-milestone");
          checkpoint.append(el2("span", "", gate.kind === "challenge" ? "阶段终点 · 完成独立解题与复盘" : "混合检验 · 回收前序知识"));
          route.append(checkpoint);
        }
      });
      routeScroll.replaceChildren(route);
    }
    function sectionHeading(title) {
      return el2("h4", "alp-section-title", title);
    }
    function renderDetail() {
      const entry2 = currentEntry();
      detail.replaceChildren();
      if (!entry2) return;
      const { gate, stage } = entry2, record = gateProgress(gate.id);
      const readingPath = [
        { label: "闯关学习", onClick() {
          detailController?.close();
        } },
        { label: `第${stageNumber(stage)}章 ${stage.title}`, onClick() {
          detailController?.close();
          openStagePicker();
        } },
        { label: `第${gateNumber(gate)}关 ${gate.title}` }
      ];
      detailController?.setPath(readingPath);
      const heading = el2("h3", "alp-gate-title", gate.title);
      heading.tabIndex = -1;
      const label = el2("div", "alp-detail-eyebrow", `第${stageNumber(stage)}章 · 第${gateNumber(gate)}关`);
      const header = el2("div", "alp-detail-header"), title = el2("div", "alp-detail-title");
      add(title, label, heading, el2("span", "alp-kind", `${kinds[gate.kind || ""] || "学习关"}${gate.optional ? " · 选修" : ""}`));
      const open2 = control("打开详情", "alp-button alp-button-secondary alp-detail-open-button reading-detail-trigger", () => {
        if (detailController || typeof ReadingDetail?.open !== "function") return;
        detailController = ReadingDetail.open({ content: detail, mount: host, title: "关卡详情", path: readingPath, onClose() {
          detailController = null;
        } });
      });
      add(header, title, open2);
      detail.append(header);
      const related = list(gate.topicIds).map((id) => topics.get(id)).filter(present);
      const notes = renderNotes(gate, related);
      const ranges = el2("div", "alp-ranges");
      rangeTags(ranges, gate.cf || stage.cf, gate.luoguDifficulty || stage.luoguDifficulty, isOrientation(stage));
      if (gate.learningTitle || gate.learningDescription) {
        const story = el2("div", "alp-learning-story");
        if (gate.learningTitle) story.append(el2("strong", "", gate.learningTitle));
        if (gate.learningDescription) story.append(el2("p", "", gate.learningDescription));
        detail.append(story);
      }
      add(detail, el2("p", "alp-description", gate.description || stage.description), ranges, !isOrientation(stage) && el2("p", "alp-fine-print", "题目难度用于选题；知识点等级单独显示，两者不作换算。"));
      const goals = list(gate.goals);
      if (goals.length) {
        detail.append(sectionHeading("本关目标"));
        const ul = el2("ul", "alp-goals");
        goals.forEach((goal) => ul.append(el2("li", "", goal)));
        detail.append(ul);
      }
      const actions = el2("div", "alp-actions");
      const complete = control(record?.status === "completed" ? "编辑完成记录" : "✓ 记录本关完成", "alp-button alp-button-primary alp-complete-button", () => openEvidence(gate.id));
      complete.disabled = busy2 || !canSave;
      actions.append(complete);
      const learning = control(record?.status === "completed" ? "撤销完成，设为学习中" : record?.status === "learning" ? "编辑学习记录" : "▶ 开始学习", "alp-button alp-button-secondary alp-learning-button", () => {
        if (record?.status === "learning") openEvidence(gate.id, "learning");
        else saveStatus(gate.id, "learning");
      });
      learning.disabled = busy2 || !canSave;
      actions.append(learning);
      add(detail, actions, el2("p", "alp-fine-print", "完成状态由自己记录，用于学习追踪；不代表系统判题通过。"));
      if (!canSave) detail.append(el2("p", "alp-inline-error", "当前无法保存学习进度，请稍后重试。"));
      if (saveError) {
        const error = el2("p", "alp-inline-error", saveError);
        error.setAttribute("role", "alert");
        detail.append(error);
      }
      detail.append(sectionHeading("关联知识点"));
      if (related.length) {
        const group = el2("div", "alp-topics");
        related.forEach((topic) => {
          const card = el2("div", "alp-topic");
          card.append(nodeButton(topic));
          const grade = grades[topic.node.color || ""];
          if (grade && topic.node.kind !== "directory") {
            const tag = el2("span", "alp-grade", grade[0]);
            tag.dataset.level = grade[1];
            card.append(tag);
          }
          group.append(card);
        });
        detail.append(group);
      } else detail.append(el2("p", "alp-fine-print", "此关的知识点正在整理，可先按学习目标练习。"));
      const thread = list(gate.threadGateIds).map((id) => gateById.get(id)).filter(present);
      if (thread.length) {
        detail.append(sectionHeading("把知识连成线"));
        const links = el2("div", "alp-thread");
        thread.forEach((item) => {
          const before = item.stageIndex < entry2.stageIndex || item.stageIndex === entry2.stageIndex && item.index < entry2.index;
          links.append(control(`${before ? "↩ 回顾" : "↗ 延伸"} · 第${stageNumber(item.stage)}章第${gateNumber(item.gate)}关 ${item.gate.title}`, "alp-prerequisite alp-thread-link", () => selectGate(item.gate.id, { focus: true })));
        });
        detail.append(links);
      }
      const requiredGates = list(gate.prerequisites?.gateIds).map((id) => gateById.get(id)).filter(present);
      const requiredTopics = list(gate.prerequisites?.topicIds).map((id) => topics.get(id)).filter(present);
      if (requiredGates.length || requiredTopics.length) {
        detail.append(sectionHeading("先修与回补"));
        const group = el2("div", "alp-prerequisites");
        requiredGates.forEach((required) => group.append(control(`${isCompleted(required.gate.id) ? "✓" : "↩"} 第${stageNumber(required.stage)}章·第${gateNumber(required.gate)}关 ${required.gate.title}`, "alp-prerequisite", () => selectGate(required.gate.id, { focus: true }))));
        requiredTopics.forEach((topic) => group.append(nodeButton(topic, `↩ ${topic.node.label}`, "alp-prerequisite")));
        add(detail, group, el2("p", "alp-fine-print", "先修是学习建议，可按实际掌握情况回补或跳学。"));
      }
      if (stage.goal) add(detail, sectionHeading(isOrientation(stage) ? "导览目标" : "阶段综合目标"), el2("p", "alp-stage-goal", stage.goal));
      if (list(stage.completionCriteria).length) {
        detail.append(sectionHeading(isOrientation(stage) ? "导览完成检验" : "阶段通关检验"));
        const criteria = el2("ul", "alp-goals alp-stage-criteria");
        list(stage.completionCriteria).forEach((criterion) => criteria.append(el2("li", "", criterion)));
        detail.append(criteria);
      }
      if (record) {
        detail.append(sectionHeading("我的本关记录"));
        const saved = el2("div", "alp-saved-record");
        saved.append(el2("strong", "", record.status === "completed" ? "✓ 已记录完成" : "▶ 学习中"));
        if (record.problemUrl) saved.append(el2("p", "alp-saved-url", record.problemUrl));
        if (record.reflection) saved.append(el2("p", "alp-saved-reflection", record.reflection));
        if (record.updatedAt && Number.isFinite(Date.parse(record.updatedAt))) saved.append(el2("span", "alp-saved-date", new Date(record.updatedAt).toLocaleString("zh-CN")));
        detail.append(saved);
      }
      const utilities = el2("footer", "alp-detail-utilities"), utilityActions = el2("div", "alp-utility-actions");
      const share = control("复制互助卡", "alp-button alp-button-secondary alp-share-button", () => openShare(gate.id));
      share.disabled = busy2;
      utilityActions.append(share);
      if (related[0] && typeof opts.onUpload === "function") {
        const upload = control("＋ 为本关知识点补充笔记", "alp-text-button alp-upload-button", () => {
          if (opts.canUpload !== false) opts.onUpload(related[0].node.id);
        });
        upload.disabled = opts.canUpload === false;
        if (upload.disabled) upload.title = "登录并获得仓库写入权限后可补充共享笔记";
        utilityActions.append(upload);
      }
      utilities.append(utilityActions);
      if (notes.length) {
        const authors = [...new Set(notes.map((note) => authorName(note.author)))];
        add(utilities, sectionHeading("相关笔记贡献者"), el2("p", "alp-contributors", authors.join(" · ")));
      }
      detail.append(utilities);
    }
    function renderNotes(gate, related) {
      const ids = new Set(related.map((topic) => topic.node.id));
      related.forEach((topic) => {
        if (topic.node.contentOf) ids.add(topics.get(topic.node.contentOf)?.node.id || topic.node.contentOf);
      });
      const notes = sharedNotes.filter((note) => ids.has(topics.get(note.nodeId)?.node.id)).slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
      detail.append(sectionHeading("相关公开笔记"));
      if (notes.length) {
        const noteList = el2("div", "alp-notes");
        notes.slice(0, 5).forEach((note) => {
          const topic = topics.get(note.nodeId);
          const noteButton = control("", `alp-note${note.featured ? " alp-note-featured" : ""}`, () => {
            if (typeof opts.onNote === "function") opts.onNote(note, { gateId: gate.id });
            else opts.onTopic?.(topic.node.id);
          });
          if (note.featured) noteButton.append(el2("span", "alp-note-featured-label", "精选"));
          add(noteButton, el2("strong", "", note.title || "未命名笔记"), el2("span", "", `${authorName(note.author)} · ${topic.node.label}`));
          noteButton.title = "打开笔记详情";
          noteList.append(noteButton);
        });
        detail.append(noteList);
      } else detail.append(el2("p", "alp-fine-print", "此关尚无相关公开笔记，可以分享自己的理解与复盘。"));
      return notes;
    }
    function renderMain({ center = false } = {}) {
      if (destroyed || !stages.length) return;
      const stage = stageById.get(stageId).stage, oldScroll = routeScroll.scrollTop;
      renderSummary();
      renderAchievements();
      stageButton.replaceChildren();
      add(stageButton, el2("span", "alp-selected-stage-number", String(stageNumber(stage)).padStart(2, "0")));
      const name = el2("span", "alp-selected-stage-copy");
      add(name, el2("strong", "", `第${stageNumber(stage)}章 ${stage.title}`), el2("span", "", `${learningPosition(stage)} · ${completedCount(validGates(stage))} / ${validGates(stage).length} 关完成`));
      add(stageButton, name, el2("span", "alp-switch-label", "切换阶段 ⌄"));
      const stageIntro2 = root2.querySelector(".alp-stage-intro");
      stageIntro2.replaceChildren();
      add(stageIntro2, el2("span", "alp-eyebrow", `阶段 ${stageNumber(stage)} · ${isOrientation(stage) ? "入门导览" : "先广后深，独立完成综合题"}`), el2("h2", "alp-stage-title", `第${stageNumber(stage)}章 ${stage.title}`));
      const ranges = el2("div", "alp-ranges");
      rangeTags(ranges, stage.cf, stage.luoguDifficulty, isOrientation(stage));
      add(stageIntro2, ranges, el2("p", "alp-description", stage.description || stage.goal));
      const orientation = isOrientation(stage);
      root2.querySelector(".alp-footer").hidden = orientation;
      renderRoute(stage);
      renderDetail();
      routeScroll.scrollTop = oldScroll;
      if (center) centerSelected();
      if (lastCelebrated) showCelebration(lastCelebrated);
    }
    function centerSelected() {
      const selected2 = root2.querySelector('.alp-checkpoint[aria-pressed="true"]');
      if (!selected2) return;
      const delta = selected2.getBoundingClientRect().top - routeScroll.getBoundingClientRect().top;
      routeScroll.scrollTop += delta - routeScroll.clientHeight * 0.38;
    }
    function showCelebration(message) {
      const band = root2.querySelector(".alp-success");
      band.textContent = message;
      band.hidden = false;
      clearTimeout(celebrationTimer);
      celebrationTimer = setTimeout(() => {
        if (!destroyed) {
          band.hidden = true;
          lastCelebrated = null;
        }
      }, 2200);
    }
    function buildDialog2(title, className) {
      const dialog3 = el2("dialog", `alp-dialog ${className}`), headingId = `${uid}-${className}-heading`;
      dialog3.setAttribute("aria-labelledby", headingId);
      const header = el2("div", "alp-dialog-heading"), heading = el2("h2", "", title);
      heading.id = headingId;
      const close = control("×", "alp-dialog-close", () => {
        if (!busy2) dialog3.close();
      });
      close.setAttribute("aria-label", "关闭");
      add(header, heading, close);
      dialog3.append(header);
      dialog3.addEventListener("cancel", (event) => {
        if (busy2) event.preventDefault();
      });
      dialog3.addEventListener("click", (event) => {
        if (event.target === dialog3 && !busy2) {
          const box = dialog3.getBoundingClientRect();
          if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog3.close();
        }
      });
      dialog3.addEventListener("close", () => {
        if (!destroyed && previousFocus?.isConnected && "focus" in previousFocus) previousFocus.focus({ preventScroll: true });
      });
      return dialog3;
    }
    function field2(labelText, input2) {
      const label = el2("label", "alp-field");
      add(label, el2("span", "", labelText), input2);
      return label;
    }
    function buildEvidenceDialog() {
      const dialog3 = buildDialog2("记录本关学习", "alp-evidence-dialog");
      const form = el2("form", "alp-evidence-form");
      const gateTitle = el2("p", "alp-evidence-title");
      const status = el2("select");
      status.name = "status";
      for (const [value, label] of [["learning", "学习中"], ["completed", "已完成（自己记录）"]]) {
        const option = el2("option", "", label);
        option.value = value;
        status.append(option);
      }
      const url = el2("input");
      url.name = "problemUrl";
      url.type = "url";
      url.maxLength = 2e3;
      url.placeholder = "https://…";
      url.autocomplete = "off";
      const reflection = el2("textarea");
      reflection.name = "reflection";
      reflection.rows = 5;
      reflection.maxLength = 4e3;
      reflection.placeholder = "写下独立解题过程、关键观察，或还没有弄清楚的地方。";
      evidenceError = el2("p", "alp-inline-error");
      evidenceError.setAttribute("role", "alert");
      evidenceError.hidden = true;
      const actions = el2("div", "alp-dialog-actions"), cancel = control("取消", "alp-button alp-button-secondary", () => {
        if (!busy2) dialog3.close();
      });
      const save = el2("button", "alp-button alp-button-primary", "保存记录");
      save.type = "submit";
      add(actions, cancel, save);
      add(form, gateTitle, el2("p", "alp-fine-print", "如实记录学习情况；题目链接和复盘可选。这里不会自动判断提交结果，也不会向队友或外部平台发送内容。"), field2("学习状态", status), field2("练习题目链接（可选）", url), field2("我的复盘（可选）", reflection), evidenceError, actions);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy2 || !evidenceGateId || !canSave) return;
        const problemUrl = url.value.trim();
        if (problemUrl) {
          try {
            const parsed = new URL(problemUrl);
            if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
          } catch (_) {
            evidenceError.textContent = "请填写有效的 HTTP 或 HTTPS 题目链接。";
            evidenceError.hidden = false;
            url.focus();
            return;
          }
        }
        evidenceError.hidden = true;
        const nextRecord = { status: status.value, problemUrl, reflection: reflection.value.trim(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        try {
          await persist(evidenceGateId, nextRecord);
          if (destroyed) return;
          dialog3.close();
          renderMain();
          if (nextRecord.status === "completed") {
            lastCelebrated = isOrientation(gateById.get(evidenceGateId).stage) ? "✓ 导览完成记录已保存。" : "✓ 本关完成记录已保存，继续积累自己的解题方法。";
            showCelebration(lastCelebrated);
          }
          detail.querySelector(".alp-complete-button")?.focus({ preventScroll: true });
        } catch (error) {
          if (!destroyed) {
            evidenceError.textContent = errorMessage(error, "未能保存，请保留记录后重试。");
            evidenceError.hidden = false;
          }
        }
      });
      evidenceForm = form;
      dialog3.append(form);
      return dialog3;
    }
    function openEvidence(id, preferredStatus) {
      if (busy2 || !gateById.has(id)) return;
      evidenceGateId = id;
      const entry2 = gateById.get(id), record = gateProgress(id);
      evidenceForm.querySelector(".alp-evidence-title").textContent = `第${stageNumber(entry2.stage)}章 · 第${gateNumber(entry2.gate)}关 ${entry2.gate.title}`;
      evidenceForm.elements.status.value = preferredStatus || "completed";
      evidenceForm.elements.problemUrl.value = String(record?.problemUrl || "");
      evidenceForm.elements.reflection.value = String(record?.reflection || "");
      evidenceForm.elements.reflection.placeholder = isOrientation(entry2.stage) ? "写下导览中的理解，或还没有弄清楚的地方。" : "写下独立解题过程、关键观察，或还没有弄清楚的地方。";
      evidenceError.hidden = true;
      previousFocus = document.activeElement;
      evidenceDialog.showModal();
      evidenceForm.elements.reflection.focus();
    }
    function setBusy(value) {
      busy2 = value;
      root2.dataset.saving = String(value);
      root2.setAttribute("aria-busy", String(value));
      evidenceForm?.querySelectorAll("button,input,textarea,select").forEach((input2) => {
        input2.disabled = value;
      });
      evidenceDialog?.querySelector(".alp-dialog-close")?.toggleAttribute("disabled", value);
      detail.querySelectorAll(".alp-complete-button,.alp-learning-button").forEach((button4) => {
        button4.disabled = value || !canSave;
      });
    }
    async function persist(id, record) {
      if (!canSave) throw new Error("当前无法保存学习进度，请稍后重试。");
      const entry2 = gateById.get(id);
      if (!entry2) throw new Error("未找到此关卡，请重新打开学习路径。");
      const next = { ...progress, gates: { ...progress.gates, [id]: record }, stageId: entry2.stage.id, gateId: id };
      setBusy(true);
      try {
        await opts.onProgress(next);
        progress = next;
        saveError = "";
      } finally {
        if (!destroyed) setBusy(false);
      }
    }
    async function saveStatus(id, status) {
      if (busy2 || !canSave) return;
      const previous = gateProgress(id);
      try {
        await persist(id, { status, problemUrl: text2(previous?.problemUrl), reflection: text2(previous?.reflection), updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
        if (!destroyed) {
          renderMain();
          notify(status === "learning" ? "已保存为学习中" : "本关完成记录已保存");
        }
      } catch (error) {
        if (!destroyed) {
          saveError = errorMessage(error, "进度未能保存，请重试。");
          renderDetail();
        }
      }
    }
    function shareText(id) {
      const entry2 = gateById.get(id), record = gateProgress(id);
      if (!entry2) return "";
      const names = list(entry2.gate.topicIds).map((id2) => topics.get(id2)).filter(present).map((topic) => topic.path.join(" / "));
      return [
        "【拾题 · 学习互助卡】",
        `第${stageNumber(entry2.stage)}章 · 第${gateNumber(entry2.gate)}关 ${entry2.gate.title}`,
        entry2.gate.learningTitle ? `学习脉络：${entry2.gate.learningTitle}` : "",
        isOrientation(entry2.stage) ? "学习定位：入门导览" : `目标选题：${cfLabel(entry2.gate.cf || entry2.stage.cf)}；洛谷参考：${list(entry2.gate.luoguDifficulty || entry2.stage.luoguDifficulty).join(" / ") || "按具体题目选择"}`,
        `知识路径：${names.join("；") || "按本关学习目标"}`,
        `当前记录：${record?.status === "completed" ? "已完成（本人记录）" : record?.status === "learning" ? "学习中" : "尚未记录"}`,
        record?.problemUrl ? `练习题目：${record.problemUrl}` : "",
        record?.reflection ? `我的复盘 / 困惑：${record.reflection}` : "想请教的问题：请补充自己的思路、卡点与尝试。",
        !isOrientation(entry2.stage) && "一起讨论：关键观察是什么？有没有反例？如何证明复杂度？"
      ].filter(Boolean).join("\n");
    }
    function buildShareDialog() {
      const dialog3 = buildDialog2("学习互助卡", "alp-share-dialog");
      const textarea = el2("textarea", "alp-share-text");
      textarea.readOnly = true;
      textarea.rows = 11;
      textarea.setAttribute("aria-label", "互助卡内容");
      const hint = el2("p", "alp-fine-print", "仅生成文字供你复制，自行选择是否分享给队友。复盘中的个人内容也会包含在卡片里。");
      const actions = el2("div", "alp-dialog-actions");
      const copy = control("复制文字", "alp-button alp-button-primary", async () => {
        try {
          await navigator.clipboard.writeText(textarea.value);
          notify("互助卡已复制，可自行分享给队友");
        } catch (_) {
          textarea.focus();
          textarea.select();
          hint.textContent = "无法自动复制，内容已选中，请按 Ctrl+C 或使用系统复制。";
        }
      });
      add(actions, copy);
      add(dialog3, textarea, hint, actions);
      return dialog3;
    }
    async function openShare(id) {
      const content = shareText(id);
      if (!content) return;
      try {
        await navigator.clipboard.writeText(content);
        notify("互助卡已复制，包含本关路径及你的记录，可自行分享");
      } catch (_) {
        if (destroyed) return;
        previousFocus = document.activeElement;
        shareDialog.querySelector("textarea").value = content;
        shareDialog.showModal();
        shareDialog.querySelector("textarea").focus();
        shareDialog.querySelector("textarea").select();
      }
    }
    root2 = el2("section", "alp");
    root2.setAttribute("aria-label", "算法竞赛闯关学习路径");
    if (!stages.length || !gateById.size) {
      add(root2, el2("h2", "alp-empty-title", "学习路径正在整理"), el2("p", "alp-description", "关卡准备完成后会显示在这里，可以先从知识树查看学习笔记。"));
      host.replaceChildren(root2);
      return { destroy() {
        destroyed = true;
        root2.remove();
      }, selectTopic() {
        return false;
      }, selectGate() {
        return false;
      } };
    }
    summary = el2("div", "alp-summary");
    summary.setAttribute("aria-label", "学习进度概览");
    const legend = el2("div", "alp-state-legend");
    for (const [type, symbol, label] of [["completed", "✓", "已完成"], ["learning", "▶", "学习中 / 下一关"], ["todo", "○", "未完成"]]) {
      const item = el2("span", "alp-state-item");
      const mark = el2("i", "alp-state-mark", symbol);
      mark.dataset.status = type;
      add(item, mark, el2("span", "", label));
      legend.append(item);
    }
    legend.append(el2("span", "alp-record-hint", "进度由自己记录，先修满足即可跳学"));
    const achievements = el2("div", "alp-achievements");
    achievements.setAttribute("aria-label", "学习足迹");
    const main = el2("div", "alp-main");
    const pickerRow = el2("div", "alp-stage-picker-row");
    stageButton = control("", "alp-stage-picker", openStagePicker);
    stageButton.setAttribute("aria-haspopup", "dialog");
    pickerRow.append(stageButton);
    const stageIntro = el2("div", "alp-stage-intro");
    const columns = el2("div", "alp-columns");
    routeScroll = el2("div", "alp-route-scroll");
    routeScroll.setAttribute("aria-label", "本章关卡路线");
    routeScroll.tabIndex = 0;
    detail = el2("aside", "alp-detail");
    detail.setAttribute("aria-label", "所选关卡详情");
    add(columns, routeScroll, detail);
    add(main, pickerRow, stageIntro, columns);
    const success = el2("div", "alp-success");
    success.hidden = true;
    success.setAttribute("role", "status");
    success.setAttribute("aria-live", "polite");
    stageDialog = buildDialog2("选择学习阶段", "alp-stage-dialog");
    stageDialog.append(el2("p", "alp-picker-hint", "以综合做题能力为主线，先广后深；阶段可以自由切换，已有基础可直接跳学。"), el2("div", "alp-stage-grid"));
    evidenceDialog = buildEvidenceDialog();
    shareDialog = buildShareDialog();
    const footer = el2("p", "alp-footer", "CF 区间和洛谷等级分别用于选题参考，不作等价换算。知识点难度与题目难度独立；阅读和勾选不能代替独立做题。");
    add(root2, summary, legend, achievements, success, main, footer, stageDialog, evidenceDialog, shareDialog);
    host.replaceChildren(root2);
    remember();
    renderMain({ center: true });
    const controller = {
      destroy() {
        if (destroyed) return;
        destroyed = true;
        detailController?.close();
        detailController = null;
        clearTimeout(celebrationTimer);
        [stageDialog, evidenceDialog, shareDialog].forEach((dialog3) => {
          if (dialog3.open) dialog3.close();
        });
        root2.remove();
      },
      selectGate(id) {
        return selectGate(id, { focus: true });
      },
      selectTopic(id) {
        const canonicalId = topics.get(id)?.node.id || id;
        const matches = /* @__PURE__ */ new Set([canonicalId]);
        function include(node2) {
          if (!node2) return;
          matches.add(node2.id);
          list(node2.children).forEach(include);
        }
        include(topics.get(id)?.node);
        for (const topic of topics.values()) if (topic.node.contentOf === canonicalId) matches.add(topic.node.id);
        const entry2 = records().find(({ gate }) => list(gate.topicIds).some((topicId) => matches.has(topics.get(topicId)?.node.id || topicId)));
        if (entry2) return selectGate(entry2.gate.id, { focus: true });
        notify("该专题暂未编入主线，可在知识树继续学习");
        return false;
      }
    };
    return controller;
  }
  var LearningPath = Object.freeze({ render: render5 });

  // src/renderer/algorithms/workspace.ts
  function createAlgorithmWorkspace(options) {
    const global2 = window;
    const { getAlgorithmNotes, setAlgorithmNotes, getAlgorithmTopics, setAlgorithmTopics, getAlgorithmTree, setAlgorithmTree, getAccount, getPermissions, getLocal, getBusy, getReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render: render6, renderMarkdown, authorName: authorName2, date, tags, toast, errorMessage: errorMessage2 } = options;
    const $ = (selector) => document.querySelector(selector);
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button4(label, className, action2) {
      const node2 = element3("button", className, label);
      node2.type = "button";
      node2.addEventListener("click", action2);
      return node2;
    }
    let algorithmSelectedNode = "root";
    function flattenTree(node2, depth = 0, parent = null, out = []) {
      out.push({ ...node2, depth, parent });
      (node2.children || []).forEach((child) => flattenTree(child, depth + 1, node2.id, out));
      return out;
    }
    function algorithmNodes() {
      return flattenTree(getAlgorithmTree());
    }
    let algorithmMode = "tree";
    let algorithmPendingTopic = null;
    let algorithmController = null;
    let learningController = null;
    function learningProgressKey() {
      return JSON.stringify([repo(), accountId() || "anonymous", global2.QMX_ALGORITHM_LEARNING_PATH?.id || "xcpc-learning"]);
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
      algorithmController?.destroy();
      learningController?.destroy();
      learningController = null;
      panel.replaceChildren();
      const modes = element3("div", "algorithm-view-modes");
      modes.setAttribute("role", "group");
      modes.setAttribute("aria-label", "算法学习方式");
      for (const [mode, title] of [["tree", "知识树"], ["path", "闯关学习"]]) {
        const control2 = button4(title, "button secondary", () => setAlgorithmMode(mode));
        control2.dataset.mode = mode;
        control2.setAttribute("aria-pressed", String(algorithmMode === mode));
        modes.append(control2);
      }
      panel.append(modes);
      const host = element3("div", "algorithm-view-content");
      panel.append(host);
      if (algorithmMode === "path") {
        learningController = LearningPath.render({
          host,
          tree: getAlgorithmTree(),
          curriculum: global2.QMX_ALGORITHM_LEARNING_PATH,
          progress: getLocal().learningPaths?.[learningProgressKey()] || { gates: {} },
          progressKey: learningProgressKey(),
          account: getAccount(),
          notes: getAlgorithmNotes(),
          canUpload: Boolean(getAccount() && getPermissions().push),
          onProgress: saveLearningProgress,
          onTopic: openLearningTopic,
          onNote: openAlgorithmNoteDetail,
          onUpload: (id) => {
            algorithmSelectedNode = id;
            openAlgorithmNoteEditor();
          },
          toast
        });
        return;
      }
      algorithmController = AlgorithmBrowser.render({
        host,
        tree: getAlgorithmTree(),
        notes: getAlgorithmNotes(),
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
        authorName: authorName2,
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
      const parent = algorithmNodes().find((node2) => node2.id === parentId);
      if (!parent) return;
      const form = $("#algorithm-topic-form");
      form.reset();
      form.elements.parentId.value = parent.id;
      $("#algorithm-topic-parent").textContent = parent.fullLabel || parent.label;
      updateAlgorithmTopicKind();
      $("#algorithm-topic-kind-hint").textContent = parent.kind === "algorithm" ? "添加子项后，此节点将保留为目录，原算法及难度移入同名子项。目录也可以上传笔记。" : "算法需要选择难度；目录不设置难度，也可以上传笔记。";
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
        $("#algorithm-topic-error").textContent = errorMessage2(error);
        $("#algorithm-topic-error").hidden = false;
      } finally {
        setBusy(false);
      }
    });
    function isMineNote(note) {
      return accountId() !== null && String(note.authorId || "") === accountId();
    }
    function openAlgorithmNoteDetail(note, { gateId } = {}) {
      const holder = element3("div", "alg-browser"), pane = element3("div", "alg-pane");
      holder.hidden = true;
      const article = element3("article", "alg-reading"), title = element3("h2", "alg-reading-title", note.title || "未命名笔记");
      const meta = element3("div", "alg-note-meta");
      if (note.featured) meta.append(element3("span", "alg-featured", "精选"));
      append(meta, element3("span", "alg-note-author", authorName2(note.author)), element3("span", "", date(note.updatedAt)));
      const body = element3("div", "markdown-body alg-markdown");
      renderMarkdown(body, note.body);
      append(article, title, meta, tags(note), body);
      pane.append(article);
      holder.append(pane);
      $("#algorithm-panel").append(holder);
      const path = [];
      const stage = global2.QMX_ALGORITHM_LEARNING_PATH?.stages.find((item) => item.gates.some((gate2) => gateId ? gate2.id === gateId : gate2.topicIds.includes(note.nodeId)));
      const gate = stage?.gates.find((item) => gateId ? item.id === gateId : item.topicIds.includes(note.nodeId));
      path.push({ label: "闯关学习", onClick() {
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
      const node2 = form.elements.nodeId;
      node2.replaceChildren(...algorithmNodes().map((n) => {
        const o = element3("option", "", n.label);
        o.value = n.id;
        return o;
      }));
      node2.value = algorithmSelectedNode;
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
        $("#algorithm-note-error").textContent = errorMessage2(error);
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
    const SIDEBAR_STORAGE = "acm-notebook.sidebar";
    const stateLabels = { unreviewed: "待复习", reviewing: "复习中", mastered: "已掌握" };
    const views2 = {
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
    function element3(tag, className, text3) {
      const node2 = document.createElement(tag);
      if (className) node2.className = className;
      if (text3 !== void 0) node2.textContent = String(text3);
      return node2;
    }
    function append(parent, ...children) {
      children.filter(Boolean).forEach((child) => parent.append(child));
      return parent;
    }
    function button4(label, className, action2) {
      const node2 = element3("button", className, label);
      node2.type = "button";
      node2.addEventListener("click", action2);
      return node2;
    }
    function toast(message) {
      $("#toast").textContent = message;
      $("#toast").hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        $("#toast").hidden = true;
      }, 3400);
    }
    function errorMessage2(error) {
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
    function authorName2(author) {
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
      if (response?.error && !["bootstrap", "sync"].includes(name)) throw new Error(errorMessage2(response.error));
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
      s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, s.algorithmTopics);
      s.issues = (Array.isArray(payload.issues) ? payload.issues : []).filter((record) => record.kind === "issue");
      s.permissions = payload.permissions || {};
      s.settings = payload.settings && typeof payload.settings === "object" ? payload.settings : {};
      s.local = normalizeLocal(payload.local);
      s.account = payload.account || null;
      s.lastSync = payload.lastSync || null;
      s.error = payload.error ? errorMessage2(payload.error) : "";
      applyTheme(s.settings.theme || readTheme());
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
          const login = button4(reauth ? "重新登录 GitHub" : "使用 GitHub 登录", "button secondary", startLoginFromBanner);
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
          const image = element3("img");
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
    const filters = createFilters({ getRecords: records, getView: () => s.view, getScope: () => s.libraryScope, getAccount: () => s.account, getTagCatalog: () => s.tagCatalog, getBusy: () => s.busy, favorite, mastery, isLocal, authorName: authorName2, render: render6 });
    const { facets, facetNames, platformNames, luoguLevels: luoguLevels2, luoguTones, facetValue, fillFacetOptions, refreshFilters, tagGroups, fillTagOptions, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, colorRatingInput, colorLuoguSelection } = filters;
    async function openTagDialog() {
      const select = $("#request-tag-category");
      select.replaceChildren();
      (s.tagCatalog?.categories || []).forEach((c) => {
        const option = element3("option", "", c.name);
        option.value = c.id;
        select.append(option);
      });
      $("#tag-review-section").hidden = true;
      $("#tag-review-dialog").showModal();
      if (demo || typeof bridge3?.getTagReview !== "function") return;
      try {
        const result = await call("getTagReview");
        s.tagReview = result;
        if (!result?.canReview) return;
        $("#tag-review-section").hidden = false;
        const list2 = $("#tag-review-list");
        list2.replaceChildren();
        (result.requests || []).forEach((request) => {
          const row2 = element3("article", "tag-request-row");
          append(row2, element3("strong", "", `${request.category} / ${request.name}`), element3("p", "facet-help", `#${request.number} · ${authorName2(request.author)} · ${request.state || "open"}`));
          if (request.url) row2.append(button4("查看申请 ↗", "button subtle", () => openExternal(request.url)));
          ["approve", "reject"].forEach((decision) => row2.append(button4(decision === "approve" ? "批准" : "拒绝", "button secondary", async () => {
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
              toast(errorMessage2(error));
            } finally {
              setBusy(false);
            }
          })));
          list2.append(row2);
        });
        if (!list2.children.length) list2.append(element3("p", "facet-help", "暂无待审核申请"));
      } catch (error) {
        toast(errorMessage2(error));
      }
    }
    function platformCode(value) {
      return Search.normalizePlatform(value);
    }
    const reader = createLibraryReader({ demo, stateLabels, getLocal: () => s.local, setLocal: (value) => {
      s.local = value;
    }, getAccount: () => s.account, getPermissions: () => s.permissions, getView: () => s.view, getLibraryScope: () => s.libraryScope, getSelected: () => s.selected, setSelected: (value) => {
      s.selected = value;
    }, getComments: () => s.comments, getBusy: () => s.busy, setBusy, getLoading: () => s.loading, getError: () => s.error, getRecords: records, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName: authorName2, date, quotaBlocked, renderMarkdown, persistLocal, call, render: render6, clearFilters, openSubmit: (record) => editor2.openSubmit(record), openLocalSolution: (record) => editor2.openLocalSolution(record), deleteRecord: (record) => editor2.deleteRecord(record), deleteDiscussion: (record) => editor2.deleteDiscussion(record), openExternal, toast, errorMessage: errorMessage2 });
    const { openDetail, closeDetail, renderDetail, loadComments, changeLocal } = reader;
    function navigate(view) {
      if (!views2[view]) return;
      reader.resetDetail();
      s.view = view;
      clearFilters();
      if (view === "home") refreshVisibleContests();
    }
    const contests = HomeContests.create({ demo, getSettings: () => s.settings, setSettings: (value) => {
      s.settings = value;
    }, getView: () => s.view, getLoading: () => s.loading, canRefresh: () => typeof bridge3?.getContests === "function", call, writeDemo, toast, errorMessage: errorMessage2, openExternal });
    const { acceptContests, renderHomeContests, updateContestStatus, renderContestCards, refreshVisibleContests, refreshContests } = contests;
    function renderHome() {
      const panel = $("#home-panel");
      const overview = $("#platform-overview");
      overview.remove();
      panel.replaceChildren();
      const toolbar = element3("div", "home-toolbar");
      const intro = element3("div", "home-intro");
      append(intro, element3("span", "home-date", (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })), element3("h2", "", "今天，继续向前。"));
      append(toolbar, intro);
      const board = element3("div", "home-board");
      const planner = element3("section", "home-planner");
      planner.id = "home-planner";
      planner.setAttribute("aria-label", "题单与学习任务");
      append(board, planner, renderHomeContests(), overview);
      append(panel, toolbar, board);
      Planner?.render(s.planner);
      updateContestStatus();
      renderContestCards();
    }
    function render6() {
      updateStateFacet();
      document.body.dataset.view = s.view;
      const [title, description, eyebrow] = views2[s.view];
      $("#page-title").replaceChildren(document.createTextNode(title), element3("span", "heading-dot", "."));
      $("#breadcrumb-view").textContent = title;
      $("#page-description").textContent = description;
      $("#page-eyebrow").textContent = eyebrow;
      $$(".nav-item,.rail-nav-item").forEach((node2) => {
        node2.classList.toggle("active", node2.dataset.view === s.view);
        if (node2.dataset.view === s.view) node2.setAttribute("aria-current", "page");
        else node2.removeAttribute("aria-current");
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
      $("#library-local-count").textContent = s.local.records.filter((record) => record.kind === "local" && visibleLocal(record)).length;
      const items = filteredRecords();
      $("#result-count").textContent = items.length;
      $(".list-heading > span:last-child").textContent = facets.tags.size ? "标签命中数 ↓ · 相关度 / 更新时间" : $("#search-input").value.trim() ? "匹配程度 ↓" : "最近更新 ↓";
      reader.renderLibrary(items);
    }
    const { highlightCodeBlock, decorateCodeBlocks, codeBlockClick } = CodeBlocks.create({ toast, errorMessage: errorMessage2 });
    const algorithms = createAlgorithmWorkspace({ getAlgorithmNotes: () => s.algorithmNotes, setAlgorithmNotes: (value) => {
      s.algorithmNotes = value;
    }, getAlgorithmTopics: () => s.algorithmTopics, setAlgorithmTopics: (value) => {
      s.algorithmTopics = value;
    }, getAlgorithmTree: () => s.algorithmTree, setAlgorithmTree: (value) => {
      s.algorithmTree = value;
    }, getAccount: () => s.account, getPermissions: () => s.permissions, getLocal: () => s.local, getBusy: () => s.busy, getReadingDetail: () => ReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render: render6, renderMarkdown, authorName: authorName2, date, tags, toast, errorMessage: errorMessage2 });
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
              const target = Array.from(container.querySelectorAll("[id],a[name]")).find((node2) => node2.id === id || node2.getAttribute("name") === id);
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
        toast(errorMessage2(error));
      }
    }
    let updateLockedControls = null;
    function setBusy(value) {
      if (!value && updateLockedControls) {
        updateLockedControls.forEach(([node2, disabled]) => {
          node2.disabled = disabled;
        });
        updateLockedControls = null;
      }
      s.busy = value;
      ["sync-button", "account-button", "settings-button", "theme-select", "submit-button", "save-local-button", "publish-button", "account-login", "account-logout", "account-switch", "account-refresh", "banner-login-button"].forEach((id) => {
        const node2 = document.getElementById(id);
        if (node2) node2.disabled = value;
      });
      $$("[data-close], #settings-form input, #settings-form select, #settings-form button").forEach((node2) => {
        node2.disabled = value;
      });
      $$("#submit-form input, #submit-form textarea").forEach((node2) => {
        node2.readOnly = value;
      });
      $$("#submit-form select, #editor-difficulty-picker select, #editor-difficulty-picker button").forEach((node2) => {
        node2.disabled = value;
      });
      if (!value && s.editor?.record?.kind === "document") $("#save-local-button").disabled = true;
      if (value && updates.updateRunning) {
        const controls = $$("button, input, select, textarea");
        if (!updateLockedControls) updateLockedControls = controls.map((node2) => [node2, node2.disabled]);
        controls.forEach((node2) => {
          node2.disabled = true;
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
    }, getBusy: () => s.busy, setBusy, getAccount: () => s.account, getPermissions: () => s.permissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave: () => clearTimeout(draftTimer), persistLocal, call, refreshFilters, navigate, render: render6, openDetail, toast, errorMessage: errorMessage2 });
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
            toast(`网络请求失败：${errorMessage2(fetchErr)}`);
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
        const message = errorMessage2(error);
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
    $$(".nav-item").forEach((node2) => node2.addEventListener("click", (event) => {
      navigate(node2.dataset.view);
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
    const tagEntry = button4("＋ 添加标签", "button subtle", openTagDialog);
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
        toast(errorMessage2(error));
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
    const stateFacet = element3("details", "facet state-facet");
    stateFacet.id = "state-facet";
    const stateSummary = element3("summary");
    const stateLabel = element3("span");
    append(stateSummary, stateLabel, element3("span", "facet-chevron", "⌄"));
    const stateOptions = element3("div", "facet-popover");
    stateOptions.setAttribute("aria-label", "状态筛选");
    [...stateSelect.options].forEach((option) => {
      const label = element3("label", "facet-option");
      const input2 = element3("input");
      input2.type = "radio";
      input2.name = "state-choice";
      input2.value = option.value;
      input2.addEventListener("change", () => {
        stateSelect.value = input2.value;
        stateFacet.open = false;
        render6();
      });
      append(label, input2, element3("span", "", option.textContent));
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
      const option = element3("option", "", "不限");
      option.value = "";
      select.append(option);
      luoguLevels2.forEach((name, i) => {
        const o = element3("option", `tone-${luoguTones[i]}`, name);
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
    $$("[data-rating]").forEach((node2) => node2.addEventListener("click", () => {
      const [min, max] = node2.dataset.rating.split(",");
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
      $$(".facet details[open],details.facet[open]").forEach((node2) => {
        if (!node2.contains(event.target)) node2.open = false;
      });
    });
    document.addEventListener("click", codeBlockClick);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") $$(".facet details[open],details.facet[open]").forEach((node2) => node2.open = false);
    });
    $("#submit-button").addEventListener("click", () => openSubmit());
    $("#sync-button").addEventListener("click", sync);
    contests.start();
    $$("dialog").forEach((dialog3) => dialog3.addEventListener("cancel", (event) => {
      if (s.busy) event.preventDefault();
    }));
    $$("[data-close]").forEach((node2) => node2.addEventListener("click", async () => {
      if (s.busy) return;
      if (node2.dataset.close === "submit-dialog") {
        clearTimeout(draftTimer);
        setBusy(true);
        await saveDraft();
        setBusy(false);
      }
      document.getElementById(node2.dataset.close).close();
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
    const settingsUI = createSettings({ demo, bridge: bridge3, themeStorage: THEME_STORAGE, getBusy: () => s.busy, setBusy, getSettings: () => s.settings, setSettings: (value) => {
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
      s.lastSync = null;
      s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, []);
    }, resetSourceView: () => {
      s.comments.clear();
      s.selected = null;
      reader.resetDetail();
    }, clearComments: () => s.comments.clear(), refreshFilters, render: render6, renderUpdate: () => updates.renderUpdate(), updateStatus, sync, writeDemo, toast, errorMessage: errorMessage2 });
    const { readTheme, applyTheme, applyCodeSettings, renderRepoSelector, renderSettingsRepoList, renderAccount, startLoginFromBanner, accountAction, cancelLogin } = settingsUI;
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
      for (const node2 of [copy, ...$$("[id]", copy)]) {
        if (node2.id) node2.removeAttribute("id");
      }
      for (const node2 of [copy, ...$$("button,a", copy)]) {
        if (!node2.matches("button,a")) continue;
        if (node2.classList.contains("sidebar-toggle")) {
          node2.id = "sidebar-rail-toggle";
          node2.addEventListener("click", (event) => {
            const wasPinned = sidebarPinned;
            applySidebar(!wasPinned);
            if (wasPinned) {
              sidebarHovered = false;
              sidebarFocused = false;
              event.currentTarget.blur();
              updateSidebar();
            }
          });
        } else if (node2.classList.contains("nav-item")) {
          node2.classList.replace("nav-item", "rail-nav-item");
          node2.addEventListener("click", () => navigate(node2.dataset.view));
        } else if (node2.classList.contains("brand")) {
          node2.classList.replace("brand", "rail-brand");
          node2.addEventListener("click", (event) => {
            event.preventDefault();
            navigate("home");
          });
        } else if (node2.classList.contains("sidebar-bottom")) node2.addEventListener("click", () => $("#account-button").click());
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
    }, hasEditor: () => !!s.editor, saveDraft, persistLocal, renderAccount, toast, errorMessage: errorMessage2 });
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
      applyTheme(readTheme());
      applySidebar(readSidebar());
      render6();
      if (demo) {
        s.settings = cached?.settings || {};
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
        applyTheme(s.settings.theme || readTheme());
        applyCodeSettings();
        renderRepoSelector();
      } else {
        try {
          applyPayload(await call("bootstrap"));
        } catch (error) {
          s.error = errorMessage2(error);
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
