import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
import type { ScreenId, ScreenRole } from './screenManifest'
import { INITIAL_FIXTURE_RECORDS, type FixtureRecord } from './fixtureData'

export type ReviewState = 'success' | 'loading' | 'empty' | 'error' | 'read-only'
export interface FixtureSessionState { role: Exclude<ScreenRole, 'guest'>; screenId: ScreenId; reviewState: ReviewState; records: FixtureRecord[] }
export const UI_DEMO_STORAGE_KEY = 'beefcare-ui-demo'
const UI_DEMO_STORAGE_VERSION = 1
export type FixtureAction =
  | { type: 'set-role'; role: FixtureSessionState['role'] }
  | { type: 'set-screen'; screenId: ScreenId }
  | { type: 'set-review-state'; reviewState: ReviewState }
  | { type: 'add-record'; record: FixtureRecord }
  | { type: 'edit-record'; id: string; patch: Partial<FixtureRecord> }
  | { type: 'set-record-status'; id: string; status: string }

export function createFixtureSession(): FixtureSessionState {
  const initial = { role: 'owner' as const, screenId: 'SCR-77' as ScreenId, reviewState: 'success' as ReviewState, records: structuredClone(INITIAL_FIXTURE_RECORDS) }
  if (typeof window === 'undefined') return initial
  try {
    const stored = window.localStorage.getItem(UI_DEMO_STORAGE_KEY)
    if (!stored) return initial
    const parsed = JSON.parse(stored) as { version?: number; state?: Partial<FixtureSessionState> }
    if (parsed.version !== UI_DEMO_STORAGE_VERSION || !parsed.state || !Array.isArray(parsed.state.records)) return initial
    return { ...initial, ...parsed.state, records: parsed.state.records as FixtureRecord[] }
  } catch { return initial }
}

export function applyFixtureAction(state: FixtureSessionState, action: FixtureAction): FixtureSessionState {
  switch (action.type) {
    case 'set-role': return { ...state, role: action.role }
    case 'set-screen': return { ...state, screenId: action.screenId }
    case 'set-review-state': return { ...state, reviewState: action.reviewState }
    case 'add-record': return { ...state, records: [...state.records, action.record] }
    case 'edit-record': return { ...state, records: state.records.map((record) => record.id === action.id ? { ...record, ...action.patch } : record) }
    case 'set-record-status': return { ...state, records: state.records.map((record) => record.id === action.id ? { ...record, status: action.status } : record) }
  }
}

type FixtureSessionValue = FixtureSessionState & { dispatch: Dispatch<FixtureAction> }
const FixtureSessionContext = createContext<FixtureSessionValue | null>(null)

export function FixtureSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applyFixtureAction, undefined, createFixtureSession)
  useEffect(() => {
    try {
      const current = JSON.parse(window.localStorage.getItem(UI_DEMO_STORAGE_KEY) || '{}') as Record<string, unknown>
      window.localStorage.setItem(UI_DEMO_STORAGE_KEY, JSON.stringify({ ...current, version: UI_DEMO_STORAGE_VERSION, state }))
    } catch { /* best effort demo persistence */ }
  }, [state])
  const value = useMemo(() => ({ ...state, dispatch }), [state])
  return <FixtureSessionContext.Provider value={value}>{children}</FixtureSessionContext.Provider>
}

export function useFixtureSession(): FixtureSessionValue {
  const session = useContext(FixtureSessionContext)
  if (!session) throw new Error('useFixtureSession must be used inside FixtureSessionProvider')
  return session
}
