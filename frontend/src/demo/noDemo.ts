import type { demo as DemoModules } from './demoModules'
import type { SessionUser } from '../features/authorization'

/** No `?demo=<state>` switch without demo data. */
export const useDemoState = (): string | null => null

/** No stand-in user: every screen of the app renders inside a session (SessionProvider). */
export const demoSessionUser = (_role: SessionUser['role']): SessionUser | null => null

/**
 * Replaces `demoModules.ts` in `vite build` and on the real backend (vite.config.js): there is no demo data, and every
 * read is a programming error that must surface instead of showing sample data.
 */
export const demo = new Proxy({}, {
  get(_target, name) {
    throw new Error(`Bản này không có dữ liệu mẫu (${String(name)}). Dữ liệu mẫu chỉ có với npm run dev:mock và test.`)
  },
}) as typeof DemoModules
