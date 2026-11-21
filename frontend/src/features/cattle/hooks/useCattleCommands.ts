import { useQuery } from '../../../shared/hooks/useQuery'
import { useMutation } from '../../../shared/hooks/useMutation'
import { catalogueApi } from '../../farm-catalogue'
import {
  checkPenMove,
  editImportRecord,
  moveBarn,
  reissueQr,
  saveCattlePhoto,
  updateIdentity,
  updatePurpose,
  updateStage,
  voidImportRecord,
  correctTimelineRecord,
  type BackendMutationContext,
} from '../api/cattleApi'
import type { CattleViewModel as CowSeed, ImportRecord } from '../types'

type MovePayload = { to: string; date: string; reason: string; by: string }
type ReissuePayload = { reason: string; note: string; by: string; tagCode?: string }

export function useCattleMoveCommand(cow: CowSeed, options: { backend: boolean; destId?: number; warningReason?: string }) {
  return useMutation((payload: MovePayload) => moveBarn(cow.code, payload, options.backend
    ? { backendId: cow.backendId, backendVersion: cow.backendVersion, toPenId: options.destId, warningReason: options.warningReason }
    : {}))
}

export function useCattlePenMoveCheck({ cow, backend, destId, date, checkRun }: { cow: CowSeed; backend: boolean; destId?: number; date: string; checkRun: number }) {
  const query = useQuery(() => backend && destId != null && date
    ? checkPenMove(cow.code, { date, toPenId: destId }, { backendId: cow.backendId })
    : Promise.resolve(null), [backend, destId, date, cow.code, cow.backendId, checkRun])
  return { ...query, data: query.loading ? null : query.data }
}

export function useCattleQrCommand(cow: CowSeed, backend: boolean) {
  return useMutation((payload: ReissuePayload) => reissueQr(cow.code, payload, backend
    ? { backendId: cow.backendId, backendVersion: cow.backendVersion }
    : {}))
}

export function useCattleRecordCommands(cow: CowSeed, record: ImportRecord) {
  const edit = useMutation((payload: { values: Record<string, string>; reason: string }) => editImportRecord(cow.code, payload))
  const voidRecord = useMutation((payload: { reason: string }) => voidImportRecord(cow.code, payload))
  return { edit, voidRecord, record }
}

export function useCattleProfileCommands(code: string, context: BackendMutationContext) {
  const identity = useMutation((payload: { name: string; tag?: string; description?: string; notes?: string }) => updateIdentity(code, payload, context))
  const stage = useMutation((payload: { stage: string; date: string; reason: string; acknowledgedReproductionChange?: boolean }) => updateStage(code, payload, context))
  const purpose = useMutation((payload: { purposeId: number; effectiveDate?: string; reason?: string; acknowledgedReproductionChange?: boolean }) => updatePurpose(code, payload.purposeId, { ...context, effectiveDate: payload.effectiveDate, reason: payload.reason, acknowledgedReproductionChange: payload.acknowledgedReproductionChange }))
  const photo = useMutation((payload: { file: File | null; context?: BackendMutationContext }) => saveCattlePhoto(code, payload.context ?? context, payload.file))
  return { identity, stage, purpose, photo }
}

export function useCattleVaccineOptions(enabled: boolean) {
  return useQuery(() => enabled ? catalogueApi.listVaccines({ status: 'ACTIVE' }) : Promise.resolve([]), [enabled])
}

export function useTimelineCorrectionCommand() {
  return useMutation((payload: { path: string; sourceId: number; action: 'correction' | 'void'; body: Record<string, unknown>; key: string }) =>
    correctTimelineRecord(payload.path, payload.sourceId, payload.action, payload.body, payload.key))
}
