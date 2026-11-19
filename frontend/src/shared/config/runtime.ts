/** Runtime configuration read once from the Vite environment (`frontend/.env`, `vite --mode`). */
const env: Partial<ImportMetaEnv> = import.meta.env ?? {}

export type BackendMode = 'local' | 'backend'

/**
 * Data source of the feature adapters. Unset still means 'local', exactly as before the refactor; making the real
 * backend the only production source is refactor phase 3 (docs/frontend-refactor-guide.md §10).
 */
export const backendMode: BackendMode = env.VITE_BEEFCARE_DATA_SOURCE === 'backend' ? 'backend' : 'local'

/** Backend origin. Empty means relative `/api` paths through the Vite proxy. */
export const backendBaseUrl = env.VITE_BEEFCARE_API_URL || ''

/** `VITE_BEEFCARE_FARM_ID`, used only by the legacy farm fallback that refactor phase 4 removes. */
export const configuredFarmId = env.VITE_BEEFCARE_FARM_ID
