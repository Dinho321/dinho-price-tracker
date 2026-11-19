/*
 * DinhoReviews value tiers v1: shows the dollar range of each value tier (strong, good, fair, weak) for one model.
 * It never shows a store price and never links to a store. Same frame and palette as the price box
 * (dr-highlight dr-highlight--price), so fonts and colours come from the theme. Own CSS is scoped to .dinho-tiers.
 *
 * Article markup (Custom HTML block). The text inside is the static fallback for no-JS and search engines:
 *   <div class="dr-highlight dr-highlight--price dinho-tiers" data-model="PRODUCT_ID">
 *     <p class="dr-highlight__title">Value check</p>
 *     <p>Model name: strong value up to $A, good value up to $B, fair value up to $C, weak value above $C. Judged 19 Nov 2026.</p>
 *   </div>
 *
 * Data: data/value-tiers.json next to widget/ on the same host as this script (or data-src on the box):
 *   {"products": {"PRODUCT_ID": {"name": "...", "judged": "YYYY-MM-DD", "tiers": [A, B, C]}}}
 * tiers = upper limits of strong, good and fair (ascending); weak is everything above the last limit.
 * No cookies, no storage, text inserted with textContent. Failures keep the fallback.
 */
(function () {
  'use strict';
  if (window.__dinhoTiers) return;
  window.__dinhoTiers = true;
  var SCRIPT_SRC = document.currentScript ? (document.currentScript.src || '') : '';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var CSS = [
    '.dinho-tiers .vt-name{margin:0 0 .6rem;font-weight:700}',
    '.dinho-tiers .vt-bar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:0;padding:0;list-style:none}',
    '.dinho-tiers .vt-seg{display:flex;flex-direction:column;gap:.45rem;margin:0;padding:0}',
    '.dinho-tiers .vt-label{display:block;padding:.65rem .4rem;border-radius:6px;text-align:center;font-weight:700;font-size:.95rem;line-height:1.2}',
    '.dinho-tiers .vt-strong .vt-label{background:#E6208C;color:#fff}',
    '.dinho-tiers .vt-good .vt-label{background:#2B4BFF;color:#fff}',
    '.dinho-tiers .vt-fair .vt-label{background:#5FEDE6;color:#0D1566}',
    '.dinho-tiers .vt-weak .vt-label{background:#DCE6FF;color:#0D1566}',
    '.dinho-tiers .vt-range{display:block;text-align:center;font-family:var(--wp--preset--font-family--orbitron);font-size:1.05rem;font-weight:700;line-height:1.2;color:var(--wp--preset--color--contrast);overflow-wrap:normal;word-break:normal}',
    '.dinho-tiers .vt-meta{margin:.8rem 0 0;font-size:.8rem;color:#5A6275}',
    '@media (max-width:640px){.dinho-tiers .vt-bar{grid-template-columns:minmax(0,1fr);gap:.5rem}',
    '.dinho-tiers .vt-seg{flex-direction:row;align-items:center;justify-content:space-between;gap:.75rem}',
    '.dinho-tiers .vt-label{flex:0 0 8.5rem;padding:.55rem .4rem}',
    '.dinho-tiers .vt-range{flex:1 1 auto;text-align:right}}'
  ].join('');

  function isNum(v) { return Number.isFinite(v) ? v > 0 : false; }
  function money(v) {
    var whole = 0.005 > Math.abs(v - Math.round(v));
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
        minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(v);
    } catch (e) { return '$' + v.toFixed(whole ? 0 : 2); }
  }
  function dparts(iso) { return /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); }
  function full(iso) { var p = dparts(iso); return p ? parseInt(p[3], 10) + ' ' + MONTHS[+p[2] - 1] + ' ' + p[1] : ''; }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function validTiers(t) {
    if (!Array.isArray(t)) return false;
    if (t.length !== 3) return false;
    if (!t.every(isNum)) return false;
    return (t[1] - t[0] > 0) ? (t[2] - t[1] > 0) : false;
  }

  function render(box, item) {
    if (!document.getElementById('dinho-vt-css')) {
      var st = document.createElement('style'); st.id = 'dinho-vt-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var t = item.tiers;
    var segs = [
      ['strong', 'Strong value', 'up to ' + money(t[0])],
      ['good', 'Good value', money(t[0]) + ' to ' + money(t[1])],
      ['fair', 'Fair value', money(t[1]) + ' to ' + money(t[2])],
      ['weak', 'Weak value', 'above ' + money(t[2])]
    ];
    var list = h('ul', 'vt-bar');
    list.setAttribute('aria-label', 'Value tiers for ' + item.name);
    segs.forEach(function (sg) {
      var li = h('li', 'vt-seg vt-' + sg[0]);
      li.appendChild(h('span', 'vt-label', sg[1]));
      li.appendChild(h('span', 'vt-range', sg[2]));
      list.appendChild(li);
    });
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(h('p', 'dr-highlight__title', 'Value check'));
    box.appendChild(h('p', 'vt-name', item.name));
    box.appendChild(list);
    box.appendChild(h('p', 'vt-meta', 'The prices at which we rate the value of this model. Judged ' + full(item.judged) + ' by DinhoReviews.'));
    box.setAttribute('data-state', 'ready');
  }

  function load(box, cache) {
    var inline = document.getElementById('dinho-tiers-data');
    if (inline) { try { return Promise.resolve(JSON.parse(inline.textContent)); } catch (e) { return Promise.reject(e); } }
    var src = box.getAttribute('data-src') || window.DINHO_TIERS_SRC ||
      (SCRIPT_SRC ? SCRIPT_SRC.replace(/widget\/[^\/?#]*(\?.*)?$/, 'data/value-tiers.json') : '');
    if (!src) return Promise.reject(new Error('no data source'));
    if (!cache[src]) {
      cache[src] = fetch(src, { cache: 'no-cache', credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    return cache[src];
  }

  function run() {
    var boxes = document.querySelectorAll('.dinho-tiers[data-model]');
    if (!boxes.length) return;
    var cache = {};
    Array.prototype.forEach.call(boxes, function (box) {
      load(box, cache).then(function (data) {
        var item = data ? (data.products ? data.products[box.getAttribute('data-model')] : null) : null;
        if (!item || !item.name || !dparts(item.judged) || !validTiers(item.tiers)) return;
        render(box, item);
      }).catch(function () { /* keep fallback */ });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
