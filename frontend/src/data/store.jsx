import { createContext, useContext, useEffect, useState } from 'react'
import { herdEntryApi } from '../features/herd-entry/api/index.js'
import { herdExitApi } from '../features/herd-exit/api/index.js'

const Store = createContext(null)

export function StoreProvider({ children }) {
  const [imports, setImports] = useState([])
  const [exports, setExports] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([herdEntryApi.list(), herdExitApi.list()]).then(([entryRows, exitRows]) => {
      if (active) {
        setImports(entryRows)
        setExports(exitRows)
      }
    })
    return () => { active = false }
  }, [])

  const addImport = async (record) => {
    const created = await herdEntryApi.create(record)
    setImports((rows) => [created, ...rows])
    return created.id
  }
  const addExport = async (record) => {
    const created = await herdExitApi.create(record)
    setExports((rows) => [created, ...rows])
    return created.id
  }
  const updateExport = async (id, patch) => {
    const updated = await herdExitApi.update(id, patch)
    setExports((rows) => rows.map((row) => (row.id === id ? updated : row)))
    return updated
  }

  return (
    <Store.Provider value={{ imports, exports, setImports, setExports, addImport, addExport, updateExport }}>
      {children}
    </Store.Provider>
  )
}

export const useStore = () => useContext(Store)
