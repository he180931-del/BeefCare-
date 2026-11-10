import { useState } from 'react'
import { Button, Card, DateInput, Note, Table, Td, Th, inputCls } from '../../../components/ui'
import { LOOKUP_MAX_DAYS, platformReconciliationApi as api, reconciliationError, type LookupPage } from '../api/platformReconciliationApi'
import { addDays, fmtSeconds, fmtVnd } from '../domain/dates'

interface Props {
  onDone: (message: string) => void
  /** Opens the stored evidence in the review panel (URL evidenceId) and reloads the list and counts. */
  onOpen: (evidenceId: number) => void
}

/** SCR-62 #5 "Look up transaction" (API-03, AF4, D19): by SePay transaction ID or by a period of bank dates. */
export default function SePayLookup({ onDone, onOpen }: Props) {
  const [transactionId, setTransactionId] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [page, setPage] = useState<{ from: string; to: string; data: LookupPage } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function store(id: number) {
    setBusy(true)
    setError(null)
    try {
      const result = await api.lookupById(id)
      onDone(result.duplicate ? `Giao dịch ${id} đã có chứng từ.` : `Đã lưu giao dịch ${id} thành chứng từ.`)
      onOpen(result.evidenceId)
      if (page) setPage({ ...page, data: await api.lookupPeriod(page.from, page.to) })
    } catch (failure) {
      setError(reconciliationError(failure))
    } finally {
      setBusy(false)
    }
  }

  function byId() {
    const raw = transactionId.trim()
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) return setError('Mã giao dịch phải là số nguyên dương.')
    void store(Number(raw))
  }

  async function byPeriod() {
    const { from, to } = range
    if (!from || !to) return setError('Vui lòng nhập ngày bắt đầu và ngày kết thúc.')
    if (from > to) return setError('Ngày bắt đầu không được sau ngày kết thúc.')
    if (to > addDays(from, LOOKUP_MAX_DAYS - 1)) return setError(`Khoảng tra cứu tối đa ${LOOKUP_MAX_DAYS} ngày.`)
    setBusy(true)
    setError(null)
    try {
      setPage({ from, to, data: await api.lookupPeriod(from, to) })
    } catch (failure) {
      setError(reconciliationError(failure))
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="Tra cứu giao dịch SePay" className="mb-4">
    <Card title="Tra cứu giao dịch SePay" sub="Tìm giao dịch webhook chưa gửi tới và lưu thành chứng từ một lần.">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-[220px] max-w-full flex-col gap-1">
            <label htmlFor="sepay-transaction" className="text-xs text-muted">Mã giao dịch SePay</label>
            <input id="sepay-transaction" className={inputCls} inputMode="numeric" aria-label="Mã giao dịch SePay" placeholder="Ví dụ 92704"
              value={transactionId} onChange={(e) => { setTransactionId(e.target.value); setError(null) }} />
          </div>
          <Button disabled={busy} onClick={byId}>Tra cứu theo mã</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-[160px] flex-col gap-1"><label htmlFor="sepay-from" className="text-xs text-muted">Từ ngày</label>
            <DateInput id="sepay-from" label="Tra cứu từ ngày" value={range.from} onChange={(from) => { setRange((v) => ({ ...v, from })); setError(null) }} /></div>
          <div className="flex w-[160px] flex-col gap-1"><label htmlFor="sepay-to" className="text-xs text-muted">Đến ngày</label>
            <DateInput id="sepay-to" label="Tra cứu đến ngày" value={range.to} onChange={(to) => { setRange((v) => ({ ...v, to })); setError(null) }} /></div>
          <Button disabled={busy} onClick={() => void byPeriod()}>Tra cứu theo khoảng ngày</Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p>}
      {page && (page.data.items.length === 0 ? <p className="mt-3 text-sm text-muted">Không có giao dịch trong khoảng ngày đã chọn.</p> : <div className="mt-3">
        {page.data.items.length >= page.data.limit && <Note tone="warn">Chỉ hiển thị {page.data.limit} giao dịch; thu hẹp khoảng ngày để xem đủ.</Note>}
        <Table stack={false}><caption className="sr-only">Giao dịch SePay</caption>
          <thead><tr><Th>Mã giao dịch</Th><Th>Ngân hàng ghi nhận</Th><Th>Số tiền / Chiều</Th><Th>Nội dung</Th><Th>Chứng từ</Th></tr></thead>
          <tbody>{page.data.items.map((row) => <tr key={row.transactionId}>
            <Td>{row.transactionId}</Td><Td>{fmtSeconds(row.bankPaidAt)}</Td>
            <Td>{fmtVnd(row.amount)}<div>{row.direction === 'IN' ? 'Tiền vào' : 'Tiền ra'}</div></Td><Td>{row.content ?? '—'}</Td>
            <Td>{row.evidenceId !== null
              ? <Button aria-label={`Mở chứng từ ${row.transactionId}`} onClick={() => onOpen(row.evidenceId!)}>Mở chứng từ</Button>
              : <Button aria-label={`Lưu thành chứng từ ${row.transactionId}`} disabled={busy} onClick={() => void store(row.transactionId)}>Lưu thành chứng từ</Button>}</Td>
          </tr>)}</tbody>
        </Table>
      </div>)}
    </Card>
  </section>
}
