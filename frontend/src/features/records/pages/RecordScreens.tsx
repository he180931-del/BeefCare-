import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition } from '../../../app/screenManifest'
import { Button, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { RecordHeader } from '../components/RecordHeader'
import { RecordTimeline } from '../components/RecordTimeline'

const events = [
  { date: '2026-11-02', title: 'Ghi nhận cân nặng', detail: 'Cân thực tế 348 kg, BCS 3.25.', by: 'Lê Minh An · Kỹ thuật viên' },
  { date: '2026-10-28', title: 'Tiêm phòng LMLM', detail: 'Mũi nhắc định kỳ, lô vaccine LMLM-2610.', by: 'Trần Quốc Long · Quản lý' },
  { date: '2026-10-20', title: 'Chuyển chuồng', detail: 'Chuyển từ C1 sang A2 sau thời gian cách ly.', by: 'Hệ thống' },
]

export function RecordScreen({ screen, state }: { screen: ScreenDefinition; state: ReviewState }) {
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Hồ sơ chưa thay đổi. Vui lòng thử lại.</InlineMessage>
  if (state === 'empty') return <EmptyState title="Chưa có lịch sử" description="Các sự kiện mới sẽ xuất hiện tại đây theo thứ tự thời gian." />
  const timeline = ['SCR-28', 'SCR-43', 'SCR-49', 'SCR-54', 'SCR-60', 'SCR-79', 'SCR-80'].includes(screen.id)
  return <><div className="mb-2 flex justify-end"><FixtureNotice /></div><RecordHeader title="VN-0248 · Bò cái 248" code="Mã hồ sơ BC-2026-0248" status="Đang nuôi" meta={['Brahman lai', 'Cái · 26 tháng', 'Chuồng A2', 'Mẹ: VN-0102', 'Bố: Ống tinh BR-771']} readOnly={state === 'read-only'} /><nav aria-label="Các phần hồ sơ" className="flex gap-5 overflow-x-auto border-b border-rule pt-4 text-xs font-semibold text-subtle"><button className="border-b-2 border-brand px-1 py-3 text-brand">Tổng quan</button><button className="px-1 py-3">Tăng trưởng</button><button className="px-1 py-3">Sức khỏe</button><button className="px-1 py-3">Sinh sản</button><button className="px-1 py-3">Lịch sử</button></nav><div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><WorkSection title={timeline ? screen.viTitle : 'Thông tin hồ sơ'}>{timeline ? <RecordTimeline events={events} /> : <Table><thead><tr><Th>Thông tin</Th><Th>Giá trị</Th></tr></thead><tbody><tr><Td>Ngày sinh</Td><Td>12/09/2024 · Chính xác</Td></tr><tr><Td>Mục đích nuôi</Td><Td>Sinh sản</Td></tr><tr><Td>Cân gần nhất</Td><Td>348 kg · 02/11/2026</Td></tr><tr><Td>Tình trạng sinh sản</Td><Td>Đang mang thai · 5 tháng</Td></tr></tbody></Table>}</WorkSection><aside className="border-l border-rule pl-5"><h2 className="text-sm font-bold text-ink">Việc cần làm</h2><ul className="space-y-3 p-0 text-xs text-subtle"><li className="list-none border-l-2 border-warn-fg pl-3">Khám thai lại trước 08/11</li><li className="list-none border-l-2 border-brand pl-3">Cân định kỳ trong 6 ngày</li></ul><Button className="mt-3" block>Xem lịch chăm sóc</Button></aside></div></>
}
