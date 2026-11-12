import { asRecord, type BackendTransport } from './backendTransport'

/** Múi giờ mặc định khi trại chưa có hoặc có múi giờ không hợp lệ (UTC+7). */
export const DEFAULT_FARM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const isValidZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Giờ địa phương (theo múi giờ) của một thời điểm, dạng các số nguyên. */
function zonedParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Độ lệch (phút) của múi giờ so với UTC tại thời điểm ms. */
function offsetMinutes(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Instant ISO → 'yyyy-mm-ddTHH:mm' theo giờ trại; chuỗi không phải thời điểm trả ''. */
export function toFarmLocal(instant: unknown, timeZone: string = DEFAULT_FARM_TIME_ZONE): string {
  const ms = typeof instant === 'string' ? Date.parse(instant) : Number.NaN
  if (Number.isNaN(ms)) return ''
  const p = zonedParts(ms, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset của trại (ví dụ +07:00) để backend đọc đúng; chuỗi khác giữ nguyên. */
export function fromFarmLocal(local: string, timeZone: string = DEFAULT_FARM_TIME_ZONE): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return local
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  // Độ lệch có thể đổi quanh giờ chuyển mùa: tính lại một lần theo thời điểm UTC vừa suy ra.
  let offset = offsetMinutes(wall, timeZone)
  offset = offsetMinutes(wall - offset * 60_000, timeZone)
  const sign = offset < 0 ? '-' : '+'
  const abs = Math.abs(offset)
  return `${local}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/**
 * Múi giờ của trại hiện tại, đọc một lần từ GET /api/farms/{farmId} (trường timeZone, FE-02).
 * Thiếu hoặc không hợp lệ → UTC+7. Lỗi request được ném ra (không tự fallback) và lần gọi sau đọc lại.
 */
export function createFarmTimeZone(transport: BackendTransport, farmId: string | number): () => Promise<string> {
  let cached: Promise<string> | undefined
  return () => {
    cached ??= transport.get(transport.farmPath(farmId)).then(
      (body) => {
        const zone = asRecord(body).timeZone
        return typeof zone === 'string' && zone.trim() !== '' && isValidZone(zone.trim()) ? zone.trim() : DEFAULT_FARM_TIME_ZONE
      },
      (error: unknown) => {
        cached = undefined
        throw error
      },
    )
    return cached
  }
}
