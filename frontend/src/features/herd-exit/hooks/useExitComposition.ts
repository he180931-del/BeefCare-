import type { ReactNode } from 'react'
import type { ExitChecks } from '../api/herdExitBackendApi'

type ExitCompositionArgs = {
  checks: ExitChecks | null
  checksError: unknown
  checking: boolean
  displayError: (error: unknown) => string
}

export function useExitComposition({ checks, checksError, checking, displayError }: ExitCompositionArgs) {
  const checkMessages = (check: ExitChecks['cattle'][number]) => check.messages.map((message) => message.text || message.code || 'Cảnh báo').join(' · ')
  const warningChecks = checks?.cattle.filter((check) => check.hasWarnings) ?? []
  const checkRows: Array<[string, ReactNode, boolean?]> = checks
    ? [
      ['Tổng quan', warningChecks.length ? `${warningChecks.length} con có cảnh báo` : 'Không có cảnh báo', warningChecks.length > 0],
      ...checks.cattle.map((check) => [check.cattleCode, check.hasWarnings ? checkMessages(check) || 'Có cảnh báo' : 'OK', check.hasWarnings] as [string, ReactNode, boolean?]),
    ]
    : [['Tổng quan', checksError ? `Không tải được kiểm tra: ${displayError(checksError)}` : checking ? 'Đang tải kết quả kiểm tra…' : 'Chưa kiểm tra. Lưu phiếu để xem kết quả.', true]]
  return { checkRows, checksReady: Boolean(checks), warningCount: warningChecks.length }
}
