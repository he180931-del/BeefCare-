import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { filterWorklist } from '../domain/reproductionRules'
import { reproductionDemoStore, type ReproductionDemoStore } from '../data/reproductionDemoStore'
import type {
  CalvingCommand,
  CalvingRecord,
  ReproductionCommand,
  ReproductionEvent,
  ReproductionRole,
  WorklistFilters,
} from '../types'

export interface ReproductionApi {
  listWorklist(filters?: WorklistFilters): Promise<Awaited<ReturnType<ReproductionDemoStore['list']>>>
  getProfile(cattleCode: string): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  recordEvent(cattleCode: string, command: ReproductionCommand, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  recordCalving(cattleCode: string, command: CalvingCommand, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  correctEvent(cattleCode: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  voidEvent(cattleCode: string, eventId: string, reason: string, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  correctCalving(cattleCode: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  voidCalving(cattleCode: string, calvingId: string, reason: string, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  voidCalf(cattleCode: string, calvingId: string, calfId: string, reason: string, role: ReproductionRole): Promise<Awaited<ReturnType<ReproductionDemoStore['get']>>>
  resetDemo(): Promise<Awaited<ReturnType<ReproductionDemoStore['list']>>>
}

const backendPending = () => new Error('Chưa tích hợp dữ liệu sinh sản với backend.')

export function createReproductionApi({
  mode,
  farmId,
  transport,
  store,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  store: ReproductionDemoStore
}): ReproductionApi {
  // Keep the farm-scoped transport available at this feature boundary for the later API handoff.
  // Backend mode intentionally does not call it or leak into the demo store until that contract is ready.
  void farmId
  void transport
  const requireLocal = () => {
    if (mode === 'backend') throw backendPending()
  }

  return {
    // GET /api/farms/{farmId}/reproduction-worklist
    async listWorklist(filters = {}) {
      requireLocal()
      return filterWorklist(await store.list(), filters)
    },
    // GET /api/farms/{farmId}/cattle/{cattleId}/reproduction-history
    async getProfile(cattleCode) {
      requireLocal()
      return store.get(cattleCode)
    },
    // POST /api/farms/{farmId}/cattle/{cattleId}/estrus-events | breeding-events | pregnancy-checks; pregnancy update: POST /api/farms/{farmId}/pregnancy-episodes/{episodeId}/updates
    async recordEvent(cattleCode, command, role) {
      requireLocal()
      return store.recordEvent(cattleCode, command, role)
    },
    // POST /api/farms/{farmId}/calvings
    async recordCalving(cattleCode, command, role) {
      requireLocal()
      return store.recordCalving(cattleCode, command, role)
    },
    // POST /api/farms/{farmId}/reproduction-events/{eventId}/correction; pregnancy update: /pregnancy-updates/{updateId}/correction
    async correctEvent(cattleCode, eventId, patch, reason, role) {
      requireLocal()
      return store.correctEvent(cattleCode, eventId, patch, reason, role)
    },
    // POST /api/farms/{farmId}/reproduction-events/{eventId}/void; pregnancy update: /pregnancy-updates/{updateId}/void
    async voidEvent(cattleCode, eventId, reason, role) {
      requireLocal()
      return store.voidEvent(cattleCode, eventId, reason, role)
    },
    // POST /api/farms/{farmId}/calvings/{calvingId}/correction; calf outcome: /calf-outcomes/{calfId}/correction
    async correctCalving(cattleCode, calvingId, patch, reason, role) {
      requireLocal()
      return store.correctCalving(cattleCode, calvingId, patch, reason, role)
    },
    // POST /api/farms/{farmId}/calvings/{calvingId}/void
    async voidCalving(cattleCode, calvingId, reason, role) {
      requireLocal()
      return store.voidCalving(cattleCode, calvingId, reason, role)
    },
    // POST /api/farms/{farmId}/calf-outcomes/{calfId}/void
    async voidCalf(cattleCode, calvingId, calfId, reason, role) {
      requireLocal()
      return store.voidCalf(cattleCode, calvingId, calfId, reason, role)
    },
    // chưa có API (chỉ dùng cho dữ liệu minh họa)
    async resetDemo() {
      requireLocal()
      return store.reset()
    },
  }
}

export const reproductionApi = createReproductionApi({
  mode: backendMode,
  farmId: backendFarmId,
  transport: backendTransport,
  store: reproductionDemoStore,
})

export const resetReproductionDemo = () => reproductionApi.resetDemo()

