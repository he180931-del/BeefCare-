import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, Radio, Segmented, Table, Td, Th } from '../../../components/ui'
import type { Evidence, PlatformPayment } from '../types'
import { fmtDateTime, fmtMoney, fmtSeconds, fmtShort } from '../domain/dates'
import { candidateSummary, checkAcceptance, evidenceCode } from '../domain/reconciliation'

type Tab = 'candidates' | 'history' | 'checks'

/** Khung "Theo dõi chứng từ": ứng viên, lịch sử xử lý và kiểm tra chấp nhận. */
export default function EvidenceTrack({ ev, candidates, cand, explicit, payments, onChoose, onPick, onHistory, canAct }: {
  ev: Evidence
  candidates: PlatformPayment[]
  cand: PlatformPayment | undefined
  explicit: boolean
  payments: PlatformPayment[]
  onChoose: (id: number) => void
  onPick: () => void
  onHistory: () => void
  canAct: boolean
}) {
  const [tab, setTab] = useState<Tab>('candidates')
  const checks = cand ? checkAcceptance(ev, cand, explicit) : []
  const allocated = payments.find((p) => p.id === ev.paymentId)
  return (
    <Card
      title={`Theo dõi chứng từ ${ev.transactionId}`}
      sub={`Ngân hàng trả tiền ${fmtDateTime(ev.bankPaidAt)} · hệ thống nhận lần đầu ${ev.receivedAt.slice(11, 19)} · ${allocated ? 'đã xác nhận' : 'chưa xác nhận'}`}
      actions={
        <Segmented value={tab} onChange={(v) => setTab(v as Tab)} options={[{ value: 'candidates', label: 'Chọn yêu cầu ứng viên' }, { value: 'history', label: 'Lịch sử xử lý' }, { value: 'checks', label: 'Kiểm tra chấp nhận' }]} />
      }
    >
      {tab === 'candidates' ? (
        candidates.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">{allocated ? `Đã phân bổ cho ${allocated.code}.` : 'Không có yêu cầu ứng viên được phép cho chứng từ này.'}</p>
        ) : (
          <Table stack={false} bordered>
            <thead><tr><Th>Chọn</Th><Th>Yêu cầu</Th><Th>Trang trại</Th><Th>Số tiền</Th><Th>Hạn thanh toán</Th><Th>Kiểm tra</Th></tr></thead>
            <tbody>
              {candidates.map((p) => {
                const s = candidateSummary(checkAcceptance(ev, p, false))
                return (
                  <tr key={p.id}>
                    <Td><Radio name="candidate" checked={cand?.id === p.id && explicit} onChange={() => onChoose(p.id)}>{' '}</Radio></Td>
                    <Td><span className="font-medium text-ink">{p.code}</span></Td>
                    <Td>{p.farmName}</Td>
                    <Td>{fmtMoney(p.amount)}</Td>
                    <Td>{fmtShort(p.expiresAt)}</Td>
                    <Td><Badge tone={s.ok ? 'ok' : 'warn'}>{s.text}</Badge></Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )
      ) : null}
      {tab === 'history' ? (
        <ul className="grid gap-2 text-[13px]">
          <li className="text-muted">{fmtSeconds(ev.receivedAt)} · Hệ thống nhận chứng từ ({ev.deliveries})</li>
          {ev.history.map((h) => <li key={h.at + h.text}><span className="text-muted">{fmtSeconds(h.at)} · {h.by}</span> · {h.text}</li>)}
          {ev.history.length === 0 ? <li className="text-muted">Chưa có quyết định nào.</li> : null}
        </ul>
      ) : null}
      {tab === 'checks' ? (
        checks.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">Chọn một yêu cầu ứng viên để xem các điều kiện chấp nhận.</p>
        ) : (
          <ul className="grid gap-1 text-[13px]">
            {checks.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                <Icon name={c.ok ? 'circle-check' : 'circle-x'} size={16} className={c.ok ? 'text-ok-fg' : 'text-err-fg'} />
                <span className="font-medium text-ink">{c.label}</span><span className="text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span>{allocated ? `Đã phân bổ cho ${allocated.code}.` : 'Chưa phân bổ cho thanh toán nào.'} Nguồn {ev.provider} / {ev.environment} / {ev.accountNamespace} chỉ đọc.</span>
        <span className="flex gap-2">
          <Button size="sm" disabled={!canAct || ev.paymentId !== null || ev.lockedForReturn} onClick={onPick}>Chọn yêu cầu để xem xét</Button>
          <Button size="sm" onClick={onHistory}>Lịch sử {evidenceCode(ev.id)}</Button>
        </span>
      </div>
    </Card>
  )
}
