import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import type { AuthClient } from '../types'
import { normalizeEmail } from '../validation'
import { AuthShell, primaryButtonClass } from '../components/AuthShell'
import { ActionLink } from '../components/AuthControls'
import { AUTH_PATH, emailFromState, friendlyEmailRequestError } from '../domain/authErrors'
import { Link } from 'react-router-dom'

/** Nút gửi lại: khóa 60 giây sau mỗi lần gửi (SCR-04, SCR-05). */
function useResend(onSend: () => Promise<void>) {
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])
  const send = async () => {
    setBusy(true); setError(null)
    try { await onSend(); setSeconds(60) }
    catch (reason) { setError(friendlyEmailRequestError(reason)) }
    finally { setBusy(false) }
  }
  return { seconds, busy, error, send }
}

function EmailCard({ email, tone }: { email: string; tone: 'verification' | 'reset' }) {
  const text = email || 'địa chỉ email bạn vừa nhập'
  if (tone === 'reset') return <div className="rounded-[14px] bg-[#eef4ef] px-5 py-4 text-[15px] font-bold text-brand-dark break-all">{text}</div>
  return (
    <div className="rounded-[14px] bg-[#eef4ef] px-5 py-3">
      <p className="m-0 text-[11px] text-subtle">Liên kết xác minh đã gửi tới</p>
      <p className="m-0 mt-0.5 break-all text-[15px] font-bold text-ink">{text}</p>
    </div>
  )
}

export function EmailSentPage({ client, kind }: { client: AuthClient; kind: 'verification' | 'reset' }) {
  const location = useLocation()
  const email = emailFromState(location.state) || normalizeEmail(new URLSearchParams(location.search).get('email') || '')
  const verification = kind === 'verification'
  const resendFn = verification ? client.resendVerification : client.requestPasswordReset
  const { seconds, busy, error, send } = useResend(async () => { if (resendFn && email) await resendFn(email) })
  const canResend = Boolean(resendFn && email)

  if (verification) {
    return (
      <AuthShell title="Xác minh email" description="Chúng tôi đã gửi liên kết xác minh đến email của bạn. Mở thư và nhấn liên kết để tiếp tục." eyebrow="Kiểm tra hộp thư" footer={<ActionLink to={AUTH_PATH.signIn}><Icon name="arrow-left" size={13} className="mr-1 inline" />Quay lại đăng nhập</ActionLink>}>
        <div className="space-y-4">
          <EmailCard email={email} tone="verification" />
          <p className="m-0 text-xs leading-5 text-subtle">Liên kết chỉ dùng được một lần và có thời hạn. Nếu chưa thấy thư, hãy kiểm tra mục thư rác. Gửi lại sẽ làm liên kết cũ hết hiệu lực.</p>
          {canResend && <button type="button" onClick={send} disabled={busy || seconds > 0} className={primaryButtonClass}>{busy ? 'Đang gửi…' : seconds > 0 ? `Đã gửi · thử lại sau ${seconds}s` : 'Gửi lại email xác minh'}</button>}
          {error && <p role="alert" className="m-0 text-xs text-[#b54843]">{error}</p>}
          <p className="m-0 text-center text-[13px] text-subtle">Có thể gửi lại sau 60 giây · tối đa 5 lần mỗi giờ</p>
        </div>
      </AuthShell>
    )
  }
  return (
    <AuthShell title="Kiểm tra email" description="Nếu email thuộc tài khoản BeefCare, liên kết đặt lại đã được gửi." eyebrow="Liên kết đã gửi">
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-4 text-center">
          <span aria-hidden="true" className="grid size-20 place-items-center rounded-full bg-[#d7f0e1] text-brand"><Icon name="circle-check" size={36} /></span>
          <p className="m-0 text-base leading-6 text-subtle">Mở hộp thư để tiếp tục đặt mật khẩu. Nếu chưa thấy thư, hãy kiểm tra mục thư rác.</p>
        </div>
        <EmailCard email={email} tone="reset" />
        <p className="m-0 text-xs text-subtle">Liên kết có hiệu lực 30 phút và chỉ dùng được một lần.</p>
        <Link to={AUTH_PATH.signIn} className={`${primaryButtonClass} no-underline`}>Quay lại đăng nhập</Link>
        {canResend && <div className="text-center"><button type="button" onClick={send} disabled={busy || seconds > 0} className="cursor-pointer border-0 bg-transparent text-[13px] font-bold text-brand hover:underline disabled:cursor-not-allowed disabled:text-subtle">{busy ? 'Đang gửi…' : seconds > 0 ? `Gửi lại liên kết · thử lại sau ${seconds}s` : 'Gửi lại liên kết'}</button></div>}
        {error && <p role="alert" className="m-0 text-center text-xs text-[#b54843]">{error}</p>}
      </div>
    </AuthShell>
  )
}
