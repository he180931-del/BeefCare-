import { money } from '../../../shared/lib/format'
import { ageOf } from '../domain/entryCow'
import { lineAmount } from '../domain/entryTotals'
import type { EntryCow } from '../types'
import { GhostSelect } from './parts'

const cell = 'px-2 py-2 text-left text-xs'
type Props = {
  cows: EntryCow[]
  pricing: 'kg' | 'con'
  date: string
  barnOptions: Array<{ value: string; label: string }>
  warningsByLine: Record<number, string[]>
  onPenChange: (index: number, code: string) => void
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}

export default function PurchaseEntryLines({ cows, pricing, date, barnOptions, warningsByLine, onPenChange, onEdit, onRemove }: Props) {
  if (!cows.length) return <p className="m-0 rounded-lg border border-dashed border-field p-4 text-sm text-muted">Chưa có con nào. Bấm “Thêm con” hoặc “Nhập từ Excel”.</p>
  const total = cows.reduce((sum, cow) => sum + lineAmount(cow, pricing), 0)
  return <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[760px] border-collapse">
    <thead><tr>{['#', 'Thẻ tai', 'Giống · giới tính · giai đoạn', 'Tuổi', 'Cân nặng', 'Chuồng nhận', `Đơn giá (${pricing === 'con' ? 'đ/con' : 'đ/kg'})`, 'Thành tiền (đ)', ''].map((label, index) => <th key={index} className={`${cell} sticky top-0 bg-page font-semibold ${index === 0 ? 'left-0 z-20 w-8 min-w-8' : index === 1 ? 'left-8 z-20' : ''}`}>{label}</th>)}</tr></thead>
    <tbody>{cows.map((cow, index) => <tr key={index} className="border-t border-field">
      <td className={`${cell} sticky left-0 z-10 w-8 min-w-8 bg-white tabular-nums`}>{index + 1}</td>
      <td className={`${cell} sticky left-8 z-10 bg-white`}>{cow.tag || <span className="text-muted">Gắn sau</span>}</td>
      <td className={cell}>{`${cow.breed || '—'} · ${cow.sex || '—'} · ${cow.stage || '—'}`}</td>
      <td className={`${cell} whitespace-nowrap`}>{cow.dob && cow.dobAccuracy !== 'UNKNOWN' ? `~${ageOf(cow.dob, date)} th` : '—'}</td>
      <td className={`${cell} whitespace-nowrap tabular-nums`}>{`${money(cow.weight)} kg${cow.estimated ? ' UT' : ''}`}</td>
      <td className={cell}><GhostSelect value={cow.barn} onChange={(code) => onPenChange(index, code)} options={barnOptions} /></td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{money(cow.unitPrice ?? 0)}</td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{money(lineAmount(cow, pricing))}</td>
      <td className={`${cell} whitespace-nowrap`}>
        {(warningsByLine[index] ?? []).length > 0 && <span title={(warningsByLine[index] ?? []).join(' ')} aria-label={`Cảnh báo con #${index + 1}: ${(warningsByLine[index] ?? []).join(' ')}`} className="mr-1 text-err-fg">⚠</span>}
        <button type="button" aria-label={`Sửa con #${index + 1}`} className="mr-2 text-muted" onClick={() => onEdit(index)}>Sửa</button>
        <button type="button" aria-label={`Xóa con #${index + 1}`} className="text-err-fg" onClick={() => onRemove(index)}>Xóa</button>
      </td>
    </tr>)}</tbody>
    <tfoot><tr className="border-t-2 border-field font-semibold"><td className={`${cell} sticky left-0 z-10 w-8 min-w-8 bg-white`} colSpan={7}>Tổng ({cows.length} con)</td><td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{money(total)} đ</td><td className={cell} /></tr></tfoot>
  </table><p className="m-0 px-2 py-1 text-xs text-muted">UT = cân ước tính (từ Excel).</p></div>
}
