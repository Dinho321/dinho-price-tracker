#!/usr/bin/env python3
"""Collector test against a MOCK Best Buy API (no network, no key needed).

Run: python3 tests/test_collector.py
Checks: first run creates history; unchanged run adds no point; a price change adds one;
missing sku and null price are skipped, not invented; index.json is written.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote

REPO = Path(__file__).resolve().parent.parent
STATE = {"prices": {"111": (1199.99, 1299.99), "222": (None, 500.0)}}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = unquote(self.path)
        assert "apiKey=testkey" in path, path
        out = []
        for sku, (sale, reg) in STATE["prices"].items():
            if f"sku in(" in path and sku in path.split("sku in(")[1].split(")")[0].split(","):
                out.append({"sku": int(sku), "name": f"Mock {sku}", "salePrice": sale, "regularPrice": reg,
                            "onSale": sale is not None and sale < reg, "url": f"https://www.bestbuy.com/{sku}.p",
                            "onlineAvailability": True, "orderable": "Available"})
        body = json.dumps({"products": out}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)


def run(work, port):
    env = dict(os.environ, BESTBUY_API_KEY="testkey", BESTBUY_API_BASE=f"http://127.0.0.1:{port}")
    return subprocess.run([sys.executable, str(work / "collector" / "collect.py")], env=env,
                          capture_output=True, text=True)


def main():
    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]
    work = Path(tempfile.mkdtemp())
    shutil.copytree(REPO / "collector", work / "collector")
    (work / "products.json").write_text(json.dumps({"products": [
        {"slug": "a", "sku": "111", "name": "A", "category": "laptops"},
        {"slug": "b", "sku": "222", "name": "B no price", "category": "laptops"},
        {"slug": "c", "sku": "333", "name": "C not in API", "category": "laptops"},
        {"slug": "d", "sku": None, "name": "D no sku yet"}]}))
    try:
        r = run(work, port); print(r.stdout.strip()); assert r.returncode == 0, r.stderr
        h = json.loads((work / "data" / "a.json").read_text())
        assert len(h["points"]) == 1 and h["points"][0][1:] == [1199.99, 1299.99, 1], h["points"]
        assert not (work / "data" / "b.json").exists(), "null price must not be recorded"
        assert not (work / "data" / "c.json").exists(), "missing sku must not be recorded"
        assert not (work / "data" / "d.json").exists()

        r = run(work, port); assert r.returncode == 0
        h = json.loads((work / "data" / "a.json").read_text())
        assert len(h["points"]) == 1, "unchanged price must not add a point"

        STATE["prices"]["111"] = (1099.99, 1299.99)
        r = run(work, port); assert r.returncode == 0
        h = json.loads((work / "data" / "a.json").read_text())
        assert len(h["points"]) == 2 and h["points"][1][1] == 1099.99, h["points"]

        idx = json.loads((work / "data" / "index.json").read_text())
        assert [p["slug"] for p in idx["products"]] == ["a"] and idx["products"][0]["price"] == 1099.99

        env = dict(os.environ); env.pop("BESTBUY_API_KEY", None)
        r = subprocess.run([sys.executable, str(work / "collector" / "collect.py")], env=env, capture_output=True, text=True)
        assert r.returncode == 2, "missing key must fail loudly"
        print("collector tests passed")
    finally:
        shutil.rmtree(work, ignore_errors=True)
        srv.shutdown()


if __name__ == "__main__":
    main()
