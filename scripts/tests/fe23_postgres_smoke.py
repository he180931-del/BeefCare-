#!/usr/bin/env python3
"""FE-23 HTTP smoke against an explicitly isolated local PostgreSQL backend.

Creates uniquely named synthetic records and deliberately leaves them in the test
database for readback. Never run against a shared or production database.
"""
import datetime
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8080"


class Api:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = None

    def call(self, method, path, body=None, key=None, expect=(200, 201, 204)):
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers.update({"Content-Type": "application/json", "X-XSRF-TOKEN": self.csrf or ""})
        if key is not None:
            headers["Idempotency-Key"] = key
        request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=30) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        if status not in expect:
            raise AssertionError(f"{method} {path}: HTTP {status}, expected {expect}")
        return json.loads(raw) if raw else None

    def login(self, username, password):
        self.csrf = self.call("GET", "/api/csrf")["token"]
        self.call("POST", "/api/authenticate", {"username": username, "password": password, "rememberMe": False})
        self.csrf = self.call("GET", "/api/csrf")["token"]

    def upload(self, path, content, command_key, expect=(200, 201)):
        boundary = "beefcare-qa-" + uuid.uuid4().hex
        prefix = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"qa-evidence.pdf\"\r\n"
                  "Content-Type: application/pdf\r\n\r\n").encode("ascii")
        body = prefix + content + f"\r\n--{boundary}--\r\n".encode("ascii")
        request = urllib.request.Request(BASE + path, data=body, method="POST", headers={
            "Accept": "application/json", "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-XSRF-TOKEN": self.csrf or "", "Idempotency-Key": command_key,
        })
        try:
            with self.opener.open(request, timeout=30) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        if status not in expect:
            raise AssertionError(f"POST {path}: HTTP {status}, expected {expect}")
        return json.loads(raw) if raw else None

    def download(self, path):
        with self.opener.open(BASE + path, timeout=30) as response:
            return response.read()


def key():
    return str(uuid.uuid4())


