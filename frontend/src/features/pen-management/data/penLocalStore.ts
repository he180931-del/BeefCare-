// Local demo pens of the pen screens. Reached only through src/demo/demoModules.ts.
// herdDomainApi creates the shared `pens` collection first; these seeds are merged into it afterwards, in the same order
// as when penApi created the collection while loading.
import '../../../api/herdDomainApi'
import { createCollection } from '../../../api/client'
import { migrateHerdStorage } from '../../../api/storageMigrations'
import { penSchema } from '../../../api/collectionSchemas'
import { seedPens } from '../../../demo/data/pensData'
import { backendMode } from '../../../shared/config/runtime'
import type { Pen } from '../types'

// The real backend is authoritative: no local collection (which reads and writes localStorage) while it is on.
export const pens = backendMode === 'backend' ? null : (() => {
  migrateHerdStorage()
  return createCollection<Pen, 'code'>('pens', seedPens, { schema: penSchema })
})()
