# FE-19 – ví dụ request/response thật

Ghi từ backend chạy ở commit tích hợp `4d83ab1` (profile `dev,local`, PostgreSQL 16.15 trong database riêng,
SePay `MOCK`, Mailpit local), qua HTTP thật với session cookie + CSRF như trình duyệt. Dữ liệu là dữ liệu thử của
lượt chạy này (tài khoản seed, tài khoản nhận giả `FE19-READY-ACCOUNT`); id, mã và thời điểm sẽ khác ở máy khác.

Đã bỏ khỏi ví dụ: cookie, CSRF token, mật khẩu, secret và chữ ký webhook. Mọi lệnh ghi có header `Idempotency-Key`
(một UUID cho mỗi ý định; ghi `Idempotency-Key: <uuid>` ở dưới). Danh sách dài chỉ giữ 2 phần tử đầu.
Đăng nhập, CSRF và quy ước lỗi chung: `docs/api/README.md`. Schema đầy đủ: `docs/api/openapi.json`.

Tra cứu SePay (A11, A17) cần `BEEFCARE_SEPAY_API_TOKEN`; local không cấu hình nên chỉ có ví dụ lỗi 503. Ca thành
công được kiểm bằng `PlatformReconciliationResourceTest` / `PlatformReconciliationPostgresIT` với client SePay giả lập.

## A1 subscription overview (before payment)

`GET /api/farms/{farmId}/subscription` — bên gọi `owner@beefcare.local`, HTTP 200

Response:

```json
{
  "farmId": 1151,
  "serviceStatus": "PENDING_PAYMENT",
  "latestEnd": null,
  "entitlementStatus": "NONE",
  "currentPrices": {
    "id": 1701,
    "price1y": 1200000.0,
    "price2y": 2160000.0,
    "price3y": 3060000.0,
    "effectiveAt": "2026-11-10T16:52:52.825321Z"
  },
  "pendingPayment": null,
  "renewalOpensAt": null,
  "farmName": "BeefCare Local Farm A",
  "suspended": false,
  "suspendedSince": null,
  "currentPeriod": null,
  "daysRemaining": null,
  "futurePeriods": [],
  "periods": [],
  "eligibility": {
    "ok": true,
    "reason": null,
    "opensAt": null
  }
}
```

## A1 subscription overview (after payment)

`GET /api/farms/{farmId}/subscription` — bên gọi `owner@beefcare.local`, HTTP 200

Response:

```json
{
  "farmId": 1151,
  "serviceStatus": "ACTIVE",
  "latestEnd": "2027-11-10T16:52:55.381824Z",
  "entitlementStatus": "CURRENT",
  "currentPrices": {
    "id": 1701,
    "price1y": 1200000.0,
    "price2y": 2160000.0,
    "price3y": 3060000.0,
    "effectiveAt": "2026-11-10T16:52:52.825321Z"
  },
  "pendingPayment": null,
  "renewalOpensAt": "2027-08-12T16:52:55.381824Z",
  "farmName": "BeefCare Local Farm A",
  "suspended": false,
  "suspendedSince": null,
  "currentPeriod": {
    "paymentCode": "BCE584F0252942",
    "durationYears": 1,
    "amountVnd": 1200000.0,
    "start": "2026-11-10T16:52:55.381824Z",
    "end": "2027-11-10T16:52:55.381824Z",
    "status": "CURRENT"
  },
  "daysRemaining": 364,
  "futurePeriods": [],
  "periods": [
    {
      "paymentCode": "BCE584F0252942",
      "durationYears": 1,
      "amountVnd": 1200000.0,
      "start": "2026-11-10T16:52:55.381824Z",
      "end": "2027-11-10T16:52:55.381824Z",
      "status": "CURRENT"
    }
  ],
  "eligibility": {
    "ok": false,
    "reason": "OUTSIDE_WINDOW",
    "opensAt": "2027-08-12T16:52:55.381824Z"
  }
}
```

## A1 error: Owner of another farm

