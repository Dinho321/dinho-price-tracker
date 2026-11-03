#!/usr/bin/env python3
"""Find Best Buy SKUs by keyword, so you can fill products.json.

  BESTBUY_API_KEY=... python3 collector/find_sku.py "lenovo loq 15 rtx 5060"

Prints sku, current price and name. Check the model and configuration against the
Best Buy product page before adding the sku (the URL ends in the same number).
"""
import json
import os
import sys
import urllib.parse
import urllib.request


def main():
    if len(sys.argv) < 2 or not os.environ.get("BESTBUY_API_KEY"):
        print('usage: BESTBUY_API_KEY=... find_sku.py "search words"', file=sys.stderr)
        return 2
    words = [w for w in sys.argv[1].split() if w]
    q = "&".join(f"search={urllib.parse.quote(w)}" for w in words)
    url = ("https://api.bestbuy.com/v1/products(" + q + ")?"
           + urllib.parse.urlencode({"apiKey": os.environ["BESTBUY_API_KEY"], "format": "json",
                                     "show": "sku,name,salePrice,regularPrice,url", "pageSize": 15,
                                     "sort": "salePrice.asc"}))
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.loads(r.read().decode())
    for p in data.get("products", []):
        print(f"{p['sku']}\t${p.get('salePrice')}\t(reg ${p.get('regularPrice')})\t{p['name']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
