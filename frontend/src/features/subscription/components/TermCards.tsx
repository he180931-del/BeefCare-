import { TERMS, fmtVnd, priceFor, termLabel } from '../domain/subscriptionRules'
import { Metric, PANEL_SURFACE } from '../../../shared/ui'
import type { PriceDTO, Term } from '../types'

const CARD = `${PANEL_SURFACE.default} flex flex-col items-start gap-1.5 p-4! text-left`

/**
 * Ba thẻ thời hạn. Có `onSelect` thì chọn được (radio), không thì chỉ hiển thị bảng giá.
 * Số cột theo bề rộng khung chứa, không theo màn hình: ở cột trái hẹp của SCR-58 (1024–1279 px) các thẻ xếp dọc thay vì bị bóp.
 */
export function TermCards({ prices, selected, onSelect }: { prices: PriceDTO | null; selected?: Term | null; onSelect?: (t: Term) => void }) {
  return (
    <div className="@container">
      <div role={onSelect ? 'radiogroup' : undefined} aria-label="Thời hạn" className="grid gap-3 @min-[520px]:grid-cols-3">
        {TERMS.map((t) => {
          const label = `Gói BeefCare · ${termLabel(t)}`
          const value = prices ? fmtVnd(priceFor(prices, t)) : '—'
          const sub = `Tổng tiền cho ${termLabel(t)}`
          if (!onSelect) return <Metric key={t} surface="panel" compact label={label} value={value} sub={sub} />
          const active = selected === t
          return (
            <button key={t} type="button" role="radio" aria-checked={active} disabled={!prices} onClick={() => onSelect(t)}
              className={`${CARD} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-brand! bg-chip!' : 'hover:border-brand'}`}>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span aria-hidden className={`size-3.5 shrink-0 rounded-full border ${active ? 'border-[#454545] bg-[#454545] shadow-[inset_0_0_0_3px_#fff]' : 'border-[#8f8f8f] bg-white'}`} />
                {label}
              </span>
              <span className="wrap-anywhere text-xl font-bold text-ink">{value}</span>
              <span className="text-[11px] text-[#5b6a60]">{sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
