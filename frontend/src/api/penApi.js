import { seedPens } from '../data/penData'
import { createCollection } from './client'

const pens = createCollection('pens', seedPens, { idKey: 'code' })

// Chuồng trại: mã chuồng là khoá. update nhận cả bản ghi (đã có code).
export const penApi = {
  list: () => pens.list(),
  create: (pen) => pens.create(pen),
  update: (pen) => pens.update(pen.code, pen),
}
