/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BEEFCARE_DATA_SOURCE?: 'local' | 'backend'
  readonly VITE_BEEFCARE_API_URL?: string
  readonly VITE_BEEFCARE_FARM_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
