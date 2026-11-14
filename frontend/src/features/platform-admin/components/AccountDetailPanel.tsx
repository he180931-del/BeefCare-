import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Button, Card, Field, Info, Note, Textarea } from '../../../components/ui'
import {
  REASON_MAX, farmsJoinedText, formatPlatformDate, formatPlatformDateTime, platformRoleText, revokedRoleNote, validateReason, verificationText,
} from '../domain/platformRules'
import type { AccountDetail } from '../types'
import AccountStatusDialog from './AccountStatusDialog'
import { AccountStatusBadge, ICON_BUTTON, PersonCell } from './common'

/**
 * Chi tiết tài khoản của SCR-16 (A10, D31): email và xác minh, tạo lúc, đăng nhập cuối (giờ Asia/Ho_Chi_Minh), đăng ký
 * Chủ trại và trại sở hữu. Không có SĐT, mật khẩu hay dữ liệu vận hành trại (GBR-11). Nút Tạm ngưng / Khôi phục (UC8)
 * và Quyền nền tảng (UC9) giữ như trước, chưa được kiểm chứng ở UC7.
 */
export default function AccountDetailPanel({ account, onChanged, onReload }: {
  account: AccountDetail
  onChanged: (message: string) => void
  onReload: () => void
}) {
  const [m, openModal, closeModal] = useModalParam()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const suspended = account.accountStatus === 'SUSPENDED'
  const revoked = revokedRoleNote(account)

  const requestChange = () => {
    const invalid = validateReason(reason)
    setReasonError(invalid)
    if (!invalid) openModal(suspended ? 'restore' : 'suspend')
  }
  const ownerRegistration = !account.ownerRegistrationCompleted
    ? 'Không'
    : account.ownerRegistrationCompletedAt ? `Có (${formatPlatformDate(account.ownerRegistrationCompletedAt)})` : 'Có'

  return (
    <Card>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2">
          <PersonCell wrap name={account.fullName.trim() || 'Chưa có tên'} sub={`${account.email} · ${verificationText(account)}`} />
          <span className="shrink-0"><AccountStatusBadge status={account.accountStatus} /></span>
        </div>
        <Info cols={2} items={[
          ['Tạo lúc', formatPlatformDateTime(account.createdAt)],
          ['Đăng nhập gần nhất', account.lastSignInAt ? formatPlatformDateTime(account.lastSignInAt) : 'Chưa đăng nhập'],
          ['Đăng ký Chủ trại', ownerRegistration],
          ['Vai trò nền tảng', revoked ? `${platformRoleText(account)} (${revoked})` : platformRoleText(account)],
          ['Trại tham gia', farmsJoinedText(account)],
          ['Trại sở hữu', account.ownedFarms.length ? account.ownedFarms.join(', ') : '—'],
        ]} />
        <Field label="Lý do *" id="account-reason" hint="Bắt buộc khi đổi trạng thái tài khoản">
          <Textarea
            id="account-reason"
            rows={3}
            value={reason}
            maxLength={REASON_MAX}
            placeholder={suspended ? 'Nhập lý do khôi phục…' : 'Nhập lý do tạm ngưng…'}
            onChange={(e) => { setReason(e.target.value); setReasonError(null) }}
          />
        </Field>
        {reasonError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{reasonError}</p>}
        <Button variant={suspended ? 'primary' : 'danger'} block className={ICON_BUTTON} onClick={requestChange}>
          <Icon name={suspended ? 'circle-check' : 'player-pause'} size={16} />
          {suspended ? 'Khôi phục tài khoản' : 'Tạm ngưng tài khoản'}
        </Button>
        <Button block className={ICON_BUTTON} onClick={() => navigate(`/nen-tang/quyen/${account.id}?m=access`)}>
          <Icon name="shield-lock" size={16} />
          Quyền nền tảng
        </Button>
        <Note>Quản trị hệ thống không xem dữ liệu vận hành trại, nội dung yêu cầu hỗ trợ hay thông tin mật khẩu – chỉ quản lý tài khoản và quyền nền tảng.</Note>
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
