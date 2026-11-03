#!/usr/bin/env python3
"""DinhoReviews price tracker: collector.

Reads products.json, asks the Best Buy Products API (official, free key) for the
current price of each SKU and appends a point to data/<slug>.json ONLY when the
price (or stock state) changed. History is therefore a compact step series; the
chart extends the last point up to `last_checked`.

Standard library only. Never invents data: a SKU the API does not return, or one
with no price, is skipped and logged, nothing is written for it.

Env:
  BESTBUY_API_KEY   required (GitHub secret)
  BESTBUY_API_BASE  optional, override for tests (default https://api.bestbuy.com)
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = "sku,name,salePrice,regularPrice,onSale,url,onlineAvailability,orderable,condition"
CHUNK = 50            # SKUs per request (API accepts long "sku in(...)" lists)
PAUSE = 0.35          # seconds between requests (limit is 5 per second per key)
RETRIES = 4


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def api_get(url):
    last = None
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "dinhoreviews-price-tracker/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            # 403 is also what Best Buy returns for a bad key or an exhausted quota
            if e.code in (429, 500, 502, 503, 504, 403) and attempt < RETRIES - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            if attempt < RETRIES - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            raise
    raise last  # pragma: no cover


def fetch_products(skus, key, base):
    """Return {sku: product dict} for the SKUs the API knows."""
    found = {}
    for i in range(0, len(skus), CHUNK):
        chunk = skus[i:i + CHUNK]
        q = "sku in(" + ",".join(chunk) + ")"
        url = (f"{base}/v1/products({urllib.parse.quote(q, safe='(),')})?"
               + urllib.parse.urlencode({"apiKey": key, "format": "json", "show": FIELDS,
                                         "pageSize": 100}))
        data = api_get(url)
        for p in data.get("products", []):
            found[str(p.get("sku"))] = p
        time.sleep(PAUSE)
    return found


def money(v):
    if v is None:
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, path)


def update_history(entry, product, stamp):
    """Apply one observation. Returns 'new', 'changed', 'same' or 'skipped'."""
    sale = money(product.get("salePrice"))
    regular = money(product.get("regularPrice"))
    if sale is None:
        return "skipped"
    if regular is None:
        regular = sale
    avail = 1 if (product.get("onlineAvailability") or product.get("orderable") == "Available") else 0

    hist_path = ROOT / "data" / f"{entry['slug']}.json"
    hist = load_json(hist_path, None)
    if hist is None:
        hist = {
            "slug": entry["slug"], "sku": str(entry["sku"]), "retailer": "Best Buy", "currency": "USD",
            "tracking_since": stamp, "points": [],
        }
        status = "new"
    else:
        status = "same"

    hist["name"] = entry.get("name") or product.get("name") or hist.get("name", "")
    hist["category"] = entry.get("category", "")
    if product.get("url"):
        hist["url"] = product["url"]
    hist["last_checked"] = stamp

    pts = hist["points"]
    point = [stamp, sale, regular, avail]
    if not pts or pts[-1][1:4] != point[1:4]:
        pts.append(point)
        if status != "new":
            status = "changed"
    save_json(hist_path, hist)
    return status


def write_index(products_cfg):
    """data/index.json: one summary row per tracked product, for lists and the viewer."""
    rows = []
    for e in products_cfg:
        h = load_json(ROOT / "data" / f"{e['slug']}.json", None)
        if not h or not h.get("points"):
            continue
        last = h["points"][-1]
        rows.append({"slug": h["slug"], "name": h["name"], "category": h.get("category", ""),
                     "price": last[1], "regular": last[2], "last_checked": h["last_checked"],
                     "tracking_since": h["tracking_since"], "points": len(h["points"])})
    save_json(ROOT / "data" / "index.json", {"updated": now_iso(), "products": rows})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="fetch and report, write nothing")
    ap.add_argument("--config", default=str(ROOT / "products.json"))
    args = ap.parse_args()

    key = os.environ.get("BESTBUY_API_KEY", "").strip()
    if not key:
        print("ERROR: BESTBUY_API_KEY is not set", file=sys.stderr)
        return 2
    base = os.environ.get("BESTBUY_API_BASE", "https://api.bestbuy.com").rstrip("/")

    cfg = load_json(Path(args.config), {"products": []})
    entries = [e for e in cfg.get("products", []) if e.get("sku")]
    skipped_cfg = [e["slug"] for e in cfg.get("products", []) if not e.get("sku")]
    if skipped_cfg:
        print("WARN: no sku yet for:", ", ".join(skipped_cfg))
    if not entries:
        print("ERROR: no products with a sku in products.json", file=sys.stderr)
        return 2

    skus = [str(e["sku"]) for e in entries]
    try:
        found = fetch_products(skus, key, base)
    except Exception as e:  # network, bad key, quota
        print(f"ERROR: Best Buy API request failed: {e}", file=sys.stderr)
        return 1

    stamp = now_iso()
    counts = {"new": 0, "changed": 0, "same": 0, "skipped": 0, "missing": 0}
    for e in entries:
        p = found.get(str(e["sku"]))
        if p is None:
            counts["missing"] += 1
            print(f"WARN: sku {e['sku']} ({e['slug']}) not returned by the API")
            continue
        if args.dry_run:
            print(f"{e['slug']}: sale={p.get('salePrice')} regular={p.get('regularPrice')} "
                  f"online={p.get('onlineAvailability')}")
            continue
        res = update_history(e, p, stamp)
        counts[res] += 1
        if res == "skipped":
            print(f"WARN: {e['slug']} has no salePrice, nothing recorded")
    if not args.dry_run:
        write_index(entries)
    print(f"{stamp} done: {counts}")
    # fail the run only when nothing at all could be read, so a broken key is noticed
    return 1 if counts["missing"] + counts["skipped"] == len(entries) else 0


if __name__ == "__main__":
    sys.exit(main())
