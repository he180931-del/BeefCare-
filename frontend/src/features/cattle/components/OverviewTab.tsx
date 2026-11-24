import { useNavigate } from 'react-router-dom'
import { Button, Foot, Icon, type IconName, Table } from '../../../shared/ui'
import { Chip, Fields, Panel, Td, Th } from './parts'
import { PURPOSE_TYPE_LABELS } from '../domain/profileRules'
import type { CattleViewModel as CowSeed } from '../types'
import { localCattleList } from '../api/cattleApi'
import { businessDate } from '../../../shared/lib/date/farmTime'

const ageFull = (cow: CowSeed) => cow.ageLong.replace('tuổi', 'năm')
const dmy = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value ?? '')

function QuickAction({ icon, label, note, to }: { icon: IconName; label: string; note: string; to: string }) {
  const nav = useNavigate()
  return (
    <button type="button" onClick={() => nav(to)} className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-field bg-white p-4 text-left hover:bg-[#f4f8f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#cde9d8] text-brand"><Icon name={icon} size={20} /></span>
      <span className="flex min-w-0 flex-col gap-1 leading-[normal]">
        <span className="text-sm font-semibold text-[#212121]">{label}</span>
        <span className="text-xs text-muted">{note}</span>
      </span>
    </button>
  )
}

export default function OverviewTab({ cow, canWrite, onOpenModal }: { cow: CowSeed; canWrite: boolean; onOpenModal: (name: string) => void }) {
  const nav = useNavigate()
  const weighDue = cow.care.reminders.find((r) => r.title.startsWith('Cân'))?.due.label
  const code = encodeURIComponent(cow.code)
  const backend = localCattleList === null
  const entryCode = typeof cow.entryVoucherCode === 'string' ? cow.entryVoucherCode : ''
  const entryId = typeof cow.entryId === 'number' && Number.isInteger(cow.entryId) && cow.entryId > 0 ? cow.entryId : undefined
  const canEditEntry = canWrite && cow.status === 'ACTIVE' && !cow.exitPending && (backend ? Boolean(entryCode && entryId != null) : Boolean(cow.importRecord))
  // Bento (Figma Tab 16 ①b): lối tắt ghi nhận 4 cột, nội dung 8+4 (5+3 khi vùng nội dung 880–1.023 px); khối nổi bật là
  // Tóm tắt chăm sóc. Đo theo vùng nội dung sau sidebar.
  return (
    <div className="@container flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
      {canWrite && (
        <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-4 @min-[1024px]:gap-6">
          <QuickAction icon="scale" label="Ghi cân & BCS" note={weighDue ? `Lần cân tới ${weighDue}` : 'Cân và chấm thể trạng'} to={`/can-nang/ghi-nhan?cattle=${code}`} />
          <QuickAction icon="vaccine" label="Ghi tiêm" note={cow.care.vaccine.label} to={`/tiem-phong/ghi-nhan?cattle=${code}`} />
          <QuickAction icon="stethoscope" label="Ghi bất thường" note="Mở ca, điều trị" to={`/suc-khoe/mo-ca?cattle=${code}`} />
          {cow.sex === 'Cái' && <QuickAction icon="heartbeat" label="Ghi khám thai" note={cow.care.repro} to={`/cattle/${code}?tab=repro`} />}
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
        <div className="flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
          <Panel title="Định danh" gap="gap-3.5">
            <Fields
              cols="grid-cols-2 sm:grid-cols-4"
              items={[
                ['Ảnh bò', cow.photoUrl
                  ? <a key="p" href={String(cow.photoUrl)} target="_blank" rel="noreferrer"><img src={String(cow.photoUrl)} alt={`Ảnh ${cow.code}`} className="size-16 rounded-md object-cover" /></a>
                  : <span key="p" className="inline-block rounded-xl bg-[#e8ede5] px-3 py-1 text-[11px] font-normal text-[#6b7870]">Chưa có ảnh</span>],
                ['Mã hiển thị', cow.code],
                ['Số thẻ tai', cow.tag || 'Gắn sau'],
              ]}
            />
          </Panel>
          <Panel
            title="Thông tin cá thể"
            gap="gap-3.5"
            action={canEditEntry && <Button variant="link" small className="leading-[normal]" onClick={() => backend ? nav(`/herd-entry/${encodeURIComponent(entryCode)}?m=line&entry=${entryId}`) : onOpenModal('record-edit')}>Sửa / hủy bản ghi nhập đàn</Button>}
          >
            <Fields
              cols="grid-cols-2 sm:grid-cols-4"
              items={[
                ['Giới tính', cow.sex],
                ['Giống', cow.breed],
                ['Ngày sinh', cow.birth],
                ['Tuổi', ageFull(cow)],
                ['Nguồn nhập đàn', cow.source],
                ...(cow.entrySource === 'EXTERNAL' && typeof cow.quarantineUntil === 'string' && cow.quarantineUntil >= businessDate()
                  ? [['Cách ly nhập đàn đến', dmy(cow.quarantineUntil)] as const] : []),
                ['Mục đích nuôi', `${cow.purpose}${cow.purposeType ? ` (${PURPOSE_TYPE_LABELS[String(cow.purposeType)] ?? cow.purposeType})` : ''} · từ ${cow.purposeSince}`],
                ['Giai đoạn', cow.stage],
                ['Chuồng hiện tại', cow.barn ? `${cow.barn} · từ ${cow.barnSince}` : '—'],
                ['Mẹ', cow.damCode ? <Button key="dam" variant="link" small className="leading-[normal]" onClick={() => nav(`/cattle/${encodeURIComponent(String(cow.damCode))}`)}>{String(cow.damCode)}</Button> : cow.mother],
                ['Bố', cow.sireCode ? <Button key="sire" variant="link" small className="leading-[normal]" onClick={() => nav(`/cattle/${encodeURIComponent(String(cow.sireCode))}`)}>{String(cow.sireCode)}</Button> : cow.father],
                ['Tên gọi', cow.name],
                ['Mô tả', cow.description],
              ]}
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
          <Panel title="Tóm tắt chăm sóc" gap="gap-3.5" tone="emphasis">
            <Fields
              dark
              cols="grid-cols-2"
              items={[
                ['Cân gần nhất', cow.care.last],
                ['ADG 90 ngày', cow.care.adg],
                ['BCS', cow.care.bcs],
                ['Sức khỏe', cow.care.healthCase],
                ['Sinh sản', cow.care.repro],
                ['Tiêm phòng', <Chip key="v" tone={cow.care.vaccine.tone} icon={cow.care.vaccine.tone === 'err' ? 'alert-triangle' : undefined}>{cow.care.vaccine.label}</Chip>],
                ['Cách ly thịt', cow.withdrawalUntil ? <Chip key="w" tone="warn" icon="alert-triangle">{`Đến ${dmy(String(cow.withdrawalUntil))}`}</Chip> : 'Không'],
              ]}
            />
          </Panel>
          <Panel title="Nhắc việc liên quan" gap="gap-2.5">
            <Table stack={false}>
              <thead>
                <tr>
                  <Th className="w-[190px]">Nhắc việc</Th>
                  <Th className="w-[130px]">Hạn</Th>
                </tr>
              </thead>
              <tbody>
                {cow.care.reminders.map((r) => (
                  <tr key={r.title}>
                    <Td className="font-medium">{r.title}</Td>
                    <Td>{r.due.tone ? <Chip tone={r.due.tone} icon={r.due.tone === 'err' ? 'alert-triangle' : undefined}>{r.due.label}</Chip> : r.due.label}</Td>
                  </tr>
                ))}
                {cow.care.reminders.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="!py-3 !text-[12px] text-muted">Không có nhắc việc.</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Panel>
        </div>
      </div>
      <Foot>
        Hồ sơ cá thể là nguồn duy nhất cho mọi tab chăm sóc; mã bò không đổi, dùng để tra cứu và in thẻ.
      </Foot>
    </div>
  )
}
