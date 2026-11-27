#!/usr/bin/env python3
"""Create the shared, coverage-driven QA baseline through the real API.

The script deliberately creates only reusable source data.  Test cases that
assert a newly-created event (health, reproduction, payments, exits, etc.)
must create that event in their isolated scenario fixture.  Every write uses
an idempotency key derived from a stable fixture key; no production ids or
secrets are embedded here.
"""
import http.cookiejar
import json
import os
import sys
from datetime import date, timedelta
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8080"
FARM = "BeefCare Local Farm A"
SEED_VERSION = "qa-baseline-v2"
GAPS = []
COUNTS = {}


def count(entity, amount=1):
    COUNTS[entity] = COUNTS.get(entity, 0) + amount


def gap(scope, route, reason):
    GAPS.append({"scope": scope, "route": route, "reason": reason})


def rows(payload, *keys):
    """Normalize the list and paged-list response shapes used by the API."""
    if isinstance(payload, list):
        return payload
    for key in keys:
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, list):
            return value
    return []


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
            # Keep the namespace used by the original QA fixture so upgrading
            # the baseline cannot duplicate QA-A/QA-B or existing vouchers.
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


def optional_request(client, scope, path, data=None, key=None):
    """Attempt a non-essential baseline source and record an API gap safely."""
    try:
        return client.request(path, data, key)
    except RuntimeError as error:
        gap(scope, path, str(error))
        return None


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
    # Shared pens cover the life-stage/purpose/status combinations used across
    # FE-04–FE-23.  QA-A/QA-B above remain backwards-compatible aliases for
    # existing scenario scripts.
    baseline_pen_specs = [
        ("QA-BL-BREED", "QA baseline breeding", "ACTIVE", {"purposeTypes": ["BREEDING"], "lifeStages": ["ADULT"], "sex": "FEMALE"}),
        ("QA-BL-SIRE", "QA baseline sire", "ACTIVE", {"purposeTypes": ["SIRE"], "lifeStages": ["ADULT"], "sex": "MALE"}),
        ("QA-BL-CALF", "QA baseline calves", "ACTIVE", {"purposeTypes": ["FATTENING"], "lifeStages": ["UNWEANED_CALF", "WEANED_CALF"]}),
        ("QA-BL-QUAR", "QA baseline quarantine", "INACTIVE", {"purposeTypes": [], "lifeStages": []}),
    ]
    for code, name, status, criteria in baseline_pen_specs:
        existing = next((p for p in rows(client.request(root + "/pens"), "items") if p.get("code") == code), None)
        if existing:
            pens.append(existing)
        else:
            created = optional_request(client, "pens", root + "/pens", {
                "code": code, "name": name, "capacity": 20, "description": "Reusable QA baseline source",
                "initialStatus": status, "criteria": criteria,
            }, "baseline-pen-" + code)
            if created:
                pens.append(created)
                count("pens")

    def line(tag, pen, weight, sex="MALE", life_stage="YOUNG_STOCK", purpose_id=None, **extra):
        value = {"earTagNumber": tag, "breedId": breed["id"], "sex": sex, "ageMonths": 18,
                 "lifeStage": life_stage, "purposeId": purpose_id or purpose["id"], "entryWeightKg": weight,
                 "weightBasis": "MEASURED", "penId": pen["id"], "unitPrice": 80000}
        value.update(extra)
        return value

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

    purpose_by_type = {item["type"]: item for item in catalogues["productionPurposes"] if item.get("available")}
    baseline_pens = {p.get("code"): p for p in pens}
    breeding_purpose = purpose_by_type.get("BREEDING", purpose)
    sire_purpose = purpose_by_type.get("SIRE", purpose)
    calf_pen = baseline_pens.get("QA-BL-CALF", pens[0])
    breeding_pen = baseline_pens.get("QA-BL-BREED", pens[0])
    sire_pen = baseline_pens.get("QA-BL-SIRE", pens[1])

    # Wide shared herd: each row is a reusable source for a family of tests;
    # events that tests must create remain absent (see BASELINE_SEED.md).
    baseline_lines = [
        line("QA-BL-F-BREED", breeding_pen, 360, "FEMALE", "ADULT", breeding_purpose["id"],
             reproduction={"status": "UNKNOWN", "pregnantAtEntry": "UNKNOWN"}),
        line("QA-BL-F-ADULT", breeding_pen, 345, "FEMALE", "ADULT", breeding_purpose["id"]),
        line("QA-BL-M-SIRE", sire_pen, 480, "MALE", "ADULT", sire_purpose["id"]),
        line("QA-BL-M-FATTEN", pens[0], 430, "MALE", "ADULT", purpose["id"]),
        line("QA-BL-F-FATTEN", pens[0], 390, "FEMALE", "ADULT", purpose["id"]),
        line("QA-BL-YOUNG-M", pens[1], 220, "MALE", "YOUNG_STOCK", purpose["id"]),
        line("QA-BL-WEANED-F", calf_pen, 150, "FEMALE", "WEANED_CALF", purpose["id"]),
        line("QA-BL-CALF-M", calf_pen, 75, "MALE", "UNWEANED_CALF", purpose["id"]),
    ]
    baseline_voucher = optional_request(client, "baseline cattle", root + "/entry-vouchers", {
        "entryType": "PURCHASE", "entryDate": max(p["statusEffectiveDate"] for p in pens),
        "newSeller": {"name": "QA fixture seller baseline-herd"},
        "quarantineCertNo": "QA-2026", "note": "Reusable QA baseline herd",
        "pricingBasis": "PER_KG", "transportFee": 0, "amountPaid": 0,
        "paymentDueDate": (date.today() + timedelta(days=30)).isoformat(), "lines": baseline_lines,
    }, "voucher-baseline-herd")
    if baseline_voucher and baseline_voucher.get("status") == "DRAFT":
        baseline_result = optional_request(
            client, "baseline cattle", root + f"/entry-vouchers/{baseline_voucher['id']}/post",
            {"expectedVersion": baseline_voucher["version"], "printQr": False}, "post-voucher-baseline-herd"
        )
        if baseline_result and baseline_result.get("voucher", {}).get("status") != "POSTED":
            gap("baseline cattle", root + "/entry-vouchers/{id}/post", "POST response did not prove POSTED")
    # Two legacy QA tags are retained for compatibility with existing tests;
    # the baseline voucher contributes the eight tagged rows above.
    baseline_posted = bool(baseline_voucher and baseline_voucher.get("status") == "POSTED")
    COUNTS["cattle"] = 2 + (len(baseline_lines) if baseline_posted else 0)
    COUNTS["pens"] = len({p.get("code") for p in pens if p.get("code")})

    # Catalogue, supplier, and stock are shared FE-18/FE-23 sources.  A posted
    # receipt deliberately leaves an outstanding balance for payment scenarios.
    feed_rows = rows(client.request(root + "/feed/catalogue"), "items")
    feed_specs = [
        ("TA-90", "QA baseline green forage", "GREEN_ROUGHAGE", 30),
        ("TA-91", "QA baseline concentrate", "CONCENTRATE", 20),
        ("TA-92", "QA baseline calf feed", "CALF_FEED", 10),
    ]
    feed_items = []
    for code, name, group, minimum in feed_specs:
        item = next((row for row in feed_rows if row.get("code") == code), None)
        if item is None:
            item = optional_request(client, "feed catalogue", root + "/feed/catalogue", {
                "code": code, "name": name, "feedGroup": group, "purchaseUnit": "kg",
                "kgPerPurchaseUnit": 1, "minimumStockKg": minimum,
                "nutritionNote": "Reusable QA baseline source", "available": True,
            }, "feed-" + code)
            if item:
                count("feed_items")
        if item:
            feed_items.append(item)

    partner_rows = rows(client.request(root + "/trading-partners"), "items")
    suppliers = []
    for suffix in ("primary", "secondary"):
        name = "QA baseline supplier " + suffix
        supplier = next((row for row in partner_rows if row.get("name") == name), None)
        if supplier is None:
            supplier = optional_request(client, "suppliers", root + "/trading-partners", {
                "name": name, "seller": False, "buyer": False, "supplier": True,
                "phone": "09000000" + ("91" if suffix == "primary" else "92"),
                "area": "QA", "note": "Reusable QA baseline source",
            }, "supplier-" + suffix)
            if supplier:
                count("suppliers")
        if supplier:
            suppliers.append(supplier)

    if suppliers and feed_items:
        receipt_rows = rows(client.request(root + "/feed/receipts"), "items")
        receipt = next((row for row in receipt_rows if row.get("invoiceNumber") == "QA baseline stock"), None)
        if receipt is None:
            receipt = optional_request(client, "feed receipt", root + "/feed/receipts", {
                "receiptDate": date.today().isoformat(), "supplierId": suppliers[0]["id"],
                "invoiceNumber": "QA baseline stock", "receivedBy": "QA baseline",
                "storageLocation": "QA store", "note": "Reusable baseline stock",
                "transportFee": 0, "amountPaid": 0, "paymentDueDate": (date.today() + timedelta(days=30)).isoformat(),
                "lines": [{"feedItemId": feed_items[0]["id"], "lotNumber": "QA-BL-LOT",
                           "expiryDate": (date.today() + timedelta(days=180)).isoformat(),
                           "quantityPurchase": 100, "purchaseUnit": "kg", "unitPrice": 1000}],
                "postNow": True,
            }, "feed-receipt-baseline")
            if receipt:
                count("feed_receipts")

    # Read-only evidence establishes inherited roles/farms, notification and
    # reminder surfaces without pre-seeding a result that a test must create.
    farm_rows = rows(client.request("/api/farms"), "items")
    member_rows = rows(client.request(root + "/members"), "items", "members")
    notification_rows = rows(client.request("/api/notifications/mine"), "items", "notifications")
    reminder_rows = rows(client.request(root + "/feed/reminders"), "items", "reminders")
    COUNTS.update({"farms_inherited": len(farm_rows), "memberships_inherited": len(member_rows),
                   "notifications_read": len(notification_rows), "feed_reminders_read": len(reminder_rows)})
    gap("reproduction scenario fixtures", root + "/cattle/{id}/estrus-events", "Kept absent: FE-11/FE-12 tests create estrus, breeding, pregnancy and calving outcomes.")
    gap("care scenario fixtures", root + "/health-cases", "Kept absent: FE-09/FE-10 tests create vaccination, disease, observations and treatments.")
    gap("payment scenario fixtures", root + "/vouchers/{type}/{voucherId}/payments", "Outstanding baseline balances exist; payment creation stays in scenario fixtures.")
    gap("farm status variants", "/api/farms", "Local profile supplies three ACTIVE farms; suspended/expired farm states require platform-only setup and are not fabricated here.")
    print(f"Farm {farm}: seed={SEED_VERSION}; baseline counts={json.dumps(COUNTS, sort_keys=True)}")
    if GAPS:
        print("Baseline gaps (intentional):")
        for item in GAPS:
            print(f"  - {item['scope']}: {item['reason']}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.URLError, KeyError, StopIteration) as error:
        print(f"QA fixture setup failed: {error}", file=sys.stderr)
        sys.exit(1)
