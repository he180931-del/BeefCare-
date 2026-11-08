#!/usr/bin/env python3
"""Create a small repeatable QA herd through the real local backend API."""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8080"
FARM = "BeefCare Local Farm A"


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = None

    def request(self, path, data=None, key=None):
        headers = {"Accept": "application/json"}
        payload = None
        if data is not None:
            payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers.update({"Content-Type": "application/json", "X-XSRF-TOKEN": self.csrf or ""})
        if key:
            headers["Idempotency-Key"] = str(uuid.uuid5(uuid.NAMESPACE_URL, "beefcare-qa-v1/" + key))
        try:
            with self.opener.open(urllib.request.Request(BASE + path, data=payload, headers=headers), timeout=20) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as exc:
            # Error body may contain user information; do not print it or credentials.
            raise RuntimeError(f"{path}: HTTP {exc.code}") from exc

    def refresh_csrf(self):
        token = self.request("/api/csrf")
        self.csrf = token["token"]


def main():
    if sys.argv[1:] != ["--isolated-qa-db"]:
        raise RuntimeError("Run only with --isolated-qa-db after starting the dedicated QA database and backend; see docs/testing/QA_FIXTURES.md")
    password = os.environ.get("BEEFCARE_DEV_PASSWORD", "")
    if len(password) < 12:
        raise RuntimeError("Set BEEFCARE_DEV_PASSWORD to the same local password used by the backend.")
    client = Client()
    client.refresh_csrf()
    client.request("/api/authenticate", {"username": "owner@beefcare.local", "password": password, "rememberMe": False})
    client.refresh_csrf()
    farms = [f for f in client.request("/api/farms") if f["name"] == FARM and f["role"] == "OWNER"]
    if len(farms) != 1:
        raise RuntimeError("Expected exactly one seeded local Farm A owned by the local owner.")
    farm = farms[0]["id"]
    root = f"/api/farms/{farm}"
    catalogues = client.request(root + "/catalogues")
    breed = next(x for x in catalogues["breeds"] if x["code"] == "LAISIND" and x["available"])
    purpose = next(x for x in catalogues["productionPurposes"] if x["type"] == "FATTENING" and x["available"])
    pens = []
    for code, name in [("QA-A", "QA - Chuong A"), ("QA-B", "QA - Chuong B")]:
        pens.append(client.request(root + "/pens", {
            "code": code, "name": name, "capacity": 10, "description": "Disposable QA fixture",
            "initialStatus": "ACTIVE", "criteria": {"purposeTypes": [], "lifeStages": []},
        }, "pen-" + code))

    def line(tag, pen, weight):
        return {"earTagNumber": tag, "breedId": breed["id"], "sex": "MALE", "ageMonths": 18,
                "lifeStage": "YOUNG_STOCK", "purposeId": purpose["id"], "entryWeightKg": weight,
                "weightBasis": "MEASURED", "penId": pen["id"], "unitPrice": 80000}

    def voucher(name, lines):
        return client.request(root + "/entry-vouchers", {
            "entryType": "PURCHASE", "entryDate": max(p["statusEffectiveDate"] for p in pens), "newSeller": {"name": "QA fixture seller " + name},
            "quarantineCertNo": "QA-2026", "note": "Disposable QA fixture " + name,
            "pricingBasis": "PER_KG", "transportFee": 0, "amountPaid": 0, "lines": lines,
        }, "voucher-" + name)

    posted = voucher("posted", [line("QA-TAG-001", pens[0], 220), line("QA-TAG-002", pens[1], 250)])
    result = client.request(root + f"/entry-vouchers/{posted['id']}/post",
                            {"expectedVersion": posted["version"], "printQr": False}, "post-" + str(posted["id"]))
    draft = voucher("draft", [line("QA-TAG-003", pens[0], 200)])
    if result["voucher"]["status"] != "POSTED" or len(result["cattleCodes"]) != 2 or draft["status"] != "DRAFT":
        raise RuntimeError("Backend returned an unexpected fixture state; inspect the isolated QA database.")
    print(f"Farm {farm}: 2 pens, 2 posted cattle, 1 posted voucher, 1 draft voucher.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.URLError, KeyError, StopIteration) as error:
        print(f"QA fixture setup failed: {error}", file=sys.stderr)
        sys.exit(1)
