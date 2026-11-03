/*! DinhoReviews price tracker widget. No dependencies.
 *
 * Usage (one script per page, one div per product):
 *   <div class="dr-pt" data-slug="lenovo-loq-15-rtx-5060-16gb-512gb"></div>
 *   <script src="https://YOUR-USER.github.io/dinho-price-tracker/widget/price-tracker.js"
 *           data-base="https://YOUR-USER.github.io/dinho-price-tracker/data/" defer></script>
 *
 * Optional on the div: data-base (overrides the script's), data-theme="dark", data-title="custom heading".
 * Data format: see README (data/<slug>.json, points = [isoTime, salePrice, regularPrice, inStock]).
 */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var DAY = 86400000;
  var NS = "http://www.w3.org/2000/svg";
  var RANGES = [["1M", 30], ["3M", 91], ["6M", 182], ["1Y", 365], ["All", 0]];

  var CSS = [
    ".dr-pt{--bg:#fff;--bd:#dde3f0;--ink:#0b1030;--ink2:#4a5068;--mut:#6b7186;--grid:#e6e9f2;--line:#2b4bff;--reg:#6b7186;--chip:#f4f8ff;--sel:#0d1566;--selt:#fff;",
    "box-sizing:border-box;position:relative;min-height:430px;margin:1.5em 0;padding:16px;background:var(--bg);color:var(--ink);border:1px solid var(--bd);border-radius:12px;font:inherit;line-height:1.4}",
    ".dr-pt[data-theme=dark]{--bg:#0b1030;--bd:#26305f;--ink:#f4f8ff;--ink2:#c3c8e0;--mut:#9aa1c4;--grid:#1d2552;--line:#4a9ef0;--reg:#9aa1c4;--chip:#151c47;--sel:#4a9ef0;--selt:#0b1030}",
    ".dr-pt *{box-sizing:border-box}",
    ".dr-pt__title{margin:0 0 2px;font-size:1rem;font-weight:700}",
    ".dr-pt__title a{color:inherit;text-decoration:underline;text-underline-offset:2px}",
    ".dr-pt__sub{margin:0 0 12px;font-size:.8125rem;color:var(--ink2)}",
    ".dr-pt__stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px 16px;margin:0 0 12px}",
    ".dr-pt__stat dt{font-size:.75rem;color:var(--ink2);margin:0}",
    ".dr-pt__stat dd{margin:0;font-size:1.125rem;font-weight:700;font-variant-numeric:tabular-nums}",
    ".dr-pt__stat--now dd{font-size:1.5rem}",
    ".dr-pt__ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}",
    ".dr-pt__btns{display:flex;flex-wrap:wrap;gap:6px}",
    ".dr-pt button{min-height:44px;min-width:44px;padding:0 14px;border:1px solid var(--bd);border-radius:8px;background:var(--chip);color:var(--ink);font:inherit;font-size:.875rem;font-weight:600;cursor:pointer}",
    ".dr-pt button[aria-pressed=true]{background:var(--sel);color:var(--selt);border-color:var(--sel)}",
    ".dr-pt button:focus-visible,.dr-pt input:focus-visible,.dr-pt svg:focus-visible{outline:2px solid var(--line);outline-offset:2px}",
    ".dr-pt__dates{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:.8125rem;color:var(--ink2)}",
    ".dr-pt__dates label{display:flex;align-items:center;gap:6px}",
    ".dr-pt input[type=date]{min-height:44px;padding:0 8px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:.875rem}",
    ".dr-pt__legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin:0 0 4px;font-size:.8125rem;color:var(--ink2)}",
    ".dr-pt__key{display:inline-block;width:18px;height:0;border-top:2px solid var(--line);vertical-align:middle;margin-right:6px}",
    ".dr-pt__key--reg{border-top:2px dashed var(--reg)}",
    ".dr-pt__plot{position:relative;transition:opacity .15s}",
    ".dr-pt__plot svg{display:block;width:100%;height:auto;touch-action:pan-y;overflow:visible}",
    ".dr-pt__tip{position:absolute;z-index:2;pointer-events:none;min-width:150px;padding:8px 10px;background:var(--bg);color:var(--ink);border:1px solid var(--bd);border-radius:8px;box-shadow:0 4px 14px rgba(11,16,48,.14);font-size:.8125rem;display:none}",
    ".dr-pt__tip b{display:block;font-size:1rem;font-variant-numeric:tabular-nums}",
    ".dr-pt__tip span{color:var(--ink2)}",
    ".dr-pt__note{margin:6px 0 0;font-size:.8125rem;color:var(--ink2)}",
    ".dr-pt__note--warn{color:#9a3412}.dr-pt[data-theme=dark] .dr-pt__note--warn{color:#fdba74}",
    ".dr-pt details{margin:10px 0 0;font-size:.8125rem}",
    ".dr-pt summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--ink2)}",
    ".dr-pt table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}",
    ".dr-pt th,.dr-pt td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--grid)}",
    ".dr-pt__foot{margin:10px 0 0;font-size:.75rem;color:var(--mut)}",
    ".dr-pt__err{padding:24px 8px;color:var(--ink2)}",
    "@media (max-width:480px){.dr-pt{padding:12px}.dr-pt button{padding:0 12px}}"
  ].join("");

  function injectCss() {
    if (document.getElementById("dr-pt-css")) return;
    var st = document.createElement("style");
    st.id = "dr-pt-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag), k;
    for (k in (attrs || {})) {
      if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function sv(tag, attrs) {
    var n = document.createElementNS(NS, tag), k;
    for (k in (attrs || {})) n.setAttribute(k, attrs[k]);
    return n;
  }

  var fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmtMoney0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var fmtDate = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });
  var fmtDateTime = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  var fmtShort = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
  var fmtHour = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric" });
  var fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

  function toInput(t) { // local yyyy-mm-dd for <input type=date>
    var d = new Date(t);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function fromInput(v, endOfDay) {
    var p = v.split("-");
    if (p.length !== 3) return NaN;
    return new Date(+p[0], +p[1] - 1, +p[2], endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0).getTime();
  }

  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    var a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [], v;
    for (v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }

  /* ---------- one widget instance ---------- */
  function Widget(root, base) {
    this.root = root;
    this.base = base;
    this.slug = root.getAttribute("data-slug");
    this.range = "1M";
    this.cursor = null; // timestamp under the pointer or keyboard
  }

  Widget.prototype.load = function () {
    var self = this;
    fetch(this.base + encodeURIComponent(this.slug) + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (!d.points || !d.points.length) throw new Error("no points");
        self.data = d;
        self.pts = d.points.map(function (p) { return { t: Date.parse(p[0]), p: p[1], r: p[2], a: p[3] }; });
        self.t0 = self.pts[0].t;
        self.tEnd = Date.parse(d.last_checked) || self.pts[self.pts.length - 1].t;
        self.build();
        self.draw();
        var lastW = self.plot.clientWidth, tm;
        window.addEventListener("resize", function () { clearTimeout(tm); tm = setTimeout(function () { if (self.plot.clientWidth !== lastW) { lastW = self.plot.clientWidth; self.draw(true); } }, 150); });
      })
      .catch(function () {
        self.root.style.minHeight = "0";
        self.root.textContent = "";
        self.root.appendChild(el("p", { "class": "dr-pt__err", text: "Price history is not available for this product right now." }));
      });
  };

  Widget.prototype.priceAt = function (t) {
    var i, pts = this.pts, best = pts[0];
    for (i = 0; i < pts.length; i++) { if (pts[i].t <= t) best = pts[i]; else break; }
    return best;
  };

  Widget.prototype.domain = function () {
    var start, end = this.tEnd;
    if (this.range === "custom") {
      start = this.cFrom; end = Math.min(this.cTo, this.tEnd);
    } else {
      var days = RANGES.filter(function (r) { return r[0] === this.range; }, this)[0][1];
      start = days ? end - days * DAY : this.t0;
    }
    this.truncated = start < this.t0;
    start = Math.max(start, this.t0);
    if (end - start < DAY) start = end - DAY; // a single reading still gets a visible frame
    return [start, end];
  };

  Widget.prototype.build = function () {
    var self = this, d = this.data, root = this.root;
    root.textContent = "";
    root.style.minHeight = "";
    root.removeAttribute("aria-busy");
    if (root.getAttribute("data-theme") !== "dark") root.removeAttribute("data-theme");

    var title = el("h3", { "class": "dr-pt__title" });
    var label = root.getAttribute("data-title") || d.name;
    if (d.url) {
      var a = el("a", { href: d.url, rel: "noopener", target: "_blank", text: label });
      title.appendChild(a);
    } else title.textContent = label;
    this.sub = el("p", { "class": "dr-pt__sub" });

    this.stats = el("dl", { "class": "dr-pt__stats" });

    var btns = el("div", { "class": "dr-pt__btns", role: "group", "aria-label": "Time range" });
    this.btns = {};
    RANGES.forEach(function (r) {
      var b = el("button", { type: "button", "aria-pressed": r[0] === self.range ? "true" : "false", text: r[0] });
      b.addEventListener("click", function () { self.setRange(r[0]); });
      self.btns[r[0]] = b;
      btns.appendChild(b);
    });
    var minD = toInput(this.t0), maxD = toInput(this.tEnd);
    this.inFrom = el("input", { type: "date", min: minD, max: maxD, "aria-label": "From date" });
    this.inTo = el("input", { type: "date", min: minD, max: maxD, "aria-label": "To date" });
    var onDate = function () {
      var f = fromInput(self.inFrom.value, false), t = fromInput(self.inTo.value, true);
      if (isNaN(f) || isNaN(t)) return;
      if (f > t) { var x = f; f = t; t = x; }
      self.cFrom = f; self.cTo = t; self.setRange("custom", true);
    };
    this.inFrom.addEventListener("change", onDate);
    this.inTo.addEventListener("change", onDate);
    var dates = el("div", { "class": "dr-pt__dates" }, [
      el("label", {}, [el("span", { text: "From" }), this.inFrom]),
      el("label", {}, [el("span", { text: "to" }), this.inTo])
    ]);
    var ctl = el("div", { "class": "dr-pt__ctl" }, [btns, dates]);

    this.legend = el("div", { "class": "dr-pt__legend" });
    this.plot = el("div", { "class": "dr-pt__plot" });
    this.tip = el("div", { "class": "dr-pt__tip", role: "presentation" });
    this.note = el("p", { "class": "dr-pt__note", "aria-live": "polite" });
    this.table = el("details", {}, [el("summary", { text: "Show price changes as a table" }), el("div")]);
    var foot = el("p", { "class": "dr-pt__foot", text: "Best Buy listing price in USD, before tax, read from Best Buy's product data. Prices change without notice; check Best Buy before you buy." });

    [title, this.sub, this.stats, ctl, this.legend, this.plot, this.note, this.table, foot].forEach(function (n) { root.appendChild(n); });
    this.plot.appendChild(this.tip);
  };

  Widget.prototype.setRange = function (r, fromDates) {
    this.range = r;
    var k;
    for (k in this.btns) this.btns[k].setAttribute("aria-pressed", k === r ? "true" : "false");
    this.cursor = null;
    this.draw(fromDates);
  };

  Widget.prototype.draw = function (keepInputs) {
    var self = this, dom = this.domain(), t1 = dom[0], t2 = dom[1], W = Math.max(300, Math.min(760, this.plot.clientWidth || 640)), H = W < 500 ? 250 : 300, L = 52, R = 52, T = 14, B = 30;
    var pts = this.pts, inRange = pts.filter(function (p) { return p.t >= t1 && p.t <= t2; });
    var first = this.priceAt(t1), hasBefore = pts[0].t <= t1;
    var series = (hasBefore ? [{ t: t1, p: first.p, r: first.r, a: first.a }] : []).concat(inRange.filter(function (p) { return !hasBefore || p.t > t1; }));
    var last = series[series.length - 1];
    var now = this.priceAt(t2);

    if (!keepInputs) { this.inFrom.value = toInput(t1); this.inTo.value = toInput(t2); }

    /* value extent */
    var vals = [], showReg = false;
    series.forEach(function (p) { vals.push(p.p); if (p.r > p.p + 0.005) { showReg = true; vals.push(p.r); } });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
    var ticks = niceTicks(lo - pad, hi + pad, 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
    var X = function (t) { return L + (t - t1) / (t2 - t1) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };

    /* stats */
    var low = Math.min.apply(null, series.map(function (p) { return p.p; }));
    var high = Math.max.apply(null, series.map(function (p) { return p.p; }));
    var changes = series.length - 1;
    this.stats.textContent = "";
    var addStat = function (k, v, cls) {
      self.stats.appendChild(el("div", { "class": "dr-pt__stat " + (cls || "") }, [el("dt", { text: k }), el("dd", { text: v })]));
    };
    addStat(t2 >= this.tEnd ? "Price now" : "Price on " + fmtShort.format(t2), fmtMoney.format(now.p), "dr-pt__stat--now");
    addStat("Lowest in range", fmtMoney.format(low));
    addStat("Highest in range", fmtMoney.format(high));
    if (now.r > now.p + 0.005) {
      addStat("Below regular price", fmtMoney.format(now.r - now.p) + " (" + Math.round((now.r - now.p) / now.r * 100) + "%)");
    } else addStat("Price changes", String(changes));
    this.sub.textContent = "Best Buy, US. Last checked " + fmtDateTime.format(this.tEnd) + ". Tracking since " + fmtDate.format(this.t0) + ".";

    /* svg */
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, role: "img", tabindex: "0",
      "aria-label": "Price history of " + this.data.name + " from " + fmtDate.format(t1) + " to " + fmtDate.format(t2) + ". Now " + fmtMoney.format(now.p) + ", lowest " + fmtMoney.format(low) + ", highest " + fmtMoney.format(high) + ". Use the left and right arrow keys to step through price changes." });
    var gridG = sv("g");
    ticks.forEach(function (v) {
      gridG.appendChild(sv("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: "var(--grid)", "stroke-width": 1 }));
      var tx = sv("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--mut)" });
      tx.textContent = fmtMoney0.format(v);
      gridG.appendChild(tx);
    });
    var span = t2 - t1, nx = W < 500 ? 3 : 5, i;
    for (i = 0; i < nx; i++) {
      var tt = t1 + span * i / (nx - 1);
      var tl = sv("text", { x: X(tt), y: H - 8, "text-anchor": i === 0 ? "start" : i === nx - 1 ? "end" : "middle", "font-size": 11, fill: "var(--mut)" });
      tl.textContent = (span > 200 * DAY ? fmtMonth : span <= 3 * DAY ? fmtHour : fmtShort).format(tt);
      gridG.appendChild(tl);
    }
    svg.appendChild(gridG);

    var stepPath = function (key) {
      var d = "", k;
      for (k = 0; k < series.length; k++) {
        var x = X(series[k].t), y = Y(series[k][key]);
        d += (k === 0 ? "M" : "H" + x.toFixed(1) + "V") + (k === 0 ? x.toFixed(1) + " " + y.toFixed(1) : y.toFixed(1));
      }
      return d + "H" + X(t2).toFixed(1);
    };
    var priceD = stepPath("p");
    var yBase = Y(y0);
    svg.appendChild(sv("path", { d: priceD + "V" + yBase + "H" + X(series[0].t) + "Z", fill: "var(--line)", "fill-opacity": 0.1 }));
    if (showReg) svg.appendChild(sv("path", { d: stepPath("r"), fill: "none", stroke: "var(--reg)", "stroke-width": 1.5, "stroke-dasharray": "5 4", "stroke-linejoin": "round" }));
    svg.appendChild(sv("path", { d: priceD, fill: "none", stroke: "var(--line)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

    /* end dot with surface ring + direct label */
    var ex = X(t2), ey = Y(now.p);
    svg.appendChild(sv("circle", { cx: ex, cy: ey, r: 6, fill: "var(--bg)" }));
    svg.appendChild(sv("circle", { cx: ex, cy: ey, r: 4, fill: "var(--line)" }));
    var endLbl = sv("text", { x: ex + 10, y: ey + 4, "font-size": 12, "font-weight": 700, fill: "var(--ink)" });
    endLbl.textContent = fmtMoney0.format(Math.round(now.p));
    svg.appendChild(endLbl);

    /* hover layer */
    var cross = sv("line", { y1: T, y2: H - B, stroke: "var(--mut)", "stroke-width": 1, visibility: "hidden" });
    var hdotRing = sv("circle", { r: 6, fill: "var(--bg)", visibility: "hidden" });
    var hdot = sv("circle", { r: 4, fill: "var(--line)", visibility: "hidden" });
    svg.appendChild(cross); svg.appendChild(hdotRing); svg.appendChild(hdot);

    var show = function (t) {
      t = Math.max(t1, Math.min(t2, t));
      var p = self.priceAt(t), x = X(t), y = Y(p.p);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      [hdot, hdotRing].forEach(function (c) { c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("visibility", "visible"); });
      self.tip.textContent = "";
      self.tip.appendChild(el("span", { text: fmtDate.format(t) }));
      self.tip.appendChild(el("b", { text: fmtMoney.format(p.p) }));
      self.tip.appendChild(el("span", { text: "Best Buy price" }));
      if (p.r > p.p + 0.005) self.tip.appendChild(el("div", {}, [el("span", { text: "Regular price " + fmtMoney.format(p.r) })]));
      if (!p.a) self.tip.appendChild(el("div", {}, [el("span", { text: "Not available to order online" })]));
      self.tip.style.display = "block";
      var rect = svg.getBoundingClientRect(), box = self.plot.getBoundingClientRect(), px = (x / W) * rect.width + (rect.left - box.left);
      var tw = self.tip.offsetWidth, left = px + 14;
      if (left + tw > box.width) left = px - tw - 14;
      self.tip.style.left = Math.max(0, left) + "px";
      self.tip.style.top = Math.max(0, (y / H) * rect.height - 10) + "px";
    };
    var hide = function () {
      cross.setAttribute("visibility", "hidden"); hdot.setAttribute("visibility", "hidden"); hdotRing.setAttribute("visibility", "hidden");
      self.tip.style.display = "none";
    };
    svg.addEventListener("pointermove", function (e) {
      var rect = svg.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width * W;
      show(t1 + (x - L) / (W - L - R) * (t2 - t1));
    });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      var ts = series.map(function (p) { return p.t; }), cur = self.cursor == null ? t2 : self.cursor, k, idx = ts.length - 1;
      for (k = ts.length - 1; k >= 0; k--) { if (ts[k] <= cur) { idx = k; break; } }
      if (e.key === "ArrowLeft") idx = (self.cursor == null) ? idx : Math.max(0, idx - (ts[idx] < cur ? 0 : 1));
      if (e.key === "ArrowRight") idx = Math.min(ts.length - 1, idx + 1);
      if (e.key === "Home") idx = 0;
      if (e.key === "End") idx = ts.length - 1;
      self.cursor = ts[idx];
      show(ts[idx]);
    });

    this.plot.querySelectorAll("svg").forEach(function (s) { s.remove(); });
    this.plot.insertBefore(svg, this.tip);

    /* legend: shown only when two series are drawn */
    this.legend.textContent = "";
    if (showReg) {
      this.legend.appendChild(el("span", {}, [el("i", { "class": "dr-pt__key" }), document.createTextNode("Best Buy price")]));
      this.legend.appendChild(el("span", {}, [el("i", { "class": "dr-pt__key dr-pt__key--reg" }), document.createTextNode("Regular price")]));
    }

    /* notes */
    var msgs = [], warn = false;
    if (this.truncated && this.range !== "All") msgs.push("History starts on " + fmtDate.format(this.t0) + ", when we began tracking this product, so longer ranges show the same data.");
    if (this.pts.length === 1) msgs.push("Tracking has just started: one reading so far. The line grows as the price changes.");
    else if (changes === 0) msgs.push("The price did not change in this range.");
    if (Date.now() - this.tEnd > 36 * 3600 * 1000) { msgs.push("The last check was more than a day and a half ago; the current price may differ."); warn = true; }
    this.note.className = "dr-pt__note" + (warn ? " dr-pt__note--warn" : "");
    this.note.textContent = msgs.join(" ");

    /* table view: every price change in range */
    var wrap = this.table.lastChild;
    wrap.textContent = "";
    var tbl = el("table"), thead = el("thead"), hr = el("tr");
    ["Date", "Best Buy price", "Regular price", "Online stock"].forEach(function (h) { hr.appendChild(el("th", { scope: "col", text: h })); });
    thead.appendChild(hr); tbl.appendChild(thead);
    var tb = el("tbody");
    series.slice().reverse().forEach(function (p) {
      tb.appendChild(el("tr", {}, [el("td", { text: fmtDateTime.format(p.t) }), el("td", { text: fmtMoney.format(p.p) }),
        el("td", { text: fmtMoney.format(p.r) }), el("td", { text: p.a ? "Available" : "Not available" })]));
    });
    tbl.appendChild(tb); wrap.appendChild(tbl);
  };

  /* ---------- boot ---------- */
  function boot() {
    injectCss();
    var scriptBase = SCRIPT && SCRIPT.getAttribute("data-base");
    var nodes = [].slice.call(document.querySelectorAll(".dr-pt[data-slug]"));
    var start = function (n) {
      if (n.__drpt) return;
      var base = n.getAttribute("data-base") || scriptBase || window.DRPT_BASE || "";
      if (base && base.slice(-1) !== "/") base += "/";
      n.__drpt = new Widget(n, base);
      n.__drpt.load();
    };
    nodes.forEach(function (n) { n.style.minHeight = "430px"; n.setAttribute("aria-busy", "true"); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } });
      }, { rootMargin: "300px" });
      nodes.forEach(function (n) { io.observe(n); });
    } else nodes.forEach(start);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
