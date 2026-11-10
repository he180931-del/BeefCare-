import { useParams, useSearchParams } from 'react-router-dom'
import TimelineTab from './TimelineTab'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { ErrorBlock, LoadingBlock } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/Icon'
import { loadProfile } from '../api/cattleApi'
import { useQuery } from '../../../hooks/useApi'
import { GrowthTechnicianTab } from '../../growth'
import { VaccinationTechnicianTab } from '../../vaccination'
import { HealthTechnicianTab } from '../../health'
import { ReproductionTechnicianTab } from '../../reproduction'
import { Chip, Fields, Panel, chipIcon } from './parts'
import type { CowSeed } from '../../../data/cowsData'

const TABS: ReadonlyArray<readonly [string, string, IconName]> = [
  ['', 'Tổng quan', 'id'],
  ['timeline', 'Dòng thời gian', 'timeline-event'],
  ['growth', 'Tăng trưởng', 'scale'],
  ['vaccine', 'Tiêm phòng', 'vaccine'],
  ['health', 'Sức khỏe', 'stethoscope'],
  ['repro', 'Sinh sản', 'dna'],
]
function Overview({ cow }: { cow: CowSeed }) {
  const cur = cow.qrHistory.find((q) => q.status === 'ACTIVE') || cow.qrHistory[0]
  return (
    <>
      <Panel title="Định danh" pad="p-4">
        <Fields cols="grid-cols-2" items={[['Mã hiển thị', cow.code], ['Số thẻ tai', cow.tag || 'Gắn sau'], ['Thẻ QR', cur?.code ?? '—'], ['Trạng thái', cur ? <Chip key="s" tone="ok" icon="circle-check">{cur.status}</Chip> : '—']]} />
      </Panel>
      <Panel title="Thông tin cá thể" pad="p-4">
        <Fields cols="grid-cols-2" items={[['Giống', cow.breed], ['Tuổi', cow.ageLong.replace('tuổi', 'năm')], ['Mục đích', cow.purpose], ['Giai đoạn', cow.stage], ['Mẹ', cow.mother], ['Chuồng', cow.barn ? `${cow.barn} · từ ${cow.barnSince}` : '—']]} />
      </Panel>
      <Panel title="Tóm tắt chăm sóc" pad="p-4">
        <Fields
          cols="grid-cols-2"
          items={[
            ['Cân gần nhất', cow.care.last],
            ['Sức khỏe', cow.care.healthCase],
            ['Sinh sản', cow.care.repro],
            ['Tiêm phòng', <Chip key="v" tone={cow.care.vaccine.tone} icon={cow.care.vaccine.tone === 'err' ? 'alert-triangle' : undefined}>{cow.care.vaccine.label}</Chip>],
          ]}
        />
      </Panel>
    </>
  )
}

// Hồ sơ bò trên điện thoại của Kỹ thuật viên: chỉ xem, các tab chăm sóc dùng bản kỹ thuật viên của từng tính năng.
export default function TechnicianProfile() {
  const { code = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, refetch } = useQuery(() => loadProfile(code), [code])
  const cow = data?.cow
  const rawTab = params.get('tab') ?? ''
  const tab = TABS.some(([v]) => v === rawTab) ? rawTab : ''
  const tabs = TABS.filter(([v]) => v !== 'repro' || cow?.sex !== 'Đực')
  const sub = cow ? [cow.name && `“${cow.name}”`, cow.breed, cow.sex, cow.barn && `Chuồng ${cow.barn}`].filter(Boolean).join(' · ') : undefined

  const views: Record<string, JSX.Element | null> = cow ? {
    '': <Overview cow={cow} />,
    timeline: <TimelineTab cow={cow} />,
    growth: <GrowthTechnicianTab cattleCode={cow.code} />,
    vaccine: <VaccinationTechnicianTab cattleCode={cow.code} />,
    health: <HealthTechnicianTab cattleCode={cow.code} />,
    repro: <ReproductionTechnicianTab cattleCode={cow.code} />,
  } : {}

  return (
    <TechnicianLayout title={cow?.code ?? code} sub={sub} back="/kt/dan-bo">
      {loading && !cow && <LoadingBlock />}
      {!cow && !loading && <ErrorBlock message={`Không tải được hồ sơ bò ${code}.`} onRetry={refetch} />}
      {cow && (
        <>
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(([v, label, icon]) => (
              <button
                key={v}
                type="button"
                // Tab mở từ liên kết ?tab= có thể nằm ngoài vùng cuộn ngang trên điện thoại.
                ref={v === tab ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) : undefined}
                onClick={() => setParams(v ? { tab: v } : {})}
                className={`flex shrink-0 cursor-pointer items-center gap-1 rounded px-2.5 py-1.5 text-[11px] ${v === tab ? 'bg-ok-bg font-semibold text-brand-dark' : 'text-muted'}`}
              >
                <Icon name={icon} size={14} />{label}
              </button>
            ))}
          </div>
          {views[tab]}
        </>
      )}
    </TechnicianLayout>
  )
}
