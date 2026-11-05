import { auditRows } from './data/platformFixtures'
import { expandLocalTable, isStressGenerated, stripStressRows } from '../../app/localStressData'

export type AuditRecord = {
  id: string
  at: string
  actor: string
  actorRole: string
  actorId?: string
  action: string
  targetType: string
  target: string
  targetId?: string
  before: string
  after: string
  correlationId: string
}

export const AUDIT_KEY = 'beefcare.preview.platform.audit.v2'
export const AUDIT_ACTIONS = [
  'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'PLATFORM_ACCESS_GRANTED', 'PLATFORM_ACCESS_REVOKED',
  'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP_SUSPENDED', 'FARM_SERVICE_RESTORED', 'FARM_SERVICE_SUSPENDED',
  'PAYMENT_CONFIRMED', 'PAYMENT_HOLD', 'PAYMENT_REJECTED', 'FINANCE_RECORD_POSTED', 'FINANCE_RECORD_VOIDED',
  'TICKET_ASSIGNED', 'TICKET_CLOSED', 'INTERNAL_REQUEST_COMPLETED',
] as const
export const AUDIT_TARGETS = ['Account', 'Platform access', 'Membership', 'Farm', 'Payment', 'Finance record', 'Ticket', 'Internal request'] as const
const ACTION_TARGET: Record<string, typeof AUDIT_TARGETS[number]> = {
  ACCOUNT_SUSPENDED: 'Account', ACCOUNT_REACTIVATED: 'Account', PLATFORM_ACCESS_GRANTED: 'Platform access', PLATFORM_ACCESS_REVOKED: 'Platform access',
  MEMBERSHIP_ROLE_CHANGED: 'Membership', MEMBERSHIP_SUSPENDED: 'Membership', FARM_SERVICE_RESTORED: 'Farm', FARM_SERVICE_SUSPENDED: 'Farm',
  PAYMENT_CONFIRMED: 'Payment', PAYMENT_HOLD: 'Payment', PAYMENT_REJECTED: 'Payment', FINANCE_RECORD_POSTED: 'Finance record', FINANCE_RECORD_VOIDED: 'Finance record',
  TICKET_ASSIGNED: 'Ticket', TICKET_CLOSED: 'Ticket', INTERNAL_REQUEST_COMPLETED: 'Internal request',
}

function fixtureIso(value: string) {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:00+07:00` : new Date().toISOString()
}
function maskIdentifier(value: string) {
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, (email) => `${email.slice(0, 1)}***@${email.split('@')[1]}`).replace(/\b(PAY|TK|EVD|FR|IR|MEM|ACC)[-_]?[A-Z0-9-]+\b/gi, '$1-****').replace(/\b\d{6,}\b/g, '••••••')
}
const SAFE_FIELDS: Record<string, string[]> = {
  ACCOUNT_SUSPENDED: ['status'], ACCOUNT_REACTIVATED: ['status'], PLATFORM_ACCESS_GRANTED: ['role', 'status'], PLATFORM_ACCESS_REVOKED: ['role', 'status'],
  MEMBERSHIP_ROLE_CHANGED: ['role', 'status'], MEMBERSHIP_SUSPENDED: ['status'], FARM_SERVICE_RESTORED: ['status'], FARM_SERVICE_SUSPENDED: ['status'],
  PAYMENT_CONFIRMED: ['status'], PAYMENT_HOLD: ['status'], PAYMENT_REJECTED: ['status'], FINANCE_RECORD_POSTED: ['status'], FINANCE_RECORD_VOIDED: ['status'],
  TICKET_ASSIGNED: ['status', 'assignment'], TICKET_CLOSED: ['status'], INTERNAL_REQUEST_COMPLETED: ['status', 'outcome'],
}
function safeValue(action: string, value: unknown) {
  const fields = SAFE_FIELDS[action] || []
  const tokens = String(value || '').split(/[·,;]/).map((token) => token.trim()).filter((token) => {
    const field = token.split(':', 1)[0]?.trim().toLowerCase()
    return Boolean(field && fields.includes(field))
  }).map((token) => {
    const [field, ...rest] = token.split(':')
    return `${field.trim()}: ${maskIdentifier(rest.join(':').trim()).slice(0, 80)}`
  })
  return tokens.length ? tokens.join(' · ') : '—'
}
function normalize(value: Partial<AuditRecord>, index = 0): AuditRecord {
  const action = String(value.action || 'UNKNOWN')
  const targetType = String(value.targetType || ACTION_TARGET[action] || 'Farm')
  return {
    id: String(value.id || `audit-${index + 1}`), at: String(value.at || new Date().toISOString()), actor: String(value.actor || 'System'), actorRole: String(value.actorRole || 'System'), actorId: value.actorId,
    action, targetType, target: maskIdentifier(String(value.target || '—')).slice(0, 120), targetId: value.targetId ? maskIdentifier(String(value.targetId)) : undefined,
    before: safeValue(action, value.before), after: safeValue(action, value.after), correlationId: maskIdentifier(String(value.correlationId || `corr-${index + 1}`)),
  }
}
const seed: AuditRecord[] = auditRows.map((row, index) => normalize({ id: `seed-${index + 1}`, at: fixtureIso(row.time), actor: row.actor, actorRole: row.actor.includes('·') ? row.actor.split('·').pop()?.trim() : 'System', action: row.action, target: row.target, targetType: row.target.startsWith('Trang trại') ? 'Farm' : row.target.startsWith('Thanh toán') ? 'Payment' : row.target.startsWith('Thành viên') ? 'Membership' : 'Farm', before: row.before, after: row.after, correlationId: row.correlation }, index))

function previewAuditRows(rows: AuditRecord[]) {
  return expandLocalTable('platform-audit', rows).map((row) => {
    if (!isStressGenerated(row)) return row
    const index = Number(row.__stressIndex || 0)
    const at = new Date(Date.UTC(2026, 10, 3, 8 + (index % 10)) - (index % 7) * 86_400_000).toISOString()
    return { ...row, at }
  })
}

export function loadAuditRecords(): AuditRecord[] {
  if (typeof window === 'undefined') return seed
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUDIT_KEY) || 'null')
    const rows = (Array.isArray(parsed) ? parsed.map((value, index) => normalize(value as Partial<AuditRecord>, index)) : seed).filter((row) => ACTION_TARGET[row.action] === row.targetType)
    if (!parsed) window.localStorage.setItem(AUDIT_KEY, JSON.stringify(rows))
    return previewAuditRows(rows)
  } catch { return previewAuditRows(seed) }
}

export function appendAuditRecord(record: Omit<AuditRecord, 'id'> & { id?: string }) {
  if (ACTION_TARGET[record.action] !== record.targetType) throw new Error('Audit action/target không nằm trong allowlist.')
  const rows = stripStressRows(loadAuditRecords()); const next = normalize({ ...record, id: record.id || `audit-${Date.now()}` }, rows.length)
  if (typeof window !== 'undefined') window.localStorage.setItem(AUDIT_KEY, JSON.stringify([...rows, next]))
  return next
}
