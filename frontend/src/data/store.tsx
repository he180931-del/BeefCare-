import { createContext, useContext, useEffect, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react'
import { herdEntryApi } from '../features/herd-entry/api/index'
import { herdExitApi } from '../features/herd-exit/api/index'
import type { HerdEntry, HerdExit } from '../types'
import type { NewCollectionInput } from '../api/client'
type StoreValue = { imports: HerdEntry[]; exports: HerdExit[]; setImports: Dispatch<SetStateAction<HerdEntry[]>>; setExports: Dispatch<SetStateAction<HerdExit[]>>; addImport: (record: NewCollectionInput<HerdEntry, 'id'>) => Promise<string>; addExport: (record: NewCollectionInput<HerdExit, 'id'>) => Promise<string>; updateExport: (id: string, patch: Partial<HerdExit>) => Promise<HerdExit> }
const Store = createContext<StoreValue | null>(null)
export function StoreProvider({ children }: PropsWithChildren) {
  const [imports, setImports] = useState<HerdEntry[]>([]); const [exports, setExports] = useState<HerdExit[]>([])
  useEffect(() => { let active = true; Promise.all([herdEntryApi.list(), herdExitApi.list()]).then(([entryRows, exitRows]) => { if (active) { setImports(entryRows); setExports(exitRows) } }); return () => { active = false } }, [])
  const addImport = async (record: NewCollectionInput<HerdEntry, 'id'>) => { const created = await herdEntryApi.create(record); setImports((rows) => [created, ...rows]); return created.id }
  const addExport = async (record: NewCollectionInput<HerdExit, 'id'>) => { const created = await herdExitApi.create(record); setExports((rows) => [created, ...rows]); return created.id }
  const updateExport = async (id: string, patch: Partial<HerdExit>) => { const updated = await herdExitApi.update(id, patch); setExports((rows) => rows.map((row) => row.id === id ? updated : row)); return updated }
  return <Store.Provider value={{ imports, exports, setImports, setExports, addImport, addExport, updateExport }}>{children}</Store.Provider>
}
export const useStore = (): StoreValue => { const value = useContext(Store); if (!value) throw new Error('useStore must be used inside StoreProvider'); return value }
