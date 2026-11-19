/** Runtime configuration read once from the Vite environment (`frontend/.env`, `vite --mode`). */

/**
 * `import.meta.env` under Vite and Vitest. Plain Node runs (`npm run test:api`, `npm run test:integration`) have no
 * Vite environment and read `process.env`, which tests/node/localDataSource.ts presets to the demo stores.
 */
export function runtimeEnv(): Partial<ImportMetaEnv> {
  return import.meta.env ?? (globalThis as { process?: { env?: Partial<ImportMetaEnv> } }).process?.env ?? {}
}

const env = runtimeEnv()

export type BackendMode = 'local' | 'backend'

/**
 * Data source of the feature adapters. The real backend unless `local` is set explicitly: `npm run dev:mock` and the
 * Vitest suite run on the demo stores, and `vite build` refuses `local` (vite.config.js), so a production bundle
 * never serves demo data because a variable was forgotten.
 */
export const backendMode: BackendMode = env.VITE_BEEFCARE_DATA_SOURCE === 'local' ? 'local' : 'backend'

/** Backend origin. Empty means relative `/api` paths through the Vite proxy. */
export const backendBaseUrl = env.VITE_BEEFCARE_API_URL || ''

/** `VITE_BEEFCARE_FARM_ID`, used only by the legacy farm fallback that refactor phase 4 removes. */
export const configuredFarmId = env.VITE_BEEFCARE_FARM_ID
