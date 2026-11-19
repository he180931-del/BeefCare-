import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Button, Field, Note, Radio, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { platformAdminApi } from '../api/platformAdminApi'
import {
  MSG, OPERATION_LABEL, PLATFORM_ROLES, REASON_MAX, ROLE_LABEL, accessButtonLabel, availableOperations, formatDateTime, validateReason,
} from '../domain/platformRules'
import type { AccountSummary, PlatformAccessOperation, PlatformRole } from '../types'
import { AccountStatusBadge, PersonCell, errorMessage, isStale } from './common'

const DONE_VERB: Record<PlatformAccessOperation, string> = { GRANT: 'cấp', CHANGE: 'đổi', REVOKE: 'thu hồi', RESTORE: 'khôi phục' }

/** Hộp thoại "Platform Staff Access" (UC-FE03-09): cấp, đổi vai trò, thu hồi hoặc khôi phục quyền nền tảng. */
export default function AccessDialog({ account, onClose, onDone, onReload }: {
  account: AccountSummary
  onClose: () => void
  onDone: (message: string) => void
  onReload: () => void
}) {
  const operations = availableOperations(account)
  const [picked, setPicked] = useState<PlatformAccessOperation>(operations[0])
  const operation = operations.includes(picked) ? picked : operations[0]
  const [role, setRole] = useState<PlatformRole>(() => PLATFORM_ROLES.find((r) => r !== account.platformRole) ?? 'CS')
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const history = useQuery(() => platformAdminApi.accountHistory(account.id), [account.id, account.platformAccessVersion])

  const needsRole = operation === 'GRANT' || operation === 'CHANGE'
  const roleSummary = account.platformRole
    ? `${ROLE_LABEL[account.platformRole]}${account.platformAccessStatus === 'REVOKED' ? ' · đã thu hồi' : ''}`
    : 'chưa có vai trò'

  const submit = async () => {
    if (!account.emailVerified) { setError(new Error(MSG.unverified)); return }
    const invalid = validateReason(reason)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      const next = await platformAdminApi.changePlatformAccess(account.id, {
        operation, role: needsRole ? role : undefined, reason: reason.trim(), expectedVersion: account.platformAccessVersion,
      })
      onDone(`Quyền ${next.platformRole} của ${next.email} đã được ${DONE_VERB[operation]}.`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Cấp quyền nền tảng"
      sub="Chỉ cấp cho người dùng đã đăng nhập Google ít nhất một lần. Mỗi người tối đa một vai trò đang hoạt động."
      width={600}
      onClose={onClose}
    >
      <div className="flex items-center justify-between gap-3 rounded-md bg-page px-3 py-2.5">
        <PersonCell name={account.fullName} sub={`${account.email} · ${roleSummary}`} />
        <AccountStatusBadge status={account.accountStatus} />
      </div>
      {!account.emailVerified && <Note tone="err">{MSG.unverified}</Note>}
      {operations.length > 1 && (
        <Field label="Hành động *">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {operations.map((o) => (
              <Radio key={o} name="access-operation" checked={operation === o} onChange={() => setPicked(o)}>{OPERATION_LABEL[o]}</Radio>
            ))}
          </div>
        </Field>
      )}
      {needsRole && (
        <Field label="Vai trò *">
          <div className="flex flex-col gap-2">
            {PLATFORM_ROLES.map((r) => (
              <Radio key={r} name="access-role" checked={role === r} onChange={() => setRole(r)}>{ROLE_LABEL[r]}</Radio>
            ))}
          </div>
        </Field>
      )}
      <Field label="Lý do *" id="access-reason">
        <input id="access-reason" className={inputCls} value={reason} maxLength={REASON_MAX} placeholder="Nhập lý do…" onChange={(e) => { setReason(e.target.value); setFieldError(null) }} />
      </Field>
      {fieldError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{fieldError}</p>}
      <Note tone="info">Không thể thu hồi quyền SA đang hoạt động cuối cùng. Quyền nền tảng không cấp quyền vào bất kỳ trang trại nào.</Note>
      {error != null && (
        <Note tone="err">
          <span role="alert">{errorMessage(error)}</span>
          {isStale(error) && <Button size="sm" className="ml-2" onClick={() => { setError(null); onReload() }}>Tải lại</Button>}
        </Note>
      )}
      <section aria-label="Lịch sử vai trò" className="flex flex-col gap-1.5">
        <h3 className="m-0 text-xs font-semibold text-ink">Lịch sử vai trò</h3>
        {history.data && history.data.length === 0 && <p className="m-0 text-xs text-muted">Chưa có lịch sử.</p>}
        <ul className="m-0 flex max-h-28 list-none flex-col gap-1 overflow-y-auto p-0 text-xs text-muted">
          {history.data?.map((h) => (
            <li key={h.id}><span className="font-medium text-ink">{OPERATION_LABEL[h.action as PlatformAccessOperation] ?? h.action}</span> · {h.details} · {formatDateTime(h.at)}</li>
          ))}
        </ul>
      </section>
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant={operation === 'REVOKE' ? 'danger' : 'primary'} onClick={submit} disabled={busy || !account.emailVerified}>
          {accessButtonLabel(operation, role, account.platformRole)}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
