import { useCallback, useState } from 'react'
import { useMutation } from '../../../shared/hooks/useMutation'
import { saveHerdEntry } from '../api'
import type { HerdEntry } from '../types'

type SaveInput = Parameters<typeof saveHerdEntry>[0]

/** Owns draft/post mutation state while leaving payload construction in the editor. */
export function useEntryDraftWorkflow() {
  const [result, setResult] = useState<HerdEntry | null>(null)
  const draftMutation = useMutation<SaveInput, HerdEntry>((input) => saveHerdEntry({ ...input, record: { ...input.record, status: 'Nháp' } }))
  const postMutation = useMutation<SaveInput, HerdEntry>((input) => saveHerdEntry({ ...input, record: { ...input.record, status: 'Đã nhập' } }))
  const saveDraft = useCallback(async (input: SaveInput) => { const saved = await draftMutation.mutate(input); setResult(saved); return saved }, [draftMutation.mutate])
  const postEntry = useCallback(async (input: SaveInput) => { const saved = await postMutation.mutate(input); setResult(saved); return saved }, [postMutation.mutate])
  return {
    saveDraft,
    postEntry,
    saving: draftMutation.loading || postMutation.loading,
    error: draftMutation.error ?? postMutation.error,
    result,
  }
}
