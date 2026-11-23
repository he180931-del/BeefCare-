import { describe, expect, it, vi } from 'vitest'
import { createVaccinationApi } from '../../../src/features/vaccination/api/vaccinationApi'
import { createVaccinationDemoStore } from '../../../src/features/vaccination/data/vaccinationDemoStore'
import { VaccinationValidationError } from '../../../src/features/vaccination/domain/vaccinationRules'
import { addMonths } from '../../../src/features/vaccination/domain/vaccinationFormat'
import type { RecordVaccinationsCommand, ScheduleCommand } from '../../../src/features/vaccination/types'

const make = () => {
  const store = createVaccinationDemoStore()
  const transport = { get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }
  return { store, api: createVaccinationApi({ mode: 'local', farmId: 1, transport: transport as never, store }) }
}
const base = { vaccineId: 1, source: 'ON_FARM' as const, administeredAt: '2026-10-20T08:15', dose: '2 ml', route: 'IM' as const, withdrawalDays: 0, vaccinator: 'Trần Quốc Long' }
const fieldOf = (field: string) => (e: unknown) => e instanceof VaccinationValidationError && Boolean(e.fields[field])
const overdueOf = async (api: ReturnType<typeof make>['api'], scheduleId = 1) => (await api.listDoses({ scheduleId, tab: 'overdue', size: 50 })).rows

describe('quy tắc', () => {
  it('cộng tháng kẹp về cuối tháng', () => {
    expect(addMonths('2026-10-15', 6)).toBe('2027-04-15')
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
  })
})

describe('lịch và danh sách mũi', () => {
  it('tính tiến độ từng lịch và số mũi theo tab', async () => {
    const { api } = make()
    const cards = await api.listSchedules()
    expect(cards.map((c) => [c.targetCount, c.doneCount, c.overdueCount])).toEqual([[86, 61, 12], [248, 214, 5], [46, 0, 0]])
    const page = await api.listDoses({ scheduleId: 1, tab: 'overdue', size: 6 })
    expect(page.counts).toMatchObject({ all: 86, overdue: 12, done: 61 })
    expect(page.leadDays).toBe(7)
    expect(page.rows.map((r) => r.cattleCode).slice(0, 3)).toEqual(['BC-000125', 'BC-000131', 'BC-000154'])
    expect(page.rows[0]).toMatchObject({ state: 'OVERDUE', daysOverdue: 5, doseText: 'mũi 2/2' })
  })
})

describe('ghi nhận tiêm', () => {
  it('ghi hàng loạt: đóng mũi, lên lịch nhắc lại và tính ngày ngưng thịt', async () => {
    const { api } = make()
    const rows = await overdueOf(api)
    const pick = (code: string) => rows.find((r) => r.cattleCode === code)!
    const result = await api.recordVaccinations({
      ...base,
      withdrawalDays: 14,
      animals: [
        { cattleCode: 'BC-000131', scheduledDoseId: pick('BC-000131').id },
        { cattleCode: 'BC-000154', scheduledDoseId: pick('BC-000154').id },
      ],
    })
    expect(result).toMatchObject({ vaccinatedCount: 2, skipped: [] })
    const counts = (await api.listDoses({ scheduleId: 1 })).counts
    expect(counts).toMatchObject({ overdue: 10, done: 63 })
    const cow = await api.getCattleVaccination('BC-000131')
    expect(cow.records[0]).toMatchObject({ withdrawalEndDate: '2026-11-03', source: 'ON_FARM' })
    expect(cow.doses.find((d) => d.kind === 'BOOSTER')?.dueDate).toBe('2027-04-20')
  })

  it.each([
    ['thời điểm ở tương lai', { ...base, administeredAt: '2026-10-21T08:00' }, 'administeredAt'],
    ['trước ngày nhập đàn', { ...base, administeredAt: '2020-01-01T08:00' }, 'administeredAt'],
    ['số ngày ngưng ngoài khoảng', { ...base, withdrawalDays: 400 }, 'withdrawalDays'],
    ['chưa chọn vắc-xin', { ...base, vaccineId: undefined }, 'vaccineId'],
  ])('từ chối: %s', async (_n, cmd, field) => {
    const { api } = make()
    const before = (await api.getCattleVaccination('BC-000131')).records.length
    const command: RecordVaccinationsCommand = { ...cmd, animals: [{ cattleCode: 'BC-000131' }] }
    await expect(api.recordVaccinations(command)).rejects.toSatisfy(fieldOf(field))
    expect((await api.getCattleVaccination('BC-000131')).records.length).toBe(before)
  })

  it('nhập lịch sử không đóng mũi và không tính ngưng thịt', async () => {
    const { api } = make()
    const before = (await api.listDoses({ scheduleId: 1 })).counts.done
    await api.recordVaccinations({ ...base, source: 'HISTORICAL', withdrawalDays: 14, administeredAt: '2020-03-01T00:00', animals: [{ cattleCode: 'BC-000131' }] })
    expect((await api.listDoses({ scheduleId: 1 })).counts.done).toBe(before)
    const saved = (await api.getCattleVaccination('BC-000131')).records.find((r) => r.source === 'HISTORICAL')
    expect(saved).toMatchObject({ withdrawalDays: 0, withdrawalEndDate: undefined })
  })

  it('bỏ qua con đã tiêm mũi này', async () => {
    const { api } = make()
    const done = (await api.listDoses({ scheduleId: 1, tab: 'done', size: 1 })).rows[0]
    const result = await api.recordVaccinations({ ...base, animals: [{ cattleCode: done.cattleCode, scheduledDoseId: done.id }] })
    expect(result.vaccinatedCount).toBe(0)
    expect(result.skipped[0].message).toContain(done.cattleCode)
  })
})

