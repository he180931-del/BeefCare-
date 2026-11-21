import { useMutation } from '../../../shared/hooks/useMutation'
import { saveHerdEntry } from '../api'
import type { HerdEntry } from '../types'

type SaveInput = Parameters<typeof saveHerdEntry>[0]

/** Owns draft/post mutation state while leaving payload construction in the editor. */
export function useEntryDraftWorkflow() {
  const mutation = useMutation<SaveInput, HerdEntry>(saveHerdEntry)
  return {
    saveDraft: mutation.mutate,
    postEntry: mutation.mutate,
    saving: mutation.loading,
    error: mutation.error,
  }
}
