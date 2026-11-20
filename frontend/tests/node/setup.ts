// Preloaded by `npm run test:api` and `npm run test:integration` (plain Node, no Vite environment).
import { register } from 'node:module'
import { MemoryStorage } from '../../src/api/testUtils'

// The app defaults to the real backend (src/shared/config/runtime.ts); these suites exercise the demo stores unless
// the shell sets the variable. Tests of the backend adapters inject `mode: 'backend'` into the factories.
process.env.VITE_BEEFCARE_DATA_SOURCE ??= 'local'

// Demo data comes through src/demo/demoModules.ts, which reaches screens that import images; Vite bundles those, Node
// loads them as empty modules.
register('./assetLoader.mjs', import.meta.url)

// The local collections open localStorage while they load; tests that check storage assign their own first.
globalThis.localStorage ??= new MemoryStorage()
