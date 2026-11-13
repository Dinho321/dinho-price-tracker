#!/usr/bin/env python3
"""Maintain data/prices.json and print the article block for a model.

  prices_tool.py set SLUG --name "Crucial P310 1TB" --price 106.99 --checked 2026-11-13 \
       --url https://... [--seller "Retailer"] [--other "Seller=109.99"]...
  prices_tool.py snippet SLUG     # prints the Custom HTML block (with static fallback) for the article
  prices_tool.py stale [DAYS]     # lists models older than DAYS (default 14)
  prices_tool.py validate         # schema check, exit 1 on problems
Run with: python3 -I prices_tool.py ...
"""
import argparse, json, os, re, sys, datetime as dt, html

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "data", "prices.json")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def load():
    with open(PATH, encoding="utf-8") as f:
        return json.load(f)


def save(d):
    d["updated"] = max([p["checked"] for p in d["products"].values()] or [d.get("updated", "")])
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
        f.write("\n")


def money(v):
    return "${:,.0f}".format(v) if abs(v - round(v)) < 0.005 else "${:,.2f}".format(v)


def fmt_date(iso):
    y, m, d = iso.split("-")
    return f"{int(d)} {MONTHS[int(m)-1]} {y}"


def problems(d):
    out = []
    if d.get("currency") != "USD": out.append("currency must be USD")
    for slug, p in d.get("products", {}).items():
        if not SLUG.match(slug): out.append(f"{slug}: bad slug")
        if not isinstance(p.get("name"), str) or not p["name"].strip(): out.append(f"{slug}: name missing")
        if not isinstance(p.get("price"), (int, float)) or p["price"] <= 0: out.append(f"{slug}: bad price")
        try: dt.date.fromisoformat(p.get("checked", ""))
        except ValueError: out.append(f"{slug}: bad checked date")
        if p.get("url") and not p["url"].startswith("https://"): out.append(f"{slug}: url must be https")
        h = p.get("history", [])
        if h and h[-1][1] != p.get("price"): out.append(f"{slug}: last history price differs from price")
        if [x[0] for x in h] != sorted(x[0] for x in h): out.append(f"{slug}: history not in date order")
        if p.get("value") not in (None, "strong", "good", "fair", "weak"): out.append(f"{slug}: bad value")
        for o in p.get("others", []):
            if not isinstance(o.get("price"), (int, float)) or o["price"] <= 0: out.append(f"{slug}: bad other price")
            elif o["price"] < p.get("price", 0): out.append(f"{slug}: an 'other' seller is cheaper than the lowest price")
    return out


def snippet(d, slug):
    p = d["products"][slug]
    price = money(p["price"])
    a = f'<a href="{html.escape(p["url"], quote=True)}">{price}</a>' if p.get("url") else f"<strong>{price}</strong>"
    at = f' at {html.escape(p["seller"])}' if p.get("seller") else ""
    return (
        f'<!-- wp:html -->\n'
        f'<div class="dr-highlight dr-highlight--price dinho-price" data-model="{slug}">'
        f'<p class="dr-highlight__title">Price check · {fmt_date(p["checked"])}</p>'
        f'<p>{html.escape(p["name"])}: {a}{at}, checked {fmt_date(p["checked"])}.</p></div>\n'
        f'<!-- /wp:html -->'
    )


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("set"); s.add_argument("slug"); s.add_argument("--name", required=True)
    s.add_argument("--price", type=float, required=True); s.add_argument("--checked", required=True)
    s.add_argument("--url"); s.add_argument("--seller"); s.add_argument("--other", action="append", default=[])
    s.add_argument("--third", action="append", default=[], help='third-party seller "Name=price"')
    s.add_argument("--value", choices=["strong", "good", "fair", "weak"])
    n = sub.add_parser("snippet"); n.add_argument("slug")
    t = sub.add_parser("stale"); t.add_argument("days", nargs="?", type=int, default=14)
    sub.add_parser("validate")
    a = ap.parse_args()
    d = load()

    if a.cmd == "set":
        item = {"name": a.name, "price": a.price, "checked": a.checked}
        if a.seller: item["seller"] = a.seller
        if a.url: item["url"] = a.url
        oth = []
        for o in a.other:
            name, _, val = o.rpartition("=")
            oth.append({"seller": name, "price": float(val)})
        for o in a.third:
            name, _, val = o.rpartition("=")
            oth.append({"seller": name, "price": float(val), "thirdParty": True})
        if oth: item["others"] = oth
        if a.value: item["value"] = a.value
        old = d["products"].get(a.slug)
        hist = list(old.get("history", [])) if old else []
        if not hist or hist[-1][1] != a.price:
            hist.append([a.checked, a.price])
        item["history"] = hist
        if old and old["price"] != a.price:
            print(f"changed {a.slug}: {money(old['price'])} -> {money(a.price)}")
        d["products"][a.slug] = item
        d.pop("demo", None) if not any(k.startswith("demo-") for k in d["products"]) else None
        bad = problems(d)
        if bad: print("\n".join(bad)); sys.exit(1)
        save(d); print("saved", a.slug)
    elif a.cmd == "snippet":
        print(snippet(d, a.slug))
    elif a.cmd == "stale":
        today = dt.date.today()
        for slug, p in d["products"].items():
            age = (today - dt.date.fromisoformat(p["checked"])).days
            if age > a.days: print(f"{slug}\t{age} days\t{p['checked']}")
    elif a.cmd == "validate":
        bad = problems(d)
        print("\n".join(bad) if bad else "ok"); sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
