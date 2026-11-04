import type { ReviewState } from '../../../app/fixtureSession'
import type { ScreenDefinition, ScreenRole } from '../../../app/screenManifest'
import { Button, inputCls, PageHeader, Table, Td, Th } from '../../../components/ui'
import { EmptyState, FilterBar, FixtureNotice, InlineMessage, LoadingState, WorkSection } from '../../../components/workspace'
import { configForFeature } from '../data/operationalFixtures'

export function OperationalScreen({ screen, state, role }: { screen: ScreenDefinition; state: ReviewState; role: Exclude<ScreenRole, 'guest'> }) {
  const config = configForFeature(screen.feature)
  if (state === 'loading') return <LoadingState label={`Đang tải ${screen.viTitle.toLowerCase()}…`} rows={6} />
  if (state === 'error') return <InlineMessage tone="err" title={`Không thể tải ${screen.viTitle.toLowerCase()}.`}>Dữ liệu công việc chưa được cập nhật. Hãy thử tải lại.</InlineMessage>
  const canWrite = state !== 'read-only' && !(role === 'manager' && screen.feature === 'herd-exit')
  return <><PageHeader title={screen.viTitle} sub="Theo dõi công việc theo trạng thái, thời hạn và đối tượng." badge={<FixtureNotice />}>{canWrite && state !== 'empty' && <Button variant="primary">{config.primaryAction}</Button>}</PageHeader><WorkSection title="Danh sách" description="Lọc nhanh trước khi mở từng hồ sơ; không cần chuyển sang màn hình trung gian."><FilterBar><form role="search" className="flex min-w-0 flex-1 flex-wrap gap-2"><input aria-label="Tìm kiếm" className={`${inputCls} min-w-52 flex-1`} placeholder="Tìm theo mã, tên bò hoặc nội dung…" /><select aria-label="Trạng thái" className={`${inputCls} w-44`}><option>Tất cả trạng thái</option><option>Đang xử lý</option><option>Đã hoàn tất</option></select><input aria-label="Từ ngày" type="date" className={`${inputCls} w-40`} /></form></FilterBar>{state === 'empty' ? <EmptyState title={config.emptyTitle} description="Thử thay đổi bộ lọc hoặc tạo bản ghi đầu tiên." actionLabel={config.primaryAction} onAction={() => undefined} compact /> : <Table><thead><tr>{config.columns.map((column) => <Th key={column}>{column}</Th>)}</tr></thead><tbody>{config.rows.map((row) => <tr key={row.code}><Td>{row.code}</Td><Td><strong>{row.subject}</strong><div className="mt-1 text-[11px] text-subtle">{row.detail}</div></Td><Td>{row.date}</Td><Td><span className="font-medium text-brand">{row.status}</span></Td></tr>)}</tbody></Table>}</WorkSection></>
}
