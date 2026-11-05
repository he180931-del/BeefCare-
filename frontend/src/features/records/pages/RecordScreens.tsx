import { useState } from 'react'
import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition } from '../../../app/screenManifest'
import { Button, Field, inputCls, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { RecordHeader } from '../components/RecordHeader'
import { RecordTimeline } from '../components/RecordTimeline'

const events = [
  { date: '2026-11-02', title: 'Ghi nhận cân nặng', detail: 'Cân thực tế 348 kg, BCS 3.25.', by: 'Lê Minh An · Kỹ thuật viên' },
  { date: '2026-10-28', title: 'Tiêm phòng LMLM', detail: 'Mũi nhắc định kỳ, lô vaccine LMLM-2610.', by: 'Trần Quốc Long · Quản lý' },
  { date: '2026-10-20', title: 'Chuyển chuồng', detail: 'Chuyển từ C1 sang A2 sau thời gian cách ly.', by: 'Hệ thống' },
]

const RECORD_PREVIEW_KEY = 'beefcare-record-preview.v1'
const defaultProfile = { name: 'Bò cái 248', note: '' }
type RecordTab = 'overview' | 'growth' | 'health' | 'reproduction' | 'history'

function loadProfile() {
  if (typeof window === 'undefined') return defaultProfile
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECORD_PREVIEW_KEY) || '{}') as Partial<typeof defaultProfile>
    return { name: stored.name?.trim() || defaultProfile.name, note: stored.note || '' }
  } catch {
    return defaultProfile
  }
}

function saveProfile(profile: typeof defaultProfile) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECORD_PREVIEW_KEY, JSON.stringify(profile))
  } catch {
    // Preview remains usable when local browser storage is unavailable.
  }
}

const tabLabels: Array<[RecordTab, string]> = [['overview', 'Tổng quan'], ['growth', 'Tăng trưởng'], ['health', 'Sức khỏe'], ['reproduction', 'Sinh sản'], ['history', 'Lịch sử']]

function DetailTable({ rows }: { rows: Array<[string, string]> }) {
  return <Table><thead><tr><Th>Thông tin</Th><Th>Giá trị</Th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><Td>{label}</Td><Td>{value}</Td></tr>)}</tbody></Table>
}

export function RecordScreen({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Hồ sơ chưa thay đổi. Vui lòng thử lại.</InlineMessage>
  if (state === 'empty') return <EmptyState title="Chưa có lịch sử" description="Các sự kiện mới sẽ xuất hiện tại đây theo thứ tự thời gian." />
  const timeline = ['SCR-28', 'SCR-43', 'SCR-49', 'SCR-54', 'SCR-60', 'SCR-79', 'SCR-80'].includes(screen.id)
  const [profile, setProfile] = useState(loadProfile)
  const [activeTab, setActiveTab] = useState<RecordTab>(timeline ? 'history' : 'overview')
  const [showEditor, setShowEditor] = useState(false)
  const [draftName, setDraftName] = useState(profile.name)
  const [draftNote, setDraftNote] = useState(profile.note)
  const [notice, setNotice] = useState('')
  const sectionTitle = activeTab === 'overview' ? 'Thông tin hồ sơ' : tabLabels.find(([key]) => key === activeTab)![1]
  const openEditor = () => {
    setDraftName(profile.name)
    setDraftNote(profile.note)
    setNotice('')
    setShowEditor(true)
  }
  const saveChanges = () => {
    if (!draftName.trim()) return
    const next = { name: draftName.trim(), note: draftNote.trim() }
    setProfile(next)
    saveProfile(next)
    setShowEditor(false)
    setNotice('Đã lưu thay đổi cục bộ.')
  }
  const content = activeTab === 'history' ? <RecordTimeline events={events} />
    : activeTab === 'growth' ? <DetailTable rows={[['Cân gần nhất', '348 kg · 02/11/2026'], ['BCS', '3,25 · Tốt'], ['Tăng từ lần trước', '+18 kg trong 28 ngày']]} />
      : activeTab === 'health' ? <DetailTable rows={[['Trạng thái', 'Ổn định'], ['Tiêm phòng gần nhất', 'LMLM · 28/10/2026'], ['Lịch chăm sóc', 'Khám thai lại trước 08/11']]} />
        : activeTab === 'reproduction' ? <DetailTable rows={[['Tình trạng', 'Đang mang thai · 5 tháng'], ['Phối giống', 'Thụ tinh nhân tạo · 06/06/2026'], ['Dự kiến sinh', '12/02/2027']]} />
          : <DetailTable rows={[['Ngày sinh', '12/09/2024 · Chính xác'], ['Mục đích nuôi', 'Sinh sản'], ['Cân gần nhất', '348 kg · 02/11/2026'], ['Tình trạng sinh sản', 'Đang mang thai · 5 tháng'], ...(profile.note ? [['Ghi chú nội bộ', profile.note] as [string, string]] : [])]} />
  return <><div className="mb-2 flex justify-end"><FixtureNotice /></div><RecordHeader title={`VN-0248 · ${profile.name}`} code="Mã hồ sơ BC-2026-0248" status="Đang nuôi" meta={['Brahman lai', 'Cái · 26 tháng', 'Chuồng A2', 'Mẹ: VN-0102', 'Bố: Ống tinh BR-771']} readOnly={state === 'read-only'} onUpdate={openEditor} />{notice && <InlineMessage tone="ok" className="mt-4" title={notice}>Thay đổi chỉ được lưu trong trình duyệt ở chế độ xem trước.</InlineMessage>}{showEditor && <WorkSection title="Cập nhật hồ sơ bò" description="Chỉnh tên gọi và ghi chú nội bộ trong bản xem trước."><div className="grid max-w-3xl gap-4 md:grid-cols-2"><Field label="Tên gọi *"><input aria-label="Tên gọi *" className={inputCls} value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} /></Field><Field label="Ghi chú nội bộ"><input aria-label="Ghi chú nội bộ" className={inputCls} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} maxLength={300} /></Field></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="primary" onClick={saveChanges} disabled={!draftName.trim()}>Lưu thay đổi</Button><Button onClick={() => setShowEditor(false)}>Hủy</Button></div></WorkSection>}<nav aria-label="Các phần hồ sơ" className="flex gap-5 overflow-x-auto border-b border-rule pt-4 text-xs font-semibold text-subtle">{tabLabels.map(([key, label]) => <button key={key} type="button" aria-current={activeTab === key ? 'page' : undefined} onClick={() => setActiveTab(key)} className={activeTab === key ? 'border-b-2 border-brand px-1 py-3 text-brand' : 'px-1 py-3'}>{label}</button>)}</nav><div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><WorkSection title={sectionTitle}>{content}</WorkSection><aside className="border-l border-rule pl-5"><h2 className="text-sm font-bold text-ink">Việc cần làm</h2><ul className="space-y-3 p-0 text-xs text-subtle"><li className="list-none border-l-2 border-warn-fg pl-3">Khám thai lại trước 08/11</li><li className="list-none border-l-2 border-brand pl-3">Cân định kỳ trong 6 ngày</li></ul><Button className="mt-3" block onClick={() => setActiveTab('health')}>Xem lịch chăm sóc</Button></aside></div></>
}
