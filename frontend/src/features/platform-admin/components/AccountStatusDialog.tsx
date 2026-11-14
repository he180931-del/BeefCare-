import { useRef, useState } from 'react'
import { BackendError } from '../../../api/backendClient'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, Note, Textarea } from '../../../components/ui'
import { platformAdminApi } from '../api/platformAdminApi'
import { MSG, PlatformAdminError, REASON_MAX, accountStatusDone, validateStatusReason } from '../domain/platformRules'
import type { AccountDetail } from '../types'
import { errorMessage } from './common'

/** Lỗi nghiệp vụ: đóng hộp thoại, hiện lý do và tải lại danh sách + chi tiết, không tự thử lại bằng version mới (D32). */
const REFUSED_CODES = new Set(['MSG-FE03-17', 'MSG-FE03-20', 'MSG-COM-05', 'MSG-COM-08', 'MSG-COM-01', 'MSG-FE01-03'])
const REFUSED_LOCAL = new Set(['LAST_SA', 'NO_CHANGE', 'STALE', 'NOT_FOUND', 'FORBIDDEN'])

type Outcome = { kind: 'refused' | 'field' | 'retry'; message: string }

/** Phân loại lỗi của A12 (D32): lỗi nghiệp vụ, lỗi trường lý do, hay lỗi lưu / mạng (giữ hộp thoại và cùng khóa). */
export function statusChangeOutcome(error: unknown, email: string): Outcome {
  if (error instanceof PlatformAdminError) {
    if (error.code === 'VALIDATION') return { kind: 'field', message: error.message }
    return { kind: REFUSED_LOCAL.has(error.code) ? 'refused' : 'retry', message: error.message }
  }
  if (error instanceof BackendError) {
    const code = error.code?.toUpperCase() ?? ''
    if (code === 'MSG-COM-06' && error.params.field === 'reason') return { kind: 'field', message: MSG.reasonRequired }
    if (code === 'MSG-COM-10' && error.params.field === 'reason') return { kind: 'field', message: MSG.statusReasonRule }
    if (REFUSED_CODES.has(code) || error.status === 404) {
      const known: Record<string, string> = {
        'MSG-FE03-17': MSG.lastSa,
        'MSG-FE03-20': `Không có thay đổi: ${typeof error.params.target === 'string' ? error.params.target : email} đã ở trạng thái này.`,
        'MSG-COM-05': MSG.stale,
        'MSG-COM-08': MSG.gone,
        'MSG-COM-01': MSG.forbidden,
      }
      return { kind: 'refused', message: known[code] ?? (error.status === 404 ? MSG.gone : errorMessage(error)) }
    }
  }
  return { kind: 'retry', message: errorMessage(error) }
}

/**
 * Hộp thoại xác nhận tạm ngưng / khôi phục tài khoản (UC-FE03-08, D32): MSG-FE03-14 / MSG-FE03-15, lý do 5–500 ký tự,
 * thành công MSG-FE03-16. Bấm lặp hoặc thử lại sau lỗi lưu / mạng dùng cùng Idempotency-Key (GBR-88); lỗi nghiệp vụ
 * (FE03-17, FE03-20, COM-05, COM-08) đóng hộp thoại và để màn tải lại dữ liệu.
 */
export default function AccountStatusDialog({ account, reason, onReason, onClose, onDone, onRefused }: {
  account: AccountDetail
  reason: string
  onReason: (reason: string) => void
  onClose: () => void
  onDone: (message: string) => void
  onRefused: (message: string) => void
}) {
  const suspending = account.accountStatus === 'ACTIVE'
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const heldKey = useRef<{ signature: string; key: string } | null>(null)

  /** Cùng tài khoản, lệnh, lý do và version → cùng khóa; đổi dữ liệu → khóa mới (máy chủ từ chối dùng lại khóa cho dữ liệu khác). */
  const keyFor = (signature: string) => {
    if (heldKey.current?.signature !== signature) heldKey.current = { signature, key: globalThis.crypto.randomUUID() }
    return heldKey.current.key
  }

  const submit = async () => {
    if (busy) return
    const invalid = validateStatusReason(reason)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    const command = { reason: reason.trim(), expectedVersion: account.version }
    const key = keyFor(JSON.stringify([account.id, suspending ? 'suspend' : 'restore', command.reason, command.expectedVersion]))
    try {
      const next = suspending
        ? await platformAdminApi.suspendAccount(account.id, command, key)
        : await platformAdminApi.restoreAccount(account.id, command, key)
      heldKey.current = null
      onDone(accountStatusDone(next.email, next.accountStatus))
    } catch (failure) {
      const outcome = statusChangeOutcome(failure, account.email)
      if (outcome.kind === 'refused') { heldKey.current = null; onRefused(outcome.message); return }
      if (outcome.kind === 'field') { heldKey.current = null; setFieldError(outcome.message); return }
      setError(outcome.message) // lỗi lưu / mạng: giữ hộp thoại và khóa để thử lại (GBR-88)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={suspending ? 'Tạm ngưng tài khoản' : 'Khôi phục tài khoản'}
      sub={suspending
        ? `Tạm ngưng tài khoản ${account.email}? Người dùng sẽ không đăng nhập được.` // MSG-FE03-14
        : `Khôi phục tài khoản ${account.email}? Các vai trò và membership đã thu hồi sẽ không được trả lại.`} // MSG-FE03-15
      width={560}
      onClose={onClose}
    >
      <Field label="Lý do *" id="status-dialog-reason" hint="5–500 ký tự; được lưu vào lịch sử tài khoản">
        <Textarea id="status-dialog-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => { onReason(e.target.value); setFieldError(null) }} />
      </Field>
      {fieldError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{fieldError}</p>}
      {error != null && <Note tone="err"><span role="alert">{error}</span></Note>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Quay lại</ModalButton>
        <ModalButton variant={suspending ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
          {suspending ? 'Tạm ngưng tài khoản' : 'Khôi phục tài khoản'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
