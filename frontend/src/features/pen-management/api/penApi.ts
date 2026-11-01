import { seedPens } from '../../../data/pensData'
import { createCollection } from '../../../api/client'
import { migrateHerdStorage } from '../../../api/storageMigrations'
import { penSchema } from '../../../api/collectionSchemas'
import type { Pen } from '../../../types'

migrateHerdStorage()

const pens = createCollection<Pen, 'code'>('pens', seedPens, { schema: penSchema })

const normalize = (pen: Pen): Pen => ({
  ...pen,
  minMonths: pen.minAge ?? 0,
  minKg: pen.minWeight ?? 0,
  tag: pen.accept ?? pen.stage ?? pen.name,
})

// Chuồng trại: mã chuồng là khoá. update nhận cả bản ghi (đã có code).
export const penApi = {
  list: () => pens.list(),
  create: (pen: Pen) => pens.create(normalize(pen)),
  update: (pen: Pen) => pens.update(pen.code, normalize(pen)),
}
