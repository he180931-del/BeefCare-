import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, Note, Textarea, Button } from '../../../components/ui'
import { platformAdminApi } from '../api/platformAdminApi'
import { REASON_MAX, validateReason } from '../domain/platformRules'
import type { AccountDetail } from '../types'
import { errorMessage, isStale } from './common'

/** Hộp thoại xác nhận tạm ngưng / khôi phục tài khoản (MSG-FE03-14, MSG-FE03-15; UC-FE03-08). */
export default function AccountStatusDialog({ account, reason, onReason, onClose, onDone, onReload }: {
  account: AccountDetail
  reason: string
  onReason: (reason: string) => void
  onClose: () => void
  onDone: (message: string) => void
  onReload: () => void
}) {
  const suspending = account.accountStatus === 'ACTIVE'
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const invalid = validateReason(reason)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      const command = { reason: reason.trim(), expectedVersion: account.version }
      const next = suspending
        ? await platformAdminApi.suspendAccount(account.id, command)
        : await platformAdminApi.restoreAccount(account.id, command)
      onDone(`Tài khoản ${next.email} đã chuyển sang trạng thái ${next.accountStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}.`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={suspending ? 'Tạm ngưng tài khoản' : 'Khôi phục tài khoản'}
      sub={suspending
        ? `Tạm ngưng tài khoản ${account.email}? Người dùng sẽ không đăng nhập được.`
        : `Khôi phục tài khoản ${account.email}? Các vai trò và membership đã thu hồi sẽ không được trả lại.`}
      width={560}
      onClose={onClose}
    >
      <Field label="Lý do *" id="status-dialog-reason" hint="Bắt buộc khi đổi trạng thái tài khoản">
        <Textarea id="status-dialog-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => onReason(e.target.value)} />
      </Field>
      {fieldError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{fieldError}</p>}
      {error != null && (
        <Note tone="err">
          <span role="alert">{errorMessage(error)}</span>
          {isStale(error) && <Button size="sm" className="ml-2" onClick={() => { setError(null); onReload() }}>Tải lại</Button>}
        </Note>
      )}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={suspending ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
          {suspending ? 'Tạm ngưng tài khoản' : 'Khôi phục tài khoản'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
