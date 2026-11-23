import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Button, ErrorBlock, Foot, LoadingBlock, Note } from '../../../shared/ui'
import { AccountShell } from '../components/AccountShell'
import { ChangePasswordDialog } from '../components/ChangePasswordDialog'
import { ProfileCard } from '../components/ProfileParts'
import { useAccountProfile, useProfileForm } from '../hooks/useAccountProfile'

export default function AccountPage() {
  const { identity, data, loading, error, refetch } = useAccountProfile()
  const [modal, openModal, closeModal] = useModalParam()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const [notice, setNotice] = useState<string | null>(null)
  const form = useProfileForm(data, identity, async (_saved, message) => { setNotice(message); await refetch() })

  if (loading && !data) return <AccountShell active="profile"><LoadingBlock /></AccountShell>
  if (error || !data) return <AccountShell active="profile"><ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ của bạn.')} onRetry={refetch} /></AccountShell>

  return (
    <AccountShell active="profile">

        <div className="mb-8 flex flex-wrap items-end gap-4">
          <div className="max-w-2xl">
            <h1 className="m-0 text-3xl font-bold tracking-[-0.03em] text-brand-dark sm:text-4xl">Hồ sơ của tôi</h1>
          </div>
          <div className="flex-1" />
          <Button variant="primary" type="submit" form="profile-form" disabled={form.saving}>{form.saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>
        </div>

        {notice && <Note tone="ok">{notice}</Note>}
        {form.error && <Note tone="err">{form.error}</Note>}
        <div className="mt-6 w-full">
          <ProfileCard profile={data} headline="Tài khoản BeefCare" values={form.values} onChange={form.setValues} errors={form.errors} onSubmit={form.submit} onPassword={() => openModal('doi-mat-khau')} />
        </div>
        {modal === 'doi-mat-khau' && <ChangePasswordDialog identity={identity} profile={data} returnTo={pathname} googleReauthenticated={search.get('googleReauthenticated') === 'true'} onClose={closeModal} onChanged={(message) => { setNotice(message); closeModal(); void refetch() }} />}
    </AccountShell>
  )
}
