import { createCollection, createCollectionSchema } from '../../../api/client'
import { FEED_DEMO_PENS } from './feedPenMock'
import { FEED_RATION_MOCK, rationStatusForDate } from './feedRationMock'
import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationDemoStore, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'

type DemoState = { id: string; rations: FeedRation[]; [key: string]: unknown }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export const FEED_RATION_DEMO_PENS: FeedRationPenOption[] = FEED_DEMO_PENS

function parseRation(value: unknown): FeedRation {
  if (!isRecord(value) || !isNumber(value.id) || !isText(value.rationCode) || !isNumber(value.versionNo)
    || !isText(value.name) || !isText(value.herdGroup) || !isText(value.basis) || !isText(value.effectiveFrom)
    || (value.effectiveTo !== null && !isText(value.effectiveTo)) || !isText(value.status)
    || !isNumber(value.sessionsPerDay) || !Array.isArray(value.penIds) || !Array.isArray(value.components)
    || (value.sessionTimes !== undefined && !Array.isArray(value.sessionTimes))) {
    throw new Error('Invalid demo ration')
  }
  const sessionTimes = value.sessionTimes === undefined ? undefined : value.sessionTimes.map((time) => {
    if (!isText(time)) throw new Error('Invalid demo ration session times')
    return time
  })
  const penIds = value.penIds.map((id) => {
    if (!isNumber(id)) throw new Error('Invalid demo ration pens')
    return id
  })
  const components = value.components.map((component) => {
    if (!isRecord(component) || !isNumber(component.feedItemId) || !isText(component.feedCode) || !isText(component.feedName)
      || !isNumber(component.session1Kg) || !isNumber(component.session2Kg) || !isNumber(component.session3Kg)
      || !isNumber(component.dailyKg) || (component.estimatedDailyCost !== null && !isNumber(component.estimatedDailyCost))) {
      throw new Error('Invalid demo ration component')
    }
    return {
      feedItemId: component.feedItemId,
      feedCode: component.feedCode,
      feedName: component.feedName,
      session1Kg: component.session1Kg,
      session2Kg: component.session2Kg,
      session3Kg: component.session3Kg,
      dailyKg: component.dailyKg,
      estimatedDailyCost: component.estimatedDailyCost,
    }
  })
  return {
    id: value.id,
    rationCode: value.rationCode,
    versionNo: value.versionNo,
    name: value.name,
    herdGroup: value.herdGroup,
    basis: value.basis,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
    status: value.status,
    sessionsPerDay: value.sessionsPerDay,
    ...(sessionTimes ? { sessionTimes } : {}),
    penIds,
    components,
  }
}

function parseState(value: unknown): DemoState {
  if (!isRecord(value) || value.id !== 'feed-rations' || !Array.isArray(value.rations)) throw new Error('Invalid demo ration state')
  return { ...value, id: 'feed-rations', rations: value.rations.map(parseRation) }
}

const schema = createCollectionSchema<DemoState, 'id'>('feed-rations-demo-v2', 'id', parseState)
const states = createCollection('feedRationsDemoV2', [{ id: 'feed-rations', rations: FEED_RATION_MOCK }], { schema })

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

