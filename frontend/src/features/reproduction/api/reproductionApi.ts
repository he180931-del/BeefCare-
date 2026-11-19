import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { filterWorklist } from '../domain/reproductionRules'
import { reproductionDemoStore, type ReproductionDemoStore } from '../data/reproductionDemoStore'
import { EMPTY_REPRODUCTION_OPTIONS, localReproductionOptions } from '../data/reproductionOptions'
import { businessDateTime } from '../../../shared/lib/date/farmTime'
import type {
  CalvingCommand,
  CalvingRecord,
  ReproductionCommand,
  ReproductionEvent,
  ReproductionFemale,
  ReproductionFormOptions,
  ReproductionRole,
  WorklistFilters,
} from '../types'
import { createReproductionBackend } from './reproductionBackend'

export interface ReproductionApi {
  /** Giờ trại hiện tại (yyyy-mm-ddTHH:mm); bản mô phỏng đứng ở ngày của dữ liệu mẫu. */
  now(): string
  /** Lựa chọn hiển thị trước khi `formOptions` trả về; máy chủ thật bắt đầu từ danh sách rỗng. */
  initialFormOptions(cattleCode?: string): ReproductionFormOptions
  listWorklist(filters?: WorklistFilters): Promise<ReproductionFemale[]>
  getProfile(cattleCode: string): Promise<ReproductionFemale>
  /** Lựa chọn của popup và SCR-40 (thành viên, đực giống, giống, chuồng, mục đích, ca bệnh của bò). */
  formOptions(cattleCode: string): Promise<ReproductionFormOptions>
  recordEvent(cattleCode: string, command: ReproductionCommand, role: ReproductionRole): Promise<ReproductionFemale>
  recordCalving(cattleCode: string, command: CalvingCommand, role: ReproductionRole): Promise<ReproductionFemale>
  correctEvent(cattleCode: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  voidEvent(cattleCode: string, eventId: string, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  correctCalving(cattleCode: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  voidCalving(cattleCode: string, calvingId: string, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  voidCalf(cattleCode: string, calvingId: string, calfId: string, reason: string, role: ReproductionRole): Promise<ReproductionFemale>
  resetDemo(): Promise<ReproductionFemale[]>
}

/**
 * Ranh giới API của tính năng sinh sản. Chế độ backend dùng `reproductionBackend` (A1–A8 của FE-11 / FE-12) và không
 * bao giờ đọc dữ liệu minh họa; chế độ local dùng `reproductionDemoStore`. Quyền ghi do backend kiểm (Manager).
 */
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
  if (mode === 'backend') {
    const backend = createReproductionBackend({ farmId, transport })
    const now = () => businessDateTime().slice(0, 16)
    return {
      now,
      initialFormOptions: () => EMPTY_REPRODUCTION_OPTIONS,
      async listWorklist(filters = {}) { return filterWorklist(await backend.listWorklist(), filters, now()) },
      getProfile: (cattleCode) => backend.getProfile(cattleCode),
      formOptions: (cattleCode) => backend.formOptions(cattleCode),
      recordEvent: (cattleCode, command) => backend.recordEvent(cattleCode, command),
      recordCalving: (cattleCode, command) => backend.recordCalving(cattleCode, command),
      correctEvent: (cattleCode, eventId, patch, reason) => backend.correctEvent(cattleCode, eventId, patch, reason),
      voidEvent: (cattleCode, eventId, reason) => backend.voidEvent(cattleCode, eventId, reason),
      correctCalving: (cattleCode, calvingId, patch, reason) => backend.correctCalving(cattleCode, calvingId, patch, reason),
      voidCalving: (cattleCode, calvingId, reason) => backend.voidCalving(cattleCode, calvingId, reason),
      voidCalf: (cattleCode, calvingId, calfId, reason) => backend.voidCalf(cattleCode, calvingId, calfId, reason),
      // Không có API: dữ liệu minh họa không tồn tại trong chế độ backend.
      async resetDemo() { throw new Error('Chế độ backend không có dữ liệu minh họa để đặt lại.') },
    }
  }
  return {
    now: () => store.now(),
    initialFormOptions: (cattleCode) => localReproductionOptions(cattleCode),
    async listWorklist(filters = {}) { return filterWorklist(await store.list(), filters, store.now()) },
    getProfile: (cattleCode) => store.get(cattleCode),
    async formOptions(cattleCode) { return localReproductionOptions(cattleCode) },
    recordEvent: (cattleCode, command, role) => store.recordEvent(cattleCode, command, role),
    recordCalving: (cattleCode, command, role) => store.recordCalving(cattleCode, command, role),
    correctEvent: (cattleCode, eventId, patch, reason, role) => store.correctEvent(cattleCode, eventId, patch, reason, role),
    voidEvent: (cattleCode, eventId, reason, role) => store.voidEvent(cattleCode, eventId, reason, role),
    correctCalving: (cattleCode, calvingId, patch, reason, role) => store.correctCalving(cattleCode, calvingId, patch, reason, role),
    voidCalving: (cattleCode, calvingId, reason, role) => store.voidCalving(cattleCode, calvingId, reason, role),
    voidCalf: (cattleCode, calvingId, calfId, reason, role) => store.voidCalf(cattleCode, calvingId, calfId, reason, role),
    resetDemo: () => store.reset(),
  }
}

export const reproductionApi = createReproductionApi({
  mode: backendMode,
  farmId: backendFarmId,
  transport: backendTransport,
  store: reproductionDemoStore,
})

export const resetReproductionDemo = () => reproductionApi.resetDemo()
