# Verification and visual evidence

## Test stages

Feature worktrees run only the agreed feature-local unit suite. Do not run
cross-feature integration/API suites there. After approved feature checkpoints
are combined on `integration`, run the agreed integration/API tests, typecheck,
and build.

Frontend commands from `frontend/`:

```bash
./node_modules/.bin/vitest run --passWithNoTests tests/unit/herd-entry
./node_modules/.bin/vitest run --passWithNoTests tests/unit/herd-exit
./node_modules/.bin/vitest run --passWithNoTests tests/unit/cattle
./node_modules/.bin/vitest run --passWithNoTests tests/unit/pens
./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth
npm run test:api
./node_modules/.bin/vitest run --passWithNoTests tests/integration
npm run typecheck
npm run build
```

The feature-unit commands above pass an exact `tests/unit/<feature>` path and
are the only test commands for a feature worktree. The current
`frontend/vitest.config.ts` include pattern also includes `tests/integration`,
so a bare `npm run test:unit:run` is not a unit-only boundary. After approved
feature changes are combined on `integration`, the installed Vitest binary
command `./node_modules/.bin/vitest run --passWithNoTests tests/integration`
covers all frontend integration directories. The existing
`npm run test:integration` script is an entry-only smoke command and must not
be treated as the full integration gate. `npm test` is an aggregate convenience
script whose unit step still includes integration files and whose final
integration step is entry-only; report its subcommands rather than treating it
as complete coverage.

Backend unit tests use `cd backend && ./mvnw -Dskip.installnodenpm -Dskip.npm
test`; select focused classes with Maven's `-Dtest=ClassName` when appropriate.
Tests named `*IT`/`*IntTest` are Failsafe integration tests and must run through
`verify`, not Surefire `test`.

## Playwright runtime checks

Runtime UI control is not automated E2E. Use the project-local
`.agents/skills/playwright-cli/SKILL.md`, an in-memory named session, snapshots,
screenshots, console, and requests. Record route, data seed, viewport, browser
conditions, source SHA, expected/observed result, and cleanup. Do not modify browser state to mask a
backend or auth failure.

For visual changes:

1. Capture a baseline before coding and a current image after coding using the
   same route, data fixture, UI state, viewport, and browser conditions. The
   manifest records separate `beforeSHA` and `afterSHA` values.
2. Store per-run evidence under `/tmp/beefcare-ui-evidence/<run-id>/`.
3. Store approved persistent design references only under
   `docs/ui-reference/<feature>/` and only after the user approves the images.
4. Compare manually side-by-side today; automated visual/E2E files or CI gates
   need separate user approval.

Existing helpers are legacy aids:

- `frontend/tools/shot.mjs` uses `playwright-core`, a hardcoded local browser
  executable, defaults to `localhost:5199`, and sets `beefcare:latency=0` in
  localStorage. Record or correct those assumptions before relying on output.
- `frontend/tools/diff.py` imports PIL and NumPy. They are not project
  dependencies; do not install them silently. If unavailable, report that the
  diff is blocked and use manual comparison.

Sanitize screenshots/manifests: never include credentials, cookies, tokens, or
unapproved personal data. A visual finding returns to Coding; a new automated
browser test returns to Testing.
