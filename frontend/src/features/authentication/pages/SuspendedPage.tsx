import { useLocation } from 'react-router-dom'
import { AuthShell, NoticePanel, primaryButtonClass } from '../components/AuthShell'
import { ActionLink } from '../components/AuthControls'
import { AUTH_PATH, emailFromState } from '../domain/authErrors'
import { CONTACT } from '../data/landingContent'

/** MSG-FE01-03: tài khoản bị tạm ngưng, kèm thông tin liên hệ chính thức (GBR-87). */
export function SuspendedPage() {
  const email = emailFromState(useLocation().state)
  return (
    <AuthShell title="Tài khoản đang tạm ngưng" description="Bạn chưa thể truy cập trại bằng tài khoản này." eyebrow="Trạng thái tài khoản" footer={<ActionLink to={AUTH_PATH.home}>Quay về trang chủ</ActionLink>}>
      <div className="space-y-5">
        <NoticePanel title="Tài khoản đã bị tạm ngưng">
          Liên hệ hỗ trợ để được kiểm tra trạng thái và hướng dẫn bước tiếp theo.
          {email && <span className="mt-1 block">Tài khoản: <strong className="text-ink">{email}</strong></span>}
        </NoticePanel>
        <a href={`mailto:${CONTACT.email}`} className={`${primaryButtonClass} no-underline`}>Liên hệ hỗ trợ</a>
        <p className="m-0 text-center text-xs text-subtle"><a href={`mailto:${CONTACT.email}`} className="text-subtle">{CONTACT.email}</a> · <a href={CONTACT.phoneHref} className="text-subtle">{CONTACT.phone}</a></p>
      </div>
    </AuthShell>
  )
}
