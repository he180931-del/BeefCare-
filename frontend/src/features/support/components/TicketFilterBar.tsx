import { DateInput, FilterSelect, SearchInput } from '../../../shared/ui'
import { TICKET_CATEGORIES } from '../domain/ticketRules'
import type { TicketCategory, TicketFilters } from '../types'

export function TicketFilterBar({ filters, onChange }: { filters: TicketFilters; onChange: (patch: Partial<TicketFilters>) => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="min-w-0 w-full @min-[880px]:w-[300px]">
        <SearchInput aria-label="Tìm mã hoặc tiêu đề" placeholder="Tìm mã / tiêu đề" value={filters.q ?? ''} onChange={(e) => onChange({ q: e.target.value })} />
      </div>
      <FilterSelect size="lg" className="w-full @min-[640px]:w-[190px]" aria-label="Danh mục" value={filters.category ?? ''} onChange={(e) => onChange({ category: e.target.value as TicketCategory | '' })}>
        <option value="">Danh mục: Tất cả</option>
        {TICKET_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            Danh mục: {c.label}
          </option>
        ))}
      </FilterSelect>
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 @min-[640px]:w-auto">
        <label htmlFor="tk-from" className="sr-only">
          Cập nhật từ ngày
        </label>
        <DateInput className="min-w-0 rounded-xl focus-within:ring-2 focus-within:ring-brand" id="tk-from" value={filters.from ?? ''} onChange={(from) => onChange({ from })} />
        <span aria-hidden className="text-muted">
          –
        </span>
        <label htmlFor="tk-to" className="sr-only">
          Cập nhật đến ngày
        </label>
        <DateInput className="min-w-0 rounded-xl focus-within:ring-2 focus-within:ring-brand" id="tk-to" value={filters.to ?? ''} onChange={(to) => onChange({ to })} />
      </div>
    </div>
  )
}