`GET /api/farms/{farmId}/subscription` — bên gọi `other-owner@beefcare.local`, HTTP 403

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Forbidden",
  "status": 403,
  "detail": "MSG-COM-01",
  "instance": "/api/farms/1151/subscription",
  "code": "MSG-COM-01",
  "params": {},
  "message": "You do not have permission to perform this action.",
  "path": "/api/farms/1151/subscription"
}
```

## A2 create payment request

`POST /api/farms/{farmId}/subscription/payments` — bên gọi `owner@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "durationYears": 1,
  "reviewedPriceVersion": 1701
}
```

Response:

```json
{
  "id": 1901,
  "quoteRef": "BCE584F0252942",
  "durationYears": 1,
  "amountVnd": 1200000.0,
  "state": "PENDING",
  "requestedAt": "2026-11-10T16:52:53.319385400Z",
  "expiresAt": "2026-11-11T16:52:53.319385400Z",
  "purchasedStart": null,
  "purchasedEnd": null,
  "receiptCode": null,
  "priceVersionId": 1701,
  "bankCode": "TESTBANK",
  "accountNumber": "FE19-READY-ACCOUNT",
  "accountName": "FE19 READY",
  "qrImageUrl": "https://qr.sepay.vn/img?acc=FE19-READY-ACCOUNT&bank=TESTBANK&amount=1200000&des=BCE584F0252942",
  "reopened": false,
  "bankPaidAt": null,
  "receivedAt": null,
  "confirmedAt": null,
  "confirmationSource": null
}
```

## A2 reopen the valid pending request

`POST /api/farms/{farmId}/subscription/payments` — bên gọi `owner@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "durationYears": 1,
  "reviewedPriceVersion": 1701
}
```

Response:

```json
{
  "id": 1901,
  "quoteRef": "BCE584F0252942",
  "durationYears": 1,
  "amountVnd": 1200000.0,
  "state": "PENDING",
  "requestedAt": "2026-11-10T16:52:53.319385Z",
  "expiresAt": "2026-11-11T16:52:53.319385Z",
  "purchasedStart": null,
  "purchasedEnd": null,
  "receiptCode": null,
  "priceVersionId": 1701,
  "bankCode": "TESTBANK",
  "accountNumber": "FE19-READY-ACCOUNT",
  "accountName": "FE19 READY",
  "qrImageUrl": "https://qr.sepay.vn/img?acc=FE19-READY-ACCOUNT&bank=TESTBANK&amount=1200000&des=BCE584F0252942",
  "reopened": true,
  "bankPaidAt": null,
  "receivedAt": null,
  "confirmedAt": null,
  "confirmationSource": null
}
```

## A2 error: renewal window not open

`POST /api/farms/{farmId}/subscription/payments` — bên gọi `owner@beefcare.local`, HTTP 409

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "durationYears": 1,
  "reviewedPriceVersion": 1701
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Conflict",
  "status": 409,
  "detail": "MSG-FE19-03 {confirmedEnd=2027-11-10T16:52:55.381824Z, opensAt=2027-08-12T16:52:55.381824Z}",
  "instance": "/api/farms/1151/subscription/payments",
  "code": "MSG-FE19-03",
  "params": {
    "confirmedEnd": "2027-11-10T16:52:55.381824Z",
    "opensAt": "2027-08-12T16:52:55.381824Z"
  },
  "message": "MSG-FE19-03",
  "path": "/api/farms/1151/subscription/payments"
}
```

## A3 payment history

`GET /api/farms/{farmId}/subscription/payments` — bên gọi `owner@beefcare.local`, HTTP 200

Response:

