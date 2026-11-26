import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, ErrorBlock, LoadingBlock, Note } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { useSession } from '../../../app/session/sessionContext'
import { useCattleProfileQuery, useCattleRemindersQuery } from '../hooks/useCattleQueries'
import CowHeader, { COW_TABS, OVERVIEW_SECTIONS } from '../components/CowHeader'
import { isFemale } from '../domain/profileRules'
import { businessDate } from '../../../shared/lib/date/farmTime'
import OverviewTab from '../components/OverviewTab'
import TimelineTab from '../components/TimelineTab'
import ComingSoon from '../components/ComingSoon'
import UpdateModal from '../components/UpdateModal'
import QrReissueModal from '../components/QrReissueModal'
import MoveModal from '../components/MoveModal'
import RecordEditModal from '../components/RecordEditModal'
import type { ReactNode } from 'react'
import type { CattleViewModel as CowSeed } from '../types'
import type { CattleReminder } from '../api/cattleReminders'
import { localCattleList } from '../api/cattleApi'
import { ReproductionProfileTab } from '../../reproduction'
import { GrowthProfileTab } from '../../growth'
import { VaccinationProfileTab } from '../../vaccination'
import { HealthProfileTab } from '../../health'

export default function CowProfile() {
  const { code } = useParams()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const profileQuery = useCattleProfileQuery(code ?? '')
  const { cow, barns: barnRows } = profileQuery.data ?? {}
  const barns = Object.fromEntries((barnRows ?? []).map((b) => [b.code, b]))
  const remindersQuery = useCattleRemindersQuery(cow)
  const [notice, setNotice] = useState('')
  // R-05-09: "Xem xét" on a REM-08 life-stage suggestion pre-fills the stage tab of the update popup.
  const [suggestion, setSuggestion] = useState<{ stage: string; date: string; reason: string }>()
  // MSG-FE05-01 / MSG-FE05-04 sau khi lưu; hồ sơ và nhắc việc được tải lại (backend tự giải quyết REM-08).
  const saved = (message?: string) => {
    profileQuery.refetch()
    remindersQuery.refetch()
    setSuggestion(undefined)
    closeModal()
    setNotice(message ?? '')
  }
  const closeUpdate = () => { setSuggestion(undefined); closeModal() }
  const reviewStage = (reminder: CattleReminder) => {
    if (!reminder.stage) return
    // An upcoming suggestion is pre-filled with today: the effective date may not be in the future (MSG-FE05-05).
    const today = businessDate()
    setSuggestion({ stage: reminder.stage, date: reminder.dueDate && reminder.dueDate < today ? reminder.dueDate : today, reason: 'Đến ngưỡng tuổi theo tham số trại' })
    openModal('update')
  }

  const rawTab = params.get('tab') || ''
  // SCR-19: the Reproduction tab is for females; ?tab=repro of a male falls back to the overview.
  const reproHidden = rawTab === 'repro' && !!cow && !isFemale(cow)
  const tab = COW_TABS.some(([value]) => value === rawTab) && !reproHidden ? rawTab : ''
  // D79: ?tab=barns / ?tab=qr mở tab Tổng quan với khối Lịch sử chuồng / Thẻ QR mở sẵn.
  const section = OVERVIEW_SECTIONS.find((value) => value === rawTab)
  useEffect(() => {
    if (reproHidden) setParams({}, { replace: true })
  }, [reproHidden, setParams])
  const tabLabel = COW_TABS.find(([value]) => value === tab)?.[1] ?? 'Tổng quan'
  const onTab = (value: string) => setParams(value ? { tab: value } : {})

  // Chỉ Chủ trại/Quản lý ghi được; backend trả canUpdate theo quyền thật, bò đã xuất hoặc chờ xuất chỉ xem.
  const canWrite = !!cow && cow.status === 'ACTIVE' && !cow.exitPending && cow.canUpdate !== false && session?.role !== 'TECHNICIAN'

  let content = null
  if (cow) {
    const tabViews: Record<string, ReactNode> = {
      '': <OverviewTab cow={cow} barns={barns} canWrite={canWrite} onOpenModal={openModal} reminders={cow.backendId != null ? remindersQuery : undefined} onReviewStage={reviewStage} openSection={section} onTab={onTab} />,
      timeline: <TimelineTab cow={cow} />,
      growth: <GrowthProfileTab cattleCode={cow.code} />,
      vaccine: <VaccinationProfileTab cattleCode={cow.code} />,
      health: <HealthProfileTab cattleCode={cow.code} />,
      repro: <ReproductionProfileTab cattleCode={cow.code} />,
    }
    content = (
      <>
        <CowHeader cow={cow} tab={tab} canWrite={canWrite} onTab={onTab} onOpenModal={openModal} />
        <ReadOnlyBanner cow={cow} technician={session?.role === 'TECHNICIAN'} />
        {tabViews[tab] ?? <ComingSoon label={tabLabel} />}
        {canWrite && (modal === 'update' || modal === 'photo') && (
          <UpdateModal key={modal} cow={cow} owner={session?.role === 'OWNER'} initialTab={modal === 'photo' ? 'identity' : 'stage'} suggestion={modal === 'update' ? suggestion : undefined} onClose={closeUpdate} onSaved={saved} />
        )}
        {canWrite && modal === 'qr-reissue' && <QrReissueModal cow={cow} onClose={closeModal} onSaved={saved} />}
        {canWrite && modal === 'move' && <MoveModal cow={cow} barns={barns} onClose={closeModal} onReload={saved} onSaved={saved} />}
        {localCattleList !== null && canWrite && modal === 'record-edit' && cow.importRecord && <RecordEditModal cow={cow} record={cow.importRecord} onClose={closeModal} onSaved={saved} />}
      </>
    )
  }

  return (
    <Layout title={`Hồ sơ bò › ${tabLabel}`} user="manager">
      <div className="flex flex-col gap-5 leading-[normal]">
        {profileQuery.loading && !cow && <LoadingBlock>Đang tải hồ sơ…</LoadingBlock>}
        {notice && <div className="text-sm font-medium text-brand" role="status" aria-live="polite">{notice}</div>}
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

/** UC-FE05-02: why the profile is read-only (MSG-COM-13 / MSG-COM-18 / MSG-COM-17 shortened). */
function ReadOnlyBanner({ cow, technician }: { cow: CowSeed; technician: boolean }) {
  if (cow.status === 'EXITED') {
    const date = cow.exitDateLabel ? ` ngày ${cow.exitDateLabel}` : ''
    const type = cow.exitTypeLabel ? ` (${cow.exitTypeLabel})` : ''
    return <Note tone="grey">{`${cow.code} đã rời đàn${date}${type}. Hồ sơ chỉ xem.`}</Note>
  }
  if (cow.status === 'VOIDED') return <Note tone="err">{`Bản ghi nhập của ${cow.code} đã bị hủy. Hồ sơ chỉ xem và không tính vào đàn.`}</Note>
  if ((cow.exitPending || cow.status === 'EXIT_PENDING') && !technician) {
    return <Note tone="warn">{`${cow.code} đang trên phiếu xuất chờ xử lý. Không ghi sự kiện mới, chuyển chuồng hay sửa hồ sơ.`}</Note>
  }
  return null
}
