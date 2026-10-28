# Integration setup and provider boundaries

This document separates local mocks from live credentials. The backend must use configured server-side URLs and secrets; it must never build identity links from the incoming `Host` header or return provider secrets to the browser.

## Email delivery

### Local development

The local Docker compose starts Mailpit. The backend sends SMTP to `localhost:1025`; open the Mailpit inbox at [http://localhost:8025](http://localhost:8025). Mailpit captures messages locally and never delivers them to external recipients. Use it to inspect the Vietnamese verification, password reset, farm invitation, and notification templates, including their plain-text alternatives and expiration times.

Use an ignored local `.env` for database, SMTP, and signing-key values. `application-local.yml` selects the SMTP adapter and Mailpit endpoint. `BEEFCARE_LINK_SECRET` is a random server-only secret of at least 32 characters. `BEEFCARE_BACKEND_URL` is the backend origin used for email activation links; `BEEFCARE_PUBLIC_URL` is the trusted frontend origin used for reset/invitation links. Keep hostnames consistent with the frontend API origin so the session cookie created during email activation is sent on later requests.

Profiles `dev` and `testh2` use the in-memory `MockEmailDelivery` unless `beefcare.email.provider=smtp` is explicitly selected. The local inbox is not exposed through an API. Link-bearing email jobs persist only a recipient, a template key, and a reference to the source row; the job does not persist the bearer link. Account/invitation token rows keep a SHA-256 hash and a random nonce. The bearer is derived at dispatch with HMAC-SHA256 and a server-only key, checked against the stored hash, and sent after the transaction commits. Failed jobs retry with backoff after restart. Changing `BEEFCARE_LINK_SECRET` invalidates pending one-time links; issue a new link after changing it.

### Live SMTP

Select `BEEFCARE_EMAIL_PROVIDER=smtp` and set `BEEFCARE_SMTP_HOST`, `BEEFCARE_SMTP_PORT`, `BEEFCARE_SMTP_USERNAME`, `BEEFCARE_SMTP_PASSWORD`, and `BEEFCARE_SMTP_AUTH` in the deployment secret store. Set `BEEFCARE_PUBLIC_URL`, `BEEFCARE_BACKEND_URL`, and `BEEFCARE_LINK_SECRET` there as well. SMTP connection, read, and write timeouts are five seconds. The SMTP adapter makes three quick attempts; the durable delivery job then retries with bounded exponential backoff. The `From` address comes from `jhipster.mail.from` and must be authorized by the mail provider.

The adapter uses Spring Boot's `JavaMailSender` support; see [Spring Boot email sending](https://docs.spring.io/spring-boot/reference/io/email.html).

## Google Identity

The Google OIDC login flow is wired behind an explicit feature switch and remains disabled by default. To enable it, set `BEEFCARE_GOOGLE_ENABLED=true` and provide `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID` and `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET` in the deployment secret store. The registration uses the `openid`, `email`, and `profile` scopes and Spring Security's authorization-code/OIDC validation. Register the exact backend callback URL `https://<backend-host>/login/oauth2/code/google` with Google; do not accept arbitrary callback hosts. The backend requires Google's verified-email claim, links by existing Google subject or matching verified email, creates a server-side BeefCare session, and does not receive or store a Google password. No OAuth client secret is committed to the repository.

## SePay and VietQR

The live webhook is exposed at `POST /api/webhooks/sepay`. It verifies the exact raw request body with `X-SePay-Timestamp` (Unix seconds) and `X-SePay-Signature: sha256=<hex>`, using HMAC-SHA256 over `<timestamp>.<raw-body>`, constant-time comparison, and a 300-second timestamp tolerance. Invalid signatures return HTTP 401 without storing bank evidence. Authenticated events are stored and synchronously evaluated in the same transaction; the response includes success, duplicate, evidence, review, and payment identifiers. Provider/environment/account namespace and the immutable quote receiving-account snapshot are checked before settlement. Duplicate transaction IDs with identical normalized payloads replay successfully, while conflicting payloads return HTTP 409. Evidence that cannot be safely matched remains in the PM review queue.

The PM-only local event simulator is `POST /api/dev/sepay/events` and is available only in `dev`, `local`, and `testh2` profiles while the configured environment is `MOCK` or `TEST`. It calls the same evidence and confirmation pipeline. The PM transaction lookup endpoint uses the server-side SePay API token and bounded timeout configuration. Configure a distinct account namespace whenever the receiving account changes; quotes retain their original environment, namespace, and account snapshot.

Payment requests expire every five minutes through JOB-03. Expiry is serialized with confirmation using farm, subscription, and payment locks. An event whose bank-paid time is inside the original half-open quote window can still settle an `EXPIRED` request when delivery was delayed; a transfer at or after expiry cannot. JOB-04 recalculates coverage every 15 minutes and keeps a PM-suspended farm suspended while the underlying entitlement changes.

For transaction lookup, the SePay API uses `Authorization: Bearer <API_TOKEN>`; keep that token server-side and configure bounded request timeouts. VietQR images can be generated from the immutable payment-request account/amount/content snapshot. Current documented routes include `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...` and its `https://new.vietqr.app/img` equivalent.

Read the provider's current primary documentation before enabling the live adapter: [SePay webhook authentication](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc), [webhook payload and integration](https://docs.sepay.vn/tich-hop-webhooks.html), [transaction API](https://docs.sepay.vn/api-giao-dich.html), and [VietQR generator](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code). These links are implementation references, not authorization to contact a live account.

## Safe local checks

1. Start the local compose profile and confirm PostgreSQL and Mailpit are healthy.
2. Start the backend with `dev,local`; use an explicitly chosen local-only owner password.
3. Register a test account, inspect its verification email in Mailpit, verify it, and confirm the browser session is created on the configured backend origin.
4. Exercise reset and invitation emails with disposable local addresses and verify that the raw bearer does not appear in database rows, application logs, or API response DTOs.
5. Use the PM-only local SePay simulator with a `MOCK` provider namespace and test duplicate/conflicting transaction events; it is unavailable in `prod`.
6. Enable live mail or SePay only after configuring secrets on the server and using the provider's documented test/sandbox capability.
