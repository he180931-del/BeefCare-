import { describe, expect, it } from 'vitest'

interface MockPen {
  code: string
  count: number
  capacity: number
}

interface MockCattle {
  code: string
  barn: string | null
  status: 'ACTIVE' | 'EXITED' | 'VOIDED'
  withdrawalUntil?: string
  scheduledTasks: Array<{ id: string; date: string }>
}

interface MockExitVoucher {
  id: string
  status: 'DRAFT' | 'CONFIRMED' | 'VOIDED'
  exitType: 'SALE' | 'CULL' | 'DEATH' | 'OTHER'
  exitDate: string
  lines: Array<{ cattleCode: string; weight: number; unitPrice: number; lineAmount: number }>
}

function confirmExitVoucher(
  voucher: MockExitVoucher,
  cattleMap: Record<string, MockCattle>,
  penMap: Record<string, MockPen>,
  operatorRole: 'OWNER' | 'MANAGER',
  acknowledgedWarnings = false
) {
  // GBR-34: Only Owner can confirm exit
  if (operatorRole !== 'OWNER') {
    throw new Error('MSG-FE13-03: Chỉ Chủ trại mới có quyền xác nhận xuất đàn')
  }

  // Pre-checks: meat withdrawal warnings (GBR-46, MSG-FE13-07)
  const warnings: string[] = []
  for (const line of voucher.lines) {
    const cow = cattleMap[line.cattleCode]
    if (cow.withdrawalUntil && voucher.exitDate < cow.withdrawalUntil) {
      warnings.push(`MSG-FE13-07: Bò ${cow.code} đang trong thời gian ngưng thuốc`)
    }
  }

  if (warnings.length > 0 && !acknowledgedWarnings) {
    throw new Error('Cần xác nhận đã kiểm tra các cảnh báo trước khi xuất đàn')
  }

  // GBR-35: Confirm sets EXITED, closes pen assignment, cancels future scheduled tasks
  voucher.status = 'CONFIRMED'
  for (const line of voucher.lines) {
    const cow = cattleMap[line.cattleCode]
    if (cow.barn) {
      const pen = penMap[cow.barn]
      if (pen) pen.count = Math.max(0, pen.count - 1)
      cow.barn = null
    }
    cow.status = 'EXITED'
    cow.scheduledTasks = cow.scheduledTasks.filter((t) => t.date <= voucher.exitDate)
  }

  return { voucher, cattleMap, penMap }
}

function voidExitVoucher(
  voucher: MockExitVoucher,
  cattleMap: Record<string, MockCattle>,
  penMap: Record<string, MockPen>,
  restorePenCode: string
) {
  if (voucher.status !== 'CONFIRMED') {
    throw new Error('Chỉ có thể hủy phiếu xuất đã xác nhận')
  }

  // GBR-36: Voiding exit restores cattle to ACTIVE and places them back into pen
  voucher.status = 'VOIDED'
  const destPen = penMap[restorePenCode]
  if (!destPen || destPen.count >= destPen.capacity) {
    throw new Error('Chuồng khôi phục không hợp lệ hoặc đã đầy')
  }

  for (const line of voucher.lines) {
    const cow = cattleMap[line.cattleCode]
    cow.status = 'ACTIVE'
    cow.barn = restorePenCode
    destPen.count += 1
  }

  return { voucher, cattleMap, penMap }
}

describe('Herd Exit Lifecycle Integration Flow (FE-13)', () => {
  it('TC-EXT-INT01: Enforces Owner permission and withdrawal acknowledgement before confirming exit (GBR-34, GBR-35, GBR-46)', () => {
    const pens: Record<string, MockPen> = {
      B1: { code: 'B1', count: 5, capacity: 10 },
    }

    const cattleMap: Record<string, MockCattle> = {
      'BC-000301': {
        code: 'BC-000301',
        barn: 'B1',
        status: 'ACTIVE',
        withdrawalUntil: '2026-11-05', // Đang ngưng thuốc
        scheduledTasks: [{ id: 't1', date: '2026-11-02' }],
      },
    }

    const voucher: MockExitVoucher = {
      id: 'PX-2026-0061',
      status: 'DRAFT',
      exitType: 'SALE',
      exitDate: '2026-10-31',
      lines: [{ cattleCode: 'BC-000301', weight: 400, unitPrice: 80_000, lineAmount: 32_000_000 }],
    }

    // 1. Quản lý (MANAGER) thử xác nhận xuất -> Bị chặn
    expect(() => confirmExitVoucher(voucher, cattleMap, pens, 'MANAGER', true)).toThrow(/MSG-FE13-03/)

    // 2. Chủ trại xác nhận nhưng CHƯA tích ô xác nhận cảnh báo ngưng thuốc -> Bị chặn
    expect(() => confirmExitVoucher(voucher, cattleMap, pens, 'OWNER', false)).toThrow(/Cần xác nhận đã kiểm tra/)

    // 3. Chủ trại xác nhận kèm đã tích xác nhận cảnh báo -> Thành công
    const result = confirmExitVoucher(voucher, cattleMap, pens, 'OWNER', true)

    expect(result.voucher.status).toBe('CONFIRMED')
    expect(result.cattleMap['BC-000301'].status).toBe('EXITED')
    expect(result.cattleMap['BC-000301'].barn).toBeNull()
    expect(result.cattleMap['BC-000301'].scheduledTasks).toHaveLength(0) // future task cancelled
    expect(result.penMap.B1.count).toBe(4) // 5 -> 4
  })

  it('TC-EXT-INT02: Voids confirmed exit voucher, returning cattle to ACTIVE and incrementing pen occupancy (GBR-36)', () => {
    const pens: Record<string, MockPen> = {
      B1: { code: 'B1', count: 4, capacity: 10 },
    }

    const cattleMap: Record<string, MockCattle> = {
      'BC-000301': {
        code: 'BC-000301',
        barn: null,
        status: 'EXITED',
        scheduledTasks: [],
      },
    }

    const confirmedVoucher: MockExitVoucher = {
      id: 'PX-2026-0061',
      status: 'CONFIRMED',
      exitType: 'SALE',
      exitDate: '2026-10-31',
      lines: [{ cattleCode: 'BC-000301', weight: 400, unitPrice: 80_000, lineAmount: 32_000_000 }],
    }

    const result = voidExitVoucher(confirmedVoucher, cattleMap, pens, 'B1')

    // 1. Phiếu xuất chuyển trạng thái VOIDED
    expect(result.voucher.status).toBe('VOIDED')

    // 2. Bò được khôi phục về ACTIVE và trở lại chuồng B1
    expect(result.cattleMap['BC-000301'].status).toBe('ACTIVE')
    expect(result.cattleMap['BC-000301'].barn).toBe('B1')

    // 3. Sĩ số chuồng B1 tăng trở lại 5 con
    expect(result.penMap.B1.count).toBe(5)
  })
})

