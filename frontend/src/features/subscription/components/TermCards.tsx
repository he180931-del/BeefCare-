import { TERMS, fmtVnd, priceFor, termLabel } from '../domain/subscriptionRules'
import type { PriceDTO, Term } from '../types'

const CARD = 'flex min-w-0 flex-col items-start gap-1.5 rounded-md border p-4 text-left'

/** Ba thẻ thời hạn. Có `onSelect` thì chọn được (radio), không thì chỉ hiển thị bảng giá. */
export function TermCards({ prices, selected, onSelect }: { prices: PriceDTO | null; selected?: Term | null; onSelect?: (t: Term) => void }) {
  return (
    <div role={onSelect ? 'radiogroup' : undefined} aria-label="Thời hạn" className="grid gap-3 sm:grid-cols-3">
      {TERMS.map((t) => {
        const active = selected === t
        const body = (
          <>
            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              {onSelect && <span aria-hidden className={`size-3.5 shrink-0 rounded-full border ${active ? 'border-[#454545] bg-[#454545] shadow-[inset_0_0_0_3px_#fff]' : 'border-[#8f8f8f] bg-white'}`} />}
              Gói BeefCare · {termLabel(t)}
            </span>
            <span className="text-xl font-bold text-ink">{prices ? fmtVnd(priceFor(prices, t)) : '—'}</span>
            <span className="text-[11px] text-muted">Tổng tiền cho {termLabel(t)}</span>
          </>
        )
        return onSelect ? (
          <button key={t} type="button" role="radio" aria-checked={active} disabled={!prices} onClick={() => onSelect(t)}
            className={`${CARD} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-[#454545] bg-chip' : 'border-edge bg-white hover:border-[#8f8f8f]'}`}>
            {body}
          </button>
        ) : (
          <div key={t} className={`${CARD} border-edge bg-white`}>{body}</div>
        )
      })}
    </div>
  )
}
