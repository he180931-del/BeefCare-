import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Badge, Card, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, Metric, Note, PageHeader, Segmented, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformServiceApi } from '../api/platformServiceApi'
import EvidencePanel from '../components/EvidencePanel'
import EvidenceTrack from '../components/EvidenceTrack'
import ReconcileDialogs from '../components/ReconcileDialogs'
import { usePmAccess } from '../components/common'
import type { EvidenceFilters, ReviewDecision, ReviewResult } from '../types'
import { fmtDateTime, fmtMoney, fmtShort } from '../domain/dates'
import { MATCH_LABEL, MATCH_TONE, PAYMENT_STATE_LABEL, blockReason, checkAcceptance, evidenceCode, exactCodeMatches, maskTransaction } from '../domain/reconciliation'
import { validateReason } from '../domain/servicePeriods'
import PaymentSourcePage from './PaymentSourcePage'
import { backendMode } from '../../../api/backendTransport'
import PaymentReadPage from './PaymentReadPage'

const TITLE = 'Thanh toán & đối soát'
type Tab = 'evidence' | 'requests'
const PAY_TONE = { PENDING: 'warn', PAID: 'ok', EXPIRED: 'outline' } as const

export default function PaymentReconciliationRoutes() {
  const [params] = useSearchParams()
  if (params.has('paymentId') && params.get('origin') !== 'payments') return <PaymentSourcePage key={params.get('paymentId')} />
  return backendMode === 'backend' ? <PaymentReadPage /> : <ReconciliationPage />
}

