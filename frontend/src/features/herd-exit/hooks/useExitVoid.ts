import { useEffect, useState } from 'react'
import { cancelHerdExit, exitCancelDefaults, exitVoidCheck, listExitCancelPens } from '../api/index'
import type { ExitVoidCheck, ExitVoidSelections } from '../api/herdExitBackendApi'
import { BackendError } from '../../../shared/api/backendClient'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useMutation } from '../../../shared/hooks/useMutation'
import type { VoucherSnapshot } from '../../../shared/api/snapshotVersion'
import type { ExitVoidOutcome, HerdExit } from '../types'
import type { Pen } from '../../pen-management'

type Choices = {
  pens: Record<string, number>; reasons: Record<string, string>; criteria: Record<string, string>
  invalidCodes: string[]; selectionNotice: string; focusCattleId?: number
}
const automaticReturns = (check: ExitVoidCheck, penId: number) => check.occupancyAfter
  .filter((pen) => pen.penId === penId).reduce((count, pen) => count + Math.max(0, pen.after - pen.before), 0)
const incoming = (choices: Record<string, number>, penId: number, except?: number) => Object.entries(choices)
  .filter(([cow, pen]) => Number(cow) !== except && pen === penId).length
const freeFor = (check: ExitVoidCheck, pen: Pen, choices: Record<string, number>, cowId?: number) =>
  pen.capacity - pen.count - automaticReturns(check, pen.id!) - incoming(choices, pen.id!, cowId)

function reconcile(previous: Choices, check: ExitVoidCheck, pens: Pen[]): Choices {
  const kept: Record<string, number> = {}, dropped: string[] = []
  for (const cow of check.cattle.filter((item) => item.needsPenOverride)) {
    const selected = previous.pens[cow.cattleId]
    if (!selected) continue
    const pen = pens.find((item) => item.id === selected && item.status === 'ACTIVE')
    if (pen && freeFor(check, pen, kept) > 0) kept[cow.cattleId] = selected
    else dropped.push(cow.cattleCode)
  }
  return {
    ...previous, pens: kept,
    reasons: Object.fromEntries(Object.entries(previous.reasons).filter(([id]) => kept[id] != null)),
    criteria: Object.fromEntries(Object.entries(previous.criteria).filter(([id]) => kept[id] != null)),
    selectionNotice: dropped.length ? `Đã bỏ lựa chọn chuồng không còn khả dụng cho: ${dropped.join(', ')}. Vui lòng chọn lại.` : previous.selectionNotice,
  }
}

export function useExitVoid(row: HerdExit, onCancelled: (outcome: ExitVoidOutcome) => void) {
  const [cancelReason, setCancelReason] = useState(() => exitCancelDefaults().reason)
  const [choices, setChoices] = useState<Choices>({ pens: {}, reasons: {}, criteria: {}, invalidCodes: [], selectionNotice: '' })
  const query = useQuery(async () => {
    const [check, pens] = await Promise.all([exitVoidCheck(row.id, row.backendId), listExitCancelPens()])
    return { check, pens }
  }, [row.id, row.backendId])
  const command = useMutation<VoucherSnapshot & ExitVoidSelections, ExitVoidOutcome>((snapshot) => cancelHerdExit(
    row.id, row.detail?.cows ?? [], { status: 'Đã hủy', cancelReason: cancelReason.trim(), detail: { ...row.detail } }, snapshot,
  ))
  const check = query.data?.check ?? null
  const pens = query.data?.pens ?? []
  const required = check?.cattle.filter((cow) => cow.needsPenOverride) ?? []

  useEffect(() => {
    const data = query.data
    if (data?.check) {
      const currentCheck = data.check
      setChoices((previous) => reconcile(previous, currentCheck, data.pens ?? []))
    }
  }, [query.data])

  const optionsFor = (cowId: number) => check ? pens.filter((pen) => pen.id != null && pen.id > 0 && pen.status === 'ACTIVE'
    && (freeFor(check, pen, choices.pens, cowId) > 0 || choices.pens[cowId] === pen.id)) : []
  const occupancyLabel = (pen: Pen) => `${pen.name} · ${pen.count + (check ? automaticReturns(check, pen.id!) : 0) + incoming(choices.pens, pen.id!)}/${pen.capacity}`
  const noPlaces = required.some((cow) => optionsFor(cow.cattleId).length === 0)
  const selectionsValid = required.every((cow) => {
    const pen = pens.find((item) => item.id === choices.pens[cow.cattleId] && item.status === 'ACTIVE')
    return pen != null && freeFor(check!, pen, choices.pens, cow.cattleId) > 0
      && (choices.criteria[cow.cattleId] === undefined || Boolean(choices.reasons[cow.cattleId]?.trim()) && choices.reasons[cow.cattleId].trim().length <= 500)
  })
  const canSubmit = Boolean(query.data && !query.loading && !query.error && !command.loading && cancelReason.trim() && cancelReason.trim().length <= 500
    && (!check || check.voidable && selectionsValid))

  const changePen = (cowId: number, penId: number) => setChoices((previous) => {
    const next = { ...previous, pens: { ...previous.pens }, reasons: { ...previous.reasons }, criteria: { ...previous.criteria }, selectionNotice: '' }
    if (penId) next.pens[cowId] = penId
    else delete next.pens[cowId]
    delete next.reasons[cowId]
    delete next.criteria[cowId]
    const code = required.find((cow) => cow.cattleId === cowId)?.cattleCode
    next.invalidCodes = previous.invalidCodes.filter((item) => item !== code)
    return next
  })
  const changeWarningReason = (cowId: number, value: string) => setChoices((previous) => ({ ...previous, reasons: { ...previous.reasons, [cowId]: value } }))

  const confirm = async () => {
    if (!canSubmit) return
    const overrides = Object.fromEntries(required.map((cow) => [cow.cattleId, choices.pens[cow.cattleId]]))
    const warnings = Object.fromEntries(required.filter((cow) => choices.criteria[cow.cattleId] !== undefined)
      .map((cow) => [cow.cattleId, choices.reasons[cow.cattleId].trim()]))
    try {
      onCancelled(await command.mutate({ expectedVersion: row.version, backendId: row.backendId, penOverrides: overrides, warningReasons: warnings }))
    } catch (error) {
      if (!(error instanceof BackendError)) return
      if (error.code === 'MSG-FE04-06') {
        const cow = required.find((item) => item.cattleCode === error.params.cattle_code)
        if (cow) setChoices((previous) => ({
          ...previous, criteria: { ...previous.criteria, [cow.cattleId]: String(error.params.criteria ?? '') },
          invalidCodes: [...new Set([...previous.invalidCodes, cow.cattleCode])], focusCattleId: cow.cattleId,
        }))
      }
      if (error.code === 'MSG-FE13-09') {
        setChoices((previous) => ({ ...previous, invalidCodes: Array.isArray(error.params.cattle_codes) ? error.params.cattle_codes.map(String) : [] }))
        await query.refetch()
      }
    }
  }
  return {
    cancelReason, setCancelReason, check, canonicalPens: query.data?.pens, required, choices, optionsFor, occupancyLabel,
    changePen, changeWarningReason, canSubmit, confirm, noPlaces, loading: query.loading, checkError: query.error,
    retry: query.refetch, saving: command.loading, error: command.error,
  }
}
