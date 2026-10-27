import { seedPens } from '../data/pensData.js'
import { createCollection } from './client.js'

const pens = createCollection('pens', seedPens, { idKey: 'code' })

const normalize = (pen) => ({
  ...pen,
  minMonths: pen.minAge ?? 0,
  minKg: pen.minWeight ?? 0,
  tag: pen.accept ?? pen.stage ?? pen.name,
})

// Chuồng trại: mã chuồng là khoá. update nhận cả bản ghi (đã có code).
export const penApi = {
  list: () => pens.list(),
  create: (pen) => pens.create(normalize(pen)),
  update: (pen) => pens.update(pen.code, normalize(pen)),
}
