import { useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, ErrorBlock, LoadingBlock } from '../../../components/ui'
import { useModalParam } from '../../../components/Modal'
import { loadProfile } from '../api/cattleApi'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import CowHeader, { COW_TABS } from '../components/CowHeader'
import OverviewTab from '../components/OverviewTab'
import TimelineTab from '../components/TimelineTab'
import BarnsTab from '../components/BarnsTab'
import QrTab from '../components/QrTab'
import ComingSoon from '../components/ComingSoon'
import UpdateModal from '../components/UpdateModal'
import QrReissueModal from '../components/QrReissueModal'
import MoveModal from '../components/MoveModal'
import RecordEditModal from '../components/RecordEditModal'
import type { ReactNode } from 'react'
import { ReproductionProfileTab } from '../../reproduction'
import { GrowthProfileTab } from '../../growth'
import { VaccinationProfileTab } from '../../vaccination'
import { HealthProfileTab } from '../../health'

export default function CowProfile() {
  const { code } = useParams()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const profileQuery = useQuery(() => loadProfile(code ?? ''), [code])
  const { cow, barns: barnRows } = profileQuery.data ?? {}
  const barns = Object.fromEntries((barnRows ?? []).map((b) => [b.code, b]))
  const saved = () => {
    profileQuery.refetch()
    closeModal()
  }

  const rawTab = params.get('tab') || ''
  const tab = COW_TABS.some(([value]) => value === rawTab) ? rawTab : ''
  const tabLabel = COW_TABS.find(([value]) => value === tab)?.[1] ?? 'Tổng quan'
  const onTab = (value: string) => setParams(value ? { tab: value } : {})

  // Chỉ Chủ trại/Quản lý ghi được; backend trả canUpdate theo quyền thật, bò đã xuất hoặc chờ xuất chỉ xem.
  const canWrite = !!cow && cow.status === 'ACTIVE' && !cow.exitPending && cow.canUpdate !== false && session?.role !== 'TECHNICIAN'

  let content = null
  if (cow) {
    const tabViews: Record<string, ReactNode> = {
      '': <OverviewTab cow={cow} canWrite={canWrite} onOpenModal={openModal} />,
      timeline: <TimelineTab cow={cow} />,
      barns: <BarnsTab cow={cow} barns={barns} canWrite={canWrite} onOpenModal={openModal} />,
      qr: <QrTab cow={cow} canWrite={canWrite} onOpenModal={openModal} />,
      growth: <GrowthProfileTab cattleCode={cow.code} />,
      vaccine: <VaccinationProfileTab cattleCode={cow.code} />,
      health: <HealthProfileTab cattleCode={cow.code} />,
      repro: <ReproductionProfileTab cattleCode={cow.code} />,
    }
    content = (
      <>
        <CowHeader cow={cow} tab={tab} canWrite={canWrite} onTab={onTab} onOpenModal={openModal} />
        {tabViews[tab] ?? <ComingSoon label={tabLabel} />}
        {canWrite && modal === 'update' && <UpdateModal cow={cow} owner={session?.role === 'OWNER'} onClose={closeModal} onSaved={saved} />}
        {canWrite && modal === 'qr-reissue' && <QrReissueModal cow={cow} onClose={closeModal} onSaved={saved} />}
        {canWrite && modal === 'move' && <MoveModal cow={cow} barns={barns} onClose={closeModal} onSaved={saved} />}
        {canWrite && modal === 'record-edit' && cow.importRecord && <RecordEditModal cow={cow} record={cow.importRecord} onClose={closeModal} onSaved={saved} />}
      </>
    )
  }

  return (
    <Layout title={`Hồ sơ bò › ${tabLabel}`} user="manager">
      <div className="flex flex-col gap-5 leading-[normal]">
        {profileQuery.loading && !cow && <LoadingBlock>Đang tải hồ sơ…</LoadingBlock>}
        {cow && content}
        {!cow && !profileQuery.loading && (
          <>
            <ErrorBlock message={`Không tải được hồ sơ bò ${code}.`} onRetry={profileQuery.refetch} />
            <div><Button className="leading-[normal]" onClick={() => window.history.back()}>← Về danh sách</Button></div>
          </>
        )}
      </div>
    </Layout>
  )
}
