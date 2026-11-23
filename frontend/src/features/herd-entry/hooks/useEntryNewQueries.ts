import type { EntryCalf, HerdEntry } from '../types'
import type { Pen } from '../../pen-management'
import { useQuery } from '../../../shared/hooks/useQuery'
import { getEntryDraftState, herdEntryApi, listEntryBreeds, listEntryPens, listEntrySellers, listEntryVaccines, listPendingEntryCalves, newEntryDefaults } from '../api'

export function useEntryNewQueries({ draftId, editingIndex, isBuy }: { draftId?: string; editingIndex?: number; isBuy?: boolean }) {
  const { data } = useQuery<HerdEntry[]>(() => herdEntryApi.list(), [])
  const { data: detailedDraft, error: draftError } = useQuery<HerdEntry | null>(() => draftId ? herdEntryApi.get(draftId) : Promise.resolve(null), [draftId])
  const { data: canonicalPens } = useQuery<Pen[]>(() => listEntryPens(), [])
  const { data: pendingCalves } = useQuery<EntryCalf[]>(() => listPendingEntryCalves(), [])
  const { data: sellers } = useQuery(() => listEntrySellers(), [])
  const { data: vaccines } = useQuery(() => editingIndex != null && editingIndex >= 0 ? listEntryVaccines() : Promise.resolve([]), [editingIndex])
  const { data: breeds } = useQuery(() => (editingIndex != null && editingIndex >= 0 || !isBuy) ? listEntryBreeds() : Promise.resolve([]), [editingIndex, isBuy])
  return { data, detailedDraft, draftError, canonicalPens, pendingCalves, sellers, vaccines, breeds, getEntryDraftState, newEntryDefaults }
}

export function useEntryCatalogues({ editingIndex, isBuy }: { editingIndex: number; isBuy: boolean }) {
  const { data: vaccines } = useQuery(() => editingIndex >= 0 ? listEntryVaccines() : Promise.resolve([]), [editingIndex])
  const { data: breeds } = useQuery(() => (editingIndex >= 0 || !isBuy) ? listEntryBreeds() : Promise.resolve([]), [editingIndex, isBuy])
  return { vaccines, breeds }
}
