import type { ReactNode } from 'react'
import { EmptyBlock, ErrorBlock, LoadingBlock, Panel, SearchInput, Select } from '../../../shared/ui'
import { catalogueError } from '../api/catalogueError'
import type { AvailabilityFilter } from '../types'

interface Props {
  q: string
  onQ: (value: string) => void
  status: AvailabilityFilter
  onStatus: (value: AvailabilityFilter) => void
  rows: unknown[] | null | undefined
  error: unknown
  onRetry: () => void
  errorText: string
  emptyTitle: string
  children: ReactNode
}

/** Thẻ danh sách: ô tìm, lọc trạng thái, rồi bảng hoặc trạng thái tải / lỗi / trống. */
export function CatalogueList({ q, onQ, status, onStatus, rows, error, onRetry, errorText, emptyTitle, children }: Props) {
  let body: ReactNode = children
  if (error) body = <ErrorBlock message={catalogueError(error, errorText)} onRetry={onRetry} />
  else if (!rows) body = <LoadingBlock />
  else if (rows.length === 0) body = <EmptyBlock title={emptyTitle} sub="Thử đổi từ khóa hoặc bộ lọc trạng thái." />
  return (
    <Panel>
      <div className="flex flex-wrap gap-2.5">
        <SearchInput className="min-w-0 flex-1 sm:max-w-[300px]" placeholder="Tìm mã, tên…" aria-label="Tìm mã, tên" value={q} onChange={(e) => onQ(e.target.value)} />
        <Select className="w-full sm:w-[220px]" aria-label="Lọc theo trạng thái" value={status} onChange={(e) => onStatus(e.target.value as AvailabilityFilter)}>
          <option value="">Trạng thái: Tất cả</option>
          <option value="ACTIVE">Trạng thái: Đang dùng</option>
          <option value="INACTIVE">Trạng thái: Ngừng dùng</option>
        </Select>
      </div>
      {body}
    </Panel>
  )
}

/** Dòng bảng chọn được; dòng ngừng dùng mờ đi như trong Figma. */
export function SelectableRow({ selected, muted, onSelect, children }: { selected: boolean; muted?: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`cursor-pointer outline-none focus-visible:bg-chip ${selected ? 'bg-[#eef4ef]' : 'hover:bg-page'} ${muted ? 'text-faint' : ''}`}
    >
      {children}
    </tr>
  )
}
