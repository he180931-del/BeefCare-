import type { BackendTransport } from '../../../shared/api/backendTransport'
import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import type { Tone } from '../types'
import { lifeStageLabel, number, rows, text } from './cattleMapper'

/** One row of GET /api/farms/{farmId}/reminders (FarmReminderQueryService.ReminderView) as the profile uses it. */
export type BackendReminder = {
  id?: number | null
  ruleType?: string | null
  sourceId?: string | null
  cattleId?: number | null
  dueTime?: string | null
  lifecycleStatus?: string | null
  urgency?: string | null
  sourceSummary?: string | null
}

/** A related reminder of SCR-19 #22; `stage` is set on a REM-08 life-stage suggestion (R-05-09). */
export type CattleReminder = {
  id: string
  ruleType: string
  title: string
  detail: string
  /** yyyy-mm-dd in farm time (UTC+7). */
  dueDate: string
  due: { label: string; tone?: Tone }
  stage?: string
}

/** Titles of the reminder rules (GBR-63, REM-01…13) as on SCR-44. */
const RULE_TITLES: Record<string, string> = {
  'REM-01': 'Đến hạn cân', 'REM-02': 'Cửa sổ phối', 'REM-03': 'Đến hạn khám thai', 'REM-04': 'Khám lại thai',
  'REM-05': 'Sắp đẻ', 'REM-06': 'Mũi tiêm đến hạn', 'REM-07': 'Sẵn sàng phối sau đẻ', 'REM-08': 'Gợi ý chuyển chuồng hoặc giai đoạn',
  'REM-09': 'Bê nháp chờ xác nhận', 'REM-10': 'Tồn thức ăn thấp', 'REM-11': 'Bữa ăn chưa ghi', 'REM-12': 'Chết hoặc mất chờ xác nhận',
  'REM-13': 'Đạt cân xuất chuồng',
}
const OPEN_STATUSES = new Set(['ACTIVE', 'OPEN'])
/** SCR-19 #22: at most five related reminders. */
export const PROFILE_REMINDER_LIMIT = 5
const STAGE_PREFIX = 'STAGE:'

const dmy = (date: string) => date.split('-').reverse().join('/')

/** Open reminders of one cattle, earliest due first. The endpoint already returns only open reminders; the status is rechecked. */
export function mapCattleReminders(body: unknown, cattleId: number): CattleReminder[] {
  return rows<BackendReminder>(body, 'reminders')
    .filter((row) => number(row.cattleId) === cattleId && (!row.lifecycleStatus || OPEN_STATUSES.has(text(row.lifecycleStatus))))
    .map((row, index): CattleReminder => {
      const ruleType = text(row.ruleType)
      const dueDate = toFarmLocal(row.dueTime).slice(0, 10)
      const sourceId = text(row.sourceId)
      const stage = ruleType === 'REM-08' && sourceId.startsWith(STAGE_PREFIX) ? sourceId.slice(STAGE_PREFIX.length) : undefined
      return {
        id: row.id == null ? `${ruleType}:${index}` : String(row.id),
        ruleType,
        title: RULE_TITLES[ruleType] ?? ruleType,
        detail: stage ? `Chuyển sang ${lifeStageLabel(stage)}` : text(row.sourceSummary),
        dueDate,
        due: { label: dueDate ? dmy(dueDate) : '—', tone: row.urgency === 'OVERDUE' ? 'err' : row.urgency === 'TODAY' ? 'warn' : undefined },
        stage,
      }
    })
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
}

export function createCattleReminderApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number | null }) {
  return {
    /** GET /api/farms/{farmId}/reminders filtered to one cattle. */
    forCattle: async (cattleId: number): Promise<CattleReminder[]> => mapCattleReminders(await transport.get(transport.farmPath(farmId, '/reminders')), cattleId),
  }
}
