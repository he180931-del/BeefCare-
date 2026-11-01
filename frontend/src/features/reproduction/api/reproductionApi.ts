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
    async listWorklist(filters = {}) {
      requireLocal()
      return filterWorklist(await store.list(), filters)
    },
    async getProfile(cattleCode) {
      requireLocal()
      return store.get(cattleCode)
    },
    async recordEvent(cattleCode, command, role) {
      requireLocal()
      return store.recordEvent(cattleCode, command, role)
    },
    async recordCalving(cattleCode, command, role) {
      requireLocal()
      return store.recordCalving(cattleCode, command, role)
    },
    async correctEvent(cattleCode, eventId, patch, reason, role) {
      requireLocal()
      return store.correctEvent(cattleCode, eventId, patch, reason, role)
    },
    async voidEvent(cattleCode, eventId, reason, role) {
      requireLocal()
      return store.voidEvent(cattleCode, eventId, reason, role)
    },
    async correctCalving(cattleCode, calvingId, patch, reason, role) {
      requireLocal()
      return store.correctCalving(cattleCode, calvingId, patch, reason, role)
    },
    async voidCalving(cattleCode, calvingId, reason, role) {
      requireLocal()
      return store.voidCalving(cattleCode, calvingId, reason, role)
    },
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

