import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, Field, Info, Note, Textarea } from '../../../components/ui'
import { REASON_MAX, formatDate, formatDateTime, validateReason, verificationText } from '../domain/platformRules'
import type { AccountSummary } from '../types'
import AccountStatusDialog from './AccountStatusDialog'
import { AccountStatusBadge, ICON_BUTTON, PersonCell } from './common'

export default function AccountDetailPanel({ account, onChanged, onReload }: {
  account: AccountSummary
  onChanged: (message: string) => void
  onReload: () => void
}) {
  const [m, openModal, closeModal] = useModalParam()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const suspended = account.accountStatus === 'SUSPENDED'

  const requestChange = () => {
    const invalid = validateReason(reason)
    setReasonError(invalid)
    if (!invalid) openModal(suspended ? 'restore' : 'suspend')
  }
  const roleText = account.platformRole
    ? `${account.platformRole}${account.platformAccessStatus === 'REVOKED' ? ' (đã thu hồi)' : ''}`
    : '—'

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2">
          <PersonCell wrap name={account.fullName} sub={`${account.email} · ${verificationText(account)}`} />
          <span className="shrink-0"><AccountStatusBadge status={account.accountStatus} /></span>
        </div>
        <Info cols={2} items={[
          ['Tạo lúc', formatDateTime(account.createdAt)],
          ['Đăng ký chủ trại', account.ownerRegisteredAt ? formatDate(account.ownerRegisteredAt) : account.ownerRegistrationCompleted ? 'Có' : 'Không'],
          ['Vai trò nền tảng', roleText],
          ['Đăng nhập gần nhất', account.lastSignInAt ? formatDateTime(account.lastSignInAt) : 'Chưa đăng nhập'],
          ['Trại sở hữu', account.ownedFarms.length ? account.ownedFarms.join(', ') : '—'],
        ]} />
        <Field label="Lý do *" id="account-reason" hint="Bắt buộc khi đổi trạng thái tài khoản">
          <Textarea
            id="account-reason"
            rows={3}
            value={reason}
            maxLength={REASON_MAX}
            placeholder={suspended ? 'Nhập lý do mở khóa…' : 'Nhập lý do tạm khóa…'}
            onChange={(e) => { setReason(e.target.value); setReasonError(null) }}
          />
        </Field>
        {reasonError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{reasonError}</p>}
        <Button variant={suspended ? 'primary' : 'danger'} block className={ICON_BUTTON} onClick={requestChange}>
          <Icon name={suspended ? 'circle-check' : 'player-pause'} size={16} />
          {suspended ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}
        </Button>
        <Button block className={ICON_BUTTON} onClick={() => navigate(`/nen-tang/quyen/${account.id}?m=access`)}>
          <Icon name="shield-lock" size={16} />
          Quyền nền tảng
        </Button>
        <Note>Quản trị hệ thống không xem dữ liệu vận hành trại, nội dung yêu cầu hỗ trợ hay chứng từ tài chính – chỉ quản lý tài khoản và quyền nền tảng.</Note>
      </div>
      {(m === 'suspend' || m === 'restore') && (
        <AccountStatusDialog
          account={account}
          reason={reason}
          onReason={setReason}
          onClose={closeModal}
          onReload={() => { closeModal(); onReload() }}
          onDone={(message) => { setReason(''); closeModal(); onChanged(message) }}
        />
      )}
    </Card>
  )
}
