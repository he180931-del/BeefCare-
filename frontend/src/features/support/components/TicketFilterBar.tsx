import { DateInput, FilterSelect, SearchInput } from '../../../components/ui'
import { TICKET_CATEGORIES } from '../domain/ticketRules'
import type { TicketCategory, TicketFilters } from '../types'

export function TicketFilterBar({ filters, onChange }: { filters: TicketFilters; onChange: (patch: Partial<TicketFilters>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-full sm:w-[300px]">
        <SearchInput aria-label="Tìm mã hoặc tiêu đề" placeholder="Tìm mã / tiêu đề" value={filters.q ?? ''} onChange={(e) => onChange({ q: e.target.value })} />
      </div>
      <FilterSelect aria-label="Danh mục" value={filters.category ?? ''} onChange={(e) => onChange({ category: e.target.value as TicketCategory | '' })}>
        <option value="">Danh mục: Tất cả</option>
        {TICKET_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            Danh mục: {c.label}
          </option>
        ))}
      </FilterSelect>
      <div className="flex items-center gap-2">
        <label htmlFor="tk-from" className="sr-only">
          Cập nhật từ ngày
        </label>
        <DateInput id="tk-from" value={filters.from ?? ''} onChange={(from) => onChange({ from })} />
        <span aria-hidden className="text-muted">
          –
        </span>
        <label htmlFor="tk-to" className="sr-only">
          Cập nhật đến ngày
        </label>
        <DateInput id="tk-to" value={filters.to ?? ''} onChange={(to) => onChange({ to })} />
      </div>
    </div>
  )
}
