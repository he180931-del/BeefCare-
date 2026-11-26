import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { ErrorBlock, LoadingBlock, Note } from '../../../shared/ui'
import { useAccountProfile, useProfileForm } from '../hooks/useAccountProfile'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { ProfileCard } from './ProfileParts'

export function AccountProfilePanel() {
  const { identity, data, loading, error, refetch } = useAccountProfile()
  const [modal, openModal, closeModal] = useModalParam()
  const [search] = useSearchParams()
  const location = useLocation()
  const [notice, setNotice] = useState<string | null>(null)
  const form = useProfileForm(data, identity, async (_saved, message) => { setNotice(message); await refetch() })

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ của bạn.')} onRetry={refetch} />

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em] text-brand-dark">Hồ sơ của tôi</h1>
      </div>
      {notice && <Note tone="ok">{notice}</Note>}
      {form.error && <Note tone="err">{form.error}</Note>}
      <div className="w-full">
        <ProfileCard profile={data} headline="Tài khoản BeefCare" values={form.values} onChange={form.setValues} errors={form.errors} onSubmit={form.submit} onPassword={() => openModal('doi-mat-khau')} saving={form.saving} />
      </div>
      {modal === 'doi-mat-khau' && (
        <ChangePasswordDialog
          identity={identity}
          profile={data}
          returnTo={`${location.pathname}${location.search}${location.hash}`}
          googleReauthenticated={search.get('googleReauthenticated') === 'true'}
          onClose={closeModal}
          onChanged={(message) => { setNotice(message); closeModal(); void refetch() }}
        />
      )}
    </>
  )
}