describe('khóa sửa lịch (D46)', () => {
  it('lịch đã có mũi tiêm: không đổi được ngày bắt đầu và khoảng cách giữa mũi, vẫn đổi được tên', async () => {
    const { api } = make()
    const detail = await api.getSchedule(1)
    expect(detail.hasDoneDoses).toBe(true)
    const cmd: ScheduleCommand = { ...detail.schedule, expectedVersion: detail.schedule.version }
    await expect(api.updateSchedule(1, { ...cmd, intervalDays: 30 })).rejects.toSatisfy(fieldOf('intervalDays'))
    await expect(api.updateSchedule(1, { ...cmd, firstDueDate: '2026-10-25' })).rejects.toSatisfy(fieldOf('firstDueDate'))
    const renamed = await api.updateSchedule(1, { ...cmd, name: 'LMLM 2026 – Sinh sản' })
    expect(renamed.schedule.name).toBe('LMLM 2026 – Sinh sản')
  })

  it('lịch tiêm xong hết là "đã hoàn thành" và bị khóa', async () => {
    const { api } = make()
    const created = await api.createSchedule({
      name: 'Một con', vaccineId: 3, firstDueDate: '2026-10-20', doseCount: 1,
      target: { penCodes: ['__none'], herdGroups: [], lifeStages: [], excluded: [], added: ['BC-000131'] },
    })
    const row = (await api.listDoses({ scheduleId: created.schedule.id })).rows[0]
    await api.recordVaccinations({ ...base, vaccineId: 3, animals: [{ cattleCode: 'BC-000131', scheduledDoseId: row.id, expectedDoseVersion: row.version }] })
    const detail = await api.getSchedule(created.schedule.id)
    expect(detail.schedule.completed).toBe(true)
    await expect(api.updateSchedule(created.schedule.id, { ...detail.schedule, name: 'Đổi tên', expectedVersion: detail.schedule.version })).rejects.toThrow(/đã khóa/)
  })
})

describe('sửa hoặc hủy bản ghi tiêm', () => {
  const lmlm = async (api: ReturnType<typeof make>['api']) => (await api.getCattleVaccination('BC-000125')).records.find((r) => r.batchNo === 'AFT-2608-03')!

  it('sửa giữ bản gốc, bắt buộc lý do và phát hiện xung đột phiên bản', async () => {
    const { api } = make()
    const r = await lmlm(api)
    const cmd = { expectedVersion: r.version, vaccineId: 1, administeredAt: r.administeredAt, dose: '2 ml', route: 'IM' as const, withdrawalDays: 7, vaccinator: 'Trần Quốc Long', reason: 'Ghi sai số ngày ngưng' }
    await expect(api.correctRecord(r.id, { ...cmd, reason: '' })).rejects.toSatisfy(fieldOf('reason'))
    const next = await api.correctRecord(r.id, cmd)
    // D44: sửa không gửi số lô nên số lô cũ của bản ghi giữ nguyên.
    expect(next).toMatchObject({ batchNo: 'AFT-2608-03', corrected: true, withdrawalEndDate: '2026-09-24', version: r.version + 1 })
    expect(next.revisions.at(-1)?.before.withdrawalDays).toBe(r.withdrawalDays)
    await expect(api.correctRecord(r.id, cmd)).rejects.toThrow(/đã thay đổi/)
  })

  it('hủy bản ghi trả mũi về chưa tiêm và gỡ mũi nhắc lại đã sinh ra', async () => {
    const { api } = make()
    const dose = (await overdueOf(api))[1]
    await api.recordVaccinations({ ...base, animals: [{ cattleCode: dose.cattleCode, scheduledDoseId: dose.id }] })
    const rec = (await api.getCattleVaccination(dose.cattleCode)).records[0]
    await expect(api.voidRecord(rec.id, { expectedVersion: rec.version, reason: '' })).rejects.toSatisfy(fieldOf('reason'))
    await api.voidRecord(rec.id, { expectedVersion: rec.version, reason: 'Ghi nhầm bò' })
    const after = await api.getCattleVaccination(dose.cattleCode)
    expect(after.records.find((r) => r.id === rec.id)?.status).toBe('VOIDED')
    expect(after.doses.map((d) => d.kind)).toEqual(['DOSE'])
    expect((await overdueOf(api)).some((r) => r.id === dose.id)).toBe(true)
  })
})

