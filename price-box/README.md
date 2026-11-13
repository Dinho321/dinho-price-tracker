# DinhoReviews price box

Compact "Price check" box with a small price-history chart, used at the end of the review part of articles.
Prices live only here, in `data/prices.json`; articles carry a small static fallback.
Own checks only (no API, no affiliate links, no copied third-party data). History starts the day a model is first checked.

- `widget/price-box.js` loads the box (no cookies, no storage, one fetch of `data/prices.json`)
- `data/prices.json` the data (USD, US)
- `tools/prices_tool.py` set / snippet / stale / validate (run with `python3 -I`)

The older folders of this repository (Best Buy API collector, chart) are not used by the box.