```json
{
  "content": [
    {
      "id": 1901,
      "quoteRef": "BCE584F0252942",
      "durationYears": 1,
      "amountVnd": 1200000.0,
      "state": "PENDING",
      "requestedAt": "2026-11-10T16:52:53.319385Z",
      "expiresAt": "2026-11-11T16:52:53.319385Z",
      "purchasedStart": null,
      "purchasedEnd": null,
      "receiptCode": null,
      "priceVersionId": 1701,
      "bankCode": "TESTBANK",
      "accountNumber": "FE19-READY-ACCOUNT",
      "accountName": "FE19 READY",
      "qrImageUrl": "https://qr.sepay.vn/img?acc=FE19-READY-ACCOUNT&bank=TESTBANK&amount=1200000&des=BCE584F0252942",
      "reopened": false,
      "bankPaidAt": null,
      "receivedAt": null,
      "confirmedAt": null,
      "confirmationSource": null
    }
  ],
  "number": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

## A3 payment detail (pending)

`GET /api/farms/{farmId}/subscription/payments/{paymentId}` — bên gọi `owner@beefcare.local`, HTTP 200

Response:

```json
{
  "id": 1901,
  "quoteRef": "BCE584F0252942",
  "durationYears": 1,
  "amountVnd": 1200000.0,
  "state": "PENDING",
  "requestedAt": "2026-11-10T16:52:53.319385Z",
  "expiresAt": "2026-11-11T16:52:53.319385Z",
  "purchasedStart": null,
  "purchasedEnd": null,
  "receiptCode": null,
  "priceVersionId": 1701,
  "bankCode": "TESTBANK",
  "accountNumber": "FE19-READY-ACCOUNT",
  "accountName": "FE19 READY",
  "qrImageUrl": "https://qr.sepay.vn/img?acc=FE19-READY-ACCOUNT&bank=TESTBANK&amount=1200000&des=BCE584F0252942",
  "reopened": false,
  "bankPaidAt": null,
  "receivedAt": null,
  "confirmedAt": null,
  "confirmationSource": null
}
```

## A3 payment detail (paid)

`GET /api/farms/{farmId}/subscription/payments/{paymentId}` — bên gọi `owner@beefcare.local`, HTTP 200

Response:

```json
{
  "id": 1901,
  "quoteRef": "BCE584F0252942",
  "durationYears": 1,
  "amountVnd": 1200000.0,
  "state": "PAID",
  "requestedAt": "2026-11-10T16:52:53.319385Z",
  "expiresAt": "2026-11-11T16:52:53.319385Z",
  "purchasedStart": "2026-11-10T16:52:55.381824Z",
  "purchasedEnd": "2027-11-10T16:52:55.381824Z",
  "receiptCode": "RC-26-001901",
  "priceVersionId": 1701,
  "bankCode": "TESTBANK",
  "accountNumber": "FE19-READY-ACCOUNT",
  "accountName": "FE19 READY",
  "qrImageUrl": "https://qr.sepay.vn/img?acc=FE19-READY-ACCOUNT&bank=TESTBANK&amount=1200000&des=BCE584F0252942",
  "reopened": false,
  "bankPaidAt": "2026-11-10T16:52:54Z",
  "receivedAt": "2026-11-10T16:52:54.845265Z",
  "confirmedAt": "2026-11-10T16:52:55.381824Z",
  "confirmationSource": "SEPAY"
}
```

## A5 farm subscriptions

`GET /api/platform/subscriptions` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "items": [
    {
      "farmId": 1153,
      "farmName": "BeefCare Local Farm C",
      "ownerName": "Local Owner 2",
      "ownerEmail": "owner-2@beefcare.local",
      "serviceStatus": "ACTIVE",
      "currentStart": "2026-11-10T16:53:00.940078Z",
      "currentEnd": "2027-11-10T16:53:00.940078Z",
      "confirmedUntil": "2027-11-10T16:53:00.940078Z",
      "paymentCodes": [
        "BCF8C41A0FD37A"
      ]
    },
    {
      "farmId": 1151,
      "farmName": "BeefCare Local Farm A",
      "ownerName": "Local Owner",
      "ownerEmail": "owner@beefcare.local",
      "serviceStatus": "ACTIVE",
      "currentStart": "2026-11-10T16:52:55.381824Z",
      "currentEnd": "2027-11-10T16:52:55.381824Z",
      "confirmedUntil": "2027-11-10T16:52:55.381824Z",
      "paymentCodes": [
        "BCE584F0252942"
      ]
    },
    "... 1 more"
  ],
  "total": 3,
  "page": 0,
  "size": 20
}
```

## A5 farm subscription detail

`GET /api/platform/subscriptions/{farmId}` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "summary": {
    "farmId": 1151,
    "farmName": "BeefCare Local Farm A",
    "ownerName": "Local Owner",
    "ownerEmail": "owner@beefcare.local",
    "serviceStatus": "ACTIVE",
    "currentStart": "2026-11-10T16:52:55.381824Z",
    "currentEnd": "2027-11-10T16:52:55.381824Z",
    "confirmedUntil": "2027-11-10T16:52:55.381824Z",
    "paymentCodes": [
      "BCE584F0252942"
    ]
  },
  "subscriptionId": 1851,
  "suspended": false,
  "suspendedSince": null,
  "renewalOpens": "2027-08-12T16:52:55.381824Z",
  "latestPurchase": {
    "paymentId": 1901,
    "paymentCode": "BCE584F0252942",
    "receiptCode": "RC-26-001901",
    "termYears": 1,
    "start": "2026-11-10T16:52:55.381824Z",
    "end": "2027-11-10T16:52:55.381824Z",
    "confirmedAt": "2026-11-10T16:52:55.381824Z",
    "status": "CURRENT"
  },
  "periods": [
    {
      "paymentId": 1901,
      "paymentCode": "BCE584F0252942",
      "receiptCode": "RC-26-001901",
      "termYears": 1,
      "start": "2026-11-10T16:52:55.381824Z",
      "end": "2027-11-10T16:52:55.381824Z",
      "confirmedAt": "2026-11-10T16:52:55.381824Z",
      "status": "CURRENT"
    }
  ],
  "emptyMessage": null
}
```

## A6 payment tiles

`GET /api/platform/payments/summary` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "pendingRequests": 1,
  "evidenceToReview": 2,
  "hold": 0,
  "lockedForReturn": 0
}
```

## A6 error: Owner is not PM

