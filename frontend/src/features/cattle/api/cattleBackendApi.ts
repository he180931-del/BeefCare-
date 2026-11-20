import type { BackendTransport } from '../../../shared/api/backendTransport'
import type { CowSeed } from '../../../data/cowsData'
import type { Pen } from '../../pen-management'
import type { BackendList, BackendPenHistory, BackendProfile, BackendPurpose, BackendPen, BackendQrTag, PenMoveCheck, PenMoveCheckCommand, PenMoveCommand, ProfileUpdateCommand, QrIssueCommand } from './cattle.dto'
import { asRecord, mapBackendCattle, mapPen, number, rows, text } from './cattleMapper'
import { mapTimeline, type BackendTimeline } from './cattleTimeline'

// Public contract kept from the former api/cattleBackendApi.ts.
export type { PenMoveCheck, PenMoveCheckCommand, PenMoveCommand, ProfileUpdateCommand, QrIssueCommand } from './cattle.dto'
export { LIFE_STAGE_OPTIONS, calculateAge, lifeStageLabel, lifeStageValue, mapBackendCattle } from './cattleMapper'

export type CattlePage = { items: CowSeed[]; total: number; page: number; size: number; counts: Record<string, number> }
export type CattleListOptions = {
  q?: string; purposeId?: string | number; health?: string; breedId?: string | number; sex?: string; penId?: string | number
  lifeStage?: string; herdStatus?: string; herdGroup?: string; page?: number; size?: number
  sort?: string; hasWeight?: boolean
}
export type PurposeOption = { id: number; code: string; name: string; purposeType: string; available: boolean }
export type ResolvedCode = { cattle: CowSeed | null; switchFarmRequired: boolean; farmId: number | null; replacedTag: boolean; currentTagCode: string | null; replacedAt: string | null }

