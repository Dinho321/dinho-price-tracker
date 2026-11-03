#!/usr/bin/env python3
"""Write SYNTHETIC demo data to demo/data/. For testing the widget only.

Every name starts with "DEMO" so the data can never be mistaken for a real price.
Never copy demo/ files into data/ and never publish them on the site.
"""
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "demo" / "data"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(7)
END = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def series(days, start_price, regular, drops):
    """drops: {day_offset_from_start: price}; regular fixed."""
    pts, price = [], start_price
    start = END - timedelta(days=days)
    pts.append([iso(start), price, regular, 1])
    for off in sorted(drops):
        price = drops[off]
        pts.append([iso(start + timedelta(days=off, hours=random.randint(1, 20))), price, regular, 1])
    return pts, start


def write(slug, name, days, start_price, regular, drops, rows):
    pts, start = series(days, start_price, regular, drops)
    doc = {"slug": slug, "sku": "0000000", "name": name, "category": "demo", "retailer": "Best Buy",
           "currency": "USD", "url": "https://www.bestbuy.com/", "tracking_since": iso(start),
           "last_checked": iso(END), "points": pts}
    (OUT / f"{slug}.json").write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    rows.append({"slug": slug, "name": name, "category": "demo", "price": pts[-1][1], "regular": regular,
                 "last_checked": iso(END), "tracking_since": iso(start), "points": len(pts)})


rows = []
write("demo-long", "DEMO (synthetic data) Gaming laptop, 14 months of history", 430, 1449.99, 1599.99,
      {20: 1399.99, 60: 1499.99, 110: 1349.99, 150: 1449.99, 200: 1399.99, 260: 1299.99, 300: 1399.99,
       340: 1349.99, 380: 1299.99, 410: 1199.99, 424: 1099.99, 428: 1149.99}, rows)
write("demo-new", "DEMO (synthetic data) Laptop tracked for 9 days", 9, 699.99, 799.99,
      {3: 649.99, 7: 599.99}, rows)
write("demo-one", "DEMO (synthetic data) Product with a single reading", 0, 549.99, 549.99, {}, rows)
(OUT / "index.json").write_text(json.dumps({"updated": iso(END), "products": rows}, separators=(",", ":")) + "\n")
print("demo data written to", OUT)