function validate(input: SaveFeedRationInput, currentStock: readonly FeedStockRow[]) {
  if (!input.name.trim()) throw new Error('Nhập tên khẩu phần.')
  if (input.name.trim().length > 100) throw new Error('Tên khẩu phần tối đa 100 ký tự.')
  if (input.rationCode && input.rationCode.length > 30) throw new Error('Mã khẩu phần tối đa 30 ký tự.')
  if (input.herdGroup.length > 30) throw new Error('Nhóm đàn tối đa 30 ký tự.')
  if (input.basis.length > 500) throw new Error('Nguồn áp dụng tối đa 500 ký tự.')
  if (!isCalendarDate(input.effectiveFrom)) throw new Error('Ngày áp dụng không hợp lệ.')
  if (input.effectiveFrom < addDays(localToday(), 1)) throw new Error('Ngày áp dụng phải từ ngày mai trở đi.')
  if (![1, 2, 3].includes(input.sessionsPerDay) || input.sessionTimes.length !== input.sessionsPerDay) throw new Error('Số cữ và thời gian chưa khớp.')
  if (input.sessionTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Nhập giờ cho từng cữ theo định dạng giờ:phút.')
  if (!input.penIds.length) throw new Error('Chọn ít nhất một chuồng.')
  if (new Set(input.penIds).size !== input.penIds.length) throw new Error('Mỗi chuồng chỉ được chọn một lần.')
  const activePenIds = new Set(FEED_RATION_DEMO_PENS.filter((pen) => pen.status === 'ACTIVE').map((pen) => pen.id))
  if (input.penIds.some((id) => !activePenIds.has(id))) throw new Error('Chỉ chọn chuồng đang hoạt động.')
  if (!input.components.length) throw new Error('Thêm ít nhất một loại thức ăn.')
  const seen = new Set<number>()
  const activeFeedIds = new Set(currentStock.filter((feed) => feed.available !== false).map((feed) => feed.feedItemId))
  for (const [index, component] of input.components.entries()) {
    if (!activeFeedIds.has(component.feedItemId)) throw new Error(`Chọn thức ăn đang hoạt động cho dòng ${index + 1}.`)
    if (seen.has(component.feedItemId)) throw new Error('Mỗi loại thức ăn chỉ được thêm một lần.')
    seen.add(component.feedItemId)
    const quantities = [component.session1Kg, component.session2Kg, component.session3Kg]
    if (quantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) throw new Error(`Lượng thức ăn dòng ${index + 1} phải là số không âm.`)
    if (input.sessionsPerDay < 2 && component.session2Kg > 0 || input.sessionsPerDay < 3 && component.session3Kg > 0) {
      throw new Error(`Dòng ${index + 1} có lượng ở cữ chưa được chọn.`)
    }
    if (!quantities.slice(0, input.sessionsPerDay).some((quantity) => quantity > 0)) throw new Error('Mỗi thức ăn cần có ít nhất một cữ lớn hơn 0.')
  }
}

function nextCode(rows: readonly FeedRation[]) {
  const next = Math.max(0, ...rows.map((row) => Number(row.rationCode.match(/^KP-(\d+)$/)?.[1] ?? 0))) + 1
  return `KP-${String(next).padStart(2, '0')}`
}

function summarizeComponent(input: SaveFeedRationInput['components'][number], currentStock: readonly FeedStockRow[]) {
  const feed = currentStock.find((row) => row.feedItemId === input.feedItemId && row.available !== false)
  if (!feed) throw new Error('Không tìm thấy mặt hàng thức ăn trong tồn kho hiện tại.')
  const dailyKg = input.session1Kg + input.session2Kg + input.session3Kg
  const unitCost = feed.onHandKg > 0 ? feed.stockValue / feed.onHandKg : null
  return {
    feedItemId: feed.feedItemId,
    feedCode: feed.code,
    feedName: feed.name,
    session1Kg: input.session1Kg,
    session2Kg: input.session2Kg,
    session3Kg: input.session3Kg,
    dailyKg,
    estimatedDailyCost: unitCost === null ? null : Math.round(dailyKg * unitCost),
  }
}

let mutationQueue = Promise.resolve()
function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const current = mutationQueue.then(operation, operation)
  mutationQueue = current.then(() => undefined, () => undefined)
  return current
}

async function saveVersion(input: SaveFeedRationInput, currentStock: readonly FeedStockRow[]): Promise<FeedRation> {
  return serializeMutation(async () => {
    validate(input, currentStock)
    const state = await states.get('feed-rations')
    const code = input.rationCode || nextCode(state.rations)
    const previousVersions = state.rations.filter((row) => row.rationCode === code).sort((a, b) => b.versionNo - a.versionNo)
    if (input.rationCode && !previousVersions.length) throw new Error('Không tìm thấy khẩu phần cần tạo phiên bản mới.')
    const today = localToday()
    const selectedPenIds = new Set(input.penIds)
    const priorRows = state.rations.filter((row) => row.penIds.some((id) => selectedPenIds.has(id)))
    if (priorRows.some((row) => row.effectiveFrom === input.effectiveFrom)) throw new Error('Chuồng đã có khẩu phần bắt đầu từ ngày này.')
    const rowsToClose = priorRows.filter((row) => row.effectiveFrom < input.effectiveFrom
      && !(row.effectiveTo && row.effectiveTo < input.effectiveFrom))
    if (rowsToClose.some((row) => row.penIds.some((id) => !selectedPenIds.has(id)))) {
      throw new Error('Khẩu phần đang áp dụng cho nhiều chuồng. Hãy chọn đủ các chuồng để thay đổi cùng lúc.')
    }
    const futureStart = priorRows.map((row) => row.effectiveFrom).filter((date) => date > input.effectiveFrom).sort()[0]
    const effectiveTo = futureStart ? addDays(futureStart, -1) : null

    const rations = state.rations.map((row) => {
      if (!row.penIds.some((id) => selectedPenIds.has(id)) || row.effectiveFrom >= input.effectiveFrom
        || row.effectiveTo && row.effectiveTo < input.effectiveFrom) return row
      const nextEnd = addDays(input.effectiveFrom, -1)
      return { ...row, effectiveTo: nextEnd, status: rationStatusForDate({ ...row, effectiveTo: nextEnd }, today) }
    })
    const next: FeedRation = {
      id: Math.max(0, ...state.rations.map((row) => row.id)) + 1,
      rationCode: code,
      versionNo: (previousVersions[0]?.versionNo ?? 0) + 1,
      name: input.name.trim(),
      herdGroup: input.herdGroup,
      basis: input.basis.trim(),
      effectiveFrom: input.effectiveFrom,
      effectiveTo,
      status: rationStatusForDate({ effectiveFrom: input.effectiveFrom, effectiveTo }, today),
      sessionsPerDay: input.sessionsPerDay,
      sessionTimes: [...input.sessionTimes],
      penIds: [...input.penIds],
      components: input.components.map((component) => summarizeComponent(component, currentStock)),
    }
    await states.update(state.id, { rations: [next, ...rations] })
    return next
  })
}

