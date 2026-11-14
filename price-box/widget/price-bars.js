/*
 * DinhoReviews price bars: horizontal bars that compare the current price of several models.
 * Same data as the price box (data/prices.json), so every price check updates every article that uses it.
 *
 * Article markup (Custom HTML block). The text inside is the static fallback for no-JS and search engines:
 *   <div class="dr-highlight dr-highlight--price dinho-pricebars" data-models="slug-a,slug-b,slug-c"
 *        data-labels="Short name A|Short name B|Short name C" data-kind="gaming laptop">
 *     <p class="dr-highlight__title">Price comparison</p>
 *     <ul><li>Short name A: <a href="https://...">$1,149.99</a> at Best Buy</li> ...</ul>
 *   </div>
 * data-labels is optional (default: the product name from the data). data-kind is used in the caption.
 *
 * Cheapest first. Bar length = price / dearest price in the chart. Colours cycle cyan, blue, magenta.
 * Models with no usable price are left out; fewer than 2 priced models keeps the fallback.
 * No cookies, no storage, text set with textContent, links must be https. Failures keep the fallback.
 */
(function () {
  'use strict';
  if (window.__dinhoPriceBars) return;
  window.__dinhoPriceBars = true;
  var SCRIPT_SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var COLORS = [
    { bg: '#5FEDE6', fg: '#0B1030' },
    { bg: '#2B4BFF', fg: '#FFFFFF' },
    { bg: '#E6208C', fg: '#FFFFFF' }
  ];

  var CSS = [
    '.dinho-pricebars .pbar{margin:.9rem 0 0}',
    '.dinho-pricebars .pbar-top{display:flex;justify-content:space-between;align-items:baseline;gap:.75rem;margin:0 0 .25rem;font-size:.95rem}',
    '.dinho-pricebars .pbar-name{font-weight:700;color:var(--wp--preset--color--secondary);min-width:0;overflow-wrap:anywhere}',
    '.dinho-pricebars .pbar-at{font-weight:500;color:#5A6275}',
    '.dinho-pricebars .pbar-note{font-size:.85rem;color:#5A6275;text-align:right;flex:0 0 auto}',
    '.dinho-pricebars .pbar-note.is-low{font-weight:700;color:#0D1566}',
    '.dinho-pricebars .pbar-track{height:2.4rem;border-radius:999px;background:#EAF0FF;overflow:hidden}',
    '.dinho-pricebars .pbar-fill{display:flex;align-items:center;justify-content:flex-end;box-sizing:border-box;height:100%;min-width:6.5rem;padding:0 1rem;border-radius:999px;font-family:var(--wp--preset--font-family--orbitron);font-size:1rem;font-weight:700;white-space:nowrap}',
    '.dinho-pricebars .pbar-fill a{color:inherit;text-decoration:underline;text-underline-offset:3px}',
    '.dinho-pricebars .pbar-cap{margin:.9rem 0 0;font-size:.8rem;color:#5A6275}',
    '.dinho-pricebars .pbar-warn{margin:.5rem 0 0;font-size:.85rem;font-weight:700;color:#C2146F}'
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
  function ageDays(iso) { return Math.floor((Date.now() - dnum(iso)) / 86400000); }
  function okUrl(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pct(price, low) { return Math.round((price - low) / low * 1000) / 10; }

  function render(box, rows) {
    var staleDays = parseInt(box.getAttribute('data-stale-days') || '14', 10);
    if (!document.getElementById('dinho-pbars-css')) {
      var st = document.createElement('style'); st.id = 'dinho-pbars-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    rows.sort(function (a, b) { return a.item.price - b.item.price; });
    var low = rows[0].item.price, max = rows[rows.length - 1].item.price;
    var kind = box.getAttribute('data-kind') || 'model';
    var newest = rows.reduce(function (m, r) { return r.item.checked > m ? r.item.checked : m; }, '');
    var oldest = rows.reduce(function (m, r) { return r.item.checked < m ? r.item.checked : m; }, newest);

    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(h('p', 'dr-highlight__title', 'Price comparison'));

    var list = h('div', 'pbar-list');
    list.setAttribute('role', 'list');
    var summary = [];
    rows.forEach(function (r, i) {
      var it = r.item, c = COLORS[i % COLORS.length];
      var wrap = h('div', 'pbar'); wrap.setAttribute('role', 'listitem');
      var top = h('div', 'pbar-top');
      var nm = h('span', 'pbar-name', r.label);
      if (it.seller) nm.appendChild(h('span', 'pbar-at', ' at ' + it.seller));
      top.appendChild(nm);
      var note = i === 0 && rows.length > 1 && max > low ? 'Cheapest'
        : (it.price > low ? money(it.price - low) + ' (' + pct(it.price, low) + '%) more than the cheapest' : 'Same price as the cheapest');
      top.appendChild(h('span', 'pbar-note' + (i === 0 ? ' is-low' : ''), note));
      var track = h('div', 'pbar-track');
      var fill = h('div', 'pbar-fill');
      fill.style.width = Math.min(100, it.price / max * 100).toFixed(2) + '%';
      fill.style.background = c.bg; fill.style.color = c.fg;
      if (okUrl(it.url)) {
        var a = h('a', null, money(it.price)); a.href = it.url; a.rel = 'noopener nofollow'; fill.appendChild(a);
      } else fill.appendChild(h('span', null, money(it.price)));
      track.appendChild(fill);
      wrap.appendChild(top); wrap.appendChild(track); list.appendChild(wrap);
      summary.push(r.label + ' ' + money(it.price) + (it.seller ? ' at ' + it.seller : ''));
    });
    box.appendChild(list);
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Price bars, cheapest first: ' + summary.join('; '));
    box.appendChild(h('p', 'pbar-cap', 'Bar length = price as a share of the dearest ' + kind + '. Tracked ' + short(newest) + '.'));
    if (ageDays(oldest) > staleDays) box.appendChild(h('p', 'pbar-warn', 'At least one price was checked more than ' + staleDays + ' days ago and may have changed.'));
    box.setAttribute('data-state', 'rendered');
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
    var boxes = document.querySelectorAll('.dinho-pricebars[data-models]');
    if (!boxes.length) return;
    var cache = {};
    Array.prototype.forEach.call(boxes, function (box) {
      load(box, cache).then(function (data) {
        var ids = (box.getAttribute('data-models') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        var labels = (box.getAttribute('data-labels') || '').split('|').map(function (x) { return x.trim(); });
        var rows = [];
        ids.forEach(function (id, i) {
          var it = data && data.products && data.products[id];
          if (!it || !isNum(it.price) || !dparts(it.checked)) return;
          rows.push({ item: it, label: labels[i] || it.name });
        });
        if (rows.length < 2) return; // keep fallback
        render(box, rows);
      }).catch(function () { /* keep fallback */ });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
