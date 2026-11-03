# DinhoReviews price tracker

Tracks Best Buy prices through Best Buy's **official Products API** and shows each product's price history as an interactive chart (1M, 3M, 6M, 1Y, All, or custom dates) inside an article.

Why the API and not a scraper: Best Buy and Newegg block scrapers (and our rule is never to bypass bot checks), scrapers break whenever the page changes, and the API gives the retailer's own price in clean form. Best Buy is also the retailer the site already links to and has an affiliate program, so affiliate links can be added later without changing the tracker. Newegg has no free public price API; it can be added later through its affiliate feed.

```
products.json            what to track (slug + Best Buy SKU)
collector/collect.py     reads prices from the API, appends a point when the price CHANGES
.github/workflows/       runs the collector every 6 hours, free, commits data/
data/<slug>.json         the history (public, read by the chart)
widget/price-tracker.js  the chart (no libraries, 22 KB unminified)
widget/index.html        standalone chart page (also works in an iframe)
demo/                    SYNTHETIC data to preview the chart. Never publish it.
tests/                   collector test with a mock API; demo data generator
```

History starts the day the collector first runs. Nothing is back-filled or invented, so "1 year" shows one year only after a year of tracking. For Black Friday (27 Nov) the 1M view will be filled if tracking starts this week.

## One-time setup (about 20 minutes)

1. **Best Buy API key.** Register at developer.bestbuy.com (free). Read their Terms and Conditions page there before going live: check caching, display and attribution rules, and whether a content site with ads or affiliate links needs approval. Keep the key secret, never paste it in chat or in a file.
2. **GitHub.** Create a free account, a new **public** repository named `dinho-price-tracker`, and upload the contents of this folder (Add file, Upload files; the hidden `.github` folder must be included).
3. **Secret.** Repository Settings, Secrets and variables, Actions, New repository secret: name `BESTBUY_API_KEY`, value = your key.
4. **Pages.** Settings, Pages, Deploy from a branch, branch `main`, folder `/ (root)`. The data and chart then live at `https://YOUR-USER.github.io/dinho-price-tracker/`.
5. **SKUs.** Each Best Buy product page URL ends in its SKU (the number before `.p`). To search by name: `BESTBUY_API_KEY=... python3 collector/find_sku.py "lenovo loq 15 rtx 5060"`. Put the SKUs in `products.json`. The LOQ SKU already there comes from the project notes and must be checked against the product page. Check the configuration (RAM, SSD, GPU) matches the model named in the article.
6. **First run.** Repository Actions tab, "Collect prices", Run workflow. A `data/<slug>.json` file should appear. Compare the first price with the Best Buy page: the API price must match what a shopper sees. If it does not for a product (member-only or marketplace price), do not track that SKU.

## Adding a product later

Add a line to `products.json` (new `slug`, never rename an existing one, plus its `sku`). The history for it starts at the next run.

## Putting the chart in an article

Insert a Custom HTML block:

```html
<div class="dr-pt" data-slug="lenovo-loq-15-rtx-5060-16gb-512gb"></div>
<script src="https://YOUR-USER.github.io/dinho-price-tracker/widget/price-tracker.js"
        data-base="https://YOUR-USER.github.io/dinho-price-tracker/data/" defer></script>
```

Two charts on one page: two `div`s and ONE script. Options on the `div`: `data-theme="dark"`, `data-title="Custom heading"`.

**WordPress.com plan check (important).** Documentation found online says WordPress.com removes `<script>` and `<iframe>` from posts unless the plan allows plugins and custom code (Business or higher); Personal-plan details were contradictory, and I have not tested this on dinhoreviews.com yet. The test is quick: create a private draft with the block above and see whether the chart appears when previewed. If it does not:
- upgrade the plan (a site-wide decision, needs the owner's approval), or
- link to the standalone page `.../widget/index.html?slug=<slug>` from the article ("See the full price history"), which works on every plan.

**Privacy.** The chart loads from GitHub Pages, so the reader's browser contacts GitHub. The privacy notice (page 39) should say so before this goes live (needs owner approval).

## Updating prices in articles

The chart never replaces the dated price box. The article text still carries "price read at Best Buy on <date>" (project rule: primary source, dated), and the chart shows the history around it. The tracker's last-check time is printed in the chart header.

## Testing

```
python3 tests/test_collector.py          # collector against a mock API, no key needed
python3 tests/make_demo_data.py          # synthetic data for demo/demo.html
python3 -m http.server 8000              # open http://localhost:8000/demo/demo.html
```

## Known limits

- Tested with a mock API and in headless Chromium; not yet run against the live Best Buy API (no key in this environment). Step 6 above is that verification.
- Best Buy returns 403 for both a bad key and an exhausted quota (limits published by third parties: 5 calls per second, 50,000 per day; this job uses a handful of calls per run).
- Each SKU records the retailer's listing price. Marketplace-seller offers are not Best Buy prices and are not tracked.
- GitHub pauses scheduled workflows after 60 days without repository activity; the collector commits data, which counts as activity.
- Affiliate links: none yet (project rule: needs a disclosure page first). When the Best Buy affiliate program is joined, the `url` link in the chart header is the one place to change.
