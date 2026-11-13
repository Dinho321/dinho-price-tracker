/*
 * DinhoReviews price box v2: text on the left, small price-history chart on the right.
 * Reuses the site's classes (dr-highlight dr-highlight--price, dr-highlight__title, dr-chip), so palette
 * and fonts come from the theme. Own CSS is limited to the grid and the chart, scoped to .dinho-price.
 *
 * Article markup (Custom HTML block). The text inside is the static fallback shown if the script or data fail:
 *   <div class="dr-highlight dr-highlight--price dinho-price" data-model="SLUG">
 *     <p class="dr-highlight__title">Price check · 13 Nov 2026</p>
 *     <p>Model name: <a href="https://...">$1,099.99</a> at Lenovo, checked 13 Nov 2026.</p>
 *   </div>
 *
 * Data source, first match wins:
 *   1. <script type="application/json" id="dinho-prices-data"> on the page (used for tests)
 *   2. data-src on the box, or window.DINHO_PRICES_SRC, or (default) data/prices.json next to widget/price-box.js
 *      on the same host the script was loaded from; also accepts a WordPress REST response with the JSON in content.rendered.
 * No cookies, no storage, text inserted with textContent, links must be https. Failures keep the fallback.
 */
(function () {
  'use strict';
  if (window.__dinhoPriceBox) return;
  window.__dinhoPriceBox = true;
  var SCRIPT_SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : '';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  var CSS = [
    '.dinho-price .pb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,15rem);gap:.75rem 1.25rem;align-items:center}',
    '@media (max-width:640px){.dinho-price .pb-grid{grid-template-columns:minmax(0,1fr)}}',
    '.dinho-price .pb-name{margin:0 0 .2rem;font-weight:700}',
    '.dinho-price .pb-price{margin:0;overflow-wrap:normal;word-break:normal;font-family:var(--wp--preset--font-family--orbitron);font-size:1.75rem;font-weight:700;line-height:1.15;color:var(--wp--preset--color--contrast)}',
    '.dinho-price .pb-price a{color:inherit;text-decoration:none;border-bottom:3px solid #5FEDE6}',
    '.dinho-price .pb-price a:hover{color:var(--wp--preset--color--magenta-dark)}',
    '.dinho-price .pb-at{display:block;margin:.35rem 0 0;font-family:inherit;font-size:1rem;font-weight:700;color:var(--wp--preset--color--secondary);overflow-wrap:normal;word-break:normal}',
    '.dinho-price .pb-row{display:flex;justify-content:space-between;align-items:baseline;gap:.75rem;margin:.35rem 0 0;padding-top:.35rem;border-top:1px solid #DCE6FF;font-size:.95rem}',
    '.dinho-price .pb-row a,.dinho-price .pb-row span{color:inherit;text-decoration:none}',
    '.dinho-price .pb-row a:hover{color:var(--wp--preset--color--magenta-dark);text-decoration:underline}',
    '.dinho-price .pb-rn{font-weight:700;color:var(--wp--preset--color--secondary)}',
    '.dinho-price .pb-rp{font-weight:700;white-space:nowrap}',
    '.dinho-price .pb-third .pb-rn{font-weight:500;color:#5A6275}',
    '.dinho-price .pb-main{border-top:0;padding-top:0;align-items:center;margin-top:.1rem}',
    '.dinho-price .pb-main .pb-rn{font-size:1.1rem}',
    '.dinho-price .pb-main .pb-rp{font-family:var(--wp--preset--font-family--orbitron);font-size:1.6rem;line-height:1.15;color:var(--wp--preset--color--contrast);border-bottom:3px solid #5FEDE6}',
    '.dinho-price .pb-line{margin:.4rem 0 0;font-size:.95rem}',
    '.dinho-price .pb-meta{margin:.6rem 0 0;font-size:.8rem;color:#5A6275}',
    '.dinho-price .pb-warn{margin:.5rem 0 0;font-size:.85rem;font-weight:700;color:#C2146F}',
    '.dinho-price .pb-chart{display:block;width:100%;height:auto;overflow:visible}',
    '.dinho-price .pb-chart text{font-family:inherit}',
    '.dinho-price .pb-cap{margin:.2rem 0 0;font-size:.8rem;color:#5A6275;text-align:right}'
  ].join('');

  function isNum(v) { return typeof v === 'number' && isFinite(v) && v > 0; }

  function money(v) {
    var whole = Math.abs(v - Math.round(v)) < 0.005;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
        minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(v);
    } catch (e) { return '$' + v.toFixed(whole ? 0 : 2); }
  }

  function dparts(iso) { return /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); }
  function dnum(iso) { var p = dparts(iso); return p ? Date.UTC(+p[1], +p[2] - 1, +p[3]) : NaN; }
  function short(iso) { var p = dparts(iso); return p ? parseInt(p[3], 10) + ' ' + MONTHS[+p[2] - 1] : ''; }
  function full(iso) { var p = dparts(iso); return p ? parseInt(p[3], 10) + ' ' + MONTHS[+p[2] - 1] + ' ' + p[1] : ''; }
  function ageDays(iso) { return Math.floor((Date.now() - dnum(iso)) / 86400000); }

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function s(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // history: [[YYYY-MM-DD, price], ...] price changes in date order; lastDate: date of the latest check
  function buildChart(item, lastDate) {
    var hist = (item.history || []).filter(function (e) { return e && dparts(e[0]) && isNum(e[1]); });
    if (!hist.length) hist = [[item.checked, item.price]];
    var W = 300, H = 132, L = 64, R = 14, T = 14, B = 28;
    var pw = W - L - R, ph = H - T - B;
    var t0 = dnum(hist[0][0]), t1 = Math.max(dnum(lastDate), dnum(hist[hist.length - 1][0]));
    var prices = hist.map(function (e) { return e[1]; });
    var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    var flat = hi === lo;
    if (flat) { lo = hi * 0.97; hi = hi * 1.03; }
    function X(t) { return t1 === t0 ? L + pw / 2 : L + (t - t0) / (t1 - t0) * pw; }
    function Y(v) { return T + (hi - v) / (hi - lo) * ph; }

    var id = 'pbg' + (++uid);
    var svg = s('svg', { 'class': 'pb-chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var first = hist[0], last = hist[hist.length - 1];
    svg.setAttribute('aria-label', 'Price history from ' + short(first[0]) + ' to ' + short(lastDate) +
      ': ' + (flat ? 'unchanged at ' + money(last[1]) : 'from ' + money(first[1]) + ' to ' + money(last[1]) +
      ', low ' + money(Math.min.apply(null, prices)) + ', high ' + money(Math.max.apply(null, prices))));

    var defs = s('defs', {});
    var g = s('linearGradient', { id: id, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(s('stop', { offset: '0', 'stop-color': '#2B4BFF', 'stop-opacity': '.22' }));
    g.appendChild(s('stop', { offset: '1', 'stop-color': '#2B4BFF', 'stop-opacity': '0' }));
    defs.appendChild(g); svg.appendChild(defs);

    // baseline and top guide
    svg.appendChild(s('line', { x1: L, x2: W - R, y1: T + ph, y2: T + ph, stroke: '#DCE6FF', 'stroke-width': 1 }));
    if (!flat) svg.appendChild(s('line', { x1: L, x2: W - R, y1: T, y2: T, stroke: '#DCE6FF', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));

    // step path: price holds until the next change, then to the last check date
    var d = '', i, x, y;
    var pts = hist.map(function (e) { return [X(dnum(e[0])), Y(e[1]), e]; });
    d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (i = 1; i < pts.length; i++) d += ' H' + pts[i][0].toFixed(1) + ' V' + pts[i][1].toFixed(1);
    var single = t1 === t0;
    if (single) pts[0][0] = W - R;
    var endX = single ? W - R : X(t1), endY = pts[pts.length - 1][1];
    if (single) d = 'M' + L + ' ' + endY.toFixed(1);
    d += ' H' + endX.toFixed(1);
    var area = d + ' V' + (T + ph) + ' H' + (single ? L : pts[0][0].toFixed(1)) + ' Z';
    svg.appendChild(s('path', { d: area, fill: 'url(#' + id + ')', stroke: 'none' }));
    svg.appendChild(s('path', { d: d, fill: 'none', stroke: '#2B4BFF', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': single ? '2 7' : 'none' }));

    // change points get a small dot with a tooltip
    pts.forEach(function (p) {
      if (single) return;
      var c = s('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.5, fill: '#fff', stroke: '#2B4BFF', 'stroke-width': 1.5 });
      var t = s('title', {}); t.textContent = money(p[2][1]) + ' from ' + full(p[2][0]);
      c.appendChild(t); svg.appendChild(c);
    });
    // current price marker
    svg.appendChild(s('circle', { cx: endX.toFixed(1), cy: endY.toFixed(1), r: 5.5, fill: '#E6208C', stroke: '#fff', 'stroke-width': 1.5 }));

    function label(txt, tx, ty, anchor, fill, weight) {
      var n = s('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-size': 11, 'font-weight': weight, fill: fill });
      n.textContent = txt; svg.appendChild(n);
    }
    // little numbers: high and low (or the single price), then first and last date
    if (flat) {
      label(money(last[1]), L - 6, Y(last[1]) + 3.5, 'end', '#0D1566', 700);
    } else {
      label(money(Math.max.apply(null, prices)), L - 6, T + 3.5, 'end', '#0D1566', 700);
      label(money(Math.min.apply(null, prices)), L - 6, T + ph + 3.5, 'end', '#0D1566', 700);
    }
    if (t1 === t0) {
      label('Tracked ' + short(lastDate), W - R, H - 7, 'end', '#5A6275', 500);
    } else {
      label(short(hist[0][0]), L, H - 7, 'start', '#5A6275', 500);
      label(short(lastDate), W - R, H - 7, 'end', '#5A6275', 500);
    }
    return svg;
  }

  function caption(item) {
    var hist = (item.history || []).filter(function (e) { return e && dparts(e[0]) && isNum(e[1]); });
    if (hist.length < 2) return '';
    var prev = hist[hist.length - 2], last = hist[hist.length - 1], diff = last[1] - prev[1];
    var amt = money(Math.abs(diff));
    return (diff < 0 ? '▼ Down ' : '▲ Up ') + amt + ' since ' + short(last[0]);
  }

  function render(box, item) {
    var staleDays = parseInt(box.getAttribute('data-stale-days') || '14', 10);
    var stale = ageDays(item.checked) > staleDays;

    if (!document.getElementById('dinho-pb-css')) {
      var st = document.createElement('style'); st.id = 'dinho-pb-css'; st.textContent = CSS; document.head.appendChild(st);
    }

    var title = h('p', 'dr-highlight__title', 'Price check');
    var left = h('div', 'pb-left');
    left.appendChild(h('p', 'pb-name', item.name));

    function okUrl(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }
    function link(txt, url, cls) {
      if (!okUrl(url)) return h('span', cls, txt);
      var a = h('a', cls, txt); a.href = url; a.rel = 'noopener nofollow'; return a;
    }
    function row(cls, name, nameUrl, price, priceUrl) {
      var r = h('div', cls);
      r.appendChild(link(name, nameUrl, 'pb-rn'));
      r.appendChild(link(price, priceUrl, 'pb-rp'));
      return r;
    }
    left.appendChild(row('pb-row pb-main', item.seller || 'Retailer', item.url, money(item.price), item.url));

    var others = (item.others || []).filter(function (o) { return o && isNum(o.price); })
      .sort(function (x, y) { return x.price - y.price; });
    var retailers = others.filter(function (o) { return !o.thirdParty; });
    var third = others.filter(function (o) { return o.thirdParty; });
    retailers.slice(0, 2).forEach(function (o) {
      left.appendChild(row('pb-row', o.seller || 'Another retailer', o.url, money(o.price), o.url));
    });
    if (third.length) left.appendChild(row('pb-row pb-third', 'Third-party retailers', third[0].url, 'from ' + money(third[0].price), third[0].url));
    if (/^(strong|good|fair|weak)$/.test(item.value || '')) {
      var v = h('p', 'pb-line', 'Value at this price: ');
      v.appendChild(h('span', 'dr-chip', item.value));
      left.appendChild(v);
    }
    left.appendChild(h('p', 'pb-meta', 'Checked by DinhoReviews. Prices change.'));
    if (stale) left.appendChild(h('p', 'pb-warn', 'Checked more than ' + staleDays + ' days ago: the price may have changed.'));

    var right = h('div', 'pb-right');
    right.appendChild(buildChart(item, item.checked));
    var cap = caption(item); if (cap) right.appendChild(h('p', 'pb-cap', cap));

    var grid = h('div', 'pb-grid'); grid.appendChild(left); grid.appendChild(right);
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(title); box.appendChild(grid);
    box.setAttribute('data-state', stale ? 'stale' : 'fresh');
  }

  function parseAny(text) {
    var j = null;
    try { j = JSON.parse(text); } catch (e) { /* not plain JSON */ }
    if (j && j.products) return j;
    var rendered = text;
    if (Array.isArray(j) && j[0] && j[0].content) rendered = j[0].content.rendered;
    else if (j && j.content) rendered = j.content.rendered;
    var doc = new DOMParser().parseFromString(rendered, 'text/html');
    var t = doc.body.textContent || '';
    return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  }

  function load(box, cache) {
    var inline = document.getElementById('dinho-prices-data');
    if (inline) return Promise.resolve(JSON.parse(inline.textContent));
    var src = box.getAttribute('data-src') || window.DINHO_PRICES_SRC ||
      (SCRIPT_SRC ? SCRIPT_SRC.replace(/widget\/[^\/?#]*(\?.*)?$/, 'data/prices.json') : '');
    if (!src) return Promise.reject(new Error('no data source'));
    if (!cache[src]) {
      cache[src] = fetch(src, { cache: 'no-cache', credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(parseAny);
    }
    return cache[src];
  }

  function run() {
    var boxes = document.querySelectorAll('.dinho-price[data-model]');
    if (!boxes.length) return;
    var cache = {};
    Array.prototype.forEach.call(boxes, function (box) {
      load(box, cache).then(function (data) {
        var item = data && data.products && data.products[box.getAttribute('data-model')];
        if (!item || !isNum(item.price) || !item.name || !dparts(item.checked)) return; // keep fallback
        render(box, item);
      }).catch(function () { /* keep fallback */ });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
