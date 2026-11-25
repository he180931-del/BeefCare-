import { useState } from 'react'
import type { EntryCalf, EntryCow, HerdEntry } from '../types'
import type { Pen } from '../../pen-management'
import { calfTotals, purchaseTotals, receivingPenAfter, receivingPenOverflow } from '../domain/entryTotals'

type Seller = { id: string; name: string; phone: string }

/** A new voucher is priced per head (one amount per cow); existing rows priced per kg keep that basis. */
const initialPricing = (cows: EntryCow[]): 'kg' | 'con' => cows.some((cow) => cow.pricing !== 'con') ? 'kg' : 'con'

export function useEntryEditor({ draft, defaults, pendingCalves, sellers, pens, isBuy }: {
  draft?: NonNullable<HerdEntry['draft']>
  defaults: { recordId: string; date: string; quarantine: string; receiver: string; note: string; cows: EntryCow[]; freight: number; paid: number; method: string; due: string }
  pendingCalves: EntryCalf[]
  sellers: Seller[]
  pens: Pen[]
  isBuy: boolean
}) {
  const [sourceId, setSourceId] = useState(draft?.sourceId ?? sellers[0]?.id ?? '')
  const [date, setDate] = useState(draft?.date ?? defaults.date)
  const [quarantine, setQuarantine] = useState(draft?.quarantine ?? defaults.quarantine)
  const [plate, setPlate] = useState(draft?.plate ?? '')
  const [receiver, setReceiver] = useState(draft?.receiver ?? defaults.receiver)
  const [note, setNote] = useState(draft?.note ?? defaults.note)
  const [cows, setCows] = useState<EntryCow[]>(draft?.cows ?? defaults.cows)
  const [pricing, setPricing] = useState<'kg' | 'con'>(() => draft?.pricing ?? initialPricing(draft?.cows ?? defaults.cows))
  const [calves, setCalves] = useState<EntryCalf[]>(() => draft?.calves?.map(saved => {
    const source = saved.calfOutcomeId == null ? undefined : pendingCalves.find(calf => calf.calfOutcomeId === saved.calfOutcomeId)
    if (!source) return saved // Preserve unavailable draft rows; the backend still checks registration eligibility.
    // D55: a saved draft may predate source corrections or contain retired parent assignments.
    // Keep the user's selection/pen/purpose, but always display birth facts from A11.
    return { ...saved, mother: source.mother, father: source.father, damId: source.damId, sireId: source.sireId,
      sireSource: source.sireSource, externalSireName: source.externalSireName, semenBatch: source.semenBatch,
      sireBreed: source.sireBreed, born: source.born, sex: source.sex, weight: source.weight, estimated: source.estimated }
  }) ?? pendingCalves)
  const [freight, setFreight] = useState(draft?.freight ?? defaults.freight)
  const [paid, setPaid] = useState(draft?.paid ?? defaults.paid)
  const [method, setMethod] = useState(draft?.method ?? defaults.method)
  const [due, setDue] = useState(draft?.due ?? defaults.due)
  const [printQr, setPrintQr] = useState(draft?.printQr ?? true)

  const patchCow = (index: number, patch: Partial<EntryCow>) => setCows((current) => current.map((cow, i) => i === index ? { ...cow, ...patch } : cow))
  const patchCalf = (index: number, patch: Partial<EntryCalf>) => setCalves((current) => current.map((calf, i) => i === index ? { ...calf, ...patch } : calf))
  const purchase = purchaseTotals(cows, pricing, freight, paid)
  const pensAfter = receivingPenAfter(pens, cows)
  const overflow = receivingPenOverflow(pens, cows)
  const calfPen = pens.find((pen) => pen.status === 'ACTIVE') ?? { code: '', name: 'Chưa chọn chuồng', count: 0, capacity: 0, status: 'INACTIVE' as const, cows: [] }
  const calvesSummary = calfTotals(calves, pens, calfPen.code)

  return {
    sourceId, setSourceId, date, setDate, quarantine, setQuarantine, plate, setPlate, receiver, setReceiver, note, setNote,
    cows, setCows, pricing, setPricing, calves, setCalves, freight, setFreight, paid, setPaid, method, setMethod, due, setDue, printQr, setPrintQr,
    patchCow, patchCalf, purchase, pensAfter, overflow, calfPen, calvesSummary, isBuy,
  }
}
