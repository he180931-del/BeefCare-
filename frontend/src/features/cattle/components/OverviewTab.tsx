import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Icon, type IconName, Table } from '../../../shared/ui'
import { Chip, Collapsible, Fields, Panel, Td, Th } from './parts'
import { PURPOSE_TYPE_LABELS, isFemale } from '../domain/profileRules'
import type { CattleViewModel as CowSeed } from '../types'
import type { Pen } from '../../pen-management'
import { localCattleList } from '../api/cattleApi'
import { PROFILE_REMINDER_LIMIT, type CattleReminder } from '../api/cattleReminders'
import { lifeStageLabel } from '../api/cattleMapper'
import { businessDate } from '../../../shared/lib/date/farmTime'
import BarnsTab, { barnNote } from './BarnsTab'
import QrTab, { qrNote } from './QrTab'
import type { OverviewSection } from './CowHeader'

const ageFull = (cow: CowSeed) => cow.ageLong.replace('tuổi', 'năm')
const dmy = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value ?? '')
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/** SCR-19 #12: "Tên mục đích (loại) · từ ngày"; bỏ phần loại khi trùng tên, ví dụ không viết "Vỗ béo (Vỗ béo)". */
export function purposeLabel(cow: CowSeed): string {
  const type = cow.purposeType ? PURPOSE_TYPE_LABELS[String(cow.purposeType)] ?? String(cow.purposeType) : ''
  const name = type && type.toLowerCase() !== cow.purpose.toLowerCase() ? `${cow.purpose} (${type})` : cow.purpose
  return cow.purposeSince && cow.purposeSince !== '—' ? `${name} · từ ${cow.purposeSince}` : name
}

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

/**
 * Một ô của Tóm tắt chăm sóc (D79): bấm để mở tab chứa số liệu gốc. Không có `onOpen` (bò đực ở ô Sinh sản, hoặc khi
 * dựng riêng trong test) thì chỉ là chữ.
 */
