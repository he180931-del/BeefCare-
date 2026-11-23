import { useCallback, useState } from 'react'
import type { ExitDraft, ExitType, LossKind } from '../types'

type EditorSeed<T> = Pick<ExitDraft, 'date' | 'buyerId' | 'quarantine' | 'plate' | 'note' | 'pricing' | 'deduction' | 'collected' | 'method' | 'dueDate'> & {
  type: ExitType
  lossKind: LossKind
  deathCause: string
  carcassDisposal: string
  picked: T[]
}

export function useExitEditor<T extends { code: string }>(seed: EditorSeed<T>) {
  const [type, setType] = useState<ExitType>(seed.type)
  const [lossKind, setLossKind] = useState<LossKind>(seed.lossKind)
  const [date, setDate] = useState(seed.date ?? '')
  const [pricing, setPricing] = useState<'kg' | 'con'>(seed.pricing ?? 'kg')
  const [buyerId, setBuyerId] = useState(seed.buyerId ?? '')
  const [quarantine, setQuarantine] = useState(seed.quarantine ?? '')
  const [plate, setPlate] = useState(seed.plate ?? '')
  const [note, setNote] = useState(seed.note ?? '')
  const [deathCause, setDeathCause] = useState(seed.deathCause)
  const [carcassDisposal, setCarcassDisposal] = useState(seed.carcassDisposal)
  const [picked, setPicked] = useState<T[]>(seed.picked)
  const [deduction, setDeduction] = useState(seed.deduction ?? 0)
  const [collected, setCollected] = useState(seed.collected ?? 0)
  const [method, setMethod] = useState(seed.method ?? '')
  const [dueDate, setDueDate] = useState(seed.dueDate ?? '')
  const [documents, setDocuments] = useState<File[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<number[]>([])

  const patch = useCallback((code: string, values: Partial<T>) => {
    setPicked((current) => current.map((cow) => cow.code === code ? { ...cow, ...values } : cow))
  }, [])

  const formSnapshot = useCallback(() => JSON.stringify({
    date, type, lossKind, pricing, buyerId, quarantine, plate, note, deathCause, carcassDisposal, picked, deduction, collected, method, dueDate,
    documents: documents.map((file) => ({ name: file.name, size: file.size, type: file.type })), removedAttachmentIds,
  }), [date, type, lossKind, pricing, buyerId, quarantine, plate, note, deathCause, carcassDisposal, picked, deduction, collected, method, dueDate, documents, removedAttachmentIds])

  return {
    type, setType, lossKind, setLossKind, date, setDate, pricing, setPricing, buyerId, setBuyerId,
    quarantine, setQuarantine, plate, setPlate, note, setNote, deathCause, setDeathCause, carcassDisposal, setCarcassDisposal,
    picked, setPicked, patch, deduction, setDeduction, collected, setCollected, method, setMethod, dueDate, setDueDate,
    documents, setDocuments, removedAttachmentIds, setRemovedAttachmentIds, formSnapshot,
  }
}
