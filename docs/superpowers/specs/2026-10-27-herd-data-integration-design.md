# Herd Data Integration Design

## Intent

Remove hard-coded voucher behavior and make the four completed frontend flows share durable mock data before they are merged to `main`.

## Required behavior

- Entry and exit voucher numbers are derived from stored rows.
- Draft vouchers persist the complete editable form and reopen with the same values.
- Posting an entry creates cattle records and increments receiving pens exactly once.
- Confirming an exit marks cattle exited and decrements their pens; cancelling restores both.
- Pen management and cattle profiles use one `beefcare:pens` collection and one in-memory collection instance.
- Every cattle link shown by Pen management resolves to a seeded or newly created cattle profile.
- Storage failures are surfaced to callers instead of being reported as successful writes.
- Automated tests cover ID generation, draft restoration, shared collections, and herd/pen side effects.

## Constraints

- Keep the current React/Vite mock architecture and localStorage persistence.
- Do not add a test framework dependency; use Node's built-in test runner.
- Keep all four feature branches independently buildable.
- Figma visual tuning is outside this functional repair; it remains a later round.

## Architecture

`api/client.js` owns a registry keyed by collection name. Repeated `createCollection` calls merge compatible seeds and return the same collection instance. A shared `herdDomainApi` owns `cattle` and `pens` mutations so feature APIs do not update related records independently. Feature-specific model helpers build and restore draft/voucher payloads and are directly unit-tested.
