import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { isFarmRole } from '../../authorization'
import { roleAtFarm } from '../domain/profileRules'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { PermissionsCard, ProfileCard } from './ProfileParts'
import { useAccountProfile, useProfileForm } from './useAccountProfile'

/** SCR-08 "Hồ sơ & quyền của tôi". `platform`: nhân sự nền tảng (CS, PM, SA) không có bảng quyền theo trại. */
export function ProfileScreen({ title, platform = false }: { title: string; platform?: boolean }) {
  const { identity, data, loading, error, refetch, permissions } = useAccountProfile()
  const [m, openModal, closeModal] = useModalParam()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const [notice, setNotice] = useState<string | null>(null)
  const form = useProfileForm(data, identity, async (_saved, message) => { setNotice(message); await refetch() })

  if (loading && !data) return <Layout title={title}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={title}><ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ của bạn.')} onRetry={refetch} /></Layout>

  const farmRole = !platform && isFarmRole(identity.role) ? identity.role : null
  return (
    <Layout title={title}>
      <PageHeader title={title} sub={platform ? roleAtFarm(identity.role, null) : undefined}>
        <Button variant="primary" type="submit" form="profile-form" disabled={form.saving}>{form.saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button>
      </PageHeader>
      {notice && <Note tone="ok">{notice}</Note>}
      {form.error && <Note tone="err">{form.error}</Note>}
      <div className={`grid items-start gap-5 ${farmRole ? 'xl:grid-cols-[minmax(0,1fr)_376px]' : 'max-w-[740px]'}`}>
        <ProfileCard profile={data} headline={roleAtFarm(identity.role, identity.farmName)} values={form.values} onChange={form.setValues} errors={form.errors} onSubmit={form.submit} onPassword={() => openModal('doi-mat-khau')} />
        {farmRole && <PermissionsCard permissions={permissions.data} loading={permissions.loading} error={permissions.error} />}
      </div>
      <Foot>{farmRole ? 'Thư điện tử và cách đăng nhập để nhận diện tài khoản; tên và điện thoại là thông tin liên hệ. Bảng quyền chỉ đọc theo vai trò hiện tại.' : 'Thư điện tử và cách đăng nhập để nhận diện tài khoản; tên và điện thoại là thông tin liên hệ. Quyền nền tảng do quản trị hệ thống cấp.'}</Foot>
      {m === 'doi-mat-khau' && <ChangePasswordDialog identity={identity} profile={data} returnTo={pathname} googleReauthenticated={search.get('googleReauthenticated') === 'true'} onClose={closeModal} onChanged={(message) => { setNotice(message); closeModal(); void refetch() }} />}
    </Layout>
  )
}