`GET /api/platform/payments/summary` — bên gọi `owner@beefcare.local`, HTTP 403

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Forbidden",
  "status": 403,
  "detail": "MSG-COM-01",
  "instance": "/api/platform/payments/summary",
  "code": "MSG-COM-01",
  "params": {},
  "message": "You do not have permission to perform this action.",
  "path": "/api/platform/payments/summary"
}
```

## A7 evidence to review

`GET /api/platform/payments/evidence` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "items": [
    {
      "id": 2003,
      "provider": "SEPAY",
      "environment": "MOCK",
      "accountNamespace": "FE19-READY",
      "maskedTransactionId": "****5724",
      "amount": 1200000.0,
      "direction": "IN",
      "content": "chuyen tien goi dich vu",
      "bankPaidAt": "2026-11-10T16:52:57Z",
      "reviewStatus": "TO_REVIEW",
      "matchResult": "CODE_MISMATCH",
      "reviewReason": "No payment reference found",
      "receivingAccountMatches": true,
      "paymentId": null,
      "paymentCode": null,
      "version": 1
    },
    {
      "id": 2002,
      "provider": "SEPAY",
      "environment": "MOCK",
      "accountNamespace": "FE19-READY",
      "maskedTransactionId": "****5723",
      "amount": 1199999.0,
      "direction": "IN",
      "content": "Thanh toan BCF8C41A0FD37A",
      "bankPaidAt": "2026-11-10T16:52:57Z",
      "reviewStatus": "TO_REVIEW",
      "matchResult": "AMOUNT_MISMATCH",
      "reviewReason": "Transfer amount does not match the requested amount",
      "receivingAccountMatches": true,
      "paymentId": null,
      "paymentCode": null,
      "version": 1
    }
  ],
  "total": 2,
  "page": 0,
  "size": 20
}
```

## A8 candidates for a transfer without code

`GET /api/platform/payments/evidence/{evidenceId}/candidates` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
[
  {
    "paymentId": 1902,
    "quoteRef": "BCF8C41A0FD37A",
    "farmId": 1153,
    "farmName": "BeefCare Local Farm C",
    "amount": 1200000.0,
    "termYears": 1,
    "expiresAt": "2026-11-11T16:52:55.881096Z",
    "accountNamespace": "FE19-READY"
  }
]
```

## A9 ACCEPT selected candidate

`POST /api/platform/payments/evidence/{evidenceId}/review` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "decision": "ACCEPT",
  "paymentId": 1902,
  "reason": "Khách quên ghi mã, đúng số tiền và tài khoản",
  "version": 1
}
```

Response:

```json
{
  "id": 2003,
  "provider": "SEPAY",
  "environment": "MOCK",
  "accountNamespace": "FE19-READY",
  "providerTransactionId": 17943295724,
  "amount": 1200000.0,
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "quoteRef": null,
  "direction": "IN",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "content": "chuyen tien goi dich vu",
  "gateway": "BIDV",
  "reviewStatus": "ACCEPTED",
  "reviewReason": "Khách quên ghi mã, đúng số tiền và tài khoản",
  "lockedForReturn": false,
  "returnReference": null,
  "returnResult": null,
  "paymentId": 1902,
  "version": 2,
  "returnDate": null
}
```

## A9 HOLD

`POST /api/platform/payments/evidence/{evidenceId}/review` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "decision": "HOLD",
  "reason": "Liên hệ khách xác nhận số tiền",
  "version": 1
}
```

Response:

```json
{
  "id": 2002,
  "provider": "SEPAY",
  "environment": "MOCK",
  "accountNamespace": "FE19-READY",
  "providerTransactionId": 17943295723,
  "amount": 1199999.0,
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "quoteRef": "BCF8C41A0FD37A",
  "direction": "IN",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "content": "Thanh toan BCF8C41A0FD37A",
  "gateway": "BIDV",
  "reviewStatus": "HOLD",
  "reviewReason": "Liên hệ khách xác nhận số tiền",
  "lockedForReturn": false,
  "returnReference": null,
  "returnResult": null,
  "paymentId": null,
  "version": 2,
  "returnDate": null
}
```

## A9 error: ACCEPT with amount mismatch

`POST /api/platform/payments/evidence/{evidenceId}/review` — bên gọi `pm@beefcare.local`, HTTP 409

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "decision": "ACCEPT",
  "paymentId": 1902,
  "reason": "Thử chấp nhận",
  "version": 1
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Conflict",
  "status": 409,
  "detail": "MSG-FE19-11 {reason=AMOUNT_MISMATCH}",
  "instance": "/api/platform/payments/evidence/2002/review",
  "code": "MSG-FE19-11",
  "params": {
    "reason": "AMOUNT_MISMATCH"
  },
  "message": "This evidence cannot be accepted: AMOUNT_MISMATCH.",
  "path": "/api/platform/payments/evidence/2002/review"
}
```

## A10 lock for return

`POST /api/platform/payments/evidence/{evidenceId}/lock-return` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reason": "Khách yêu cầu hoàn lại tiền",
  "version": 2
}
```

Response:

```json
{
  "id": 2002,
  "provider": "SEPAY",
  "environment": "MOCK",
  "accountNamespace": "FE19-READY",
  "providerTransactionId": 17943295723,
  "amount": 1199999.0,
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "quoteRef": "BCF8C41A0FD37A",
  "direction": "IN",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "content": "Thanh toan BCF8C41A0FD37A",
  "gateway": "BIDV",
  "reviewStatus": "LOCKED_FOR_RETURN",
  "reviewReason": "Khách yêu cầu hoàn lại tiền",
  "lockedForReturn": true,
  "returnReference": null,
  "returnResult": null,
  "paymentId": null,
  "version": 3,
  "returnDate": null
}
```

## A10 unlock

`POST /api/platform/payments/evidence/{evidenceId}/unlock-return` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reason": "Khóa nhầm, khách chưa xác nhận",
  "version": 3
}
```