describe('quản lý lịch', () => {
  const draft = (over: Partial<ScheduleCommand> = {}): ScheduleCommand => ({
    name: 'Lịch thử', vaccineId: 3, firstDueDate: '2026-11-01', doseCount: 2, intervalDays: 21, target: { penCodes: ['C1'], herdGroups: [], lifeStages: [], excluded: [], added: [] }, ...over,
  })

  it('tạo lịch sinh một mũi cho mỗi con và mỗi số mũi', async () => {
    const { api } = make()
    const c1 = await api.previewTarget({ penCodes: ['C1'], herdGroups: [], lifeStages: [], excluded: [], added: [] })
    const result = await api.createSchedule(draft({ target: { penCodes: ['C1'], herdGroups: [], lifeStages: [], excluded: [c1[0].code], added: [] } }))
    expect(result.targetCount).toBe(c1.length - 1)
    expect(result.plannedDoseCount).toBe((c1.length - 1) * 2)
    expect(result.message).toContain('Lịch thử')
    expect((await api.listSchedules()).length).toBe(4)
  })

  it.each([
    ['trùng tên lịch đang chạy', { name: 'LMLM 2026 – Đàn sinh sản' }, 'name'],
    ['số mũi ngoài khoảng', { doseCount: 11 }, 'doseCount'],
    ['thiếu cách giữa mũi khi có 2 mũi', { intervalDays: undefined }, 'intervalDays'],
    ['không có bò nào khớp', { target: { penCodes: ['Q'], herdGroups: ['FATTENING' as const], lifeStages: [], excluded: [], added: [] } }, 'form'],
  ])('từ chối: %s', async (_n, over, field) => {
    const { api } = make()
    await expect(api.createSchedule(draft(over as Partial<ScheduleCommand>))).rejects.toSatisfy(fieldOf(field))
  })

  it('dừng lịch cần lý do và hủy các mũi chưa tiêm', async () => {
    const { api } = make()
    const detail = await api.getSchedule(3)
    await expect(api.stopSchedule(3, { reason: '', expectedVersion: detail.schedule.version })).rejects.toSatisfy(fieldOf('reason'))
    await api.stopSchedule(3, { reason: 'Hết dịch', expectedVersion: detail.schedule.version })
    expect((await api.listSchedules()).length).toBe(2)
    expect((await api.listDoses({ scheduleId: 3 })).total).toBe(0)
  })
})

describe('lịch sử tiêm', () => {
  it('mặc định 3 tháng gần nhất, lọc theo nguồn và tìm kiếm, có phân trang', async () => {
    const { api } = make()
    const page = await api.listHistory({})
    expect(page.from).toBe('2026-07-20')
    expect(page.size).toBe(6)
    expect(page.total).toBeGreaterThan(300)
    expect((await api.listHistory({ q: 'BC-000154' })).rows.every((r) => r.cattleCode === 'BC-000154')).toBe(true)
    const hist = await api.listHistory({ source: 'HISTORICAL', from: '2020-01-01' })
    expect(hist.rows.every((r) => r.source === 'HISTORICAL')).toBe(true)
  })
})

describe('chế độ backend', () => {
  it('không đọc hay ghi mock', async () => {
    const store = createVaccinationDemoStore()
    const spies = [vi.spyOn(store, 'listSchedules'), vi.spyOn(store, 'recordVaccinations'), vi.spyOn(store, 'listHistory')]
    const transport = { get: vi.fn().mockRejectedValue(new Error('backend down')), command: vi.fn(), farmPath: (id: number, suffix = '') => `/api/farms/${id}${suffix}` }
    const api = createVaccinationApi({ mode: 'backend', farmId: 1, transport: transport as never, store })
    await expect(api.listSchedules()).rejects.toThrow(/backend down/)
    await expect(api.recordVaccinations({ ...base, animals: [] })).rejects.toThrow(/Chưa chọn bò/)
    await expect(api.listHistory({})).rejects.toThrow(/backend down/)
    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
    expect(transport.command).not.toHaveBeenCalled()
  })
})