function ReconciliationPage() {
  const canAct = usePmAccess()
  const [m, openModal, closeModal] = useModalParam()
  const [tab, setTab] = useState<Tab>('evidence')
  const [status, setStatus] = useState<NonNullable<EvidenceFilters['status']>>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedId, setSelectedId] = useState(842)
  const [decisionState, setDecision] = useState<ReviewDecision | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [chosenId, setChosenId] = useState<number | null>(null)
  const [requestId, setRequestId] = useState<number | null>(null)
  const [accepted, setAccepted] = useState<ReviewResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const filters = useMemo(() => ({ status, bankFrom: from, bankTo: to }), [status, from, to])
  const list = useQuery(() => platformServiceApi.listEvidence(filters), [filters, tick])
  const tiles = useQuery(() => platformServiceApi.paymentTiles(), [tick])
  const payments = useQuery(() => platformServiceApi.listPayments(), [tick])
  const selected = useQuery(() => platformServiceApi.getEvidence(selectedId), [selectedId, tick])
  const candidates = useQuery(() => platformServiceApi.listCandidates(selectedId), [selectedId, tick])

  if ((list.loading && !list.data) || (payments.loading && !payments.data)) return <Layout title={TITLE}><LoadingBlock /></Layout>
  const failure = list.error ?? payments.error ?? tiles.error
  if (failure || !list.data || !payments.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(failure, 'Không tải được dữ liệu đối soát.')} onRetry={() => { list.refetch(); payments.refetch(); tiles.refetch() }} /></Layout>

  const ev = selected.data
  const cands = candidates.data ?? []
  const exact = ev ? exactCodeMatches(ev.content, cands) : []
  const chosen = cands.find((p) => p.id === chosenId)
  const cand = chosen ?? (exact.length === 1 ? exact[0] : cands.length === 1 ? cands[0] : undefined)
  const explicit = !!chosen
  const decision: ReviewDecision = decisionState ?? (cand ? 'ACCEPT' : 'HOLD')
  const toReview = list.data.filter((e) => e.reviewStatus === 'TO_REVIEW' && e.matchResult !== 'EXACT_CODE').length

  const select = (id: number) => { setSelectedId(id); setChosenId(null); setDecision(null); setReason(''); setReasonError(null) }
  const refresh = () => setTick((t) => t + 1)

  function primary() {
    const err = validateReason(reason, 'Lý do & bằng chứng', 1000)
    setReasonError(err)
    if (err || !ev) return
    if (decision === 'HOLD') openModal('hold')
    else if (decision === 'REJECT') openModal('reject')
    else openModal(cand && ev && !blockReason(checkAcceptance(ev, cand, explicit)) ? 'accept' : 'blocked')
  }

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub="Chứng từ ngân hàng chưa khớp luôn được giữ lại để xem xét – mọi quyết định cần lý do và bằng chứng" />
      {message ? <Note tone="ok">{message}</Note> : null}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Chứng từ chưa khớp" value={String(tiles.data?.unmatched ?? '—')} note="cần xem xét" warn />
        <Metric label="Yêu cầu chờ thanh toán" value={String(tiles.data?.pendingRequests ?? '—')} note="Hết hạn sau 24 giờ" />
        <Metric label="Đang tạm giữ" value={String(tiles.data?.hold ?? '—')} note="Chờ xác minh" />
        <Metric label="Đã khóa chờ hoàn" value={String(tiles.data?.lockedForReturn ?? '—')} note="Hoàn tiền ngoài hệ thống" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={(v) => setTab(v as Tab)} options={[{ value: 'evidence', label: 'Chứng từ ngân hàng' }, { value: 'requests', label: 'Yêu cầu thanh toán' }]} />
        {tab === 'evidence' ? (
          <>
            <FilterSelect aria-label="Trạng thái xem xét" value={status} onChange={(e) => setStatus(e.target.value as NonNullable<EvidenceFilters['status']>)}>
              <option value="">Trạng thái xem xét: Tất cả</option>
              <option value="TO_REVIEW">Chưa xử lý</option>
              <option value="HOLD">Tạm giữ</option>
              <option value="REJECTED">Từ chối</option>
              <option value="ACCEPTED">Đã chấp nhận</option>
              <option value="LOCKED">Đã khóa chờ hoàn</option>
            </FilterSelect>
            <label className="flex items-center gap-2 text-[12px] text-muted">Ngày từ <span className="w-[160px]"><DateInput id="bank-from" value={from} onChange={setFrom} /></span></label>
            <label className="flex items-center gap-2 text-[12px] text-muted">đến <span className="w-[160px]"><DateInput id="bank-to" value={to} onChange={setTo} /></span></label>
          </>
        ) : null}
      </div>

      {tab === 'requests' ? (
        <Card>
          {payments.data.length === 0 ? <EmptyBlock title="Chưa có yêu cầu thanh toán" /> : (
            <Table wide>
              <thead><tr><Th>Mã</Th><Th>Trang trại</Th><Th>Thời hạn</Th><Th>Số tiền</Th><Th>Tạo lúc</Th><Th>Hết hạn</Th><Th>Trạng thái</Th><Th>Chứng từ</Th></tr></thead>
              <tbody>
                {payments.data.map((p) => (
                  <tr key={p.id}>
                    <Td><button type="button" className="font-medium text-brand" onClick={() => { setRequestId(p.id); openModal('request') }}>{p.code}</button></Td>
                    <Td>{p.farmName}</Td>
                    <Td>{p.termYears} năm</Td>
                    <Td>{fmtMoney(p.amount)}</Td>
                    <Td>{fmtDateTime(p.createdAt)}</Td>
                    <Td>{fmtDateTime(p.expiresAt)}</Td>
                    <Td><Badge tone={PAY_TONE[p.state]}>{PAYMENT_STATE_LABEL[p.state]}</Badge></Td>
                    <Td>{p.evidenceId ? evidenceCode(p.evidenceId) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_456px]">
          <div className="grid content-start gap-4">
            <Card>
              {list.data.length === 0 ? <EmptyBlock title="Không có chứng từ phù hợp" sub="Thử đổi trạng thái hoặc khoảng ngày." /> : (
                <Table stack={false}>
                  <thead><tr><Th>Giao dịch</Th><Th>Số tiền</Th><Th>Nội dung CK</Th><Th>Ngân hàng ghi</Th><Th>Khớp</Th></tr></thead>
                  <tbody>
                    {list.data.map((e) => (
                      <tr key={e.id} aria-selected={e.id === selectedId} className={`cursor-pointer ${e.id === selectedId ? 'bg-[#eef4ef]' : ''}`} onClick={() => select(e.id)}>
                        <Td><button type="button" className="whitespace-nowrap font-semibold text-brand" onClick={() => select(e.id)}>{maskTransaction(e.transactionId)}</button></Td>
                        <Td><span className="whitespace-nowrap">{fmtMoney(e.amount)}</span></Td>
                        <Td>{e.content}</Td>
                        <Td>{fmtShort(e.bankPaidAt)}</Td>
                        <Td><Badge tone={MATCH_TONE[e.matchResult]}>{MATCH_LABEL[e.matchResult]}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <div className="px-4 py-3 text-[12px] text-muted">{list.data.length} chứng từ · {toReview} cần xem xét</div>
            </Card>
          </div>
          {ev ? (
            <EvidencePanel
              ev={ev} cand={cand} decision={decision} setDecision={setDecision} reason={reason} setReason={setReason} reasonError={reasonError} canAct={canAct}
              onPrimary={primary} onLock={() => openModal('lock')} onLocked={() => openModal('locked')}
            />
          ) : <LoadingBlock />}
          {ev ? (
            <div className="xl:col-span-2">
              <EvidenceTrack ev={ev} candidates={cands} cand={cand} explicit={explicit} payments={payments.data} canAct={canAct} onChoose={setChosenId} onPick={() => openModal('pick')} onHistory={() => openModal('history')} />
            </div>
          ) : null}
        </div>
      )}
      <Foot>Thanh toán & đối soát (PM). Bảng trái liệt kê chứng từ ngân hàng theo ngày; chọn một dòng để xem xét ở khung phải. "Chấp nhận" chỉ mở khi mã, số tiền, tài khoản và thời gian đều khớp; các quyết định khác cần lý do và bằng chứng. Khung dưới theo dõi ứng viên và lịch sử xử lý của chứng từ.</Foot>
      {ev && m ? (
        <ReconcileDialogs
          m={m}
          c={{
            ev, cand, explicit, candidates: cands, payments: payments.data, requestId, reason, setReason, accepted, setAccepted, setChosenId,
            open: openModal, close: () => { closeModal(); refresh() },
            saved: (text) => { setMessage(text); setReason(''); closeModal(); refresh() },
            showEvidence: (id) => {
              setTab('evidence'); closeModal()
              if (id !== null) {
                const target = (list.data ?? []).find((e) => e.paymentId === null && exactCodeMatches(e.content, payments.data?.filter((p) => p.id === id) ?? []).length === 1) ?? (list.data ?? []).find((e) => e.reviewStatus === 'TO_REVIEW')
                if (target) select(target.id)
              }
            },
          }}
        />
      ) : null}
    </Layout>
  )
}
