// Preloaded by `npm run test:api` and `npm run test:integration` (plain Node, no Vite environment).
// The app defaults to the real backend (src/shared/config/runtime.ts); these suites exercise the demo stores unless
// the shell sets the variable. Tests of the backend adapters inject `mode: 'backend'` into the factories.
process.env.VITE_BEEFCARE_DATA_SOURCE ??= 'local'