Response:

```json
{
  "id": 2002,
  "provider": "SEPAY",
  "environment": "MOCK",
  "accountNamespace": "FE19-READY",
  "providerTransactionId": 17943295723,
  "amount": 1199999.0,
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "quoteRef": "BCF8C41A0FD37A",
  "direction": "IN",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "content": "Thanh toan BCF8C41A0FD37A",
  "gateway": "BIDV",
  "reviewStatus": "UNMATCHED",
  "reviewReason": "Khóa nhầm, khách chưa xác nhận",
  "lockedForReturn": false,
  "returnReference": null,
  "returnResult": null,
  "paymentId": null,
  "version": 4,
  "returnDate": null
}
```

## A10 record return

`POST /api/platform/payments/evidence/{evidenceId}/record-return` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reference": "FT-RETURN-1794329572",
  "returnDate": "2026-11-10",
  "result": "Đã hoàn 1.199.999 VND cho khách",
  "version": 5
}
```

Response:

```json
{
  "id": 2002,
  "provider": "SEPAY",
  "environment": "MOCK",
  "accountNamespace": "FE19-READY",
  "providerTransactionId": 17943295723,
  "amount": 1199999.0,
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "quoteRef": "BCF8C41A0FD37A",
  "direction": "IN",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "content": "Thanh toan BCF8C41A0FD37A",
  "gateway": "BIDV",
  "reviewStatus": "LOCKED_FOR_RETURN",
  "reviewReason": "Khách xác nhận cần hoàn lại",
  "lockedForReturn": true,
  "returnReference": "FT-RETURN-1794329572",
  "returnResult": "Đã hoàn 1.199.999 VND cho khách",
  "paymentId": null,
  "version": 6,
  "returnDate": "2026-11-10"
}
```

## A10 error: return date in the future

`POST /api/platform/payments/evidence/{evidenceId}/record-return` — bên gọi `pm@beefcare.local`, HTTP 400

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reference": "FT-RETURN-1794329572",
  "returnDate": "2026-11-11",
  "result": "Đã hoàn",
  "version": 5
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-07 {field=returnDate}",
  "instance": "/api/platform/payments/evidence/2002/record-return",
  "code": "MSG-COM-07",
  "params": {
    "field": "returnDate"
  },
  "message": "The time cannot be in the future.",
  "path": "/api/platform/payments/evidence/2002/record-return"
}
```

## A11 error: SePay lookup not configured

`POST /api/platform/payments/lookup/{transactionId}` — bên gọi `pm@beefcare.local`, HTTP 503

Request:

```json
{}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "503 SERVICE_UNAVAILABLE \"SePay lookup is not configured\"",
  "instance": "/api/platform/payments/lookup/17943295729",
  "message": "error.http.503",
  "path": "/api/platform/payments/lookup/17943295729"
}
```

## A12 payment requests

`GET /api/platform/payments` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "items": [
    {
      "id": 1902,
      "farmId": 1153,
      "farmName": "BeefCare Local Farm C",
      "quoteRef": "BCF8C41A0FD37A",
      "termYears": 1,
      "amount": 1200000.0,
      "state": "PAID",
      "requestedAt": "2026-11-10T16:52:55.881096Z",
      "expiresAt": "2026-11-11T16:52:55.881096Z",
      "purchasedStart": "2026-11-10T16:53:00.940078Z",
      "purchasedEnd": "2027-11-10T16:53:00.940078Z",
      "receiptCode": "RC-26-001902",
      "requestedByEmail": "owner-2@beefcare.local",
      "priceVersionId": 1701,
      "evidenceId": 2003,
      "confirmedAt": "2026-11-10T16:53:00.940078Z",
      "confirmationSource": "PM",
      "bankPaidAt": "2026-11-10T16:52:57Z",
      "receivedAt": "2026-11-10T16:52:57.160006Z"
    },
    {
      "id": 1901,
      "farmId": 1151,
      "farmName": "BeefCare Local Farm A",
      "quoteRef": "BCE584F0252942",
      "termYears": 1,
      "amount": 1200000.0,
      "state": "PAID",
      "requestedAt": "2026-11-10T16:52:53.319385Z",
      "expiresAt": "2026-11-11T16:52:53.319385Z",
      "purchasedStart": "2026-11-10T16:52:55.381824Z",
      "purchasedEnd": "2027-11-10T16:52:55.381824Z",
      "receiptCode": "RC-26-001901",
      "requestedByEmail": "owner@beefcare.local",
      "priceVersionId": 1701,
      "evidenceId": 2001,
      "confirmedAt": "2026-11-10T16:52:55.381824Z",
      "confirmationSource": "SEPAY",
      "bankPaidAt": "2026-11-10T16:52:54Z",
      "receivedAt": "2026-11-10T16:52:54.845265Z"
    }
  ],
  "total": 2,
  "page": 0,
  "size": 20
}
```

## A12 payment request detail

`GET /api/platform/payments/{paymentId}` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "id": 1902,
  "farmId": 1153,
  "farmName": "BeefCare Local Farm C",
  "quoteRef": "BCF8C41A0FD37A",
  "termYears": 1,
  "amount": 1200000.0,
  "state": "PAID",
  "requestedAt": "2026-11-10T16:52:55.881096Z",
  "expiresAt": "2026-11-11T16:52:55.881096Z",
  "purchasedStart": "2026-11-10T16:53:00.940078Z",
  "purchasedEnd": "2027-11-10T16:53:00.940078Z",
  "receiptCode": "RC-26-001902",
  "requestedByEmail": "owner-2@beefcare.local",
  "priceVersionId": 1701,
  "evidenceId": 2003,
  "confirmedAt": "2026-11-10T16:53:00.940078Z",
  "confirmationSource": "PM",
  "bankPaidAt": "2026-11-10T16:52:57Z",
  "receivedAt": "2026-11-10T16:52:57.160006Z"
}
```

