import { useState } from 'react'
import { supportApi } from '../api/supportApi'
import { MESSAGES, SupportError } from '../domain/supportError'
import type { Ticket } from '../types'

/** `message: null` nghĩa là lỗi đã được xử lý bằng một hộp thoại (kết quả đã thay đổi, ticket đã đóng). */
export type ActionResult = { ok: true } | { ok: false; message: string | null }

interface Hooks {
  refetch: () => unknown
  openModal: (name: string) => void
}

/** Các lệnh của Chủ trại trên chi tiết ticket; ánh xạ lỗi nghiệp vụ sang hộp thoại hoặc thông báo trang. */
export function useTicketActions(ticket: Ticket | null | undefined, { refetch, openModal }: Hooks) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (action: (t: Ticket) => Promise<unknown>, successModal?: string): Promise<ActionResult> => {
    if (!ticket) return { ok: false, message: MESSAGES.notFound }
    setBusy(true)
    setNotice(null)
    try {
      await action(ticket)
      await refetch()
      if (successModal) openModal(successModal)
      return { ok: true }
    } catch (e) {
      if (e instanceof SupportError) {
        if (e.code === 'VALIDATION') return { ok: false, message: Object.values(e.fields)[0] ?? e.message }
        if (e.code === 'RESULT_CHANGED') {
          openModal('ket-qua-thay-doi')
          return { ok: false, message: null }
        }
        if (e.code === 'CLOSED') {
          await refetch()
          openModal('da-dong')
          return { ok: false, message: null }
        }
        setNotice(e.message)
        return { ok: false, message: e.message }
      }
      setNotice(MESSAGES.saveFailed)
      return { ok: false, message: MESSAGES.saveFailed }
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    notice,
    clearNotice: () => setNotice(null),
    reply: (content: string) => run((t) => supportApi.reply(t.id, { content, expectedVersion: t.version })),
    confirm: (resolutionVersion: number) => run((t) => supportApi.acknowledge(t.id, { resolutionVersion, expectedVersion: t.version }), 'da-xac-nhan'),
    reopen: (reason: string) => run((t) => supportApi.reopen(t.id, { reason, expectedVersion: t.version }), 'da-mo-lai'),
  }
}
