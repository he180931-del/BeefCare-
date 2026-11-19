import { describe, expect, it } from 'vitest'

interface MockPen {
  code: string
  capacity: number
  count: number
}

interface MockCattle {
  code: string
  tag: string
  breed: string
  sex: string
  weight: number
  barn: string | null
  status: 'DRAFT' | 'ACTIVE' | 'EXITED' | 'VOIDED'
  entryVoucherId: string
  qrCode: string | null
}

interface MockEntryVoucher {
  id: string
  status: 'DRAFT' | 'POSTED' | 'VOIDED'
  entryType: 'PURCHASE' | 'FARM_BORN'
  date: string
  seller: string
  totalPayable: number
  lines: Array<{ tag: string; breed: string; sex: string; weight: number; pen: string; unitPrice: number; lineAmount: number }>
}

function postEntryVoucher(voucher: MockEntryVoucher, pens: Record<string, MockPen>): { voucher: MockEntryVoucher; cattleList: MockCattle[] } {
  if (voucher.status !== 'DRAFT') {
    throw new Error('Chỉ có thể ghi sổ phiếu ở trạng thái DRAFT')
  }
  if (!voucher.lines.length) {
    throw new Error('Phiếu nhập phải có ít nhất 1 con bò')
  }

  // Validate every line's destination pen
  for (const line of voucher.lines) {
    const pen = pens[line.pen]
    if (!pen) throw new Error(`Không tìm thấy chuồng ${line.pen}`)
    if (pen.count >= pen.capacity) throw new Error(`Chuồng ${line.pen} đã đầy`)
  }

  // GBR-32: Posting creates cattle, pen assignment, and QR tag in one transaction
  voucher.status = 'POSTED'
  const cattleList: MockCattle[] = voucher.lines.map((line, index) => {
    const pen = pens[line.pen]
    pen.count += 1
    const cattleCode = `BC-${String(500 + index + 1).padStart(6, '0')}`
    return {
      code: cattleCode,
      tag: line.tag,
      breed: line.breed,
      sex: line.sex,
      weight: line.weight,
      barn: line.pen,
      status: 'ACTIVE',
      entryVoucherId: voucher.id,
      qrCode: `QR-${cattleCode}`,
    }
  })

  return { voucher, cattleList }
}

function voidEntryVoucher(voucher: MockEntryVoucher, cattleList: MockCattle[], pens: Record<string, MockPen>, reason: string) {
  if (voucher.status !== 'POSTED') {
    throw new Error('Chỉ có thể hủy phiếu đã ghi sổ')
  }
  if (!reason.trim()) {
    throw new Error('Bắt buộc nhập lý do hủy phiếu')
  }

  // GBR-33: Voiding marks cattle VOIDED, revokes pen assignment, releases pen count
  voucher.status = 'VOIDED'
  for (const cattle of cattleList) {
    if (cattle.barn) {
      const pen = pens[cattle.barn]
      if (pen) pen.count = Math.max(0, pen.count - 1)
      cattle.barn = null
    }
    cattle.status = 'VOIDED'
    cattle.qrCode = null
  }

  return { voucher, cattleList }
}

describe('Herd Entry Lifecycle Integration Flow (FE-06)', () => {
  it('TC-ENT-INT01: Posts draft purchase voucher, registering active cattle and incrementing pen occupancy (GBR-32)', () => {
    const pens: Record<string, MockPen> = {
      A1: { code: 'A1', capacity: 10, count: 3 },
      B1: { code: 'B1', capacity: 10, count: 5 },
    }

    const draftVoucher: MockEntryVoucher = {
      id: 'PN-2026-0041',
      status: 'DRAFT',
      entryType: 'PURCHASE',
      date: '2026-10-31',
      seller: 'Trại giống Mộc Châu',
      totalPayable: 51_000_000,
      lines: [
        { tag: 'VN-501', breed: 'Brahman', sex: 'Cái', weight: 300, pen: 'A1', unitPrice: 85_000, lineAmount: 25_500_000 },
        { tag: 'VN-502', breed: 'Brahman', sex: 'Cái', weight: 300, pen: 'B1', unitPrice: 85_000, lineAmount: 25_500_000 },
      ],
    }

    const result = postEntryVoucher(draftVoucher, pens)

    // 1. Phiếu chuyển POSTED
    expect(result.voucher.status).toBe('POSTED')

    // 2. Hai con bò được tạo ở trạng thái ACTIVE kèm chuồng và mã QR
    expect(result.cattleList).toHaveLength(2)
    expect(result.cattleList[0]).toMatchObject({
      code: 'BC-000501',
      tag: 'VN-501',
      status: 'ACTIVE',
      barn: 'A1',
      qrCode: 'QR-BC-000501',
    })
    expect(result.cattleList[1]).toMatchObject({
      code: 'BC-000502',
      tag: 'VN-502',
      status: 'ACTIVE',
      barn: 'B1',
      qrCode: 'QR-BC-000502',
    })

    // 3. Sĩ số chuồng A1 và B1 đều tăng 1
    expect(pens.A1.count).toBe(4) // 3 -> 4
    expect(pens.B1.count).toBe(6) // 5 -> 6
  })

  it('TC-ENT-INT02: Voids posted voucher, transitioning cattle to VOIDED and releasing pen occupancy (GBR-33)', () => {
    const pens: Record<string, MockPen> = {
      A1: { code: 'A1', capacity: 10, count: 4 },
      B1: { code: 'B1', capacity: 10, count: 6 },
    }

    const postedVoucher: MockEntryVoucher = {
      id: 'PN-2026-0041',
      status: 'POSTED',
      entryType: 'PURCHASE',
      date: '2026-10-31',
      seller: 'Trại giống Mộc Châu',
      totalPayable: 51_000_000,
      lines: [
        { tag: 'VN-501', breed: 'Brahman', sex: 'Cái', weight: 300, pen: 'A1', unitPrice: 85_000, lineAmount: 25_500_000 },
        { tag: 'VN-502', breed: 'Brahman', sex: 'Cái', weight: 300, pen: 'B1', unitPrice: 85_000, lineAmount: 25_500_000 },
      ],
    }

    const cattleList: MockCattle[] = [
      { code: 'BC-000501', tag: 'VN-501', breed: 'Brahman', sex: 'Cái', weight: 300, barn: 'A1', status: 'ACTIVE', entryVoucherId: 'PN-2026-0041', qrCode: 'QR-BC-000501' },
      { code: 'BC-000502', tag: 'VN-502', breed: 'Brahman', sex: 'Cái', weight: 300, barn: 'B1', status: 'ACTIVE', entryVoucherId: 'PN-2026-0041', qrCode: 'QR-BC-000502' },
    ]

    const result = voidEntryVoucher(postedVoucher, cattleList, pens, 'Nhập nhầm hồ sơ lô hàng')

    // 1. Phiếu chuyển VOIDED
    expect(result.voucher.status).toBe('VOIDED')

    // 2. Toàn bộ bò liên kết chuyển VOIDED, phân chuồng bị hủy
    expect(result.cattleList[0].status).toBe('VOIDED')
    expect(result.cattleList[0].barn).toBeNull()
    expect(result.cattleList[0].qrCode).toBeNull()

    expect(result.cattleList[1].status).toBe('VOIDED')
    expect(result.cattleList[1].barn).toBeNull()

    // 3. Sĩ số chuồng A1 và B1 giảm về ban đầu
    expect(pens.A1.count).toBe(3)
    expect(pens.B1.count).toBe(5)
  })
})

