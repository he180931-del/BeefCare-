import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { QR_BORDER, tagQrModules } from '../../../src/features/cattle/domain/tagQr'

describe('cattle QR label encoding', () => {
  it.each(['QR-5T8W-0142', 'QR-' + 'Aa_09-'.repeat(7) + '67890'])(
    'encodes the complete tag %s and decodes it without cattle data',
    (tag) => {
      const modules = tagQrModules(tag)
      const cell = 5
      const side = (modules.length + 2 * QR_BORDER) * cell
      const pixels = new Uint8ClampedArray(side * side * 4).fill(255)
      for (const [y, row] of modules.entries()) {
        for (const [x, dark] of row.entries()) {
          if (!dark) continue
          for (let dy = 0; dy < cell; dy++) {
            for (let dx = 0; dx < cell; dx++) {
              const offset = (((y + QR_BORDER) * cell + dy) * side + (x + QR_BORDER) * cell + dx) * 4
              pixels.fill(0, offset, offset + 3)
            }
          }
        }
      }
      expect(jsQR(pixels, side, side)?.data).toBe(tag)
    },
  )
})