def main():
    if sys.argv[1:] != ["--isolated-db"]:
        raise SystemExit("Run only with --isolated-db after verifying the backend uses the disposable QA database.")
    password = os.environ.get("BEEFCARE_DEV_PASSWORD", "")
    if len(password) < 12:
        raise SystemExit("Set BEEFCARE_DEV_PASSWORD to the local seed password.")
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    due = today + datetime.timedelta(days=14)
    unique = uuid.uuid4()
    owner = Api()
    owner.login("owner@beefcare.local", password)
    farms = [row for row in owner.call("GET", "/api/farms") if row["name"] == "BeefCare Local Farm A" and row["role"] == "OWNER"]
    if len(farms) != 1:
        raise AssertionError("Expected exactly one seeded local Farm A")
    farm_id = farms[0]["id"]
    root = f"/api/farms/{farm_id}"
    partner = owner.call("POST", root + "/trading-partners", {
        "name": "FE23 QA supplier " + unique.hex[:8], "seller": False, "buyer": False, "supplier": True,
    }, key())
    feed = owner.call("POST", root + "/feed/catalogue", {
        "code": "TA-" + str(int(unique.hex[:10], 16)), "name": "FE23 QA feed " + unique.hex[:8],
        "feedGroup": "GREEN_ROUGHAGE", "purchaseUnit": "kg", "kgPerPurchaseUnit": 1,
        "minimumStockKg": 2, "available": True, "nutritionNote": "QA nutrition note",
    }, key())
    feed_id = feed["id"]
    assert feed.get("nutritionNote") == "QA nutrition note", "Feed nutrition note did not round-trip"
    body = {
        "receiptDate": today.isoformat(), "supplierId": partner["id"], "invoiceNumber": "QA-INV-001",
        "receivedBy": "QA receiver", "storageLocation": "QA storage", "note": "QA receipt note",
        "transportFee": 500, "amountPaid": 1000, "method": "CASH", "paymentDate": today.isoformat(),
        "paymentDueDate": due.isoformat(), "lines": [
            {"feedItemId": feed_id, "lotNumber": "QA-LOT-001", "expiryDate": due.isoformat(),
             "quantityPurchase": 10, "purchaseUnit": "kg", "unitPrice": 1000},
            {"feedItemId": feed_id, "lotNumber": "QA-LOT-002", "expiryDate": (due + datetime.timedelta(days=1)).isoformat(),
             "quantityPurchase": 5, "purchaseUnit": "kg", "unitPrice": 1000},
        ],
        "postNow": False,
    }
    receipt = owner.call("POST", root + "/feed/receipts", body, key())
    receipt_id = receipt["id"]
    assert receipt["status"] == "DRAFT"
    detail = owner.call("GET", root + f"/feed/receipts/{receipt_id}")
    assert detail["invoiceNumber"] == body["invoiceNumber"]
    assert detail["receivedBy"] == body["receivedBy"]
    assert detail["storageLocation"] == body["storageLocation"]
    assert detail["note"] == body["note"]
    assert detail["paymentDueDate"] == body["paymentDueDate"]
    assert detail["initialPaymentAmount"] == 1000 and detail["initialPaymentMethod"] == "CASH"
    assert detail["initialPaymentDate"] == body["paymentDate"] and detail["amountPaid"] == 0
    draft_stock = next(row for row in owner.call("GET", root + "/feed/stock") if row["feedItemId"] == feed_id)
    assert float(draft_stock["onHandKg"]) == 0, "Saving a draft must not change stock"
    before = owner.call("GET", root + f"/feed/receipts/{receipt_id}/payments")
    assert before["summary"]["paid"] == 0 and not before["payments"], "A draft must not create a payment"
    post_key = key()
    post_body = {"expectedVersion": detail["version"]}
    posted = owner.call("POST", root + f"/feed/receipts/{receipt_id}/post", post_body, post_key)
    replay = owner.call("POST", root + f"/feed/receipts/{receipt_id}/post", post_body, post_key)
    assert posted["id"] == replay["id"] and posted["status"] == "POSTED"
    owner.call("POST", root + f"/feed/receipts/{receipt_id}/post", {"expectedVersion": -999}, post_key, expect=(409,))
    stock = next(row for row in owner.call("GET", root + "/feed/stock") if row["feedItemId"] == feed_id)
    assert float(stock["onHandKg"]) == 15, "Two lots must add 15 kg once, even on replay"
    moves = owner.call("GET", root + f"/feed/stock/{feed_id}/movements")
    received = [row for row in moves if row["movementType"] == "RECEIPT" and row["sourceId"] == receipt_id]
    assert len(received) == 2 and sum(float(row["quantityKg"]) for row in received) == 15, "Each receipt line must create one movement"
    payments = owner.call("GET", root + f"/feed/receipts/{receipt_id}/payments")
    assert payments["summary"]["paid"] == 1000 and len(payments["payments"]) == 1
    later_key = key()
    payment_body = {"paymentDate": today.isoformat(), "amount": 2000, "method": "BANK_TRANSFER",
                    "reference": "QA-PAY-001", "note": "QA payment", "voucherVersion": payments["summary"]["voucherVersion"]}
    later = owner.call("POST", root + f"/feed/receipts/{receipt_id}/payments", payment_body, later_key)
    repeated = owner.call("POST", root + f"/feed/receipts/{receipt_id}/payments", payment_body, later_key)
    assert later["payment"]["id"] == repeated["payment"]["id"]
    after = owner.call("GET", root + f"/feed/receipts/{receipt_id}/payments")
    assert after["summary"]["paid"] == 3000 and len(after["payments"]) == 2
    assert after["summary"]["outstanding"] == 12500
    payment_id = later["payment"]["id"]
    attachments_path = root + f"/feed/receipts/{receipt_id}/payments/{payment_id}/attachments"
    evidence = b"%PDF-1.4\n% FE23 synthetic evidence\n%%EOF\n"
    attachment_key = key()
    attachment = owner.upload(attachments_path, evidence, attachment_key)
    attachment_replay = owner.upload(attachments_path, evidence, attachment_key)
    assert attachment["id"] == attachment_replay["id"], "Upload retry created a duplicate"
    owner.upload(attachments_path, evidence + b"changed", attachment_key, expect=(409,))
    owner.upload(attachments_path, b"not a pdf", key(), expect=(415,))
    assert len(owner.call("GET", attachments_path)) == 1
    assert owner.download(attachments_path + f"/{attachment['id']}") == evidence
    bad_payment = dict(payment_body, amount=13000, voucherVersion=after["summary"]["voucherVersion"])
    owner.call("POST", root + f"/feed/receipts/{receipt_id}/payments", bad_payment, key(), expect=(422,))
    stale_payment = dict(payment_body, amount=1, voucherVersion=-999)
    owner.call("POST", root + f"/feed/receipts/{receipt_id}/payments", stale_payment, key(), expect=(409,))
    final_payments = owner.call("GET", root + f"/feed/receipts/{receipt_id}/payments")
    assert final_payments["summary"]["paid"] == 3000 and len(final_payments["payments"]) == 2
    voided = owner.call("POST", root + f"/payments/{payment_id}/void",
                        {"reason": "QA void test", "version": later["payment"]["version"]}, key())
    assert voided["summary"]["paid"] == 1000 and voided["payment"]["status"] == "VOIDED"
    assert owner.download(attachments_path + f"/{attachment['id']}") == evidence
    owner.upload(attachments_path, evidence, key(), expect=(409,))
    other = Api()
    other.login("other-owner@beefcare.local", password)
    other.call("GET", root + f"/feed/receipts/{receipt_id}", expect=(403, 404))
    other.call("GET", attachments_path, expect=(403, 404))
    technician = Api()
    technician.login("technician@beefcare.local", password)
    technician.call("GET", root + "/feed/stock", expect=(403, 404))
    technician.call("GET", attachments_path, expect=(403, 404))
    technician.call("POST", root + "/feed/receipts", body, key(), expect=(403, 404))
    print(json.dumps({"result": "PASS", "farmId": farm_id, "feedId": feed_id, "receiptId": receipt_id,
                      "supplierId": partner["id"], "paymentId": payment_id, "stockKg": 15,
                      "paidBeforeVoid": 3000, "paidAfterVoid": 1000, "outstandingAfterVoid": 14500,
                      "paymentAttachmentId": attachment["id"]}))


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, urllib.error.URLError, KeyError, StopIteration) as error:
        print(f"FE-23 smoke failed: {error}", file=sys.stderr)
        sys.exit(1)
