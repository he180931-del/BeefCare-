import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Button, Card, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../shared/ui'
import { isFarmRole } from '../../authorization'
import { roleAtFarm } from '../domain/profileRules'
import { ChangePasswordDialog } from './ChangePasswordDialog'
import { PermissionsCard, ProfileCard } from './ProfileParts'
import { useAccountProfile, useProfileForm } from '../hooks/useAccountProfile'

/** SCR-08 "Hồ sơ & quyền của tôi". `platform`: nhân sự nền tảng (CS, PM, SA) không có bảng quyền theo trại. */
export function ProfileScreen({ title, platform = false }: { title: string; platform?: boolean }) {
  const { identity, data, loading, error, refetch, permissions } = useAccountProfile()
  const [m, openModal, closeModal] = useModalParam()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)
  const form = useProfileForm(data, identity, async (_saved, message) => { setNotice(message); await refetch() })

  if (loading && !data) return <Layout title={title}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={title}><ErrorBlock message={userFacingError(error, 'Không tải được hồ sơ của bạn.')} onRetry={refetch} /></Layout>

  const farmRole = !platform && isFarmRole(identity.role) ? identity.role : null
  // Permissions belong to one farm: a tab that has not entered one has no role or permission table to show.
  const noFarm = farmRole != null && identity.farmId == null
  return (
    <Layout title={title}>
      <PageHeader title={title} sub={platform ? roleAtFarm(identity.role, null) : undefined}>
        <Button variant="primary" size="bento" type="submit" form="profile-form" disabled={form.saving}>{form.saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</Button>
      </PageHeader>
      {notice && <Note tone="ok">{notice}</Note>}
      {form.error && <Note tone="err">{form.error}</Note>}
      <div className={farmRole ? 'grid grid-cols-4 items-start gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6' : 'max-w-[740px]'}>
        <div className="@container col-span-full min-w-0 @min-[880px]:col-span-5 @min-[1024px]:col-span-8">
          <ProfileCard profile={data} headline={noFarm ? 'Chưa vào trại nào trong tab này' : roleAtFarm(identity.role, identity.farmName)} values={form.values} onChange={form.setValues} errors={form.errors} onSubmit={form.submit} onPassword={() => openModal('doi-mat-khau')} />
        </div>
        {farmRole && (
          <div className="col-span-full min-w-0 @min-[880px]:col-span-3 @min-[1024px]:col-span-4">
            {noFarm
              ? <Card variant="panel" title="Quyền của tôi trong trại này"><p className="m-0 text-[13px] text-muted">Quyền được cấp theo từng trại. Vào một trại để xem vai trò và quyền của bạn ở trại đó.</p><div className="mt-3"><Button size="bento" onClick={() => navigate('/chon-trai')}>Chọn trại</Button></div></Card>
              : <PermissionsCard permissions={permissions.data} loading={permissions.loading} error={permissions.error} />}
          </div>
        )}
      </div>
      <Foot>{farmRole ? 'Thư điện tử và cách đăng nhập để nhận diện tài khoản; tên và điện thoại là thông tin liên hệ. Bảng quyền chỉ đọc theo vai trò hiện tại.' : 'Thư điện tử và cách đăng nhập để nhận diện tài khoản; tên và điện thoại là thông tin liên hệ. Quyền nền tảng do quản trị hệ thống cấp.'}</Foot>
      {m === 'doi-mat-khau' && <ChangePasswordDialog identity={identity} profile={data} returnTo={pathname} googleReauthenticated={search.get('googleReauthenticated') === 'true'} onClose={closeModal} onChanged={(message) => { setNotice(message); closeModal(); void refetch() }} />}
    </Layout>
  )
}