export function createCattleBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number | null }) {
  const root = transport.farmPath(farmId, '/cattle')
  const listPage = async (options: CattleListOptions = {}): Promise<CattlePage> => {
    const params = new URLSearchParams()
    params.set('page', String(options.page ?? 0)); params.set('size', String(options.size ?? 25))
    if (options.q?.trim()) params.set('q', options.q.trim())
    if (options.purposeId !== undefined && String(options.purposeId)) params.set('purposeId', String(options.purposeId))
    if (options.health) params.set('health', options.health)
    if (options.breedId !== undefined && String(options.breedId)) params.set('breedId', String(options.breedId))
    if (options.sex) params.set('sex', options.sex)
    if (options.penId !== undefined && String(options.penId)) params.set('penId', String(options.penId))
    if (options.lifeStage) params.set('lifeStage', options.lifeStage)
    if (options.herdStatus) params.set('herdStatus', options.herdStatus)
    if (options.herdGroup) params.set('herdGroup', options.herdGroup)
    if (options.sort) params.set('sort', options.sort)
    if (options.hasWeight !== undefined) params.set('hasWeight', String(options.hasWeight))
    const body = await transport.get(`${root}?${params.toString()}`) as BackendList
    const record = asRecord(body)
    const items = (Array.isArray(record.items) ? record.items as BackendProfile[] : []).map((row) => mapBackendCattle(row))
    return { items, total: number(record.total), page: number(record.page), size: number(record.size, options.size ?? 25), counts: (record.counts || {}) as Record<string, number> }
  }
  const purposes = async (): Promise<PurposeOption[]> => {
    const body = await transport.get(transport.farmPath(farmId, '/catalogues/production-purposes'))
    return rows<BackendPurpose>(body, 'items').map((p) => ({ id: number(p.id), code: text(p.code), name: text(p.name), purposeType: text(p.purposeType), available: p.available !== false }))
  }
  const breeds = async (): Promise<Array<{ id: number; name: string; code: string }>> => rows<{ id?: number; name?: string; code?: string }>(await transport.get(transport.farmPath(farmId, '/catalogues/breeds')), 'items').map((breed) => ({ id: number(breed.id), name: text(breed.name), code: text(breed.code) }))
  const pens = async (): Promise<Pen[]> => rows<BackendPen>(await transport.get(transport.farmPath(farmId, '/pens')), 'pens').map(mapPen)
  const updateProfile = (cattleId: number, body: ProfileUpdateCommand) => transport.command(transport.farmPath(farmId, `/cattle/${cattleId}/profile`), body, { method: 'PUT' })
  const issueQr = (cattleId: number, body: QrIssueCommand) => transport.command(transport.farmPath(farmId, `/cattle/${cattleId}/qr-tags`), body, { method: 'POST' })
  /** A4: JPG / PNG photo, multipart with the cattle version read when the popup opened. */
  const uploadPhoto = (cattleId: number, file: File, cattleVersion: number) => {
    const form = new FormData()
    form.append('file', file)
    return transport.command(transport.farmPath(farmId, `/cattle/${cattleId}/photo?expectedVersion=${cattleVersion}`), form, { method: 'POST' })
  }
  const removePhoto = (cattleId: number, cattleVersion: number) => transport.command(transport.farmPath(farmId, `/cattle/${cattleId}/photo?expectedVersion=${cattleVersion}`), undefined, { method: 'DELETE' })
  /** A7 as returned by the backend: the cattle card, or a farm switch, or a domain error (MSG-FE05-09 / -10). */
  const resolveCode = async (code: string): Promise<ResolvedCode> => {
    const body = asRecord(await transport.get(`${root}/resolve?code=${encodeURIComponent(code)}`))
    return {
      cattle: body.cattle ? mapBackendCattle(body.cattle as BackendProfile) : null,
      switchFarmRequired: body.switchFarmRequired === true,
      farmId: typeof body.farmId === 'number' ? body.farmId : null,
      replacedTag: body.replacedTag === true,
      currentTagCode: typeof body.currentTagCode === 'string' ? body.currentTagCode : null,
      replacedAt: typeof body.replacedAt === 'string' ? body.replacedAt : null,
    }
  }
  const checkPenMove = ({ cattleId, toPenId, moveDate }: PenMoveCheckCommand): Promise<PenMoveCheck> => transport.command(transport.farmPath(farmId, '/pen-moves/check'), { cattleIds: [cattleId], toPenId, moveDate }, { method: 'POST' }) as Promise<PenMoveCheck>
  const movePen = ({ cattleId, toPenId, moveDate, reason, warningReason, cattleVersion }: PenMoveCommand) => transport.command(transport.farmPath(farmId, '/pen-moves'), {
    cattleIds: [cattleId], toPenId, moveDate, reason, warningReasons: warningReason ? { [cattleId]: warningReason } : {},
    ...(cattleVersion == null ? {} : { cattleVersions: { [cattleId]: cattleVersion } }),
  }, { method: 'POST' })
  const timelineRows = async (cattleId: number, showCorrections: boolean) =>
    rows<BackendTimeline>(await transport.get(`${root}/${cattleId}/timeline?showCorrections=${showCorrections}`), 'items')
  const timeline = async (cattleId: number, showCorrections: boolean) =>
    (await timelineRows(cattleId, showCorrections)).filter((event) => event.occurredAt || event.recordedAt).map(mapTimeline)
  const profile = async (code: string): Promise<{ cow: CowSeed; barns: Pen[] }> => {
    const resolved = asRecord(await transport.get(`${root}/resolve?code=${encodeURIComponent(code)}`))
    const cattleId = number(resolved.cattleId)
    if (!cattleId) throw new Error(`Không tìm thấy hồ sơ bò ${code}`)
    const [body, history, barnRows, tagResult, timelineResult] = await Promise.all([
      transport.get(`${root}/${cattleId}`) as Promise<BackendProfile>,
      transport.get(transport.farmPath(farmId, `/cattle/${cattleId}/pen-history`)) as Promise<BackendPenHistory>,
      pens(),
      transport.get(`${root}/${cattleId}/qr-tags`).then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const, value: [] })),
      timelineRows(cattleId, false).then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const, value: [] })),
    ])
    return { cow: mapBackendCattle(body, history, rows<BackendQrTag>(tagResult.value, 'items'), rows<BackendTimeline>(timelineResult.value, 'items'), { qr: !tagResult.ok, timeline: !timelineResult.ok }), barns: barnRows }
  }
  return { listPage, purposes, breeds, pens, profile, timeline, updateProfile, issueQr, uploadPhoto, removePhoto, resolveCode, checkPenMove, movePen }
}