## A13 list price versions

`GET /api/platform/plan-prices` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "items": [],
  "total": 0,
  "page": 0,
  "size": 20,
  "asOf": "2026-11-10T16:52:52.742297400Z",
  "current": null,
  "nextEffectiveAt": null
}
```

## A13 publish now

`POST /api/platform/plan-prices` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "price1y": 1200000,
  "price2y": 2160000,
  "price3y": 3060000,
  "applyNow": true,
  "terms": "Gói chuẩn 1/2/3 năm"
}
```

Response:

```json
{
  "id": 1701,
  "revision": 0,
  "price1y": 1200000,
  "price2y": 2160000,
  "price3y": 3060000,
  "effectiveAt": "2026-11-10T16:52:52.825321400Z",
  "terms": "Gói chuẩn 1/2/3 năm",
  "status": "EFFECTIVE",
  "publishedById": 1059,
  "publishedBy": "Local Platform Manager",
  "publishedAt": "2026-11-10T16:52:52.825321400Z",
  "withdrawnBy": null,
  "withdrawnAt": null,
  "withdrawReason": null
}
```

## A13 schedule future version

`POST /api/platform/plan-prices` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "price1y": 1300000,
  "price2y": 2300000,
  "price3y": 3200000,
  "applyNow": false,
  "effectiveAt": "2026-12-10T16:52:52Z"
}
```

Response:

```json
{
  "id": 1702,
  "revision": 0,
  "price1y": 1300000,
  "price2y": 2300000,
  "price3y": 3200000,
  "effectiveAt": "2026-12-10T16:52:52Z",
  "terms": null,
  "status": "SCHEDULED",
  "publishedById": 1059,
  "publishedBy": "Local Platform Manager",
  "publishedAt": "2026-11-10T16:52:52.997395Z",
  "withdrawnBy": null,
  "withdrawnAt": null,
  "withdrawReason": null
}
```

## A13 error: price below 1,000

`POST /api/platform/plan-prices` — bên gọi `pm@beefcare.local`, HTTP 400

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "price1y": 999,
  "price2y": 2160000,
  "price3y": 3060000,
  "applyNow": true
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-FE19-13 {field=price1y}",
  "instance": "/api/platform/plan-prices",
  "code": "MSG-FE19-13",
  "params": {
    "field": "price1y"
  },
  "message": "MSG-FE19-13",
  "path": "/api/platform/plan-prices"
}
```

## A14 withdraw scheduled version

