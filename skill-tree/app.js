/* supershero 技能树 v2：所有技能数据来自 skills.json，本文件不包含任何技能定义。 */
(function () {
  "use strict";

  var TIER_LABEL = { T0: "T0 人类本能", T1: "T1 武术训练", T2: "T2 传承", P: "P 超能力" };
  var TYPE_LABEL = { active: "主动", passive: "被动", ultimate: "终极" };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ZOOM_MIN = 0.5, ZOOM_MAX = 1.5, ZOOM_STEP = 0.1;

  var data = null, byId = {}, nodeEls = {}, edges = [], enhancedBy = {};
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
  function validate() {
    var seen = {};
    data.skills.forEach(function (s, i) {
      if (!s.id) { console.warn("[skill-tree] 第 " + i + " 条技能缺少 id", s); return; }
      if (seen[s.id]) console.warn("[skill-tree] 重复的技能 id：" + s.id);
      seen[s.id] = true;
      if (["state", "T0", "T1", "T2", "P"].indexOf(s.tier) < 0) console.warn("[skill-tree] " + s.id + " 的 tier 未知：" + s.tier);
      if (s.type && !TYPE_LABEL[s.type]) console.warn("[skill-tree] " + s.id + " 的 type 未知：" + s.type);
    });
    data.skills.forEach(function (s) {
      (s.requires || []).forEach(function (r) {
        if (!byId[r]) console.warn("[skill-tree] " + s.id + " 的前置技能不存在：" + r);
        else if (s.tier === "P" || byId[r].tier === "P" || byId[r].tier === "state")
          console.warn("[skill-tree] " + s.id + " 的前置 " + r + " 不应参与前置连线（P 层 / 通用状态）");
      });
      (s.enhances || []).forEach(function (r) {
        if (!byId[r]) console.warn("[skill-tree] " + s.id + " 强化的技能不存在：" + r);
        else if (byId[r].tier !== "T2") console.warn("[skill-tree] " + s.id + " 强化的 " + r + " 不是 T2 技能");
      });
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
    n.appendChild(el("span", "node-zh", s.name_zh));
    n.appendChild(el("span", "node-en", s.name_en));
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
    if (s.status === "coming_soon") {
      var cs = el("span", "soon");
      cs.appendChild(lockIcon());
      cs.appendChild(document.createTextNode("即将开放"));
      n.appendChild(cs);
    }
    nodeEls[s.id] = n;
    return n;
  }

  function groupBox(cls, key, zh, en) {
    var g = el("div", "group " + cls + "-" + key);
    var h = el("div", "group-head");
    h.appendChild(el("span", "group-zh", zh));
    h.appendChild(el("span", "group-en", en));
    g.appendChild(h);
    return g;
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
      var g = groupBox(cls, k, meta.name_zh, meta.name_en);
      items.forEach(function (s) { g.appendChild(makeNode(s)); });
      col.appendChild(g);
    });
  }

  function render() {
    var skills = data.skills;
    ["T0", "T1"].forEach(function (t) {
      var col = $("col-" + t);
      skills.filter(function (s) { return s.tier === t; }).forEach(function (s) { col.appendChild(makeNode(s)); });
    });
    renderGrouped("T2", "lineage", data.lineages, "col-T2", "lin");
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
    skills.forEach(function (s) {
      if (s.tier === "state" || s.tier === "P") return;
      (s.requires || []).forEach(function (r) {
        if (byId[r] && nodeEls[r] && byId[r].tier !== "P" && byId[r].tier !== "state") edges.push({ from: r, to: s.id, kind: "req" });
      });
    });
    skills.forEach(function (s) {
      if (s.tier !== "P") return;
      (s.enhances || []).forEach(function (r) {
        if (byId[r] && nodeEls[r]) {
          edges.push({ from: s.id, to: r, kind: "enh" });
          (enhancedBy[r] = enhancedBy[r] || []).push(s.id);
        }
      });
    });
  }

  /* ---------- 连线（坐标相对画布，与滚动、缩放无关） ---------- */
  function edgeClass(e) {
    if (e.kind === "enh") return "link link-enh";
    var t = byId[e.to];
    return "link link-req tier-" + t.tier + (t.lineage ? " lin-" + t.lineage : "");
  }
  function markerFor(e) {
    var t = byId[e.to];
    if (e.kind === "enh") return "arrow-enh";
    if (t.tier === "T2") return "arrow-" + (t.lineage || "T2");
    return "arrow-" + t.tier;
  }
  function buildDefs() {
    var defs = document.createElementNS(SVG_NS, "defs");
    ["T1", "T2", "enh"].concat(Object.keys(data.lineages || {})).forEach(function (n) {
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

  function drawLinks() {
    var m = canvasMetrics();
    edges.forEach(function (e) {
      var a = rectIn(nodeEls[e.from], m), b = rectIn(nodeEls[e.to], m);
      var d, x1, y1, x2, y2, k;
      if (e.kind === "enh") {
        x1 = a.l; y1 = a.cy; x2 = b.r + 2; y2 = b.cy;
        k = Math.max(50, (x1 - x2) * 0.5);
        d = "M" + x1 + "," + y1 + " C" + (x1 - k) + "," + y1 + " " + (x2 + k) + "," + y2 + " " + x2 + "," + y2;
      } else if (Math.abs(a.l - b.l) < 30) {
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
    if (!id) {
      document.body.classList.remove("focus-mode");
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("hl", "hl-self"); });
      edges.forEach(function (e) { if (e.el) e.el.classList.remove("hl"); });
    } else {
      var s = byId[id], on = {}, onEdge = [];
      if (s.tier === "state") on[id] = true;
      else if (s.tier === "P") {
        on[id] = true;
        edges.forEach(function (e) { if (e.kind === "enh" && e.from === id) { on[e.to] = true; onEdge.push(e); } });
      } else {
        on = ancestors(id);
        edges.forEach(function (e) { if (e.kind === "req" && on[e.from] && on[e.to]) onEdge.push(e); });
        edges.forEach(function (e) { if (e.kind === "enh" && e.to === id) { on[e.from] = true; onEdge.push(e); } });
      }
      document.body.classList.add("focus-mode");
      Object.keys(nodeEls).forEach(function (k) {
        nodeEls[k].classList.toggle("hl", !!on[k]);
        nodeEls[k].classList.toggle("hl-self", k === id);
      });
      edges.forEach(function (e) { if (e.el) e.el.classList.toggle("hl", onEdge.indexOf(e) >= 0); });
    }
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
    document.body.classList.toggle("has-detail", !!id);
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
        body.appendChild(row("获得方式", "先天 / 起源（不可学习）"));
        body.appendChild(row("升级", "消耗技能点"));
      } else if (s.tier === "T2") {
        var l2 = (data.lineages || {})[s.lineage];
        body.appendChild(row("解锁方式", "需要传承：" + (l2 ? l2.name_zh : s.lineage)));
      } else {
        body.appendChild(row("解锁方式", "消耗技能点：" + (s.cost != null ? s.cost : "—")));
      }
      if (s.energy_cost != null && s.energy_cost !== "") body.appendChild(row("能量消耗", String(s.energy_cost), "tt-energy"));
      if (s.tier !== "P") body.appendChild(row("前置技能", (s.requires && s.requires.length) ? linkList(s.requires) : "无"));
      if (s.enhances && s.enhances.length) body.appendChild(row("强化", linkList(s.enhances), "tt-enh"));
      if (enhancedBy[s.id]) body.appendChild(row("可被强化", linkList(enhancedBy[s.id]), "tt-enh"));
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

  function update() {
    var next = previewId || pinnedId || null;
    var changed = next !== shownId;
    shownId = next;
    applyHighlight();
    if (changed || true) renderPanel();
  }
  function preview(id) { if (previewId !== id) { previewId = id; update(); } }
  function endPreview() { if (previewId) { previewId = null; update(); } }
  function pin(id) { pinnedId = id; previewId = null; update(); }
  function unpin() { pinnedId = null; previewId = null; update(); }

  function reveal(id, smooth) {
    var n = nodeEls[id];
    if (!n) return;
    n.scrollIntoView({ block: "center", inline: "center", behavior: smooth ? "smooth" : "auto" });
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
      if (n) preview(n.dataset.id);
    });
    canvas.addEventListener("pointerout", function (ev) {
      if (ev.pointerType !== "mouse") return;
      var n = nodeFrom(ev.target);
      if (n && nodeFrom(ev.relatedTarget) !== n && document.activeElement !== n) endPreview();
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
