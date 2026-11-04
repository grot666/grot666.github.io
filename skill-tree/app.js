/* supershero 技能树：所有技能数据来自 skills.json，本文件不包含任何技能定义。 */
(function () {
  "use strict";

  var TIER_LABEL = { T0: "T0 人类本能", T1: "T1 武术训练", T2: "T2 传承", P: "P 超能力" };
  var TYPE_LABEL = { active: "主动", passive: "被动", ultimate: "终极" };
  var SVG_NS = "http://www.w3.org/2000/svg";

  var data = null;
  var byId = {};
  var nodeEls = {};          // id -> 卡片元素
  var edges = [];            // {from, to, kind: "req"|"enh", el}
  var enhancedBy = {};       // T2 id -> [P id]
  var tree, svg, tooltip, scroller;
  var pinnedId = null;       // 点击（触屏）固定显示的节点
  var activeId = null;

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
      if (["state", "T0", "T1", "T2", "P"].indexOf(s.tier) < 0)
        console.warn("[skill-tree] " + s.id + " 的 tier 未知：" + s.tier);
      if (s.type && !TYPE_LABEL[s.type])
        console.warn("[skill-tree] " + s.id + " 的 type 未知：" + s.type);
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
      if (s.tier === "T2" && !(data.lineages || {})[s.lineage])
        console.warn("[skill-tree] " + s.id + " 的流派未知：" + s.lineage);
      if (s.tier === "P" && !(data.power_groups || {})[s.power_group])
        console.warn("[skill-tree] " + s.id + " 的能力组未知：" + s.power_group);
    });
  }

  /* ---------- 渲染 ---------- */
  function makeNode(s) {
    var n = el("div", "node tier-" + s.tier);
    n.id = "node-" + s.id;
    n.dataset.id = s.id;
    n.tabIndex = 0;
    n.setAttribute("role", "button");
    n.setAttribute("aria-describedby", "tooltip");
    if (s.lineage) n.classList.add("lin-" + s.lineage);
    if (s.power_group) n.classList.add("pg-" + s.power_group);
    n.classList.add("type-" + (s.type || "active"));
    var label = s.name_zh + "（" + s.name_en + "）";
    if (s.status === "coming_soon") {
      n.classList.add("coming-soon");
      label += "，即将开放";
    }
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

  function render() {
    var skills = data.skills;
    ["T0", "T1"].forEach(function (t) {
      var col = $("col-" + t);
      skills.filter(function (s) { return s.tier === t; }).forEach(function (s) { col.appendChild(makeNode(s)); });
    });

    // T2：按流派分组（流派顺序按 lineages 定义顺序，其后是未登记流派）
    var t2 = skills.filter(function (s) { return s.tier === "T2"; });
    var linKeys = Object.keys(data.lineages || {});
    t2.forEach(function (s) { if (linKeys.indexOf(s.lineage) < 0) linKeys.push(s.lineage); });
    var colT2 = $("col-T2");
    linKeys.forEach(function (k) {
      var list = t2.filter(function (s) { return s.lineage === k; });
      if (!list.length) return;
      var meta = (data.lineages || {})[k] || { name_zh: String(k), name_en: "" };
      var g = groupBox("lin", k, meta.name_zh, meta.name_en);
      list.forEach(function (s) { g.appendChild(makeNode(s)); });
      colT2.appendChild(g);
    });

    // P：按能力组分组
    var ps = skills.filter(function (s) { return s.tier === "P"; });
    var pgKeys = Object.keys(data.power_groups || {});
    ps.forEach(function (s) { if (pgKeys.indexOf(s.power_group) < 0) pgKeys.push(s.power_group); });
    var colP = $("col-P");
    pgKeys.forEach(function (k) {
      var list = ps.filter(function (s) { return s.power_group === k; });
      if (!list.length) return;
      var meta = (data.power_groups || {})[k] || { name_zh: String(k), name_en: "" };
      var g = groupBox("pg", k, meta.name_zh, meta.name_en);
      list.forEach(function (s) { g.appendChild(makeNode(s)); });
      colP.appendChild(g);
    });

    // 通用状态
    var st = $("states");
    skills.filter(function (s) { return s.tier === "state"; }).forEach(function (s) {
      var n = makeNode(s);
      n.classList.add("state-card");
      st.appendChild(n);
    });

    // 图例里的流派（来自数据）
    var lg = $("legend-lineages");
    Object.keys(data.lineages || {}).forEach(function (k) {
      lg.appendChild(el("span", "chip chip-lin lin-" + k, data.lineages[k].name_zh));
    });

    // 边
    skills.forEach(function (s) {
      if (s.tier === "state" || s.tier === "P") return;
      (s.requires || []).forEach(function (r) {
        if (byId[r] && nodeEls[r] && byId[r].tier !== "P" && byId[r].tier !== "state")
          edges.push({ from: r, to: s.id, kind: "req" });
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

  /* ---------- 连线 ---------- */
  function edgeClass(e) {
    var t = byId[e.to];
    if (e.kind === "enh") return "link link-enh";
    var c = "link link-req tier-" + t.tier;
    if (t.lineage) c += " lin-" + t.lineage;
    return c;
  }

  function markerFor(e) {
    var t = byId[e.to];
    if (e.kind === "enh") return "arrow-enh";
    if (t.tier === "T2") return "arrow-" + (t.lineage || "T2");
    return "arrow-" + t.tier;
  }

  function buildDefs() {
    var defs = document.createElementNS(SVG_NS, "defs");
    var names = ["T1", "T2", "enh"].concat(Object.keys(data.lineages || {}));
    names.forEach(function (n) {
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

  function rectIn(node, base) {
    var r = node.getBoundingClientRect();
    return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, b: r.bottom - base.top, cy: (r.top + r.bottom) / 2 - base.top };
  }

  function drawLinks() {
    var base = tree.getBoundingClientRect();
    svg.setAttribute("width", tree.scrollWidth);
    svg.setAttribute("height", tree.scrollHeight);
    svg.setAttribute("viewBox", "0 0 " + tree.scrollWidth + " " + tree.scrollHeight);
    edges.forEach(function (e) {
      var a = rectIn(nodeEls[e.from], base), b = rectIn(nodeEls[e.to], base);
      var d, x1, y1, x2, y2;
      if (e.kind === "enh") {
        // 超能力（右侧）→ 被强化的 T2（左侧）
        x1 = a.l; y1 = a.cy; x2 = b.r + 2; y2 = b.cy;
        var k = Math.max(40, (x1 - x2) * 0.5);
        d = "M" + x1 + "," + y1 + " C" + (x1 - k) + "," + y1 + " " + (x2 + k) + "," + y2 + " " + x2 + "," + y2;
      } else if (Math.abs(a.l - b.l) < 30) {
        // 同列前置：从右侧绕出
        x1 = a.r; y1 = a.cy; x2 = b.r + 2; y2 = b.cy;
        var bulge = 26 + Math.min(40, Math.abs(y2 - y1) * 0.15);
        d = "M" + x1 + "," + y1 + " C" + (x1 + bulge) + "," + y1 + " " + (x2 + bulge) + "," + y2 + " " + x2 + "," + y2;
      } else {
        x1 = a.r; y1 = a.cy; x2 = b.l - 2; y2 = b.cy;
        var dx = Math.max(30, (x2 - x1) * 0.5);
        d = "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2;
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
    if (activeId) highlight(activeId);
  }

  var rafPending = false;
  function scheduleDraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () { rafPending = false; drawLinks(); if (activeId) positionTooltip(activeId); });
  }

  /* ---------- 高亮 ---------- */
  function ancestors(id, acc) {
    acc = acc || {};
    if (acc[id]) return acc;
    acc[id] = true;
    var s = byId[id];
    if (s && s.tier !== "P" && s.tier !== "state")
      (s.requires || []).forEach(function (r) { if (byId[r]) ancestors(r, acc); });
    return acc;
  }

  function highlight(id) {
    var s = byId[id];
    var on = {};
    var onEdge = [];
    if (s.tier === "state") {
      on[id] = true;
    } else if (s.tier === "P") {
      on[id] = true;
      edges.forEach(function (e) { if (e.kind === "enh" && e.from === id) { on[e.to] = true; onEdge.push(e); } });
    } else {
      on = ancestors(id);
      edges.forEach(function (e) {
        if (e.kind === "req" && on[e.from] && on[e.to]) onEdge.push(e);
      });
      // 强化当前技能的超能力也一起亮起
      edges.forEach(function (e) { if (e.kind === "enh" && e.to === id) { on[e.from] = true; onEdge.push(e); } });
    }
    document.body.classList.add("focus-mode");
    Object.keys(nodeEls).forEach(function (k) {
      nodeEls[k].classList.toggle("hl", !!on[k]);
      nodeEls[k].classList.toggle("hl-self", k === id);
    });
    edges.forEach(function (e) { e.el && e.el.classList.toggle("hl", onEdge.indexOf(e) >= 0); });
  }

  function clearHighlight() {
    document.body.classList.remove("focus-mode");
    Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("hl", "hl-self"); });
    edges.forEach(function (e) { e.el && e.el.classList.remove("hl"); });
  }

  /* ---------- 提示框 ---------- */
  function names(ids) {
    return ids.map(function (r) { return byId[r] ? byId[r].name_zh : r; }).join("、");
  }

  function row(label, value, cls) {
    var r = el("div", "tt-row" + (cls ? " " + cls : ""));
    r.appendChild(el("span", "tt-k", label));
    r.appendChild(el("span", "tt-v", value));
    return r;
  }

  function fillTooltip(s) {
    tooltip.innerHTML = "";
    tooltip.className = "tooltip tt-tier-" + s.tier + (s.lineage ? " lin-" + s.lineage : "") + (s.type ? " type-" + s.type : "");

    if (s.image) {
      var fig = el("div", "tt-img");
      fig.hidden = true;
      var img = new Image();
      img.alt = s.name_zh + " 关键帧";
      img.onload = function () { fig.hidden = false; if (activeId === s.id) positionTooltip(s.id); };
      img.onerror = function () { if (fig.parentNode) fig.parentNode.removeChild(fig); };
      img.src = s.image;
      fig.appendChild(img);
      tooltip.appendChild(fig);
    }

    var head = el("div", "tt-head");
    head.appendChild(el("span", "tt-zh", s.name_zh));
    head.appendChild(el("span", "tt-en", s.name_en));
    tooltip.appendChild(head);

    var body = el("div", "tt-body");
    if (s.tier === "state") {
      body.appendChild(row("分类", "通用状态（非技能）"));
    } else {
      var tierText = s.tier;
      if (s.tier === "T2" && s.lineage) {
        var lin = (data.lineages || {})[s.lineage];
        tierText += " · " + (lin ? lin.name_zh : s.lineage);
      } else if (s.tier === "P") {
        var pg = (data.power_groups || {})[s.power_group];
        tierText = "超能力 · " + (pg ? pg.name_zh : s.power_group);
      } else {
        tierText = TIER_LABEL[s.tier] || s.tier;
      }
      body.appendChild(row("层级", tierText));
      if (s.type) body.appendChild(row("类型", TYPE_LABEL[s.type] || s.type, "tt-type"));

      if (s.tier === "P") {
        body.appendChild(row("获得方式", "先天 / 起源（不可学习）"));
        body.appendChild(row("升级", "消耗技能点"));
      } else if (s.tier === "T2") {
        var l2 = (data.lineages || {})[s.lineage];
        body.appendChild(row("解锁方式", "需要传承：" + (l2 ? l2.name_zh : s.lineage)));
      } else {
        body.appendChild(row("解锁方式", "消耗技能点：" + (s.cost != null ? s.cost : "—")));
      }

      if (s.energy_cost != null && s.energy_cost !== "")
        body.appendChild(row("能量消耗", String(s.energy_cost), "tt-energy"));

      if (s.tier !== "P")
        body.appendChild(row("前置技能", (s.requires && s.requires.length) ? names(s.requires) : "无"));

      if (s.enhances && s.enhances.length)
        body.appendChild(row("强化", names(s.enhances), "tt-enh"));
      if (enhancedBy[s.id])
        body.appendChild(row("可被强化", names(enhancedBy[s.id]), "tt-enh"));

      if (s.status === "coming_soon") {
        var cs = el("div", "tt-soon");
        cs.appendChild(lockIcon());
        cs.appendChild(document.createTextNode("即将开放"));
        body.appendChild(cs);
      }
    }
    tooltip.appendChild(body);
    if (s.desc) tooltip.appendChild(el("p", "tt-desc", s.desc));
  }

  function positionTooltip(id) {
    var n = nodeEls[id];
    if (!n || tooltip.hidden) return;
    var r = n.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var m = 10, gap = 12;
    tooltip.style.maxWidth = Math.min(320, vw - 2 * m) + "px";
    tooltip.style.left = "0px"; tooltip.style.top = "0px";
    var tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    var left, top, side;
    // 优先右侧，其次左侧，再其次下方 / 上方
    var isP = byId[id] && byId[id].tier === "P";
    if (r.right + gap + tw <= vw - m) { left = r.right + gap; side = "right"; }
    else if (!isP && r.left - gap - tw >= m) { left = r.left - gap - tw; side = "left"; }
    else { left = r.left + r.width / 2 - tw / 2; side = "v"; }
    // 超能力在最右列：提示框放在上下方，避免挡住左侧被强化的 T2 技能
    if (isP && side === "v") left = Math.max(r.left + r.width - tw, m);
    if (side === "v") {
      if (r.bottom + gap + th <= vh - m) top = r.bottom + gap;
      else if (r.top - gap - th >= m) top = r.top - gap - th;
      else top = vh - m - th;
    } else {
      top = r.top + r.height / 2 - th / 2;
    }
    left = Math.max(m, Math.min(left, vw - m - tw));
    top = Math.max(m, Math.min(top, vh - m - th));
    tooltip.style.left = Math.round(left) + "px";
    tooltip.style.top = Math.round(top) + "px";
    tooltip.dataset.side = side;
  }

  function show(id) {
    activeId = id;
    fillTooltip(byId[id]);
    tooltip.hidden = false;
    positionTooltip(id);
    highlight(id);
  }

  function hide() {
    activeId = null;
    pinnedId = null;
    tooltip.hidden = true;
    clearHighlight();
  }

  function nodeFrom(target) {
    return target && target.closest ? target.closest(".node") : null;
  }

  function bind() {
    var lastPointer = "mouse";
    document.addEventListener("pointerdown", function (ev) { lastPointer = ev.pointerType || "mouse"; }, true);

    document.addEventListener("mouseover", function (ev) {
      if (lastPointer !== "mouse") return;
      var n = nodeFrom(ev.target);
      if (n && n.dataset.id !== activeId) { pinnedId = null; show(n.dataset.id); }
    });
    document.addEventListener("mouseout", function (ev) {
      if (lastPointer !== "mouse" || pinnedId) return;
      var n = nodeFrom(ev.target);
      if (!n) return;
      var to = nodeFrom(ev.relatedTarget);
      if (to === n) return;
      if (!to && document.activeElement !== n) hide();
    });
    document.addEventListener("click", function (ev) {
      var n = nodeFrom(ev.target);
      if (n) {
        pinnedId = n.dataset.id;
        show(n.dataset.id);
      } else if (!tooltip.contains(ev.target)) {
        hide();
      }
    });
    document.addEventListener("focusin", function (ev) {
      var n = nodeFrom(ev.target);
      if (n) show(n.dataset.id);
    });
    document.addEventListener("focusout", function (ev) {
      var n = nodeFrom(ev.target);
      if (n && !nodeFrom(ev.relatedTarget) && !pinnedId) hide();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && activeId) {
        var cur = nodeEls[activeId];
        hide();
        if (cur) cur.blur();
      } else if ((ev.key === "Enter" || ev.key === " ") && nodeFrom(ev.target)) {
        ev.preventDefault();
        pinnedId = nodeFrom(ev.target).dataset.id;
        show(pinnedId);
      }
    });

    window.addEventListener("resize", scheduleDraw);
    scroller.addEventListener("scroll", function () { if (activeId) positionTooltip(activeId); }, { passive: true });
    window.addEventListener("scroll", function () { if (activeId) positionTooltip(activeId); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(scheduleDraw).observe(tree);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw);
  }

  function fail(msg) {
    var e = $("load-error");
    e.textContent = msg;
    e.hidden = false;
    console.error("[skill-tree] " + msg);
  }

  function init() {
    tree = $("tree"); svg = $("links"); tooltip = $("tooltip"); scroller = $("tree-scroll");
    fetch("skills.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        if (!json || !Array.isArray(json.skills)) throw new Error("skills.json 缺少 skills 数组");
        data = json;
        data.skills.forEach(function (s) { if (s && s.id) byId[s.id] = s; });
        validate();
        render();
        buildDefs();
        drawLinks();
        bind();
        document.body.classList.add("ready");
      })
      .catch(function (err) {
        fail("技能数据加载失败：" + err.message + "（如果是直接双击打开的本地文件，请用本地服务器访问）");
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