async function cancelVersion(id: number): Promise<FeedRation> {
  return serializeMutation(async () => {
    const state = await states.get('feed-rations')
    const current = state.rations.find((row) => row.id === id)
    if (!current) throw new Error('Không tìm thấy phiên bản khẩu phần.')
    const today = localToday()
    if (rationStatusForDate(current, today) !== 'SCHEDULED') throw new Error('Chỉ hủy được phiên bản chưa có hiệu lực.')
    const dayBefore = addDays(current.effectiveFrom, -1)
    // The version this one replaced ended the day before: give its end date back so it stays effective.
    const rations = state.rations.filter((row) => row.id !== id).map((row) => {
      const replaced = row.rationCode === current.rationCode && row.effectiveTo === dayBefore
        && row.penIds.some((penId) => current.penIds.includes(penId))
      if (!replaced) return row
      return { ...row, effectiveTo: current.effectiveTo, status: rationStatusForDate({ effectiveFrom: row.effectiveFrom, effectiveTo: current.effectiveTo }, today) }
    })
    await states.update(state.id, { rations })
    return { ...current, penIds: [...current.penIds], components: current.components.map((component) => ({ ...component })) }
  })
}

async function stopRation(id: number, endDate: string): Promise<FeedRation> {
  return serializeMutation(async () => {
    const state = await states.get('feed-rations')
    const current = state.rations.find((row) => row.id === id)
    if (!current) throw new Error('Không tìm thấy khẩu phần.')
    const today = localToday()
    if (rationStatusForDate(current, today) !== 'EFFECTIVE') throw new Error('Chỉ ngừng được khẩu phần đang áp dụng.')
    if (current.effectiveTo) throw new Error('Khẩu phần này đã có ngày kết thúc.')
    if (!isCalendarDate(endDate)) throw new Error('Ngày kết thúc không hợp lệ.')
    if (endDate < addDays(today, 1)) throw new Error('Ngày kết thúc phải từ ngày mai trở đi.')
    const nextStart = state.rations
      .filter((row) => row.id !== id && row.penIds.some((penId) => current.penIds.includes(penId)) && row.effectiveFrom > current.effectiveFrom)
      .map((row) => row.effectiveFrom).sort()[0]
    if (nextStart && endDate >= nextStart) throw new Error('Ngày kết thúc phải trước ngày phiên bản kế tiếp có hiệu lực.')
    const next = { ...current, effectiveTo: endDate, status: rationStatusForDate({ effectiveFrom: current.effectiveFrom, effectiveTo: endDate }, today) }
    await states.update(state.id, { rations: state.rations.map((row) => row.id === id ? next : row) })
    return { ...next, penIds: [...next.penIds], components: next.components.map((component) => ({ ...component })) }
  })
}

const demoStore: FeedRationDemoStore = {
  list: async () => (await states.get('feed-rations')).rations.map((row) => ({
    ...row,
    status: rationStatusForDate(row),
    penIds: [...row.penIds],
    components: row.components.map((component) => ({ ...component })),
  })).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || a.rationCode.localeCompare(b.rationCode) || b.versionNo - a.versionNo),
  get: async (id) => {
    const row = (await states.get('feed-rations')).rations.find((ration) => String(ration.id) === String(id))
    if (!row) throw new Error(`Not found: feed ration demo/${id}`)
    return { ...row, status: rationStatusForDate(row), penIds: [...row.penIds], components: row.components.map((component) => ({ ...component })) }
  },
  saveVersion,
  cancelVersion,
  stop: stopRation,
  reset: async () => { await serializeMutation(async () => { await states.reset() }) },
}

export const feedRationDemoStore = demoStore
export const listFeedRationDemo = () => demoStore.list()
export const getFeedRationDemo = (id: string) => demoStore.get(id)
export const saveFeedRationDemoVersion = (input: SaveFeedRationInput, currentStock: readonly FeedStockRow[]) => demoStore.saveVersion(input, currentStock)
export const cancelFeedRationDemoVersion = (id: number) => demoStore.cancelVersion(id)
export const stopFeedRationDemo = (id: number, endDate: string) => demoStore.stop(id, endDate)
export const resetFeedRationDemoStore = () => demoStore.reset()
