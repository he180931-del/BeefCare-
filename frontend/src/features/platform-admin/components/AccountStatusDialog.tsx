import { useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Note, Textarea } from '../../../shared/ui'
import { REASON_MAX, accountStatusDone } from '../domain/platformRules'
import { useStaffAccess } from '../hooks/useStaffAccess'
import { validateReason } from '../validation/accountStatusValidation'
import type { AccountDetail } from '../types'
import { commandOutcome } from './commandOutcome'

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
  const { suspendAccount, restoreAccount, clearRequestKey } = useStaffAccess(account)

  const submit = async () => {
    if (busy) return
    const invalid = validateReason(reason)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    const command = { reason: reason.trim(), expectedVersion: account.version }
    try {
      const next = suspending
        ? await suspendAccount(command)
        : await restoreAccount(command)
      clearRequestKey()
      onDone(accountStatusDone(next.email, next.accountStatus))
    } catch (failure) {
      const outcome = commandOutcome(failure, account.email)
      if (outcome.kind === 'refused') { clearRequestKey(); onRefused(outcome.message); return }
      if (outcome.kind === 'field') { clearRequestKey(); setFieldError(outcome.message); return }
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
      <ModalFooter>
        <ModalButton onClick={onClose}>Quay lại</ModalButton>
        <ModalButton variant={suspending ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
          {suspending ? 'Tạm ngưng tài khoản' : 'Khôi phục tài khoản'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