`POST /api/platform/plan-prices/{version}/withdraw` — bên gọi `pm@beefcare.local`, HTTP 200

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reason": "Lịch giá đặt nhầm ngày",
  "expectedVersion": 0
}
```

Response:

```json
{
  "id": 1702,
  "revision": 1,
  "price1y": 1300000.0,
  "price2y": 2300000.0,
  "price3y": 3200000.0,
  "effectiveAt": "2026-12-10T16:52:52Z",
  "terms": null,
  "status": "WITHDRAWN",
  "publishedById": 1059,
  "publishedBy": "Local Platform Manager",
  "publishedAt": "2026-11-10T16:52:52.997395Z",
  "withdrawnBy": "Local Platform Manager",
  "withdrawnAt": "2026-11-10T16:52:53.124590900Z",
  "withdrawReason": "Lịch giá đặt nhầm ngày"
}
```

## A14 error: reason too short

`POST /api/platform/plan-prices/{version}/withdraw` — bên gọi `pm@beefcare.local`, HTTP 400

Header: `Idempotency-Key: <uuid>`

Request:

```json
{
  "reason": "abc",
  "expectedVersion": 0
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Bad Request",
  "status": 400,
  "detail": "MSG-COM-10 {field=reason}",
  "instance": "/api/platform/plan-prices/1702/withdraw",
  "code": "MSG-COM-10",
  "params": {
    "field": "reason"
  },
  "message": "reason is not valid.",
  "path": "/api/platform/plan-prices/1702/withdraw"
}
```

## A15 webhook accepted (storage acknowledgement)

`POST /api/webhooks/sepay` — bên gọi `SePay`, HTTP 200

Header: `X-SePay-Timestamp: <unix seconds>`, `X-SePay-Signature: sha256=<HMAC-SHA256 of timestamp.rawBody>`

Request:

```json
{
  "id": 17943295722,
  "gateway": "BIDV",
  "transactionDate": "2026-11-10 23:52:54",
  "accountNumber": "FE19-READY-ACCOUNT",
  "code": "BCE584F0252942",
  "content": "Thanh toan BCE584F0252942",
  "transferType": "in",
  "transferAmount": 1200000,
  "referenceCode": "FT17943295722",
  "description": "BIDV 17943295722"
}
```

Response:

```json
{
  "success": true
}
```

## A15 alias route, repeated delivery

`POST /api/v1/payments/sepay/webhook` — bên gọi `SePay`, HTTP 200

Header: `X-SePay-Timestamp: <unix seconds>`, `X-SePay-Signature: sha256=<HMAC-SHA256 of timestamp.rawBody>`

Request:

```json
{
  "id": 17943295722,
  "gateway": "BIDV",
  "transactionDate": "2026-11-10 23:52:54",
  "accountNumber": "FE19-READY-ACCOUNT",
  "code": "BCE584F0252942",
  "content": "Thanh toan BCE584F0252942",
  "transferType": "in",
  "transferAmount": 1200000,
  "referenceCode": "FT17943295722",
  "description": "BIDV 17943295722"
}
```

Response:

```json
{
  "success": true
}
```

## A15 webhook: amount differs by 1 VND

`POST /api/webhooks/sepay` — bên gọi `SePay`, HTTP 200

Header: `X-SePay-Timestamp: <unix seconds>`, `X-SePay-Signature: sha256=<HMAC-SHA256 of timestamp.rawBody>`

Request:

```json
{
  "id": 17943295723,
  "gateway": "BIDV",
  "transactionDate": "2026-11-10 23:52:57",
  "accountNumber": "FE19-READY-ACCOUNT",
  "code": "BCF8C41A0FD37A",
  "content": "Thanh toan BCF8C41A0FD37A",
  "transferType": "in",
  "transferAmount": 1199999,
  "referenceCode": "FT17943295723",
  "description": "BIDV 17943295723"
}
```

Response:

```json
{
  "success": true
}
```

## A15 webhook: no payment code

`POST /api/webhooks/sepay` — bên gọi `SePay`, HTTP 200

Header: `X-SePay-Timestamp: <unix seconds>`, `X-SePay-Signature: sha256=<HMAC-SHA256 of timestamp.rawBody>`

Request:

```json
{
  "id": 17943295724,
  "gateway": "BIDV",
  "transactionDate": "2026-11-10 23:52:57",
  "accountNumber": "FE19-READY-ACCOUNT",
  "code": null,
  "content": "chuyen tien goi dich vu",
  "transferType": "in",
  "transferAmount": 1200000,
  "referenceCode": "FT17943295724",
  "description": "BIDV 17943295724"
}
```

Response:

```json
{
  "success": true
}
```

## A15 error: wrong signature

`POST /api/webhooks/sepay` — bên gọi `SePay`, HTTP 401

Header: `X-SePay-Timestamp: <unix seconds>`, `X-SePay-Signature: sha256=<wrong>`

Request:

```json
{
  "id": 17943295721,
  "gateway": "BIDV",
  "transactionDate": "2026-11-10 23:52:54",
  "accountNumber": "FE19-READY-ACCOUNT",
  "code": "BCE584F0252942",
  "content": "Thanh toan BCE584F0252942",
  "transferType": "in",
  "transferAmount": 1200000,
  "referenceCode": "FT17943295721",
  "description": "BIDV 17943295721"
}
```

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Unauthorized",
  "status": 401,
  "detail": "401 UNAUTHORIZED \"Invalid webhook authentication\"",
  "instance": "/api/webhooks/sepay",
  "message": "error.http.401",
  "path": "/api/webhooks/sepay"
}
```

## A16 evidence detail

