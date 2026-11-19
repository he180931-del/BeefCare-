import { describe, expect, it } from 'vitest'

interface MockPen {
  code: string
  name: string
  capacity: number
  count: number
  status: 'ACTIVE' | 'INACTIVE'
  cows: string[]
}

interface MockCattle {
  code: string
  barn: string
  status: 'ACTIVE' | 'EXITED' | 'VOIDED'
  history: Array<{ type: string; from: string; to: string; date: string; reason: string; by: string }>
}

function executePenMove(
  cattle: MockCattle,
  fromPen: MockPen,
  toPen: MockPen,
  date: string,
  reason: string,
  by: string
) {
  // GBR-20: Cannot place into INACTIVE or full pen
  if (toPen.status !== 'ACTIVE') {
    throw new Error('MSG-FE04-05: Chuồng đích không ở trạng thái ACTIVE')
  }
  if (toPen.count >= toPen.capacity) {
    throw new Error('MSG-FE04-05: Chuồng đích đã đạt sức chứa tối đa')
  }
  if (!reason.trim()) {
    throw new Error('MSG-FE05-06: Bắt buộc nhập lý do chuyển chuồng')
  }

  // Atomic pen move: decrement old pen, increment new pen, update cattle (GBR-22)
  fromPen.count -= 1
  fromPen.cows = fromPen.cows.filter((c) => c !== cattle.code)

  toPen.count += 1
  toPen.cows.push(cattle.code)

  cattle.barn = toPen.code
  cattle.history.push({
    type: 'PEN_MOVE',
    from: fromPen.code,
    to: toPen.code,
    date,
    reason: reason.trim(),
    by,
  })

  return { cattle, fromPen, toPen }
}

describe('Pen & Cattle Move Integration Flow (FE-04 & FE-05)', () => {
  it('TC-PEN-INT01: Atomically updates pen occupancies and cattle location on valid pen move', () => {
    const penA1: MockPen = { code: 'A1', name: 'Chuồng A1', capacity: 10, count: 5, status: 'ACTIVE', cows: ['BC-000101', 'BC-000102', 'BC-000103', 'BC-000104', 'BC-000105'] }
    const penB1: MockPen = { code: 'B1', name: 'Chuồng B1', capacity: 10, count: 8, status: 'ACTIVE', cows: ['BC-000201', 'BC-000202', 'BC-000203', 'BC-000204', 'BC-000205', 'BC-000206', 'BC-000207', 'BC-000208'] }
    const movingCattle: MockCattle = { code: 'BC-000101', barn: 'A1', status: 'ACTIVE', history: [] }

    const result = executePenMove(movingCattle, penA1, penB1, '2026-10-31', 'Chuyển sang nhóm vỗ béo', 'Quản lý Trần Quốc Long')

    // 1. Kiểm tra chuồng nguồn A1 giảm 1 con
    expect(result.fromPen.count).toBe(4)
    expect(result.fromPen.cows).not.toContain('BC-000101')

    // 2. Kiểm tra chuồng đích B1 tăng 1 con
    expect(result.toPen.count).toBe(9)
    expect(result.toPen.cows).toContain('BC-000101')

    // 3. Kiểm tra bò đã cập nhật vị trí chuồng và lịch sử di chuyển
    expect(result.cattle.barn).toBe('B1')
    expect(result.cattle.history).toHaveLength(1)
    expect(result.cattle.history[0]).toEqual({
      type: 'PEN_MOVE',
      from: 'A1',
      to: 'B1',
      date: '2026-10-31',
      reason: 'Chuyển sang nhóm vỗ béo',
      by: 'Quản lý Trần Quốc Long',
    })
  })

  it('TC-PEN-INT02: Blocks pen move into full pen or INACTIVE pen without modifying state (GBR-20)', () => {
    const penA1: MockPen = { code: 'A1', name: 'Chuồng A1', capacity: 10, count: 5, status: 'ACTIVE', cows: ['BC-000101'] }
    const penFull: MockPen = { code: 'B_FULL', name: 'Chuồng B Đầy', capacity: 5, count: 5, status: 'ACTIVE', cows: [] }
    const penInactive: MockPen = { code: 'E_INACTIVE', name: 'Chuồng E Tạm ngưng', capacity: 10, count: 0, status: 'INACTIVE', cows: [] }
    const cattle: MockCattle = { code: 'BC-000101', barn: 'A1', status: 'ACTIVE', history: [] }

    // Thử chuyển vào chuồng đầy -> ném ngoại lệ
    expect(() => executePenMove(cattle, penA1, penFull, '2026-10-31', 'Thử chuyển', 'Quản lý')).toThrow(/Chuồng đích đã đạt sức chứa tối đa/)
    expect(penA1.count).toBe(5) // Không thay đổi
    expect(penFull.count).toBe(5)

    // Thử chuyển vào chuồng INACTIVE -> ném ngoại lệ
    expect(() => executePenMove(cattle, penA1, penInactive, '2026-10-31', 'Thử chuyển', 'Quản lý')).toThrow(/Chuồng đích không ở trạng thái ACTIVE/)
    expect(penA1.count).toBe(5) // Không thay đổi
    expect(penInactive.count).toBe(0)
  })
})

