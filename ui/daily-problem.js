// Generated from src/renderer/home/daily-problem.ts; run pnpm modules:build.
(function () {
"use strict";
var __QMXStandalone = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/renderer/home/daily-problem.ts
  var daily_problem_exports = {};
  __export(daily_problem_exports, {
    DailyProblem: () => DailyProblem
  });

  // src/shared/luogu-difficulty.ts
  var luoguDifficultyLevels = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
  var aliases = {
    "暂无评定": 0,
    "入门": 1,
    "普及-": 2,
    "普及减": 2,
    "普及": 3,
    "普及/提高-": 3,
    "普及/提高减": 3,
    "普及提高-": 3,
    "普及+/提高-": 4,
    "普及+/提高": 4,
    "普及加/提高": 4,
    "提高": 5,
    "提高+/省选-": 6,
    "提高/省选-": 6,
    "省选/NOI-": 7,
    "省选/NOI减": 7,
    "NOI/NOI+/CTS": 8,
    "NOI/NOI+/CTSC": 8,
    "NOI/CTSC": 8,
    "NOI": 8,
    "NOI+": 8
  };
  function luoguDifficultyRank(value) {
    const key = value.trim().replace(/[−–—﹣]/g, "-").replace(/\s/g, "");
    return Object.hasOwn(aliases, key) ? aliases[key] : null;
  }
  function luoguDifficultyLabel(value) {
    const rank = luoguDifficultyRank(value);
    return rank === null ? value : rank === 0 ? "暂无评定" : luoguDifficultyLevels[rank - 1];
  }

  // src/renderer/lib/search.ts
  function text(value) {
    return String(value == null ? "" : value).normalize("NFKC").toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ").replace(/\s+/gu, " ").trim();
  }
  function normalizePlatform(value) {
    const name = text(value).replace(/[\s_-]/g, "");
    const aliases2 = { cf: "CF", codeforces: "CF", lg: "LG", luogu: "LG", "洛谷": "LG", at: "AT", atcoder: "AT", nc: "NC", nowcoder: "NC", "牛客": "NC", lc: "LC", leetcode: "LC", "力扣": "LC", oth: "Oth", other: "Oth", "其他": "Oth" };
    return aliases2[name] || String(value == null ? "" : value).trim() || "Oth";
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
  function difficulty(input) {
    const record = input || {};
    const code = normalizePlatform(record.platform);
    const rawNative = String(record.difficulty == null ? "" : record.difficulty).trim();
    const native = code === "LG" ? luoguDifficultyLabel(rawNative) : rawNative;
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
      const index = luoguLevels.findIndex(function(entry) {
        return entry[1].some(function(alias) {
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
      const index = levels.findIndex(function(entry) {
        return entry[1].includes(name);
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
      let parts;
      if (host === "codeforces.com" || host.endsWith(".codeforces.com")) {
        parts = url.pathname.match(/^\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([a-z]\d*)\/?$/i);
        if (parts) return "cf" + parts[1] + parts[2].toLowerCase();
      }
      if (host === "luogu.com.cn" || host.endsWith(".luogu.com.cn") || host === "luogu.org" || host.endsWith(".luogu.org")) {
        parts = url.pathname.match(/^\/problem\/([a-z]+\d+[a-z\d]*)\/?$/i);
        if (parts) return compact(parts[1]);
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
  function match(input, query) {
    const phrase = queryText(query);
    if (!phrase) return 1;
    const record = input || {};
    const terms = Array.from(new Set(phrase.split(/\s+/u)));
    const ids = identifiers(record);
    const title = text(record.title);
    const tags = text(Array.isArray(record.tags) ? record.tags.join(" ") : record.tags);
    const author = text(typeof record.author === "object" && record.author ? [record.author.name, record.author.login].filter(Boolean).join(" ") : record.author);
    const body = text(record.body);
    const metadata = text([record.platform, normalizePlatform(record.platform), record.rating, record.difficulty].filter((value) => value != null).join(" "));
    let score = 0;
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
      if (metadata.includes(term)) hit = Math.max(hit, 100);
      if (body.includes(term)) hit = Math.max(hit, 50);
      if (!hit) return 0;
      score += hit;
    }
    if (terms.length > 1 && title.includes(phrase)) score += 1200;
    else if (terms.length > 1 && body.includes(phrase)) score += 20;
    return score;
  }
  function tagHits(input, selected) {
    const record = input;
    const wanted = selected instanceof Set ? selected : new Set(selected || []);
    return Array.from(new Set(Array.isArray(record?.tags) ? record.tags.map(String) : [])).filter((tag) => wanted.has(tag)).length;
  }
  var Search = { normalizePlatform, difficulty, match, tagHits };

  // src/renderer/lib/tag-color.ts
  function tagColorClass(value) {
    let hash = 0;
    for (const character of value) hash = (hash + character.codePointAt(0)) % 5;
    return `tag-color-${hash}`;
  }

  // src/renderer/home/problem-enrichment.ts
  var luoguLevels2 = ["暂无评定", "入门", "普及−", "普及/提高−", "普及+/提高", "提高+/省选−", "省选/NOI−", "NOI/NOI+/CTSC"];
  var activeDialog = null;
  function node(tag, className = "", text2) {
    const element = document.createElement(tag);
    element.className = className;
    if (text2 !== void 0) element.textContent = text2;
    return element;
  }
  function button(label, className, action) {
    const element = node("button", `button ${className}`, label);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }
  function field(label, control, hint) {
    const wrapper = node("label", "enrichment-field");
    wrapper.append(node("span", "", label), control);
    if (hint) wrapper.append(node("small", "", hint));
    return wrapper;
  }
  function openProblemEnrichment(url, onApplied) {
    if (activeDialog) {
      activeDialog.close();
      activeDialog.remove();
    }
    const bridge = window.notebook;
    const previousFocus = document.activeElement;
    const dialog = node("dialog", "problem-enrichment-dialog");
    activeDialog = dialog;
    dialog.setAttribute("aria-labelledby", "problem-enrichment-title");
    const header = node("header", "enrichment-header");
    const title = node("h2", "", "补充题目信息");
    title.id = "problem-enrichment-title";
    const close = button("关闭", "subtle", () => dialog.close());
    header.append(title, close);
    const status = node("p", "enrichment-status", "正在读取题目信息…");
    status.setAttribute("role", "status");
    const error = node("p", "enrichment-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const content = node("div", "enrichment-content");
    dialog.append(header, status, error, content);
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => {
      key.value = "";
      statement.value = "";
      dialog.remove();
      if (activeDialog === dialog) activeDialog = null;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
      }
    });
    let view = null;
    let aiStatus = null;
    let busy = false;
    const controls = [];
    const tags = node("input", "enrichment-tags");
    tags.type = "text";
    tags.maxLength = 3030;
    tags.placeholder = "例如：动态规划, 二分";
    const cf = node("input", "enrichment-cf");
    cf.type = "number";
    cf.min = "800";
    cf.max = "3500";
    cf.step = "1";
    cf.placeholder = "800–3500";
    const lg = node("select", "enrichment-luogu");
    for (const value of ["", ...luoguLevels2]) {
      const option2 = node("option", "", value ? luoguDifficultyLabel(value) : "不补充洛谷参考难度");
      option2.value = value;
      lg.append(option2);
    }
    const reason = node("textarea", "enrichment-reason");
    reason.rows = 3;
    reason.maxLength = 4e3;
    reason.required = true;
    const endpoint = node("input", "enrichment-endpoint");
    endpoint.type = "url";
    endpoint.placeholder = "https://api.example.com/v1/chat/completions";
    endpoint.maxLength = 2048;
    const model = node("input", "enrichment-model");
    model.type = "text";
    model.maxLength = 200;
    const key = node("input", "enrichment-key");
    key.type = "password";
    key.autocomplete = "new-password";
    key.maxLength = 8192;
    const statement = node("textarea", "enrichment-statement");
    statement.rows = 6;
    statement.minLength = 20;
    statement.maxLength = 1e5;
    statement.required = true;
    statement.placeholder = "粘贴公开题面的描述、输入输出和约束，至少 20 个字符。请先检查发送内容。";
    const config = node("details", "enrichment-ai-config");
    const configSummary = node("summary", "", "配置 AI 接口");
    config.append(configSummary);
    const configStatus = node("p", "enrichment-hint", "正在检查 AI 配置…");
    const saveConfig = button("保存 AI 配置", "secondary enrichment-config-save", () => void run(async () => {
      if (!bridge) return;
      if (!endpoint.value.trim() || !model.value.trim()) throw new Error("请填写接口地址和模型名称");
      try {
        const input = { endpoint: endpoint.value.trim(), model: model.value.trim(), ...key.value.trim() ? { apiKey: key.value } : {} };
        aiStatus = await bridge.saveProblemAIConfig(input);
        renderAIStatus();
        status.textContent = "AI 配置已保存";
      } finally {
        key.value = "";
      }
    }));
    const clearKey = button("清除 AI 配置和密钥", "subtle enrichment-config-clear", () => void run(async () => {
      if (!bridge) return;
      aiStatus = await bridge.clearProblemAIConfig();
      key.value = "";
      renderAIStatus();
      status.textContent = "AI 配置和密钥已清除";
    }));
    const configActions = node("div", "enrichment-actions");
    configActions.append(saveConfig, clearKey);
    config.append(configStatus, field("OpenAI 兼容接口地址", endpoint, "填写完整的 chat/completions 地址。"), field("模型名称", model), field("API 密钥", key, "已配置时留空保留原密钥；更换接口需重新填写。密钥不会回显。"), configActions);
    const official = node("section", "enrichment-official");
    official.setAttribute("aria-label", "官方信息");
    const current = node("section", "enrichment-current");
    const manual = node("section", "enrichment-manual");
    const manualFields = node("div", "enrichment-fields");
    const tagHint = node("p", "enrichment-hint");
    const difficultyHint = node("p", "enrichment-hint");
    manualFields.append(field("补充算法标签（逗号分隔）", tags), tagHint, field("CF 参考评分", cf), field("洛谷参考难度", lg), difficultyHint, field("补充理由", reason, "说明标签或参考难度的依据；所有补充均保留来源标记。"));
    const save = button("保存手动补充", "primary enrichment-save", () => void run(async () => {
      if (!bridge || !view) return;
      const fields = { reason: reason.value.trim() };
      if (view.canSupplementTags) fields.tags = [...new Set(tags.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean))];
      if (view.canSupplementDifficulty) {
        if (cf.value.trim()) {
          const rating = Number(cf.value);
          if (!Number.isInteger(rating) || rating < 800 || rating > 3500) throw new Error("CF 参考评分必须为 800–3500 的整数");
          fields.cfRating = rating;
        }
        if (lg.value) fields.luoguDifficulty = lg.value;
      }
      if (!fields.reason) throw new Error("请填写补充理由");
      if (!fields.tags?.length && fields.cfRating == null && (!fields.luoguDifficulty || fields.luoguDifficulty === "暂无评定")) throw new Error("请至少补充一项缺失的算法标签或难度");
      view = await bridge.saveProblemEnrichment({ ...fields, url: view.url, expectedRevision: view.revision });
      renderView();
      status.textContent = "手动补充已保存";
      onApplied();
    }));
    const remove = button("删除补充，恢复官方信息", "subtle enrichment-remove", () => void run(async () => {
      if (!bridge || !view) return;
      view = await bridge.removeProblemEnrichment({ url: view.url, expectedRevision: view.revision });
      renderView();
      status.textContent = "补充已删除，官方信息保持原样";
      onApplied();
    }));
    const manualActions = node("div", "enrichment-actions");
    manualActions.append(save, remove);
    manual.append(node("h3", "", "手动补充"), manualFields, manualActions);
    const ai = node("section", "enrichment-ai");
    ai.append(node("h3", "", "AI 建议"), config);
    const generate = button("生成 AI 待审核建议", "secondary enrichment-generate", () => void run(async () => {
      if (!bridge || !view) return;
      if (!aiStatus?.configured) {
        config.open = true;
        throw new Error("请先配置 AI 接口和模型");
      }
      if (statement.value.trim().length < 20) {
        statement.focus();
        throw new Error("请粘贴至少 20 个字符的公开题面，包含描述和约束，避免只凭标题推测");
      }
      status.textContent = "正在生成建议，请等待审核…";
      view = await bridge.suggestProblemEnrichment({ url: view.url, statementText: statement.value.trim() });
      renderView();
      status.textContent = "建议已生成，审核后点击“采用建议”才会保存";
    }));
    const pending = node("section", "enrichment-pending");
    pending.setAttribute("aria-label", "AI 待审核建议");
    const approve = button("采用建议", "primary enrichment-approve", () => void run(async () => {
      if (!bridge || !view?.suggestion) return;
      const suggestion = view.suggestion;
      const input = { url: view.url, expectedRevision: view.revision, suggestionId: suggestion.id, reason: suggestion.reason };
      if (suggestion.tags !== void 0) input.tags = [...suggestion.tags];
      if (suggestion.cfRating !== void 0) input.cfRating = suggestion.cfRating;
      if (suggestion.luoguDifficulty !== void 0) input.luoguDifficulty = suggestion.luoguDifficulty;
      view = await bridge.saveProblemEnrichment(input);
      renderView();
      status.textContent = "AI 建议已审核采用";
      onApplied();
    }));
    ai.append(field("将向你配置的 AI 接口发送以下公开题面文本", statement, "仅点击“生成”时发送题目标题、链接、平台与此处文本。至少 20 个字符，请勿填写私人信息。"), generate, pending);
    content.append(official, current, manual, ai);
    controls.push(tags, cf, lg, reason, endpoint, model, key, statement, saveConfig, clearKey, save, remove, generate, approve);
    function renderAIStatus() {
      if (aiStatus) {
        endpoint.value = aiStatus.endpoint ?? "";
        model.value = aiStatus.model ?? "";
        configStatus.textContent = aiStatus.configured ? `AI 接口已配置 · 模型 ${aiStatus.model ?? ""}；密钥已保存，不会回显。` : "尚未配置 AI 接口。展开此处填写接口、模型和密钥后，即可手动生成建议。";
        configSummary.textContent = aiStatus.configured ? "管理 AI 接口配置" : "配置 AI 接口（尚未配置）";
        config.open = !aiStatus.configured;
      }
      syncDisabled();
    }
    function describe(fields) {
      const detail = node("div", "enrichment-values");
      if (fields.tags !== void 0) detail.append(node("p", "", `算法标签：${fields.tags.join("、") || "未补充"}`));
      if (fields.cfRating !== void 0) detail.append(node("p", "", `CF 参考评分：${fields.cfRating ?? "未补充"}`));
      if (fields.luoguDifficulty !== void 0) detail.append(node("p", "", `洛谷参考难度：${luoguDifficultyLabel(fields.luoguDifficulty)}`));
      detail.append(node("p", "enrichment-reason-copy", `理由：${fields.reason}`));
      return detail;
    }
    function renderView() {
      if (!view) return;
      official.replaceChildren(node("h3", "", view.title), node("p", "enrichment-hint", `${view.platform} · ${view.url}`), node("p", "", `官方算法标签：${view.officialTags.join("、") || "未提供"}`), node("p", "", `官方难度：${view.officialDifficulty == null ? "未提供" : view.platform === "LG" ? luoguDifficultyLabel(view.officialDifficulty) : view.officialDifficulty}`));
      current.replaceChildren();
      if (view.supplement) current.append(node("span", "enrichment-badge", view.supplement.source === "ai" ? "AI 补充 · 已审核" : "手动补充"), describe(view.supplement));
      else current.append(node("p", "enrichment-hint", "当前没有补充信息。只允许补充官方缺失的字段。"));
      tags.value = view.canSupplementTags ? (view.supplement?.tags ?? []).join(", ") : view.officialTags.join(", ");
      cf.value = view.canSupplementDifficulty && view.supplement?.cfRating != null ? String(view.supplement.cfRating) : "";
      lg.value = view.canSupplementDifficulty ? view.supplement?.luoguDifficulty ?? "" : "";
      reason.value = view.supplement?.reason ?? "";
      tagHint.textContent = view.canSupplementTags ? "官方未提供算法标签，可以补充。" : "官方已有算法标签，不能补充或覆盖。";
      difficultyHint.textContent = view.canSupplementDifficulty ? "官方未提供难度，可以补充 CF 和洛谷参考难度。参考值不是官方评分。" : `官方已有难度（${view.officialDifficulty}），不能补充或覆盖参考难度。`;
      pending.replaceChildren();
      pending.hidden = !view.suggestion;
      if (view.suggestion) pending.append(node("span", "enrichment-badge enrichment-pending-badge", "AI 待审核"), node("p", "enrichment-hint", `模型：${view.suggestion.model}。请核对字段和理由；采用前不会影响当前题目。`), describe(view.suggestion), approve);
      syncDisabled();
    }
    function syncDisabled() {
      dialog.setAttribute("aria-busy", String(busy));
      for (const control of controls) control.disabled = busy || !bridge || !view;
      if (busy || !bridge || !view) return;
      tags.disabled = !view.canSupplementTags;
      cf.disabled = lg.disabled = !view.canSupplementDifficulty;
      save.disabled = reason.disabled = !view.canSupplementTags && !view.canSupplementDifficulty;
      remove.disabled = !view.supplement;
      generate.disabled = !aiStatus?.configured || !view.canSupplementTags && !view.canSupplementDifficulty;
      clearKey.disabled = aiStatus?.configured === false;
      approve.disabled = !view.suggestion || Boolean(view.suggestion.tags?.length && !view.canSupplementTags) || Boolean((view.suggestion.cfRating != null || view.suggestion.luoguDifficulty && view.suggestion.luoguDifficulty !== "暂无评定") && !view.canSupplementDifficulty);
      dialog.setAttribute("aria-busy", "false");
    }
    async function run(action) {
      if (busy || !dialog.isConnected) return;
      busy = true;
      error.hidden = true;
      dialog.setAttribute("aria-busy", "true");
      syncDisabled();
      try {
        await action();
      } catch (failure) {
        if (dialog.isConnected) {
          error.textContent = failure instanceof Error ? failure.message : "操作失败，请重试";
          error.hidden = false;
          status.textContent = "操作未完成";
        }
      } finally {
        busy = false;
        syncDisabled();
      }
    }
    void run(async () => {
      if (!bridge) throw new Error("题目补充需要在桌面应用中使用");
      view = await bridge.getProblemEnrichment(url);
      renderView();
      status.textContent = "已读取官方信息与当前补充";
      try {
        aiStatus = await bridge.getProblemAIStatus();
        renderAIStatus();
      } catch {
        config.open = true;
        configStatus.textContent = "无法读取 AI 配置，请重新保存接口、模型和密钥后重试。";
      }
    });
  }

  // src/renderer/home/daily-problem.ts
  var cachedResult = null;
  var autoDrawStarted = false;
  var pendingRequest = null;
  var lastDrawError = "";
  var activeContext = "";
  var contextGeneration = 0;
  var resultRevision = 0;
  var resultTagsExpanded = false;
  var pendingClistRefresh = null;
  var clistRefreshFeedback = null;
  var lastElapsedMs = null;
  var lastServiceDurationMs = null;
  var savedFilters = { source: "all", ratingMin: "", ratingMax: "", luoguDifficultyMin: "", luoguDifficultyMax: "", tags: [] };
  var latestMount = null;
  function notifyMount() {
    if (latestMount?.section.isConnected) latestMount.sync();
  }
  var sources = [["all", "全部来源"], ["local", "本地题库"], ["public", "公共题库"], ["CF", "Codeforces"], ["LG", "洛谷"], ["AT", "AtCoder"], ["NC", "牛客"], ["LC", "LeetCode"], ["LOJ", "LibreOJ"]];
  var sourceNames = Object.fromEntries(sources);
  var platformName = (source) => sourceNames[source] ?? source;
  var luoguLevels3 = luoguDifficultyLevels;
  var formatDuration = (durationMs) => durationMs < 1e3 ? `${Math.round(durationMs)} 毫秒` : `${(durationMs / 1e3).toFixed(2)} 秒`;
  function node2(tag, className = "", text2) {
    const element = document.createElement(tag);
    element.className = className;
    if (text2 !== void 0) element.textContent = text2;
    return element;
  }
  function button2(label, className, onClick) {
    const element = node2("button", className, label);
    element.type = "button";
    element.addEventListener("click", onClick);
    return element;
  }
  function option(value, label) {
    const element = node2("option", "", label);
    element.value = value;
    return element;
  }
  function create({ draw: drawApi, openExternal, chooseTags, updateLibrary, autoDraw = false, contextKey = "" }) {
    if (activeContext !== contextKey) {
      activeContext = contextKey;
      contextGeneration += 1;
      cachedResult = null;
      pendingRequest = null;
      lastDrawError = "";
      autoDrawStarted = false;
      resultRevision += 1;
      resultTagsExpanded = false;
      pendingClistRefresh = null;
      clistRefreshFeedback = null;
      lastElapsedMs = null;
      lastServiceDurationMs = null;
      Object.assign(savedFilters, { source: "all", ratingMin: "", ratingMax: "", luoguDifficultyMin: "", luoguDifficultyMax: "", tags: [] });
    }
    const generation = contextGeneration;
    const section = node2("section", "daily-problem");
    section.setAttribute("aria-labelledby", "daily-problem-title");
    const heading = node2("div", "daily-problem-heading"), titleGroup = node2("div", "daily-problem-title-group");
    const title = node2("h2", "", "每日一题");
    title.id = "daily-problem-title";
    titleGroup.append(node2("span", "eyebrow", "DAILY PRACTICE"), title);
    const aside = node2("div", "daily-problem-heading-aside");
    const refresh = button2("刷新题库", "button subtle daily-refresh", () => refreshLibrary());
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
    const lgMin = node2("select", "daily-filter-luogu daily-filter-luogu-min");
    lgMin.setAttribute("aria-label", "最低洛谷难度");
    const lgMax = node2("select", "daily-filter-luogu-max");
    lgMax.setAttribute("aria-label", "最高洛谷难度");
    lgMin.append(option("", "洛谷难度 ≥不限"));
    lgMax.append(option("", "洛谷难度 ≤不限"));
    luoguLevels3.forEach((level) => {
      lgMin.append(option(level, level));
      lgMax.append(option(level, level));
    });
    let selectedTags = /* @__PURE__ */ new Set();
    const tags = button2("算法标签…", "button secondary daily-filter-tags", () => chooseTags(selectedTags, (selected) => {
      if (generation !== contextGeneration) return;
      savedFilters.tags = [...selected];
      if (latestMount?.section.isConnected) latestMount.restoreFilters();
    }));
    const presetNames = ["动态规划", "图论", "数据结构", "数学", "字符串", "贪心", "二分", "搜索", "树", "构造"];
    const presets = document.createElement("datalist");
    presets.id = `daily-tag-suggestions-${Math.random().toString(36).slice(2)}`;
    presetNames.forEach((tag) => presets.append(option(tag, tag)));
    tags.setAttribute("aria-label", "算法标签");
    tags.setAttribute("aria-haspopup", "dialog");
    filters.append(source, ratingMin, ratingMax, lgMin, lgMax, tags, presets);
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
    const draw = button2("试试手气", "button primary daily-draw", () => drawProblem());
    const change = button2("换一道", "button subtle daily-change", () => drawProblem(true));
    change.hidden = true;
    const easier = button2("− 难度", "button subtle daily-easier", () => shiftDifficulty(-1));
    const harder = button2("＋ 难度", "button subtle daily-harder", () => shiftDifficulty(1));
    const currentDifficulty = node2("span", "daily-current-difficulty", "当前难度：洛谷不限");
    lgMin.addEventListener("change", updateDifficulty);
    lgMax.addEventListener("change", updateDifficulty);
    const copy = button2("复制链接", "button subtle daily-copy", () => copyLink());
    copy.hidden = true;
    const duration = node2("p", "daily-duration");
    duration.hidden = true;
    duration.setAttribute("role", "status");
    const coverage = node2("p", "daily-coverage");
    coverage.hidden = true;
    actions.append(draw, copy, change, easier, currentDifficulty, harder);
    section.append(heading, filters, result, duration, actions);
    let current = null;
    let renderedRevision = -1;
    let clistRefreshButton = null;
    let clistRefreshStatus = null;
    function syncClistRefresh() {
      if (clistRefreshButton) {
        const busy = pendingClistRefresh?.generation === generation && pendingClistRefresh.url === current?.url;
        clistRefreshButton.disabled = busy;
        clistRefreshButton.textContent = busy ? "查询中…" : "刷新评分";
      }
      if (clistRefreshStatus) {
        clistRefreshStatus.hidden = !clistRefreshFeedback;
        clistRefreshStatus.textContent = clistRefreshFeedback?.message ?? "";
        clistRefreshStatus.title = clistRefreshFeedback?.detail ?? "";
      }
    }
    async function refreshClistRating(url) {
      const bridge = window.notebook;
      if (typeof bridge?.refreshProblemClistRating !== "function" || generation !== contextGeneration || cachedResult?.problem.url !== url || renderedRevision !== resultRevision || pendingClistRefresh) return;
      const request = { generation, url, revision: resultRevision };
      pendingClistRefresh = request;
      clistRefreshFeedback = null;
      notifyMount();
      const isCurrent = () => generation === contextGeneration && cachedResult?.problem.url === url && resultRevision === request.revision;
      try {
        const refreshed = await bridge.refreshProblemClistRating(url);
        if (!isCurrent() || !cachedResult) return;
        cachedResult = { ...cachedResult, problem: refreshed.problem };
        resultRevision += 1;
        const message = refreshed.message.trim();
        clistRefreshFeedback = message ? { message: message.length > 48 ? `${message.slice(0, 47)}…` : message, detail: message } : null;
      } catch (cause) {
        if (!isCurrent()) return;
        const detail = cause instanceof Error ? cause.message : "评分查询失败，请稍后重试";
        const message = `评分刷新失败：${detail}`;
        clistRefreshFeedback = { message: message.length > 48 ? `${message.slice(0, 47)}…` : message, detail };
      } finally {
        if (pendingClistRefresh === request) pendingClistRefresh = null;
        if (generation === contextGeneration) notifyMount();
      }
    }
    function saveFilters() {
      if (generation !== contextGeneration) return;
      savedFilters.source = source.value;
      savedFilters.ratingMin = ratingMin.value;
      savedFilters.ratingMax = ratingMax.value;
      savedFilters.luoguDifficultyMin = lgMin.value;
      savedFilters.luoguDifficultyMax = lgMax.value;
      savedFilters.tags = [...selectedTags];
    }
    function restoreFilters() {
      source.value = savedFilters.source;
      ratingMin.value = savedFilters.ratingMin;
      ratingMax.value = savedFilters.ratingMax;
      lgMin.value = savedFilters.luoguDifficultyMin;
      lgMax.value = savedFilters.luoguDifficultyMax;
      selectedTags = new Set(savedFilters.tags);
      tags.textContent = selectedTags.size ? `算法标签…（已选 ${selectedTags.size}）` : "算法标签…";
      updateDifficulty();
    }
    for (const input of [source, ratingMin, ratingMax, lgMin, lgMax]) {
      input.addEventListener("input", saveFilters);
      input.addEventListener("change", saveFilters);
    }
    function readFilters() {
      return {
        source: source.value || void 0,
        platform: ["CF", "LG", "AT", "NC", "LC", "LOJ"].includes(source.value) ? source.value : void 0,
        ratingMin: ratingMin.value ? Number(ratingMin.value) : void 0,
        ratingMax: ratingMax.value ? Number(ratingMax.value) : void 0,
        luoguDifficultyMin: lgMin.value || void 0,
        luoguDifficultyMax: lgMax.value || void 0,
        tags: [...selectedTags]
      };
    }
    function updateDifficulty() {
      const min = lgMin.value, max = lgMax.value;
      const label = min && max ? min === max ? min : `${min} ～ ${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : "不限";
      currentDifficulty.textContent = `当前难度：洛谷 ${label}`;
    }
    function shiftDifficulty(delta) {
      const min = lgMin.selectedIndex, max = lgMax.selectedIndex, last = luoguLevels3.length;
      if (!min && !max) lgMin.selectedIndex = lgMax.selectedIndex = 1;
      else if (min && max) {
        const movement = Math.max(1 - Math.min(min, max), Math.min(last - Math.max(min, max), delta));
        lgMin.selectedIndex = min + movement;
        lgMax.selectedIndex = max + movement;
      } else {
        const selected = min ? lgMin : lgMax;
        selected.selectedIndex = Math.max(1, Math.min(last, selected.selectedIndex + delta));
      }
      updateDifficulty();
      saveFilters();
    }
    function render(value) {
      current = value.problem;
      if (current.clistRating === 0) {
        const zeroEstimate = current.estimatedCfRating === 0 || current.difficultyReference?.basis === "clist";
        current = { ...current, clistRating: null, clistRatingStatus: "no-data", ...zeroEstimate && !current.supplementInfo?.difficulty ? { estimatedCfRating: null, estimatedLuoguDifficulty: null } : {} };
      }
      renderedRevision = resultRevision;
      result.replaceChildren();
      clistRefreshButton = null;
      clistRefreshStatus = null;
      const meta = node2("div", "daily-problem-meta");
      meta.append(node2("span", "daily-source", platformName(current.source)));
      const nativeCf = current.source === "CF" && current.rating != null;
      const referenceCf = !nativeCf && current.estimatedCfRating != null;
      const cfLabel = nativeCf ? `CF 原生 ${current.rating}` : referenceCf ? `CF 参考 ${current.estimatedCfRating}` : current.clistRatingStatus === "no-data" ? "CF 参考：无数据" : "CF 难度：待评级";
      const cf = node2("span", `daily-cf ${nativeCf || referenceCf ? "daily-rating" : "daily-unrated"}${referenceCf ? " daily-estimated" : ""}`, cfLabel);
      const cfDifficulty = nativeCf || referenceCf ? Search.difficulty({ platform: "CF", rating: nativeCf ? current.rating : current.estimatedCfRating }) : null;
      if (cfDifficulty) cf.classList.add("difficulty-badge", `tone-${cfDifficulty.tone}`, ...cfDifficulty.rank ? [`rank-${cfDifficulty.rank}`] : []);
      cf.title = nativeCf ? "Codeforces 官方原生 Rating" : referenceCf ? "参考其他平台难度推算的 Codeforces Rating，不是官方评分" : "尚未获取 Codeforces 原生或参考评分";
      const nativeLuogu = current.luoguDifficulty ? luoguDifficultyLabel(current.luoguDifficulty) : "";
      const nativeLuoguLabel = nativeLuogu === "暂无评定" ? "" : nativeLuogu;
      const estimatedLuogu = current.estimatedLuoguDifficulty ? luoguDifficultyLabel(current.estimatedLuoguDifficulty) : "";
      const luogu = node2(
        "span",
        `daily-luogu${!nativeLuoguLabel && estimatedLuogu ? " daily-estimated" : ""}`,
        nativeLuoguLabel ? `洛谷难度：${nativeLuoguLabel}` : estimatedLuogu ? `洛谷参考：${estimatedLuogu}` : current.clistRatingStatus === "no-data" ? "洛谷参考：无数据" : "洛谷难度：待评级"
      );
      const luoguDifficulty = Search.difficulty({ platform: "LG", difficulty: nativeLuoguLabel || estimatedLuogu });
      if (luoguDifficulty.level !== null) luogu.classList.add("difficulty-badge", `tone-${luoguDifficulty.tone}`);
      else luogu.classList.add("daily-unrated");
      meta.append(cf, luogu);
      if (current.clistRating != null) meta.append(node2("span", "daily-rating daily-clist", `CLIST ${current.clistRating}`));
      else if (current.clistRatingStatus === "not-found") meta.append(node2("span", "daily-unrated daily-clist-status", "CLIST：未收录"));
      else if (current.clistRatingStatus === "no-data") meta.append(node2("span", "daily-unrated daily-clist-status", "CLIST：无数据"));
      else if (current.clistRatingStatus === "not-configured" || current.clistRatingStatus === "not-obtained") {
        const status = node2("span", "daily-unrated daily-clist-status", current.clistRatingStatus === "not-configured" ? "CLIST：未配置" : "CLIST：未获取");
        status.title = "尚未取得该题的 CLIST 评分，不代表这道题在 CLIST 未评级";
        meta.append(status);
      }
      const clistMetadata = [
        current.clistRatingCached ? "使用缓存评分" : "",
        current.clistRatingStale ? "缓存已过期，可刷新" : "",
        current.clistRatingQueriedAt ? `查询时间：${current.clistRatingQueriedAt}` : ""
      ].filter(Boolean).join("；");
      const clistBadge = meta.querySelector(".daily-clist, .daily-clist-status");
      if (clistBadge && clistMetadata) clistBadge.title = [clistBadge.title, clistMetadata].filter(Boolean).join("；");
      if (current.clistRatingCached) {
        const cache = node2("span", "daily-clist-cache", current.clistRatingStale ? "缓存·待更新" : "缓存");
        cache.title = clistMetadata;
        meta.append(cache);
      }
      if (typeof window.notebook?.refreshProblemClistRating === "function") {
        const url2 = current.url;
        clistRefreshButton = button2("刷新评分", "button subtle daily-clist-refresh", () => refreshClistRating(url2));
        clistRefreshButton.title = "重新查询该题的 CLIST 评分";
        clistRefreshStatus = node2("span", "daily-clist-refresh-status");
        clistRefreshStatus.setAttribute("role", "status");
        meta.append(clistRefreshButton, clistRefreshStatus);
        syncClistRefresh();
      }
      if (current.source !== "CF" && current.rating != null) meta.append(node2("span", "daily-rating", `来源评分 ${current.rating}`));
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
      if (!["CF", "LG"].includes(current.source) && current.clistRatingStatus === "not-found" && (referenceCf || !nativeLuoguLabel && Boolean(estimatedLuogu))) {
        const warning = node2("p", "daily-difficulty-warning", "CLIST 未收录：参考难度与实际难度可能存在很大偏差。");
        warning.setAttribute("role", "note");
        result.append(warning);
      }
      const problemTags = [...new Set((current.tags ?? []).filter((tag) => tag.trim()))];
      const tagArea = node2("div", "daily-result-tags");
      if (problemTags.length) {
        let syncTags2 = function() {
          toggle.textContent = resultTagsExpanded ? "收起算法标签" : "显示算法标签";
          toggle.setAttribute("aria-expanded", String(resultTagsExpanded));
          tagList.replaceChildren();
          tagList.hidden = !resultTagsExpanded;
          if (resultTagsExpanded) problemTags.forEach((tag) => tagList.append(node2("span", `tag ${tagColorClass(tag)}`, tag)));
        };
        var syncTags = syncTags2;
        const tagList = node2("div", "daily-problem-tags");
        tagList.id = `daily-result-tags-${generation}-${resultRevision}`;
        const toggle = button2("", "button subtle daily-tags-toggle", () => {
          if (generation !== contextGeneration || renderedRevision !== resultRevision) return;
          resultTagsExpanded = !resultTagsExpanded;
          syncTags2();
        });
        toggle.setAttribute("aria-controls", tagList.id);
        syncTags2();
        tagArea.append(toggle, tagList);
      } else tagArea.append(node2("span", "daily-tags-unavailable", "算法标签：未获取"));
      result.append(tagArea);
      if (typeof window.notebook?.getProblemEnrichment === "function") {
        const url2 = current.url;
        const supplement = button2("补充缺失信息 / AI 建议", "button subtle daily-enrichment-open", () => openProblemEnrichment(url2, () => {
          if (generation !== contextGeneration) return;
          void window.notebook.getProblemEnrichment(url2).then((view) => {
            if (generation !== contextGeneration || cachedResult?.problem.url !== url2 || !view.problem) return;
            cachedResult = { ...cachedResult, problem: view.problem };
            resultRevision += 1;
            notifyMount();
          }).catch(() => {
            if (generation === contextGeneration) {
              lastDrawError = "补充已保存，但结果刷新失败，请重新抽题查看";
              notifyMount();
            }
          });
        }));
        result.append(supplement);
      }
      if (current.supplementInfo) result.append(node2("span", "daily-supplement-source", current.supplementInfo.source === "ai" ? "AI 补充 · 已审核" : "人工补充"));
      const explanation = node2("details", "daily-rating-explanation");
      explanation.append(node2("summary", "", "题目信息"));
      if (current.ratingEstimateReason) {
        const reason = current.supplementInfo?.source === "ai" ? current.ratingEstimateReason.replace(/^(?:AI 建议（已确认）：)?AI 建议，待审核（低置信度）：/, "AI 参考（低置信度）：") : current.ratingEstimateReason;
        explanation.append(node2("p", "daily-reference-note", reason));
      }
      if (value.note) explanation.append(node2("p", "daily-problem-note", value.note));
      const diagnostics = value.diagnostics;
      coverage.hidden = !diagnostics;
      if (diagnostics) {
        const mode = { index: "本地索引", online: "在线数据", mixed: "索引与在线数据", scoped: "当前账号/资料库" }[diagnostics.dataMode];
        const platforms = Object.entries(diagnostics.platforms).map(([code, item]) => `${platformName(code)} ${item.count} 题（有标签 ${item.tagged}）`);
        coverage.textContent = `数据覆盖（${mode}）：${platforms.join("；") || "暂未获取平台统计"}；本次候选 ${diagnostics.candidateCount} 题`;
      } else coverage.textContent = "";
      explanation.append(coverage);
      if (current.ratingEstimateReason || value.note || diagnostics) result.append(explanation);
      result.append(loading, error);
      error.hidden = true;
      change.hidden = false;
      copy.hidden = !url;
    }
    function setBusy(value) {
      draw.disabled = value;
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
    function syncDrawState() {
      if (cachedResult && (current !== cachedResult.problem || renderedRevision !== resultRevision)) render(cachedResult);
      empty.hidden = Boolean(cachedResult || pendingRequest || lastDrawError);
      error.textContent = lastDrawError;
      error.hidden = !lastDrawError;
      duration.hidden = lastElapsedMs === null || pendingRequest !== null;
      duration.textContent = lastElapsedMs === null ? "" : `抽题耗时：${formatDuration(lastElapsedMs)}${lastDrawError ? "（本次未完成）" : ""}`;
      duration.title = lastElapsedMs === null ? "" : `客户端总耗时 ${lastElapsedMs.toFixed(1)} 毫秒（从发起抽题到请求完成）${lastServiceDurationMs === null ? "" : `；服务端处理 ${lastServiceDurationMs.toFixed(1)} 毫秒`}`;
      setBusy(pendingRequest !== null);
      syncClistRefresh();
    }
    async function drawProblem(excludeCurrent = false) {
      if (pendingRequest || generation !== contextGeneration) return;
      saveFilters();
      const filters2 = readFilters();
      if (excludeCurrent && current) filters2.excludedIds = [...new Set([current.id, current.url].filter(Boolean))];
      lastDrawError = "";
      lastElapsedMs = null;
      lastServiceDurationMs = null;
      resultTagsExpanded = false;
      resultRevision += 1;
      pendingClistRefresh = null;
      clistRefreshFeedback = null;
      const startedAt = performance.now();
      pendingRequest = Promise.resolve().then(() => drawApi(filters2)).then((value) => {
        if (generation === contextGeneration) {
          cachedResult = value;
          resultRevision += 1;
          const serviceDurationMs = value.diagnostics?.durationMs;
          lastServiceDurationMs = typeof serviceDurationMs === "number" && Number.isFinite(serviceDurationMs) ? serviceDurationMs : null;
        }
      }, (cause) => {
        if (generation === contextGeneration) lastDrawError = cause instanceof Error ? cause.message : "抽题失败，请稍后重试。";
      }).finally(() => {
        if (generation !== contextGeneration) return;
        lastElapsedMs = Math.max(0, performance.now() - startedAt);
        pendingRequest = null;
        notifyMount();
      });
      notifyMount();
      await pendingRequest;
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
    restoreFilters();
    latestMount = { section, sync: syncDrawState, restoreFilters, draw: () => drawProblem() };
    syncDrawState();
    if (!cachedResult && !pendingRequest && autoDraw && !autoDrawStarted) {
      autoDrawStarted = true;
      setTimeout(() => {
        if (generation !== contextGeneration) return;
        if (latestMount?.section.isConnected && !cachedResult && !pendingRequest) void latestMount.draw();
        else if (!cachedResult && !pendingRequest) autoDrawStarted = false;
      }, 260);
    }
    return section;
  }
  var DailyProblem = { create };
  return __toCommonJS(daily_problem_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["DailyProblem"] = __QMXStandalone["DailyProblem"];
})();
