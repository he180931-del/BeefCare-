// QR Model 2, version 3-L: 29×29 modules, one block of 55 data and 15 parity codewords.
// Its byte-mode capacity of 53 bytes covers every valid cattle tag (at most 50 ASCII characters).
const MODULES = 29
const DATA_WORDS = 55
const PARITY_WORDS = 15
export const QR_BORDER = 4

function multiply(a: number, b: number): number {
  let result = 0
  while (b) {
    if (b & 1) result ^= a
    a = (a << 1) ^ (a & 0x80 ? 0x11d : 0)
    b >>>= 1
  }
  return result
}

function codewords(tag: string): Uint8Array {
  const bytes = new TextEncoder().encode(tag)
  if (bytes.length > 53) throw new RangeError('Mã thẻ quá dài để tạo QR.')
  const bits: number[] = []
  const append = (value: number, count: number) => {
    for (let bit = count - 1; bit >= 0; bit--) bits.push((value >>> bit) & 1)
  }
  append(4, 4) // Byte mode
  append(bytes.length, 8)
  for (const byte of bytes) append(byte, 8)
  append(0, 4) // Terminator also aligns this byte-mode payload.

  const words = new Uint8Array(DATA_WORDS + PARITY_WORDS)
  for (let i = 0; i < bits.length; i++) words[i >>> 3] |= bits[i] << (7 - (i & 7))
  for (let i = bits.length / 8, pad = 0; i < DATA_WORDS; i++, pad++) words[i] = pad % 2 ? 0x11 : 0xec

  // Reed–Solomon generator with roots α^0 through α^14 in GF(256).
  let generator = [1]
  for (let i = 0, root = 1; i < PARITY_WORDS; i++, root = multiply(root, 2)) {
    const next = new Array<number>(generator.length + 1).fill(0)
    for (let j = 0; j < generator.length; j++) {
      next[j] ^= generator[j]
      next[j + 1] ^= multiply(generator[j], root)
    }
    generator = next
  }
  const remainder = words.slice()
  for (let i = 0; i < DATA_WORDS; i++) {
    const lead = remainder[i]
    for (let j = 1; j < generator.length; j++) remainder[i + j] ^= multiply(generator[j], lead)
  }
  words.set(remainder.subarray(DATA_WORDS), DATA_WORDS)
  return words
}

export function tagQrModules(tag: string): boolean[][] {
  const grid: Array<Array<boolean | null>> = Array.from({ length: MODULES }, () => Array(MODULES).fill(null))
  const set = (x: number, y: number, dark: boolean) => { grid[y][x] = dark }
  for (const [cx, cy] of [[3, 3], [MODULES - 4, 3], [3, MODULES - 4]]) {
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        if (cx + x < 0 || cy + y < 0 || cx + x >= MODULES || cy + y >= MODULES) continue
        const ring = Math.max(Math.abs(x), Math.abs(y))
        set(cx + x, cy + y, ring !== 2 && ring !== 4)
      }
    }
  }
  for (let i = 8; i < MODULES - 8; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) set(22 + x, 22 + y, Math.max(Math.abs(x), Math.abs(y)) !== 1)
  }

  // The BCH-encoded format word for level L and mask pattern 0.
  const formatBit = (i: number) => ((0x77c4 >>> i) & 1) === 1
  for (let i = 0; i < 6; i++) set(8, i, formatBit(i))
  set(8, 7, formatBit(6))
  set(8, 8, formatBit(7))
  set(7, 8, formatBit(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, formatBit(i))
  for (let i = 0; i < 8; i++) set(MODULES - 1 - i, 8, formatBit(i))
  for (let i = 8; i < 15; i++) set(8, MODULES - 15 + i, formatBit(i))
  set(8, MODULES - 8, true)

  const words = codewords(tag)
  let bit = 0
  for (let right = MODULES - 1, upwards = true; right > 0; right -= 2, upwards = !upwards) {
    if (right === 6) right = 5 // Skip the vertical timing pattern.
    for (let row = 0; row < MODULES; row++) {
      const y = upwards ? MODULES - 1 - row : row
      for (const x of [right, right - 1]) {
        if (grid[y][x] !== null) continue
        const dark = ((words[bit >>> 3] ?? 0) >>> (7 - (bit & 7)) & 1) === 1
        set(x, y, dark !== ((x + y) % 2 === 0))
        bit++
      }
    }
  }
  return grid.map((row) => row.map(Boolean))
}
