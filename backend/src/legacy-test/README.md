# Retired authentication tests

These files were the generated JWT authentication and invalid-token-meter integration suite. BeefCare now uses server-side HTTP sessions with CSRF protection, so Bearer-token issuance and JWT decoder meter assertions no longer describe the application contract. They are retained here as historical test material and are intentionally outside Maven's test source roots.

The active replacement coverage is `AuthenticateControllerIT` (H2 session, CSRF, account activation mapping, logout, and access denial) plus `BearerTokenRejectionIT` (a Bearer token cannot authenticate a request).
