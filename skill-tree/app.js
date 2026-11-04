/* supershero 技能树 v2：所有技能数据来自 skills.json，本文件不包含任何技能定义。 */
(function () {
  "use strict";

  var TIER_LABEL = { T0: "T0 人类本能", T1: "T1 武术训练", T2: "T2 传承", P: "P 超能力" };
  var TYPE_LABEL = { active: "主动", passive: "被动", ultimate: "终极" };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ZOOM_MIN = 0.5, ZOOM_MAX = 1.5, ZOOM_STEP = 0.1;

  var data = null, byId = {}, nodeEls = {}, edges = [];
  var lineageShown = null;   // 详情面板正在显示的传承（点击流派信息按钮）
  var originShown = null;    // 详情面板正在显示的能力来源
  var originFilter = null;   // 超能力列的来源筛选
  var groups = {};           // T2 流派 key -> 分组元素
  var STORE_KEY = "supershero.skilltree.collapsed.v2"; // {流派 key: 是否折叠}
  var OLD_STORE_KEY = "supershero.skilltree.collapsed";
  var canvas, svg, viewport, panel, panelEmpty, panelDetail;
  var pinnedId = null, previewId = null, shownId = null;
  var zoom = 1;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function lockIcon() {
    var s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "lock");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor"/>' +
      '<circle cx="12" cy="15.5" r="1.8" fill="#111"/>';
    return s;
  }

  /* ---------- 数据校验 ---------- */
  function checkAttrs(req, where) {
    Object.keys(req || {}).forEach(function (a) {
      if (!(data.attributes || {})[a]) console.warn("[skill-tree] " + where + " 的属性需求里有未知属性：" + a);
      if (typeof req[a] !== "number") console.warn("[skill-tree] " + where + " 的属性需求 " + a + " 应为数字");
    });
  }
  function validate() {
    var PO = data.power_origins || {};
    if (!Object.keys(PO).length) console.warn("[skill-tree] 缺少 power_origins（超能力来源）");
    Object.keys(PO).forEach(function (k) {
      var o = PO[k];
      if (!o.name_zh) console.warn("[skill-tree] 能力来源 " + k + " 缺少 name_zh");
      if (typeof o.innate !== "boolean") console.warn("[skill-tree] 能力来源 " + k + " 的 innate 应为 true / false");
      if (!o.how) console.warn("[skill-tree] 能力来源 " + k + " 缺少 how（获得方式）");
    });
    Object.keys(data.power_groups || {}).forEach(function (k) {
      if ((data.lineages || {})[k]) console.warn("[skill-tree] 超能力分组 " + k + " 与传承同名");
    });
    data.skills.forEach(function (s) {
      if (s.tier !== "P") return;
      if (!Array.isArray(s.origin) || !s.origin.length) console.warn("[skill-tree] 超能力 " + s.id + " 缺少 origin（能力来源）");
      else s.origin.forEach(function (o) { if (!PO[o]) console.warn("[skill-tree] 超能力 " + s.id + " 的来源未知：" + o); });
      if (s.drawback != null && typeof s.drawback !== "string") console.warn("[skill-tree] 超能力 " + s.id + " 的 drawback 应为文字");
      if (!(data.power_groups || {})[s.power_group]) console.warn("[skill-tree] 超能力 " + s.id + " 的分组未知：" + s.power_group);
    });
    Object.keys(data.lineages || {}).forEach(function (k) {
      var l = data.lineages[k];
      if (!l.attr_req || !Object.keys(l.attr_req).length) console.warn("[skill-tree] 传承 " + k + " 缺少 attr_req 属性需求");
      else checkAttrs(l.attr_req, "传承 " + k);
      if (!Array.isArray(l.sources) || !l.sources.length) console.warn("[skill-tree] 传承 " + k + " 缺少 sources 传承来源");
      else l.sources.forEach(function (src, i) { if (!src || !src.name) console.warn("[skill-tree] 传承 " + k + " 的第 " + i + " 个来源缺少 name"); });
    });
    var seen = {};
    data.skills.forEach(function (s, i) {
      if (!s.id) { console.warn("[skill-tree] 第 " + i + " 条技能缺少 id", s); return; }
      if (seen[s.id]) console.warn("[skill-tree] 重复的技能 id：" + s.id);
      seen[s.id] = true;
      if (["state", "T0", "T1", "T2", "P"].indexOf(s.tier) < 0) console.warn("[skill-tree] " + s.id + " 的 tier 未知：" + s.tier);
      if (s.icon != null && typeof s.icon !== "string") console.warn("[skill-tree] " + s.id + " 的 icon 应为图片路径字符串");
      if (s.type && !TYPE_LABEL[s.type]) console.warn("[skill-tree] " + s.id + " 的 type 未知：" + s.type);
    });
    data.skills.forEach(function (s) {
      (s.requires || []).forEach(function (r) {
        if (!byId[r]) console.warn("[skill-tree] " + s.id + " 的前置技能不存在：" + r);
        else if (s.tier === "P" || byId[r].tier === "P" || byId[r].tier === "state")
          console.warn("[skill-tree] " + s.id + " 的前置 " + r + " 不应参与前置连线（P 层 / 通用状态）");
      });
      if ((s.tier === "T2" || s.tier === "P") && s.requires && s.requires.length)
        console.warn("[skill-tree] " + s.id + " 是 " + s.tier + " 技能，不应有前置技能（requires 会被忽略）");
      if (s.enhances) console.warn("[skill-tree] " + s.id + " 含有已废弃的 enhances 字段（会被忽略）");
      if (s.attr_req) checkAttrs(s.attr_req, s.id);
      if (s.tier === "T2" && !(data.lineages || {})[s.lineage]) console.warn("[skill-tree] " + s.id + " 的流派未知：" + s.lineage);
      if (s.tier === "P" && !(data.power_groups || {})[s.power_group]) console.warn("[skill-tree] " + s.id + " 的能力组未知：" + s.power_group);
    });
  }

  /* ---------- 渲染 ---------- */
  function makeNode(s) {
    var n = el("div", "node tier-" + s.tier);
    n.id = "node-" + s.id;
    n.dataset.id = s.id;
    n.tabIndex = 0;
    n.setAttribute("role", "button");
    n.setAttribute("aria-controls", "panel");
    if (s.lineage) n.classList.add("lin-" + s.lineage);
    if (s.power_group) n.classList.add("pg-" + s.power_group);
    n.classList.add("type-" + (s.type || "active"));
    var label = s.name_zh + "（" + s.name_en + "）";
    if (s.status === "coming_soon") { n.classList.add("coming-soon"); label += "，即将开放"; }
    n.setAttribute("aria-label", label);
    var text = el("span", "node-text");
    text.appendChild(el("span", "node-zh", s.name_zh));
    text.appendChild(el("span", "node-en", s.name_en));
    if (s.icon) {
      n.classList.add("has-icon");
      var ic = new Image();
      ic.className = "node-icon";
      ic.alt = "";
      ic.width = 40;
      ic.height = 40;
      ic.decoding = "async";
      ic.onerror = function () { if (ic.parentNode) ic.parentNode.removeChild(ic); n.classList.remove("has-icon"); };
      ic.src = s.icon;
      n.appendChild(ic);
    }
    n.appendChild(text);
    var badges = el("span", "node-badges");
    if (s.energy_cost != null && s.energy_cost !== "") {
      var ec = String(s.energy_cost);
      var b = el("span", "badge badge-energy", "⚡" + (ec.length <= 3 ? ec : ""));
      b.title = "能量消耗：" + ec;
      badges.appendChild(b);
    }
    if (s.type === "ultimate") badges.appendChild(el("span", "badge badge-ult", "终极"));
    if (s.type === "passive") badges.appendChild(el("span", "badge badge-passive", "被动"));
    if (s.image) badges.appendChild(el("span", "badge badge-img", "▣"));
    if (badges.childNodes.length) n.appendChild(badges);
    if (s.tier === "P" && Array.isArray(s.origin)) {
      n.dataset.origins = s.origin.join(" ");
      var ob = el("span", "origin-badges");
      s.origin.forEach(function (k) {
        if ((data.power_origins || {})[k]) ob.appendChild(originIcon(k, "origin-mini"));
      });
      ob.title = "能力来源：" + s.origin.map(originName).join(" / ");
      text.appendChild(ob);
    }
    if (s.status === "coming_soon") {
      var cs = el("span", "soon");
      cs.appendChild(lockIcon());
      cs.appendChild(document.createTextNode("即将开放"));
      text.appendChild(cs);
    }
    nodeEls[s.id] = n;
    return n;
  }

  function originName(k) { var o = (data.power_origins || {})[k]; return o ? o.name_zh : k; }
  // 来源图标：优先用 SVG 文件，加载失败时退回为带颜色的单字徽章
  function originIcon(k, cls) {
    var o = (data.power_origins || {})[k] || {};
    var w = el("span", "origin-ic " + (cls || "") + " og-" + k);
    w.style.setProperty("--og", o.color || "#b388ff");
    w.setAttribute("aria-hidden", "true");
    var txt = function () { w.textContent = o.abbr || (o.name_zh || k).charAt(0); w.classList.add("origin-ic-txt"); };
    if (o.icon) {
      var im = new Image();
      im.alt = "";
      im.width = 16; im.height = 16;
      im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); txt(); };
      im.src = o.icon;
      w.appendChild(im);
    } else txt();
    return w;
  }
  function originChips(list) {
    var w = el("span", "tt-v origin-chips");
    list.forEach(function (k) {
      var o = (data.power_origins || {})[k] || {};
      var c = el("button", "origin-chip og-" + k);
      c.type = "button";
      c.dataset.origin = k;
      c.style.setProperty("--og", o.color || "#b388ff");
      c.setAttribute("aria-label", "查看能力来源：" + originName(k));
      c.appendChild(originIcon(k));
      c.appendChild(document.createTextNode(originName(k)));
      w.appendChild(c);
    });
    return w;
  }
  function originGainText(list) {
    var PO = data.power_origins || {};
    var inn = list.filter(function (k) { return PO[k] && PO[k].innate; }).length;
    if (inn === list.length) return "先天（无法后天获得）";
    if (inn === 0) return "后天获得（事故、改造、契约或神器）";
    return "先天觉醒，或后天经由事件获得";
  }

  function groupBox(cls, key, zh, en, count, collapsible, toggleKey, unit) {
    toggleKey = toggleKey || key;
    unit = unit || "个技能";
    var g = el("div", "group " + cls + "-" + key);
    g.dataset.group = key;
    var h = el("div", "group-head");
    if (collapsible) {
      h.classList.add("group-toggle");
      h.tabIndex = 0;
      h.setAttribute("role", "button");
      h.dataset.toggle = toggleKey;
      h.setAttribute("aria-label", zh + "，" + count + " " + unit + "，点击折叠或展开");
      var chev = el("span", "chev");
      chev.setAttribute("aria-hidden", "true");
      h.appendChild(chev);
    }
    h.appendChild(el("span", "group-zh", zh));
    h.appendChild(el("span", "group-en", en));
    if (collapsible) h.appendChild(el("span", "group-count", count + " " + unit));
    g.appendChild(h);
    if (collapsible && cls === "lin") {
      var lm = (data.lineages || {})[key] || {};
      var meta = el("div", "group-meta");
      var chips = attrChips(lm.attr_req);
      if (chips) meta.appendChild(chips);
      var info = el("button", "lin-info");
      info.type = "button";
      info.dataset.lineage = key;
      info.setAttribute("aria-label", zh + " 传承详情：属性需求和传承来源");
      info.appendChild(el("span", "lin-info-i", "i"));
      info.appendChild(document.createTextNode("传承来源 " + ((lm.sources || []).length)));
      meta.appendChild(info);
      g.appendChild(meta);
      g._meta = meta;
    }
    var items = el("div", "group-items");
    items.id = "group-items-" + toggleKey;
    if (collapsible) h.setAttribute("aria-controls", items.id);
    g.appendChild(items);
    g._items = items;
    g._head = h;
    return g;
  }

  function attrName(a) { var m = (data.attributes || {})[a]; return m ? m.name_zh : a; }
  function attrChips(req, big) {
    var keys = Object.keys(req || {});
    if (!keys.length) return null;
    var w = el("span", "attr-chips" + (big ? " attr-chips-big tt-v" : ""));
    keys.forEach(function (a) {
      var c = el("span", "attr-chip attr-" + a);
      c.appendChild(el("span", "attr-n", attrName(a)));
      c.appendChild(el("b", "attr-v", String(req[a])));
      c.title = attrName(a) + " ≥ " + req[a];
      w.appendChild(c);
    });
    return w;
  }

  function renderGrouped(tier, key, metaMap, colId, cls) {
    var list = data.skills.filter(function (s) { return s.tier === tier; });
    var keys = Object.keys(metaMap || {});
    list.forEach(function (s) { if (keys.indexOf(s[key]) < 0) keys.push(s[key]); });
    var col = $(colId);
    keys.forEach(function (k) {
      var items = list.filter(function (s) { return s[key] === k; });
      if (!items.length) return;
      var meta = (metaMap || {})[k] || { name_zh: String(k), name_en: "" };
      var tk = tier === "P" ? "pg-" + k : k;
      var g = groupBox(cls, k, meta.name_zh, meta.name_en, items.length, true, tk, tier === "P" ? "个能力" : "个技能");
      g._tier = tier;
      g._defaultCollapsed = !!meta.default_collapsed;
      items.forEach(function (s) { g._items.appendChild(makeNode(s)); });
      col.appendChild(g);
      groups[tk] = g;
    });
  }

  function renderOriginFilter() {
    var box = $("origin-filter");
    if (!box) return;
    var PO = data.power_origins || {};
    var all = el("button", "of-chip of-all is-on", "全部");
    all.type = "button";
    all.dataset.filter = "";
    all.setAttribute("aria-pressed", "true");
    box.appendChild(all);
    Object.keys(PO).forEach(function (k) {
      var c = el("button", "of-chip og-" + k);
      c.type = "button";
      c.dataset.filter = k;
      c.style.setProperty("--og", PO[k].color || "#b388ff");
      c.setAttribute("aria-pressed", "false");
      c.title = PO[k].name_zh + "（" + (PO[k].innate ? "先天" : "后天") + "）";
      c.appendChild(originIcon(k));
      c.appendChild(document.createTextNode(PO[k].name_zh));
      box.appendChild(c);
    });
  }
  function setFilter(k) {
    originFilter = k || null;
    Array.prototype.forEach.call(document.querySelectorAll(".of-chip"), function (c) {
      var on = (c.dataset.filter || null) === originFilter;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.body.classList.toggle("origin-filtering", !!originFilter);
    data.skills.forEach(function (s) {
      if (s.tier !== "P" || !nodeEls[s.id]) return;
      var hit = !originFilter || (s.origin || []).indexOf(originFilter) >= 0;
      nodeEls[s.id].classList.toggle("filtered-out", !hit);
    });
    Object.keys(groups).forEach(function (gk) {
      var g = groups[gk];
      if (g._tier !== "P") return;
      var n = g._items.querySelectorAll(".node:not(.filtered-out)").length;
      g.classList.toggle("filter-empty", !!originFilter && n === 0);
      var cnt = g._head.querySelector(".group-count");
      if (cnt) cnt.textContent = (originFilter ? n + "/" : "") + g._items.children.length + " 个能力";
    });
    var st = $("origin-filter-status");
    if (st) st.textContent = originFilter ? "只看「" + originName(originFilter) + "」来源的超能力" : "";
    if (originShown) renderPanel();
  }

  function render() {
    var skills = data.skills;
    ["T0", "T1"].forEach(function (t) {
      var col = $("col-" + t);
      skills.filter(function (s) { return s.tier === t; }).forEach(function (s) { col.appendChild(makeNode(s)); });
    });
    renderGrouped("T2", "lineage", data.lineages, "col-T2", "lin");
    renderOriginFilter();
    renderGrouped("P", "power_group", data.power_groups, "col-P", "pg");
    var st = $("states");
    skills.filter(function (s) { return s.tier === "state"; }).forEach(function (s) {
      var n = makeNode(s);
      n.classList.add("state-card");
      st.appendChild(n);
    });
    var lg = $("legend-lineages");
    Object.keys(data.lineages || {}).forEach(function (k) {
      lg.appendChild(el("span", "chip chip-lin lin-" + k, data.lineages[k].name_zh));
    });
    // 只有 T0 / T1 之间有前置连线；T2 从传承来源习得，超能力来自天生、变异、事故、改造等来源
    skills.forEach(function (s) {
      if (s.tier !== "T0" && s.tier !== "T1") return;
      (s.requires || []).forEach(function (r) {
        if (byId[r] && nodeEls[r] && (byId[r].tier === "T0" || byId[r].tier === "T1")) edges.push({ from: r, to: s.id, kind: "req" });
      });
    });
  }

  /* ---------- 连线（坐标相对画布，与滚动、缩放无关） ---------- */
  function edgeClass(e) {
    var t = byId[e.to];
    return "link link-req tier-" + t.tier + (t.lineage ? " lin-" + t.lineage : "");
  }
  function markerFor(e) {
    return "arrow-" + byId[e.to].tier;
  }
  function buildDefs() {
    var defs = document.createElementNS(SVG_NS, "defs");
    ["T1"].forEach(function (n) {
      var m = document.createElementNS(SVG_NS, "marker");
      m.setAttribute("id", "arrow-" + n);
      m.setAttribute("viewBox", "0 0 10 10");
      m.setAttribute("refX", "9");
      m.setAttribute("refY", "5");
      m.setAttribute("markerWidth", "7");
      m.setAttribute("markerHeight", "7");
      m.setAttribute("orient", "auto-start-reverse");
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", "M0,0 L10,5 L0,10 z");
      p.setAttribute("class", "arrowhead arrow-" + n);
      m.appendChild(p);
      defs.appendChild(m);
    });
    svg.appendChild(defs);
  }

  function canvasMetrics() {
    var r = canvas.getBoundingClientRect();
    // 屏幕像素 / 画布内部 CSS 像素（同时兼容 zoom 与 transform 缩放）
    var ratio = canvas.offsetWidth ? r.width / canvas.offsetWidth : 1;
    return { left: r.left, top: r.top, ratio: ratio || 1 };
  }
  function rectIn(node, m) {
    var r = node.getBoundingClientRect();
    var l = (r.left - m.left) / m.ratio, t = (r.top - m.top) / m.ratio;
    var w = r.width / m.ratio, h = r.height / m.ratio;
    return { l: l, r: l + w, t: t, b: t + h, cy: t + h / 2 };
  }

  function groupOf(id) {
    var s = byId[id];
    if (!s) return null;
    if (s.tier === "T2") return groups[s.lineage] || null;
    if (s.tier === "P") return groups["pg-" + s.power_group] || null;
    return null;
  }
  function isHidden(id) {
    var g = groupOf(id);
    return !!(g && g.classList.contains("collapsed"));
  }

  function drawLinks() {
    var m = canvasMetrics();
    edges.forEach(function (e) {
      var a = rectIn(nodeEls[e.from], m), b = rectIn(nodeEls[e.to], m);
      var d, x1, y1, x2, y2, k;
      if (Math.abs(a.l - b.l) < 30) {
        x1 = a.r; y1 = a.cy; x2 = b.r + 2; y2 = b.cy;
        k = 34 + Math.min(50, Math.abs(y2 - y1) * 0.12);
        d = "M" + x1 + "," + y1 + " C" + (x1 + k) + "," + y1 + " " + (x2 + k) + "," + y2 + " " + x2 + "," + y2;
      } else {
        x1 = a.r; y1 = a.cy; x2 = b.l - 2; y2 = b.cy;
        k = Math.max(40, (x2 - x1) * 0.5);
        d = "M" + x1 + "," + y1 + " C" + (x1 + k) + "," + y1 + " " + (x2 - k) + "," + y2 + " " + x2 + "," + y2;
      }
      if (!e.el) {
        e.el = document.createElementNS(SVG_NS, "path");
        e.el.setAttribute("class", edgeClass(e));
        e.el.setAttribute("marker-end", "url(#" + markerFor(e) + ")");
        e.el.dataset.from = e.from;
        e.el.dataset.to = e.to;
        svg.appendChild(e.el);
      }
      e.el.setAttribute("d", d);
    });
    applyHighlight();
  }
  var rafPending = false;
  function scheduleDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; drawLinks(); });
  }

  /* ---------- 高亮 ---------- */
  function ancestors(id, acc) {
    acc = acc || {};
    if (acc[id]) return acc;
    acc[id] = true;
    var s = byId[id];
    if (s && s.tier !== "P" && s.tier !== "state") (s.requires || []).forEach(function (r) { if (byId[r]) ancestors(r, acc); });
    return acc;
  }
  function applyHighlight() {
    var id = shownId;
    if (!id && originShown) {
      document.body.classList.add("focus-mode");
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle("hl", byId[k].tier === "P" && (byId[k].origin || []).indexOf(originShown) >= 0);
        nodeEls[k].classList.remove("hl-self");
      });
      edges.forEach(function (e) { if (e.el) e.el.classList.remove("hl"); });
    } else if (!id && lineageShown) {
      // 传承详情：高亮该流派的全部技能
      document.body.classList.add("focus-mode");
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle("hl", byId[k].lineage === lineageShown && byId[k].tier === "T2");
        nodeEls[k].classList.remove("hl-self");
      });
      edges.forEach(function (e) { if (e.el) e.el.classList.remove("hl"); });
    } else if (!id) {
      document.body.classList.remove("focus-mode");
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("hl", "hl-self"); });
      edges.forEach(function (e) { if (e.el) e.el.classList.remove("hl"); });
    } else {
      var s = byId[id], on = {}, onEdge = [];
      if (s.tier === "T0" || s.tier === "T1") {
        on = ancestors(id);
        edges.forEach(function (e) { if (on[e.from] && on[e.to]) onEdge.push(e); });
      } else on[id] = true;
      document.body.classList.add("focus-mode");
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle("hl", !!on[k]);
        nodeEls[k].classList.toggle("hl-self", k === id);
      });
      edges.forEach(function (e) { if (e.el) e.el.classList.toggle("hl", onEdge.indexOf(e) >= 0); });
    }
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], hit = false;
      if (id || lineageShown || originShown) Array.prototype.forEach.call(g._items.children, function (n) { if (n.classList.contains("hl")) hit = true; });
      if (lineageShown === k) hit = true;
      g._head.classList.toggle("hl", hit);
      g.classList.toggle("lin-selected", lineageShown === k && !id);
    });
    Object.keys(nodeEls).forEach(function (k) {
      var sel = k === pinnedId;
      nodeEls[k].classList.toggle("selected", sel);
      nodeEls[k].setAttribute("aria-pressed", sel ? "true" : "false");
    });
  }

  /* ---------- 详情面板 ---------- */
  function linkList(ids) {
    var wrap = el("span", "tt-v tt-links");
    ids.forEach(function (r, i) {
      if (i) wrap.appendChild(document.createTextNode("、"));
      if (byId[r]) {
        var b = el("button", "jump", byId[r].name_zh);
        b.type = "button";
        b.dataset.jump = r;
        b.title = "跳转到 " + byId[r].name_zh;
        wrap.appendChild(b);
      } else wrap.appendChild(document.createTextNode(r));
    });
    return wrap;
  }
  function row(label, value, cls) {
    var r = el("div", "tt-row" + (cls ? " " + cls : ""));
    r.appendChild(el("span", "tt-k", label));
    r.appendChild(typeof value === "string" ? el("span", "tt-v", value) : value);
    return r;
  }

  function renderPanel() {
    var id = shownId;
    document.body.classList.toggle("has-detail", !!(id || lineageShown || originShown));
    panelDetail.style.removeProperty("--og");
    if (!id && originShown) { renderOriginPanel(originShown); return; }
    if (!id && lineageShown) { renderLineagePanel(lineageShown); return; }
    if (!id) {
      panelDetail.hidden = true;
      panelDetail.innerHTML = "";
      panelEmpty.hidden = false;
      return;
    }
    var s = byId[id];
    panelEmpty.hidden = true;
    panelDetail.hidden = false;
    panelDetail.innerHTML = "";
    panelDetail.className = "panel-detail tt-tier-" + s.tier + (s.lineage ? " lin-" + s.lineage : "") + (s.type ? " type-" + s.type : "");

    var head = el("div", "tt-head");
    var names = el("div", "tt-names");
    names.appendChild(el("span", "tt-zh", s.name_zh));
    names.appendChild(el("span", "tt-en", s.name_en));
    head.appendChild(names);
    var state = el("span", "tt-state", id === pinnedId ? "已选中" : "预览");
    head.appendChild(state);
    if (id === pinnedId) {
      var x = el("button", "tt-close", "×");
      x.type = "button";
      x.setAttribute("aria-label", "取消选中");
      x.dataset.close = "1";
      head.appendChild(x);
    }

    if (s.image) {
      var fig = el("div", "tt-img");
      fig.hidden = true;
      var img = new Image();
      img.alt = s.name_zh + " 关键帧";
      img.onload = function () { fig.hidden = false; };
      img.onerror = function () { if (fig.parentNode) fig.parentNode.removeChild(fig); };
      img.src = s.image;
      fig.appendChild(img);
      panelDetail.appendChild(fig);
    }
    else if (s.icon) {
      var fig2 = el("div", "tt-icon tt-icon-" + s.tier);
      var ic = new Image();
      ic.alt = s.name_zh + " 示意图";
      ic.width = 180;
      ic.height = 180;
      ic.onerror = function () { if (fig2.parentNode) fig2.parentNode.removeChild(fig2); };
      ic.src = s.icon;
      fig2.appendChild(ic);
      panelDetail.appendChild(fig2);
    }
    panelDetail.appendChild(head);

    var body = el("div", "tt-body");
    if (s.tier === "state") {
      body.appendChild(row("分类", "通用状态（非技能）"));
    } else {
      var tierText;
      if (s.tier === "T2") {
        var lin = (data.lineages || {})[s.lineage];
        tierText = "T2 · " + (lin ? lin.name_zh : s.lineage);
      } else if (s.tier === "P") {
        var pg = (data.power_groups || {})[s.power_group];
        tierText = "超能力 · " + (pg ? pg.name_zh : s.power_group);
      } else tierText = TIER_LABEL[s.tier] || s.tier;
      body.appendChild(row("层级", tierText));
      if (s.type) body.appendChild(row("类型", TYPE_LABEL[s.type] || s.type));
      if (s.tier === "P") {
        var ol = Array.isArray(s.origin) ? s.origin : [];
        if (ol.length) {
          body.appendChild(row("能力来源", originChips(ol)));
          body.appendChild(row("获得方式", originGainText(ol)));
        }
        if (s.drawback) body.appendChild(row("代价", s.drawback, "tt-drawback"));
      } else if (s.tier === "T2") {
        var l2 = (data.lineages || {})[s.lineage] || {};
        body.appendChild(row("解锁方式", "从传承来源习得"));
        var req = s.attr_req || l2.attr_req;
        if (req) body.appendChild(row(s.attr_req ? "属性需求*" : "属性需求", attrChips(req, true)));
        if (l2.sources && l2.sources.length) body.appendChild(row("传承来源", sourceNames(l2.sources, s.lineage)));
      } else {
        body.appendChild(row("解锁方式", "消耗技能点：" + (s.cost != null ? s.cost : "—")));
      }
      if (s.energy_cost != null && s.energy_cost !== "") body.appendChild(row("能量消耗", String(s.energy_cost), "tt-energy"));
      if (s.tier === "T0" || s.tier === "T1") body.appendChild(row("前置技能", (s.requires && s.requires.length) ? linkList(s.requires) : "无"));
      if (s.attr_req && s.tier === "T2") body.appendChild(el("p", "tt-note", "* 此招式的属性需求高于本传承的基础需求。"));
      if (s.status === "coming_soon") {
        var cs = el("div", "tt-soon");
        cs.appendChild(lockIcon());
        cs.appendChild(document.createTextNode("即将开放"));
        body.appendChild(cs);
      }
    }
    panelDetail.appendChild(body);
    if (s.desc) panelDetail.appendChild(el("p", "tt-desc", s.desc));
  }

  function sourceNames(list, lineageKey) {
    var w = el("span", "tt-v tt-sources");
    list.forEach(function (src, i) {
      if (i) w.appendChild(document.createTextNode("、"));
      w.appendChild(el("span", "src-type src-" + (src.type || ""), src.type || "来源"));
      w.appendChild(document.createTextNode(src.name));
    });
    var more = el("button", "jump lin-more", "查看传承详情");
    more.type = "button";
    more.dataset.lineage = lineageKey;
    w.appendChild(more);
    return w;
  }

  function renderLineagePanel(k) {
    var l = (data.lineages || {})[k] || { name_zh: k, name_en: "" };
    panelEmpty.hidden = true;
    panelDetail.hidden = false;
    panelDetail.innerHTML = "";
    panelDetail.className = "panel-detail tt-tier-T2 tt-lineage lin-" + k;
    var head = el("div", "tt-head");
    var names = el("div", "tt-names");
    names.appendChild(el("span", "tt-kicker", "T2 传承"));
    names.appendChild(el("span", "tt-zh", l.name_zh));
    names.appendChild(el("span", "tt-en", l.name_en));
    head.appendChild(names);
    var x = el("button", "tt-close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "关闭传承详情");
    x.dataset.close = "1";
    head.appendChild(x);
    panelDetail.appendChild(head);
    var body = el("div", "tt-body");
    body.appendChild(row("习得方式", "满足属性需求后，从任一传承来源习得本流派的招式（无需前置技能）"));
    var chips = attrChips(l.attr_req, true);
    if (chips) body.appendChild(row("属性需求", chips));
    var skills = data.skills.filter(function (s) { return s.tier === "T2" && s.lineage === k; });
    body.appendChild(row("招式", linkList(skills.map(function (s) { return s.id; }))));
    panelDetail.appendChild(body);
    var srcs = l.sources || [];
    if (srcs.length) {
      var sec = el("div", "tt-src-list");
      sec.appendChild(el("h3", "tt-src-title", "传承来源"));
      srcs.forEach(function (src) {
        var c = el("div", "src-card");
        var t = el("div", "src-card-head");
        t.appendChild(el("span", "src-type src-" + (src.type || ""), src.type || "来源"));
        t.appendChild(el("b", "src-name", src.name));
        c.appendChild(t);
        if (src.desc) c.appendChild(el("p", "src-desc", src.desc));
        sec.appendChild(c);
      });
      panelDetail.appendChild(sec);
    }
  }
  function showLineage(k) {
    pinnedId = null; previewId = null; originShown = null; lineageShown = k; update();
  }
  function showOrigin(k) {
    pinnedId = null; previewId = null; lineageShown = null; originShown = k; update();
  }
  function renderOriginPanel(k) {
    var o = (data.power_origins || {})[k] || { name_zh: k, name_en: "" };
    panelEmpty.hidden = true;
    panelDetail.hidden = false;
    panelDetail.innerHTML = "";
    panelDetail.className = "panel-detail tt-tier-P tt-origin og-" + k;
    panelDetail.style.setProperty("--og", o.color || "#b388ff");
    var head = el("div", "tt-head");
    head.appendChild(originIcon(k, "origin-big"));
    var names = el("div", "tt-names");
    names.appendChild(el("span", "tt-kicker", "超能力来源 · " + (o.innate ? "先天" : "后天")));
    names.appendChild(el("span", "tt-zh", o.name_zh));
    names.appendChild(el("span", "tt-en", o.name_en || ""));
    head.appendChild(names);
    var x = el("button", "tt-close", "×");
    x.type = "button";
    x.setAttribute("aria-label", "关闭来源详情");
    x.dataset.close = "1";
    head.appendChild(x);
    panelDetail.appendChild(head);
    var body = el("div", "tt-body");
    body.appendChild(row("类别", o.innate ? "先天 · 不可后天获得" : "后天获得", o.innate ? "tt-innate" : "tt-acquired"));
    if (o.how) body.appendChild(row("获得方式", o.how));
    if (o.drawback) body.appendChild(row("典型代价", o.drawback, "tt-drawback"));
    var list = data.skills.filter(function (s) { return s.tier === "P" && (s.origin || []).indexOf(k) >= 0; });
    body.appendChild(row("相关能力", list.length ? linkList(list.map(function (s) { return s.id; })) : "暂无"));
    var fb = el("button", "of-toggle", originFilter === k ? "取消筛选" : "只看此来源的超能力");
    fb.type = "button";
    fb.dataset.filter = k;
    var wrap = el("div", "tt-actions");
    wrap.appendChild(fb);
    body.appendChild(wrap);
    panelDetail.appendChild(body);
    if (o.desc) panelDetail.appendChild(el("p", "tt-desc", o.desc));
  }

  function update() {
    var next = previewId || pinnedId || null;
    var changed = next !== shownId;
    shownId = next;
    applyHighlight();
    if (changed || true) renderPanel();
  }
  function preview(id) { if (previewId !== id) { previewId = id; update(); } }
  function endPreview() { if (previewId) { previewId = null; update(); } }
  function pin(id) {
    pinnedId = id; previewId = null; lineageShown = null; originShown = null; update();
    // 详情面板（尤其是手机底部抽屉）展开后视口会变小，确保选中的卡片仍然可见
    requestAnimationFrame(function () {
      var n = nodeEls[id];
      if (n && !isHidden(id)) n.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  function unpin() { pinnedId = null; previewId = null; lineageShown = null; originShown = null; update(); }

  function reveal(id, smooth) {
    var n = nodeEls[id];
    if (!n) return;
    var g = groupOf(id);
    var wait = g && g.classList.contains("collapsed");
    if (wait) setCollapsed(g._head.dataset.toggle, false);
    setTimeout(function () {
      n.scrollIntoView({ block: "center", inline: "center", behavior: smooth ? "smooth" : "auto" });
    }, wait ? ANIM_MS + 30 : 0);
  }

  /* ---------- T2 流派 / 超能力分组折叠 ---------- */
  var ANIM_MS = 260;
  // 返回 {key: bool}；没有记录的流派使用 skills.json 里的 default_collapsed
  function loadCollapsed() {
    var map = {};
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) map = JSON.parse(raw) || {};
      else {
        var old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || "null");
        if (Array.isArray(old)) old.forEach(function (k) { map[k] = true; });
      }
    } catch (e) { map = {}; }
    return map;
  }
  function saveCollapsed() {
    var map = {};
    Object.keys(groups).forEach(function (k) { map[k] = groups[k].classList.contains("collapsed"); });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch (e) { /* 隐私模式等情况下忽略 */ }
  }
  function followLinks(ms) {
    var end = performance.now() + ms;
    (function tick() {
      drawLinks();
      if (performance.now() < end) requestAnimationFrame(tick);
    })();
  }
  function setCollapsed(key, collapsed, instant) {
    var g = groups[key];
    if (!g || g.classList.contains("collapsed") === collapsed) return;
    var items = g._items;
    var reduce = instant || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (collapsed && shownId && groupOf(shownId) === g && pinnedId === shownId) { pinnedId = null; previewId = null; }
    g.classList.toggle("collapsed", collapsed);
    g._head.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) items.setAttribute("inert", ""); else items.removeAttribute("inert");
    items.setAttribute("aria-hidden", collapsed ? "true" : "false");
    if (reduce) {
      items.style.height = collapsed ? "0px" : "";
      drawLinks();
    } else {
      var full = items.scrollHeight;
      items.style.height = (collapsed ? full : 0) + "px";
      items.offsetHeight; // 强制回流，让过渡从起始高度开始
      items.style.height = (collapsed ? 0 : full) + "px";
      clearTimeout(items._t);
      items._t = setTimeout(function () {
        if (!g.classList.contains("collapsed")) items.style.height = "";
        drawLinks();
      }, ANIM_MS + 20);
      followLinks(ANIM_MS + 40);
    }
    saveCollapsed();
    if (!shownId || !collapsed) return;
    update();
  }
  function setAll(collapsed, tier) {
    Object.keys(groups).forEach(function (k) { if (!tier || groups[k]._tier === tier) setCollapsed(k, collapsed); });
  }

  /* ---------- 缩放 ---------- */
  function setZoom(z) {
    z = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 10) / 10;
    if (z === zoom) return;
    var cx = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom;
    var cy = (viewport.scrollTop + viewport.clientHeight / 2) / zoom;
    zoom = z;
    canvas.style.zoom = String(z);
    $("zoom-label").textContent = Math.round(z * 100) + "%";
    viewport.scrollLeft = cx * z - viewport.clientWidth / 2;
    viewport.scrollTop = cy * z - viewport.clientHeight / 2;
    drawLinks();
  }

  function nodeFrom(t) { return t && t.closest ? t.closest(".node") : null; }

  function bind() {
    // 悬停预览（仅鼠标）
    canvas.addEventListener("pointerover", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var n = nodeFrom(ev.target);
      if (n && !isHidden(n.dataset.id)) preview(n.dataset.id);
    });
    canvas.addEventListener("pointerout", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var n = nodeFrom(ev.target);
      if (n && nodeFrom(ev.relatedTarget) !== n && document.activeElement !== n) endPreview();
    });

    // 兜底：鼠标移到任何非技能卡区域时结束悬停预览（防止滚动或动画后残留）
    document.addEventListener("pointerover", function (ev) {
      if (ev.pointerType !== "mouse" || !previewId || nodeFrom(ev.target)) return;
      if (document.activeElement !== nodeEls[previewId]) endPreview();
    });

    // 拖拽平移（鼠标在空白处按下）
    var drag = null, suppressClick = false;
    viewport.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType !== "mouse" || ev.button !== 0 || nodeFrom(ev.target)) return;
      drag = { x: ev.clientX, y: ev.clientY, sl: viewport.scrollLeft, st: viewport.scrollTop, moved: false };
    });
    window.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; viewport.classList.add("dragging"); }
      if (drag.moved) {
        viewport.scrollLeft = drag.sl - dx;
        viewport.scrollTop = drag.st - dy;
        ev.preventDefault();
      }
    });
    window.addEventListener("pointerup", function () {
      if (drag && drag.moved) suppressClick = true;
      drag = null;
      viewport.classList.remove("dragging");
    });

    // 点击：选中 / 取消
    document.addEventListener("click", function (ev) {
      if (suppressClick) { suppressClick = false; return; }
      var j = ev.target.closest && ev.target.closest("[data-jump]");
      if (j) { var id = j.dataset.jump; pin(id); reveal(id, true); nodeEls[id].focus({ preventScroll: true }); return; }
      if (ev.target.closest && ev.target.closest("[data-close]")) { unpin(); return; }
      var fl = ev.target.closest && ev.target.closest("[data-filter]");
      if (fl) { var fk = fl.dataset.filter || ""; setFilter(fk && fk === originFilter ? "" : fk); return; }
      var og = ev.target.closest && ev.target.closest("[data-origin]");
      if (og) { showOrigin(og.dataset.origin); return; }
      var li = ev.target.closest && ev.target.closest("[data-lineage]");
      if (li) { showLineage(li.dataset.lineage); return; }
      var tg = ev.target.closest && ev.target.closest("[data-toggle]");
      if (tg) { var gk = tg.dataset.toggle; setCollapsed(gk, !groups[gk].classList.contains("collapsed")); return; }
      var all = ev.target.closest && ev.target.closest("[data-all]");
      if (all) { setAll(all.dataset.all === "collapse", all.dataset.tier || "T2"); return; }
      var n = nodeFrom(ev.target);
      if (n) { pin(n.dataset.id); return; }
      if (ev.target.closest && ev.target.closest(".panel, .zoom, .topbar")) return;
      unpin();
    });

    // 键盘
    canvas.addEventListener("focusin", function (ev) {
      var n = nodeFrom(ev.target);
      if (!n) return;
      n.scrollIntoView({ block: "nearest", inline: "nearest" });
      preview(n.dataset.id);
    });
    canvas.addEventListener("focusout", function (ev) {
      if (!nodeFrom(ev.relatedTarget)) endPreview();
    });
    document.addEventListener("keydown", function (ev) {
      var n = nodeFrom(ev.target);
      if (ev.key === "Escape") {
        unpin();
        if (n) n.blur();
      } else if ((ev.key === "Enter" || ev.key === " ") && ev.target.dataset && ev.target.dataset.toggle) {
        ev.preventDefault();
        var k2 = ev.target.dataset.toggle;
        setCollapsed(k2, !groups[k2].classList.contains("collapsed"));
      } else if ((ev.key === "Enter" || ev.key === " ") && n) {
        ev.preventDefault();
        pin(n.dataset.id);
      } else if ((ev.key === "+" || ev.key === "=") && !n && ev.target.tagName !== "INPUT") {
        setZoom(zoom + ZOOM_STEP);
      } else if (ev.key === "-" && !n && ev.target.tagName !== "INPUT") {
        setZoom(zoom - ZOOM_STEP);
      }
    });

    $("zoom-in").addEventListener("click", function () { setZoom(zoom + ZOOM_STEP); });
    $("zoom-out").addEventListener("click", function () { setZoom(zoom - ZOOM_STEP); });
    $("zoom-reset").addEventListener("click", function () { setZoom(1); });
    viewport.addEventListener("wheel", function (ev) {
      if (!ev.ctrlKey) return; // Ctrl/触控板捏合 = 缩放
      ev.preventDefault();
      setZoom(zoom + (ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });

    window.addEventListener("resize", scheduleDraw);
    if (window.ResizeObserver) new ResizeObserver(scheduleDraw).observe(canvas);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw);

    // 图例：窄屏默认收起
    var legend = $("legend");
    var mq = window.matchMedia("(max-width: 760px)");
    function syncLegend() { legend.open = !mq.matches; }
    syncLegend();
    if (mq.addEventListener) mq.addEventListener("change", syncLegend);
    legend.addEventListener("toggle", scheduleDraw);
  }

  function fail(msg) {
    var e = $("load-error");
    e.textContent = msg;
    e.hidden = false;
    console.error("[skill-tree] " + msg);
  }

  function init() {
    canvas = $("canvas"); svg = $("links"); viewport = $("viewport");
    panel = $("panel"); panelEmpty = $("panel-empty"); panelDetail = $("panel-detail");
    fetch("skills.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) {
        if (!json || !Array.isArray(json.skills)) throw new Error("skills.json 缺少 skills 数组");
        data = json;
        data.skills.forEach(function (s) { if (s && s.id) byId[s.id] = s; });
        validate();
        render();
        var saved = loadCollapsed();
        Object.keys(groups).forEach(function (k) {
          groups[k]._head.setAttribute("aria-expanded", "true");
          var want = Object.prototype.hasOwnProperty.call(saved, k) ? !!saved[k] : groups[k]._defaultCollapsed;
          if (want) setCollapsed(k, true, true);
        });
        buildDefs();
        bind();
        drawLinks();
        document.body.classList.add("ready");
      })
      .catch(function (err) { fail("技能数据加载失败：" + err.message + "（如果是直接双击打开的本地文件，请用本地服务器访问）"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
