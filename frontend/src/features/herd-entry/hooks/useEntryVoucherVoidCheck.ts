import { entryVoucherVoidCheck } from '../api'
import { useQuery } from '../../../shared/hooks/useQuery'
import type { EntryVoucherVoidCheck, HerdEntry } from '../types'

/** Popup Hủy phiếu #2: loads the server-side void check (R-06-15) when the popup opens. */
export function useEntryVoucherVoidCheck(record: HerdEntry) {
  return useQuery<EntryVoucherVoidCheck>(() => entryVoucherVoidCheck(record), [record.id, record.backendId, record.version])
}