function SummaryCell({ label, value, onOpen }: { label: string; value: ReactNode; onOpen?: () => void }) {
  const body = (
    <>
      <span className="mb-[3px] block text-[11px] text-side-text">{label}</span>
      <span className="block break-words text-[13px] font-medium text-white">{value || '—'}</span>
    </>
  )
  if (!onOpen) return <div className="min-w-0 rounded-xl p-2">{body}</div>
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}: mở tab chi tiết`}
      className="min-w-0 cursor-pointer rounded-xl p-2 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
    >
      {body}
    </button>
  )
}

type ReminderRows = Array<{ id?: string; title: string; detail?: string; due: { label: string; tone?: CattleReminder['due']['tone'] } }>
/** Backend reminders of the cattle (SCR-19 #22); absent in the demo, which keeps cow.care.reminders. */
type RemindersQuery = { data: CattleReminder[] | null; loading: boolean; error: unknown; refetch: () => unknown }

export default function OverviewTab({ cow, barns = {}, canWrite, onOpenModal, reminders, onReviewStage, openSection, onTab }: {
  cow: CowSeed
  barns?: Record<string, Pen>
  canWrite: boolean
  onOpenModal: (name: string) => void
  reminders?: RemindersQuery
  onReviewStage?: (reminder: CattleReminder) => void
  /** D79: khối mở sẵn khi vào từ liên kết cũ ?tab=barns / ?tab=qr. */
  openSection?: OverviewSection
  /** D79: ô Tóm tắt chăm sóc mở tab tương ứng. */
  onTab?: (tab: string) => void
}) {
  const nav = useNavigate()
  const [moreInfo, setMoreInfo] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (openSection) sectionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }, [openSection])

  const reminderRows: ReminderRows = reminders ? (reminders.data ?? []).slice(0, PROFILE_REMINDER_LIMIT) : cow.care.reminders
  // R-05-09: the earliest open REM-08 life-stage suggestion (SCR-19 #13).
  const stageSuggestion = reminders?.data?.find((r) => r.stage)
  const weighDue = reminders ? reminders.data?.find((r) => r.ruleType === 'REM-01')?.due.label : cow.care.reminders.find((r) => r.title.startsWith('Cân'))?.due.label
  const code = encodeURIComponent(cow.code)
  const backend = localCattleList === null
  const entryCode = typeof cow.entryVoucherCode === 'string' ? cow.entryVoucherCode : ''
  const entrySourceText = String(cow.source ?? '').replace(` · ${entryCode}`, '')
  const entryId = typeof cow.entryId === 'number' && Number.isInteger(cow.entryId) && cow.entryId > 0 ? cow.entryId : undefined
  const canEditEntry = canWrite && cow.status === 'ACTIVE' && !cow.exitPending && (backend ? Boolean(entryCode && entryId != null) : Boolean(cow.importRecord))
  const quarantine = cow.entrySource === 'EXTERNAL' && typeof cow.quarantineUntil === 'string' && cow.quarantineUntil >= businessDate()
  const female = isFemale(cow)
  const open = (tab: string) => (onTab ? () => onTab(tab) : undefined)

  // D79: luôn thấy các trường hay hỏi; định danh (đã có ở tiêu đề), nguồn gốc và mô tả nằm sau "Xem thêm".
  const keyFields: Array<readonly [ReactNode, ReactNode]> = [
    ['Giống', cow.breed],
    ['Ngày sinh', [cow.birth, ageFull(cow)].filter((v) => v && v !== '—').join(' · ')],
    ['Mục đích nuôi', purposeLabel(cow)],
    ['Giai đoạn', <span key="stage" className="flex flex-col items-start gap-1">
      {cow.stageSince && cow.stageSince !== '—' ? `${cow.stage} · từ ${cow.stageSince}` : cow.stage}
      {stageSuggestion && (
        <span className="flex flex-wrap items-center gap-1.5 text-[12px] font-normal text-[#296194]">
          {`Gợi ý: chuyển sang ${lifeStageLabel(stageSuggestion.stage)} từ ${stageSuggestion.due.label}`}
          {canWrite && onReviewStage && <Button variant="link" small className="leading-[normal]" onClick={() => onReviewStage(stageSuggestion)}>Xem xét</Button>}
        </span>
      )}
    </span>],
    // Chuồng hiện tại đã có ở tiêu đề và dòng tóm tắt khối Lịch sử chuồng, không lặp lại ở đây.
    ...(quarantine ? [['Cách ly nhập đàn đến', <Chip key="q" tone="warn" icon="alert-triangle">{dmy(String(cow.quarantineUntil))}</Chip>] as const] : []),
  ]
  const moreFields: Array<readonly [ReactNode, ReactNode]> = [
    ['Ảnh bò', cow.photoUrl
      ? <a key="p" href={String(cow.photoUrl)} target="_blank" rel="noreferrer"><img src={String(cow.photoUrl)} alt={`Ảnh ${cow.code}`} className="size-16 rounded-md object-cover" /></a>
      : <span key="p" className="text-muted">Chưa có ảnh</span>],
    ['Mã hiển thị', cow.code],
    ['Số thẻ tai', cow.tag || 'Gắn tai sau'],
    ['Giới tính', cow.sex],
    // FE-05 SCR-22 #10 (DEF-ST-03): the entry voucher code opens the voucher detail (SCR-75).
    ['Nguồn nhập đàn', entryCode ? <span key="src">
      {entrySourceText && entrySourceText !== '—' && entrySourceText !== entryCode ? `${entrySourceText} · ` : ''}
      <Button variant="link" small className="leading-[normal]" onClick={() => nav(`/herd-entry/${encodeURIComponent(entryCode)}`)}>{entryCode}</Button>
    </span> : cow.source],
    ['Mẹ', cow.damCode ? <Button key="dam" variant="link" small className="leading-[normal]" onClick={() => nav(`/cattle/${encodeURIComponent(String(cow.damCode))}`)}>{String(cow.damCode)}</Button> : cow.mother],
    ['Bố', cow.sireCode ? <Button key="sire" variant="link" small className="leading-[normal]" onClick={() => nav(`/cattle/${encodeURIComponent(String(cow.sireCode))}`)}>{String(cow.sireCode)}</Button> : cow.father],
    ['Tên gọi', cow.name],
    ['Mô tả', cow.description],
  ]

  // Bento (Figma Tab 16 ①b): lối tắt ghi nhận 4 cột, nội dung 8+4 (5+3 khi vùng nội dung 880–1.023 px); khối nổi bật là
  // Tóm tắt chăm sóc. Lịch sử chuồng và Thẻ QR là khối gập cuối tab (D79). Đo theo vùng nội dung sau sidebar.
  return (
    <div className="@container flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
      {canWrite && (
        <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-4 @min-[1024px]:gap-6">
          <QuickAction icon="scale" label="Ghi cân & BCS" note={weighDue ? `Lần cân tới ${weighDue}` : 'Cân và chấm thể trạng'} to={`/can-nang/ghi-nhan?cattle=${code}`} />
          <QuickAction icon="vaccine" label="Ghi tiêm" note={cow.care.vaccine.label === '—' ? 'Mũi theo lịch, mũi lẻ' : cow.care.vaccine.label} to={`/tiem-phong/ghi-nhan?cattle=${code}`} />
          <QuickAction icon="stethoscope" label="Ghi bất thường" note="Mở ca, điều trị" to={`/suc-khoe/mo-ca?cattle=${code}`} />
          {cow.sex === 'Cái' && <QuickAction icon="heartbeat" label="Ghi khám thai" note={cow.care.repro} to={`/cattle/${code}?tab=repro`} />}
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
        <div className="flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
          <Panel
            title="Thông tin cá thể"
            gap="gap-3.5"
            action={canEditEntry && <Button variant="link" small className="leading-[normal]" onClick={() => backend ? nav(`/herd-entry/${encodeURIComponent(entryCode)}?m=line&entry=${entryId}`) : onOpenModal('record-edit')}>Sửa / hủy bản ghi nhập đàn</Button>}
          >
            <Fields cols="grid-cols-2 sm:grid-cols-3" items={keyFields} />
            {moreInfo && <Fields cols="grid-cols-2 sm:grid-cols-3" items={moreFields} className="border-t border-edge pt-3.5" />}
            {/* D82, SCR-19 #11: khai báo trước nhập là thông tin tham khảo, sửa qua phiếu nhập ("Sửa / hủy bản ghi nhập đàn"). */}
            {moreInfo && cow.entryDeclarations && (
              <section aria-label="Khai báo khi nhập" className="flex flex-col gap-2 border-t border-edge pt-3.5">
                <h3 className="m-0 text-[11px] font-semibold text-label">Khai báo khi nhập</h3>
                <Fields cols="grid-cols-1 sm:grid-cols-3" items={cow.entryDeclarations.map((row) => [row.label, row.value] as const)} />
              </section>
            )}
            <Button variant="link" small className="self-start leading-[normal]" aria-expanded={moreInfo} onClick={() => setMoreInfo((v) => !v)}>
              {moreInfo ? 'Thu gọn' : 'Xem thêm: định danh, nguồn gốc, bố mẹ'}
            </Button>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
          <Panel title="Tóm tắt chăm sóc" gap="gap-2" tone="emphasis">
            <div className="grid grid-cols-2 gap-1">
              <SummaryCell label="Cân gần nhất" value={cow.care.last} onOpen={open('growth')} />
              <SummaryCell label="ADG 90 ngày" value={cow.care.adg} onOpen={open('growth')} />
              <SummaryCell label="BCS" value={cow.care.bcs} onOpen={open('growth')} />
              <SummaryCell label="Sức khỏe" value={cow.care.healthCase} onOpen={open('health')} />
              <SummaryCell label="Sinh sản" value={female ? cow.care.repro : 'Không áp dụng'} onOpen={female ? open('repro') : undefined} />
              <SummaryCell
                label="Tiêm phòng"
                value={cow.care.vaccine.label === '—' ? '—' : <Chip tone={cow.care.vaccine.tone} icon={cow.care.vaccine.tone === 'err' ? 'alert-triangle' : undefined}>{cow.care.vaccine.label}</Chip>}
                onOpen={open('vaccine')}
              />
              <SummaryCell
                label="Cách ly thịt"
                value={cow.withdrawalUntil ? <Chip tone="warn" icon="alert-triangle">{`Đến ${dmy(String(cow.withdrawalUntil))}`}</Chip> : 'Không'}
                onOpen={open('health')}
              />
            </div>
          </Panel>
          <Panel title="Nhắc việc liên quan" gap="gap-2.5" action={reminders && <Link to="/nhac-viec" className="text-xs font-medium text-brand underline-offset-2 hover:underline">Xem tất cả</Link>}>
            {reminders?.error ? (
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-err-fg" role="alert">
                Không tải được nhắc việc.
                <Button small onClick={() => void reminders.refetch()}>Thử lại</Button>
              </div>
            ) : (
              <Table stack={false}>
                <thead>
                  <tr>
                    <Th className="w-[190px]">Nhắc việc</Th>
                    <Th className="w-[130px]">Hạn</Th>
                  </tr>
                </thead>
                <tbody>
                  {reminderRows.map((r) => (
                    <tr key={r.id ?? r.title}>
                      <Td className="font-medium">{r.title}{r.detail && <span className="block text-[11px] font-normal text-muted">{r.detail}</span>}</Td>
                      <Td>{r.due.tone ? <Chip tone={r.due.tone} icon={r.due.tone === 'err' ? 'alert-triangle' : undefined}>{r.due.label}</Chip> : r.due.label}</Td>
                    </tr>
                  ))}
                  {reminderRows.length === 0 && (
                    <tr>
                      <Td colSpan={2} className="!py-3 !text-[12px] text-muted">{reminders?.loading ? 'Đang tải nhắc việc…' : 'Không có nhắc việc.'}</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      </div>
      <div ref={sectionRef} className={cx('flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6', openSection && 'scroll-mt-4')}>
        <Collapsible key={`barns-${openSection ?? ''}`} title="Lịch sử chuồng" note={barnNote(cow, barns)} defaultOpen={openSection === 'barns'}>
          <BarnsTab cow={cow} barns={barns} canWrite={canWrite} onOpenModal={onOpenModal} />
        </Collapsible>
        <Collapsible key={`qr-${openSection ?? ''}`} title="Thẻ QR" note={qrNote(cow)} defaultOpen={openSection === 'qr'}>
          <QrTab cow={cow} canWrite={canWrite} onOpenModal={onOpenModal} />
        </Collapsible>
      </div>
    </div>
  )
}
