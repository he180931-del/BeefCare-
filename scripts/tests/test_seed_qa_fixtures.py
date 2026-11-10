"""Exercise the fixture client against a fake HTTP backend, not the real database."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("qa_fixtures", Path(__file__).parents[1] / "seed-qa-fixtures.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


class FakeBackend(BaseHTTPRequestHandler):
    cache = {}
    writes = []

    def log_message(self, *_):
        pass

    def send(self, status, body=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        if self.path == "/api/csrf":
            return self.send(200, {"token": "example-token"})
        if self.path == "/api/farms":
            return self.send(200, [{"id": 1, "name": seed.FARM, "role": "OWNER"}])
        if self.path == "/api/farms/1/catalogues":
            return self.send(200, {"breeds": [{"id": 10, "code": "LAISIND", "available": True}],
                                   "productionPurposes": [{"id": 11, "type": "FATTENING", "available": True}]})
        self.send(404)

    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.headers.get("X-XSRF-TOKEN") != "example-token":
            return self.send(403)
        if self.path == "/api/authenticate":
            return self.send(204)
        key = self.headers.get("Idempotency-Key")
        if not key:
            return self.send(400)
        if key in self.cache:
            old_path, old_data, old_body = self.cache[key]
            return self.send(200, old_body) if (old_path, old_data) == (self.path, data) else self.send(409)
        self.writes.append((self.path, data))
        if self.path.endswith("/pens"):
            body = {"id": len(self.writes), "statusEffectiveDate": "2026-11-08"}
        elif self.path.endswith("/entry-vouchers"):
            body = {"id": len(self.writes), "version": 0, "status": "DRAFT"}
        elif self.path.endswith("/post"):
            body = {"voucher": {"status": "POSTED"}, "cattleCodes": ["C1", "C2"]}
        else:
            return self.send(404)
        self.cache[key] = (self.path, data, body)
        self.send(200, body)


class FixtureClientTest(unittest.TestCase):
    def test_idempotent_sequence_and_isolation_acknowledgement(self):
        FakeBackend.cache = {}
        FakeBackend.writes = []
        server = ThreadingHTTPServer(("127.0.0.1", 0), FakeBackend)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with patch.object(seed, "BASE", f"http://127.0.0.1:{server.server_port}"), \
                 patch.dict(os.environ, {"BEEFCARE_DEV_PASSWORD": "only-test-password"}), \
                 patch.object(sys, "argv", ["seed", "--isolated-qa-db"]), \
                 contextlib.redirect_stdout(io.StringIO()):
                seed.main()
                seed.main()
            self.assertEqual(len(FakeBackend.writes), 5)
            self.assertEqual(sum(path.endswith("/pens") for path, _ in FakeBackend.writes), 2)
            voucher_bodies = [body for path, body in FakeBackend.writes if path.endswith("/entry-vouchers")]
            self.assertEqual([len(body["lines"]) for body in voucher_bodies], [2, 1])
            self.assertTrue(all(body["entryDate"] == "2026-11-08" for body in voucher_bodies))
            with patch.object(sys, "argv", ["seed"]), self.assertRaises(RuntimeError):
                seed.main()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