`GET /api/platform/payments/evidence/{evidenceId}` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "summary": {
    "id": 2003,
    "provider": "SEPAY",
    "environment": "MOCK",
    "accountNamespace": "FE19-READY",
    "maskedTransactionId": "****5724",
    "amount": 1200000.0,
    "direction": "IN",
    "content": "chuyen tien goi dich vu",
    "bankPaidAt": "2026-11-10T16:52:57Z",
    "reviewStatus": "TO_REVIEW",
    "matchResult": "CODE_MISMATCH",
    "reviewReason": "No payment reference found",
    "receivingAccountMatches": true,
    "paymentId": null,
    "paymentCode": null,
    "version": 1
  },
  "transactionId": "17943295724",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "bank": "BIDV",
  "referenceCode": "FT17943295724",
  "quoteRef": null,
  "firstReceivedAt": "2026-11-10T16:52:57.160006Z",
  "returnReference": null,
  "returnDate": null,
  "returnResult": null,
  "history": [
    {
      "id": 1759,
      "source": "EVENT",
      "action": "EVIDENCE_RECEIVED",
      "reason": "No payment reference found",
      "reference": null,
      "result": null,
      "returnDate": null,
      "pmId": null,
      "pmName": null,
      "at": "2026-11-10T16:52:57.489762Z",
      "relatedPaymentId": null,
      "relatedPaymentCode": null
    }
  ]
}
```

## A16 evidence detail with history

`GET /api/platform/payments/evidence/{evidenceId}` — bên gọi `pm@beefcare.local`, HTTP 200

Response:

```json
{
  "summary": {
    "id": 2002,
    "provider": "SEPAY",
    "environment": "MOCK",
    "accountNamespace": "FE19-READY",
    "maskedTransactionId": "****5723",
    "amount": 1199999.0,
    "direction": "IN",
    "content": "Thanh toan BCF8C41A0FD37A",
    "bankPaidAt": "2026-11-10T16:52:57Z",
    "reviewStatus": "LOCKED",
    "matchResult": "AMOUNT_MISMATCH",
    "reviewReason": "Khách xác nhận cần hoàn lại",
    "receivingAccountMatches": true,
    "paymentId": null,
    "paymentCode": null,
    "version": 6
  },
  "transactionId": "17943295723",
  "receivingAccount": "FE19-READY-ACCOUNT",
  "bank": "BIDV",
  "referenceCode": "FT17943295723",
  "quoteRef": "BCF8C41A0FD37A",
  "firstReceivedAt": "2026-11-10T16:52:57.130064Z",
  "returnReference": "FT-RETURN-1794329572",
  "returnDate": "2026-11-10",
  "returnResult": "Đã hoàn 1.199.999 VND cho khách",
  "history": [
    {
      "id": 2206,
      "source": "REVIEW",
      "action": "RETURN_VERIFIED",
      "reason": null,
      "reference": "FT-RETURN-1794329572",
      "result": "Đã hoàn 1.199.999 VND cho khách",
      "returnDate": "2026-11-10",
      "pmId": 1059,
      "pmName": "Local Platform Manager",
      "at": "2026-11-10T16:53:01.318747Z",
      "relatedPaymentId": null,
      "relatedPaymentCode": null
    },
    {
      "id": 2205,
      "source": "REVIEW",
      "action": "LOCK",
      "reason": "Khách xác nhận cần hoàn lại",
      "reference": null,
      "result": null,
      "returnDate": null,
      "pmId": 1059,
      "pmName": "Local Platform Manager",
      "at": "2026-11-10T16:53:01.191693Z",
      "relatedPaymentId": null,
      "relatedPaymentCode": null
    },
    "... 4 more"
  ]
}
```

## A17 error: SePay lookup not configured

`GET /api/platform/payments/lookup` — bên gọi `pm@beefcare.local`, HTTP 503

Response:

```json
{
  "type": "https://www.jhipster.tech/problem/problem-with-message",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "503 SERVICE_UNAVAILABLE \"SePay lookup is not configured\"",
  "instance": "/api/platform/payments/lookup",
  "message": "error.http.503",
  "path": "/api/platform/payments/lookup"
}
```

## Đối chiếu database sau lượt chạy

Đọc trực tiếp database riêng của lượt chạy (`beefcare_fe19_ready`, PostgreSQL 16.15) sau các lệnh trên:

| Dữ liệu | Kết quả |
|---|---|
| Yêu cầu trại A (webhook) | PAID, nguồn SEPAY, biên lai `RC-26-001901`, kỳ 1 năm; xác nhận 0,77 giây sau ACK (JOB-06, NFR-P05 ≤ 10 giây) |
| Yêu cầu trại C (PM chấp nhận chứng từ không có mã) | PAID, nguồn PM, biên lai `RC-26-001902` |
| Chứng từ | 3 chứng từ: hai ACCEPTED đã phân bổ, một LOCKED_FOR_RETURN đã ghi hoàn trả; mỗi chứng từ một job DONE sau 1 lần thử; lần giao lặp qua alias tăng số lần giao lên 2, không tạo job/kỳ thứ hai |
| Email | Hai email intent `PAYMENT_PAID:<id>` ở trạng thái SENT (Mailpit local) |
| Lời gọi sai chữ ký | 401, chỉ một dòng metadata hạn chế, không có chứng từ |
