import type { ExitDraft, HerdExit } from '../types'

/** Draft being edited: the given voucher, else the first draft; defaults to a sale. */
export const getExitDraftState = (rows: HerdExit[], id?: string): ExitDraft & { row?: HerdExit } => {
  const row = id ? rows.find((item) => item.id === id) : rows.find((item) => item.status === 'Nháp')
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Bán', row }
}
