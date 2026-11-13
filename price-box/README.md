# Price box and price database

Data (CSV, source of truth): `data/products.csv`, `data/retailers.csv`, `data/observations.csv` (append-only).
`data/prices.json` and `data/report.md` are generated: `python3 -I price-box/tools/pricedb.py build`.
Add a price: `pricedb.py add --date 2026-11-13 --product ID --retailer lenovo --price 999.99 --url https://... --source FILE`.
Other commands: `find`, `show`, `stale`, `snippet`, `validate`. Only quality `page` or `owner` feeds the website.
Main retailer rule: official store if within 5% of the lowest, else a store within 3%, else the lowest.
Widget: `widget/price-box.js` (box per `.dinho-price[data-model]`).
