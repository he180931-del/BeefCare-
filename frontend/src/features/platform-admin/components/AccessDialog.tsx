import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Button, Field, Note, Radio, Textarea } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { platformAdminApi } from '../api/platformAdminApi'
import {
  MSG, OPERATION_LABEL, PLATFORM_ROLES, REASON_MAX, ROLE_LABEL, accessButtonLabel, accessDoneMessage, formatPlatformDateTime, noAccessActionReason,
  validateReason,
} from '../domain/platformRules'
import { useCommandKey } from '../hooks/useCommandKey'
import type { AccessHistoryItem, AccountDetail, PlatformAccessOperation, PlatformRole } from '../types'
import { commandOutcome } from './commandOutcome'
import { AccountStatusBadge, PersonCell, errorMessage } from './common'

const historyRole = (h: AccessHistoryItem) => (h.action === 'CHANGE' && h.roleBefore ? `${h.roleBefore} → ${h.roleAfter}` : h.roleAfter)

/**
 * Popup "Quyền nhân viên nền tảng" của SCR-16 (UC-FE03-09, D33): tài khoản, vai trò hiện tại, hành động theo `accessActions`
 * của máy chủ, vai trò (Cấp / Đổi), lý do 5–500, ghi chú SA cuối cùng và lịch sử vai trò (A11). Thành công MSG-FE03-19;
 * lỗi nghiệp vụ đóng popup để màn tải lại; lỗi lưu / mạng giữ popup và cùng Idempotency-Key.
 */
export default function AccessDialog({ account, onClose, onDone, onRefused }: {
  account: AccountDetail
  onClose: () => void
  onDone: (message: string) => void
  onRefused: (message: string) => void
}) {
  const operations = account.accessActions
  const [picked, setPicked] = useState<PlatformAccessOperation | null>(operations[0] ?? null)
  const operation = picked && operations.includes(picked) ? picked : operations[0] ?? null
  const activeRole = account.platformAccessStatus === 'ACTIVE' ? account.platformRole : null
  const [role, setRole] = useState<PlatformRole>(() => PLATFORM_ROLES.find((r) => r !== activeRole) ?? 'CS')
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const requestKey = useCommandKey()
  const history = useQuery(() => platformAdminApi.accountHistory(account.id), [account.id, account.platformAccessVersion])

  const needsRole = operation === 'GRANT' || operation === 'CHANGE'
  const blocked = noAccessActionReason(account)
  const roleSummary = account.platformRole
    ? `${ROLE_LABEL[account.platformRole]}${account.platformAccessStatus === 'REVOKED' ? ' · đã thu hồi' : ''}`
    : 'chưa có vai trò'
  // Table III-1: closing after entering data asks first (MSG-COM-14).
  const close = () => { if (reason.trim() && !discarding) setDiscarding(true); else onClose() }

  const submit = async () => {
    if (busy || !operation) return
    const invalid = validateReason(reason)
    setFieldError(invalid)
    if (invalid) return
    setBusy(true)
    setError(null)
    const command = { operation, role: needsRole ? role : undefined, reason: reason.trim(), expectedVersion: account.platformAccessVersion }
    const key = requestKey.keyFor([account.id, command])
    try {
      const next = await platformAdminApi.changePlatformAccess(account.id, command, key)
      requestKey.clear()
      onDone(accessDoneMessage(next.platformRole ?? role, next.email, operation))
    } catch (failure) {
      const outcome = commandOutcome(failure, account.email)
      if (outcome.kind === 'refused') { requestKey.clear(); onRefused(outcome.message); return }
      if (outcome.kind === 'field') { requestKey.clear(); setFieldError(outcome.message); return }
      setError(outcome.message) // lỗi lưu / mạng: giữ popup và khóa để thử lại (GBR-88)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Quyền nhân viên nền tảng"
      sub="Cấp, đổi, thu hồi hoặc khôi phục quyền CS, PM, SA cho tài khoản đã xác minh email. Mỗi người tối đa một vai trò đang hoạt động; quyền nền tảng không cho vào dữ liệu trại."
      width={600}
      onClose={close}
    >
      <div className="flex items-center justify-between gap-3 rounded-md bg-page px-3 py-2.5">
        <PersonCell wrap name={account.fullName.trim() || 'Chưa có tên'} sub={`${account.email} · ${roleSummary}`} />
        <span className="shrink-0"><AccountStatusBadge status={account.accountStatus} /></span>
      </div>
      {blocked && <Note tone="warn">{blocked}</Note>}
      {operation && operations.length > 1 && (
        <Field label="Hành động *">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {operations.map((o) => (
              <Radio key={o} name="access-operation" checked={operation === o} onChange={() => { setPicked(o); setFieldError(null) }}>{OPERATION_LABEL[o]}</Radio>
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
      {operation && (
        <>
          <Field label="Lý do *" id="access-reason" hint="5–500 ký tự; được lưu vào lịch sử vai trò">
            <Textarea id="access-reason" rows={3} value={reason} maxLength={REASON_MAX} placeholder="Nhập lý do…" onChange={(e) => { setReason(e.target.value); setFieldError(null); setDiscarding(false) }} />
          </Field>
          {fieldError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{fieldError}</p>}
        </>
      )}
      <Note tone="info">{MSG.lastSaNotice}</Note>
      {error != null && <Note tone="err"><span role="alert">{error}</span></Note>}
      <section aria-label="Lịch sử vai trò" className="flex flex-col gap-1.5">
        <h3 className="m-0 text-xs font-semibold text-ink">Lịch sử vai trò</h3>
        {history.loading && !history.data && <p className="m-0 text-xs text-muted">Đang tải lịch sử…</p>}
        {history.error != null && (
          <p className="m-0 text-xs text-err-fg">
            {errorMessage(history.error, 'Không tải được lịch sử vai trò.')}{' '}
            <Button variant="link" size="sm" onClick={history.refetch}>Thử lại</Button>
          </p>
        )}
        {history.data && history.data.length === 0 && <p className="m-0 text-xs text-muted">Chưa có lịch sử.</p>}
        {history.data && history.data.length > 0 && (
          <ul className="m-0 flex max-h-36 list-none flex-col gap-1 overflow-y-auto p-0 text-xs text-muted">
            {history.data.map((h) => (
              <li key={h.id} className="break-words">
                <span className="font-medium text-ink">{OPERATION_LABEL[h.action]}</span> · {historyRole(h)} · {h.reason} · {h.byName ?? 'Hệ thống'} · {formatPlatformDateTime(h.at)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {discarding && <Note tone="warn">Bỏ thông tin bạn đã nhập?</Note>}
      <ModalFooter className="!px-0 !pb-0">
        {discarding ? (
          <>
            <ModalButton onClick={() => setDiscarding(false)}>Tiếp tục nhập</ModalButton>
            <ModalButton variant="danger" onClick={onClose}>Bỏ thông tin</ModalButton>
          </>
        ) : (
          <>
            <ModalButton onClick={close}>{operation ? 'Hủy' : 'Đóng'}</ModalButton>
            {operation && (
              <ModalButton variant={operation === 'REVOKE' ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
                {accessButtonLabel(operation, role, account.platformRole)}
              </ModalButton>
            )}
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
