import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import { useModalParam } from '../../../components/Modal'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { EmptyBlock, ErrorBlock, LoadingBlock, Note, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { farmOverviewApi } from '../api/farmOverviewApi'
import { ReminderDetailModal } from '../components/ReminderParts'
import { dueLabel } from '../domain/reminderRules'
import type { ReminderItem, Urgency } from '../types'

const TITLE = 'Nhắc việc'
const dateText = (item: ReminderItem, today: string) => dueLabel(item, today)

export default function TechnicianRemindersPage() {
  const [tab, setTab] = useState<Urgency>('TODAY')
  const [m, , closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const { data, loading, error, refetch } = useQuery(() => farmOverviewApi.listReminders('TECHNICIAN'), [])
  const items = useMemo(() => data?.items ?? [], [data])

  if (loading && !data) return <TechnicianLayout title={TITLE} back="/kt"><LoadingBlock /></TechnicianLayout>
  if (error || !data) return <TechnicianLayout title={TITLE} back="/kt"><ErrorBlock message={userFacingError(error, 'Không tải được nhắc việc.')} onRetry={refetch} /></TechnicianLayout>

  const count = (u: Urgency) => items.filter((i) => i.urgency === u).length
  const shown = items.filter((i) => i.urgency === tab)
  const selected = m === 'chi-tiet' ? items.find((i) => i.id === Number(params.get('r'))) : undefined
  const open = (id: number) => { const next = new URLSearchParams(params); next.set('m', 'chi-tiet'); next.set('r', String(id)); setParams(next) }

  return (
    <TechnicianLayout title={TITLE} back="/kt">
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Urgency)}
        options={[
          { value: 'OVERDUE', label: `Quá hạn (${count('OVERDUE')})` },
          { value: 'TODAY', label: `Hôm nay (${count('TODAY')})` },
          { value: 'UPCOMING', label: `Sắp tới (${count('UPCOMING')})` },
        ]}
      />
      {shown.length === 0 && <EmptyBlock title="Không có nhắc việc" sub="Chưa có mốc nào trong nhóm này." />}
      {shown.map((item) => (
        <button key={item.id} type="button" onClick={() => open(item.id)} className="flex w-full cursor-pointer flex-col gap-1 rounded-lg border border-field bg-white px-3.5 py-3 text-left">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#212121]">{item.title}</span>
            <span className="shrink-0 text-[11px] font-semibold text-muted">{dateText(item, data.today)}</span>
          </span>
          <span className="text-[11px] text-muted">{[item.code ?? item.group, item.breed, item.pen].filter(Boolean).join(' · ')}</span>
        </button>
      ))}
      <Note>Chỉ xem. Kỹ thuật viên không thấy nhắc bê nháp và tồn kho thức ăn thấp.</Note>
      {selected && <ReminderDetailModal item={selected} today={data.today} technician onClose={closeModal} />}
    </TechnicianLayout>
  )
}
