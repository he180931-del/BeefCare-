import { createContext, useContext, useState } from 'react'
import { initialExports } from './exportsData'
import { initialImports } from './importsData'

const Store = createContext(null)

export function StoreProvider({ children }) {
  const [imports, setImports] = useState(initialImports)
  const [exports, setExports] = useState(initialExports)

  const nextId = (prefix, list) => {
    const max = Math.max(...list.map((r) => Number(r.id.split('-')[2])))
    return `${prefix}-2026-${String(max + 1).padStart(4, '0')}`
  }

  const addImport = (record) => {
    const id = nextId('PN', imports)
    setImports([{ ...record, id }, ...imports])
    return id
  }
  const addExport = (record) => {
    const id = nextId('PX', exports)
    setExports([{ ...record, id }, ...exports])
    return id
  }
  const updateExport = (id, patch) =>
    setExports(exports.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <Store.Provider value={{ imports, exports, setImports, setExports, addImport, addExport, updateExport }}>
      {children}
    </Store.Provider>
  )
}

export const useStore = () => useContext(Store)
