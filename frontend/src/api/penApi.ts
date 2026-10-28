import { seedPens } from '../data/pensData'
import { createCollection } from './client'
import { migrateHerdStorage } from './storageMigrations'
import { penSchema } from './collectionSchemas'
import type { Pen } from '../types'

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
