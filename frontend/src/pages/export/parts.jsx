import { Badge, KV, Table, Td, Th, inputCls } from '../../components/ui'
import { money } from '../../data/format'

export const cx = (...c) => c.filter(Boolean).join(' ')
// Khoảng cách giữa các cột 8px như Figma (ghi đè px của Th/Td trong ui.jsx).
export const TH = '!px-1 first:!pl-3 last:!pr-3'

/** Thẻ Figma: viền #bdbdbd, bo 6, padding 16. */
export const Box = ({ title, sub, actions, gap = 'gap-[10px]', className, children }) => (
  <section className={cx('flex flex-col rounded-md border border-edge bg-white p-4', gap, className)}>
    {(title || actions) && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-[#212121]">{title}</h3>
          {sub && <div className="mt-[3px] text-[11px] text-muted">{sub}</div>}
        </div>
        <div className="flex-1" />
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    )}
    {children}
  </section>
)

export const DocRow = ({ ext, name }) => (
  <div className="flex items-center gap-2 text-xs">
    <Badge>{ext}</Badge>
    <span>{name}</span>
    <span className="flex-1" />
    <button type="button" className="cursor-pointer p-1 font-semibold text-brand">Xem</button>
  </div>
)

export const Drop = ({ hint }) => (
  <div className="flex flex-col items-center gap-1 rounded-md border border-field bg-page p-3.5">
    <span className="text-xs font-semibold text-brand">⇪ Kéo thả tệp hoặc Chọn tệp</span>
    <span className="max-w-[240px] text-center text-[11px] text-muted">{hint}</span>
  </div>
)

/** Thẻ "Tóm tắt phiếu xuất": rows = [[nhãn, giá trị]], children = phần thêm dưới danh sách. */
export const SummaryCard = ({ badge, rows, children }) => (
  <Box title="Tóm tắt phiếu xuất" actions={badge}>
    <div className="flex flex-col gap-3">
      {rows.map(([k, v]) => <KV key={k} k={k}>{v}</KV>)}
    </div>
    {children}
  </Box>
)

/** Bảng "Kiểm tra trước khi xác nhận": rows = [[mục, kết quả, lỗi?]]. */
export const CheckList = ({ rows }) => (
  <Table stack={false}>
    <thead>
      <tr><Th className={cx(TH, 'w-[150px]')}>Mục</Th><Th className={TH}>Kết quả</Th></tr>
    </thead>
    <tbody>
      {rows.map(([label, value, bad]) => (
        <tr key={label}>
          <Td className={TH}>{label}</Td>
          <Td className={cx(TH, bad && 'font-medium text-err-fg')}>{value}</Td>
        </tr>
      ))}
    </tbody>
  </Table>
)

export const parseMoney = (s) => Number(String(s).replace(/\D/g, '')) || 0

/** Ô số tiền: hiển thị 60.000.000, gõ số là tự định dạng. suffix = hậu tố "đ". */
export const MoneyInput = ({ value, onChange, suffix, className }) => (
  <div className={cx('relative', className)}>
    <input
      inputMode="numeric"
      value={money(value)}
      onChange={(e) => onChange(parseMoney(e.target.value))}
      className={cx(inputCls, suffix && 'pr-8')}
    />
    {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
  </div>
)
