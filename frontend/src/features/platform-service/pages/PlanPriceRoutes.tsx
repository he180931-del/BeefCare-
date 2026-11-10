import { useEffect, useRef, useState } from 'react'
import Layout from '../../../components/Layout'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Field, Foot, LoadingBlock, Note, PageHeader, Radio, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { BackendError } from '../../../api/backendClient'
import { planPriceApi, priceError, type PlanPrice, type PublishPrice } from '../api/planPriceApi'
import { usePmAccess } from '../components/common'
import { fmtDateTime, fmtMoney, fmtSeconds } from '../domain/dates'
import { parseVnd, PRICE_ERROR, validPrice } from '../domain/pricing'
import type { PriceDraft, PriceStatus } from '../types'

const TITLE = 'Bảng giá gói'
const DISCARD = 'Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này không?'
const STATUS: Record<PriceStatus, { label: string; tone: 'ok' | 'info' | 'outline' | 'err' }> = {
  EFFECTIVE: { label: 'Đang hiệu lực', tone: 'ok' }, SCHEDULED: { label: 'Lên lịch', tone: 'info' }, SUPERSEDED: { label: 'Hết hiệu lực', tone: 'outline' }, WITHDRAWN: { label: 'Đã rút lại', tone: 'err' },
}
function initial(p: PlanPrice | null): PriceDraft { return { price1y: p ? fmtMoney(p.price1y) : '', price2y: p ? fmtMoney(p.price2y) : '', price3y: p ? fmtMoney(p.price3y) : '', mode: 'NOW', effectiveAt: '', terms: p?.terms ?? '' } }
/** One key per command intent: retries of the same body reuse it; a success ends it, so an identical later command is new. */
function useIntentKey() {
  const intent = useRef({ body: '', key: '' })
  return {
    keyFor(body: unknown) {
      const serialized = JSON.stringify(body)
      if (serialized !== intent.current.body) intent.current = { body: serialized, key: crypto.randomUUID() }
      return intent.current.key
    },
    complete() { intent.current = { body: '', key: '' } },
  }
}
/** Same rule as the server: trimmed reason, at least 5 non-space code points, at most 1,000 characters. */
const REASON_ERROR = 'Lý do phải có ít nhất 5 ký tự không phải khoảng trắng và tối đa 1.000 ký tự.'
function WithdrawDialog({ version, onClose, onDone, onStale }: { version: PlanPrice; onClose: () => void; onDone: () => void; onStale: () => void }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const sending = useRef(false); const keys = useIntentKey()
  function close() { if (!sending.current && (!reason || window.confirm(DISCARD))) onClose() }
  async function withdraw() {
    if (sending.current) return
    const value = reason.trim()
    if (!value) { setError('Vui lòng nhập lý do.'); return }
    if (Array.from(value.replace(/\s/g, '')).length < 5) { setError('Lý do phải có ít nhất 5 ký tự không phải khoảng trắng.'); return }
    if (value.length > 1000) { setError('Lý do tối đa 1.000 ký tự.'); return }
    const body = { id: version.id, reason: value, expectedVersion: version.revision }
    sending.current = true; setBusy(true); setError(null)
    try { await planPriceApi.withdraw(version.id, value, version.revision, keys.keyFor(body)); keys.complete(); onDone() }
    catch (e) {
      setError(e instanceof BackendError && e.code === 'MSG-COM-10' && e.params.field === 'reason' ? REASON_ERROR : priceError(e, 'rút phiên bản'))
      if (e instanceof BackendError && e.code === 'MSG-COM-05') onStale()
    }
    finally { sending.current = false; setBusy(false) }
  }
  return <Modal title={`Rút lại bảng giá v${version.id}`} topTitle={TITLE} width={640} onClose={close}>
    <p className="mb-3 text-sm text-muted">Hiệu lực từ {fmtSeconds(version.effectiveAt)}. Chỉ rút được trước thời điểm này.</p>
    <Field label="Lý do *" id="withdraw-reason"><textarea id="withdraw-reason" className={inputCls} rows={4} value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setError(null) }} /></Field>
    {error ? <p role="alert" className="mt-2 text-sm text-err-fg">{error}</p> : null}
    <ModalFooter><ModalButton disabled={busy} onClick={close}>Hủy</ModalButton><ModalButton variant="danger" disabled={busy} onClick={withdraw}>Rút lại phiên bản</ModalButton></ModalFooter>
  </Modal>
}

export default function PlanPriceRoutes() {
  const canAct = usePmAccess()
  const [page, setPage] = useState(() => { try { const p = Number(sessionStorage.getItem('beefcare:plan-price-page')); return Number.isSafeInteger(p) && p >= 0 && p <= 107374182 ? p : 0 } catch { return 0 } })
  const [tick, setTick] = useState(0)
  const receivedAt = useRef(Date.now())
  const query = useQuery(async () => { const value = await planPriceApi.list(page); receivedAt.current = Date.now(); return value }, [page, tick])
  const [draft, setDraft] = useState<PriceDraft | null>(null); const baseline = useRef('')
  const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<keyof PriceDraft | null>(null)
  const [confirming, setConfirming] = useState(false); const [withdrawing, setWithdrawing] = useState<PlanPrice | null>(null)
  const [busy, setBusy] = useState(false); const sending = useRef(false); const keys = useIntentKey()
  const data = query.data
  const dirty = draft !== null && JSON.stringify(draft) !== baseline.current
  const refresh = () => setTick(t => t + 1)
  useEffect(() => { try { sessionStorage.setItem('beefcare:plan-price-page', String(page)) } catch { /* session storage is optional */ } }, [page])
  useEffect(() => { if (data && draft === null) { const d = initial(data.current); setDraft(d); baseline.current = JSON.stringify(d) } }, [data, draft])
  useEffect(() => {
    if (data && data.total > 0 && page * data.size >= data.total) setPage(Math.max(0, Math.ceil(data.total / data.size) - 1))
  }, [data, page])
  useEffect(() => {
    if (!data?.nextEffectiveAt) return
    const delay = Date.parse(data.nextEffectiveAt) - Date.parse(data.asOf) - (Date.now() - receivedAt.current) + 25
    const target = Date.now() + Math.max(25, delay)
    let timer: number
    const arm = () => {
      const remaining = target - Date.now()
      if (remaining <= 0) { refresh(); return }
      // Chaining timer chunks also supports schedules beyond the browser's 24.8-day timer limit, without HTTP polling.
      timer = window.setTimeout(arm, Math.min(2147483647, remaining))
    }
    arm(); return () => window.clearTimeout(timer)
  }, [data])
  useEffect(() => {
    if (!dirty) return
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const navigate = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') as HTMLAnchorElement | null : null
      if (link && new URL(link.href).pathname !== window.location.pathname && !window.confirm(DISCARD)) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true) }
  }, [dirty])
  function set(patch: Partial<PriceDraft>) { if (draft) setDraft({ ...draft, ...patch }); setError(null); setErrorField(null) }
  function reset() { if (!dirty || window.confirm(DISCARD)) { const d = initial(data?.current ?? null); setDraft(d); baseline.current = JSON.stringify(d); setError(null); setErrorField(null) } }
  function invalid(message: string, field: keyof PriceDraft): null { setError(message); setErrorField(field); return null }
  function payload(): PublishPrice | null {
    if (!draft) return null
    const prices = [draft.price1y, draft.price2y, draft.price3y].map(parseVnd)
    const badPrice = prices.findIndex(p => !validPrice(p))
    if (badPrice >= 0) return invalid(PRICE_ERROR, (['price1y', 'price2y', 'price3y'] as const)[badPrice])
    if (draft.terms.trim().length > 500) return invalid('Mô tả điều khoản tối đa 500 ký tự.', 'terms')
    let at: string | null = null
    if (draft.mode === 'SCHEDULE') {
      if (!draft.effectiveAt) return invalid('Vui lòng nhập thời điểm hiệu lực.', 'effectiveAt')
      const parsed = Date.parse(`${draft.effectiveAt.length === 16 ? `${draft.effectiveAt}:00` : draft.effectiveAt}+07:00`)
      if (!Number.isFinite(parsed)) return invalid('Thời điểm hiệu lực không hợp lệ.', 'effectiveAt')
      const serverNow = data ? Date.parse(data.asOf) + Date.now() - receivedAt.current : Date.now()
      if (parsed < serverNow) return invalid('Thời điểm hiệu lực không được ở quá khứ.', 'effectiveAt')
      at = new Date(parsed).toISOString()
    }
    return { price1y: prices[0], price2y: prices[1], price3y: prices[2], applyNow: draft.mode === 'NOW', effectiveAt: at, terms: draft.terms.trim() || null }
  }
  function openPublish() { setMessage(null); if (payload()) { setError(null); setErrorField(null); setConfirming(true) } }
  async function publish() {
    if (sending.current) return
    const body = payload(); if (!body) { setConfirming(false); return }
    sending.current = true; setBusy(true); setError(null)
    try {
      const p = await planPriceApi.publish(body, keys.keyFor(body)); keys.complete(); setConfirming(false)
      setMessage(`Đã công bố bảng giá v${p.id}, hiệu lực ${fmtSeconds(p.effectiveAt)}.`)
      const d = initial(p.status === 'EFFECTIVE' ? p : data?.current ?? null); setDraft(d); baseline.current = JSON.stringify(d); refresh()
    } catch (e) { setError(priceError(e)); if (e instanceof BackendError && e.code === 'MSG-FE19-15') refresh() }
    finally { sending.current = false; setBusy(false) }
  }

  if (query.error && !data) return <Layout title={TITLE}><ErrorBlock message={priceError(query.error)} onRetry={query.refetch} /></Layout>
  if (!data || !draft) return <Layout title={TITLE}><LoadingBlock /></Layout>
  const current = data.current
  const fieldError = (field: keyof PriceDraft) => error && errorField === field && !confirming ? <p role="alert" className="text-sm text-err-fg">{error}</p> : null
  return <Layout title={TITLE}>
    <PageHeader title={TITLE} sub="Một gói duy nhất với giá theo 1, 2 hoặc 3 năm. Giờ hiển thị theo Asia/Ho_Chi_Minh.">
      <Button disabled={query.loading || busy} onClick={refresh}>Làm mới</Button>
    </PageHeader>
    {message ? <p role="status" className="mb-3 rounded-md bg-ok-bg p-3 text-sm text-ok-fg">{message}</p> : null}
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-4">
        <Card title={`Bảng giá hiện hành${current ? ` · v${current.id}` : ''}`} sub={current ? `Hiệu lực từ ${fmtSeconds(current.effectiveAt)}` : undefined}>
          {current ? <>
            <div className="grid gap-3 sm:grid-cols-3">{([['1 năm', current.price1y], ['2 năm', current.price2y], ['3 năm', current.price3y]] as const).map(([label, value]) => <div key={label} className="min-w-0 rounded-md bg-page p-3"><p className="text-xs text-muted">{label}</p><p className="break-words text-xl font-bold">{fmtMoney(value)} đ</p></div>)}</div>
            <p className="mt-3 text-xs text-muted">Công bố bởi {current.publishedBy ?? '—'} · {fmtSeconds(current.publishedAt)}</p>
          </> : <EmptyBlock title="Chưa có bảng giá hiệu lực" />}
        </Card>
        <Card title="Soạn bảng giá mới" sub="Thời hạn cố định: 1, 2, 3 năm">
          <fieldset disabled={!canAct || busy} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">{(['price1y', 'price2y', 'price3y'] as const).map((field, i) => <Field key={field} id={field} label={`Giá ${i + 1} năm (VND) *`}><input id={field} className={inputCls} inputMode="numeric" aria-invalid={errorField === field && !!error} value={draft[field]} onChange={e => set({ [field]: e.target.value })} />{fieldError(field)}</Field>)}</div>
            <div className="flex min-w-0 flex-col gap-1.5"><span className="text-xs font-medium text-ink">Áp dụng *</span>
              <div role="radiogroup" aria-label="Áp dụng" aria-required="true" className="flex flex-wrap gap-6"><Radio name="application" checked={draft.mode === 'NOW'} onChange={() => set({ mode: 'NOW' })}>Áp dụng ngay</Radio><Radio name="application" checked={draft.mode === 'SCHEDULE'} onChange={() => set({ mode: 'SCHEDULE' })}>Lên lịch</Radio></div></div>
            {draft.mode === 'SCHEDULE' ? <Field id="effectiveAt" label="Hiệu lực từ *" hint="Giờ Việt Nam (Asia/Ho_Chi_Minh)"><input id="effectiveAt" className={inputCls} type="datetime-local" aria-invalid={errorField === 'effectiveAt' && !!error} value={draft.effectiveAt} onChange={e => set({ effectiveAt: e.target.value })} />{fieldError('effectiveAt')}</Field> : <p className="text-sm text-muted">Hiệu lực ngay khi công bố thành công.</p>}
            <Field id="terms" label="Mô tả điều khoản" hint="Tối đa 500 ký tự"><textarea id="terms" className={inputCls} rows={3} aria-invalid={errorField === 'terms' && !!error} value={draft.terms} onChange={e => set({ terms: e.target.value })} />{fieldError('terms')}</Field>
          </fieldset>
          {error && !confirming && !errorField ? <p role="alert" className="mt-3 text-sm text-err-fg">{error}</p> : null}
          <div className="mt-4"><Note tone="info">Bảng giá mới chỉ dùng từ thời điểm hiệu lực. Các yêu cầu thanh toán đã phát hành và kỳ đã mua giữ nguyên. Công bố ngay vẫn giữ các lịch giá tương lai.</Note></div>
          {canAct ? <div className="mt-4 flex flex-wrap justify-end gap-2"><Button disabled={busy} onClick={reset}>Hủy chỉnh sửa</Button><Button variant="primary" disabled={busy} onClick={openPublish}>Công bố phiên bản</Button></div> : null}
        </Card>
      </div>
      <section aria-label="Lịch sử công bố" aria-busy={query.loading} className="min-w-0">
        <Card title="Lịch sử công bố" sub={`${data.total} phiên bản · mới công bố trước`}>
          {data.items.length === 0 ? <EmptyBlock title="Chưa có phiên bản công bố" /> : <ol className="grid gap-3">{data.items.map(v => <li key={v.id} className="min-w-0 rounded-md border border-rule p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><strong className="text-brand">v{v.id}</strong><Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge></div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted">Giá 1 / 2 / 3 năm</dt><dd className="break-words">{fmtMoney(v.price1y)} / {fmtMoney(v.price2y)} / {fmtMoney(v.price3y)} đ</dd>
              <dt className="text-muted">Hiệu lực từ</dt><dd>{fmtSeconds(v.effectiveAt)}</dd>
              <dt className="text-muted">Người công bố</dt><dd className="break-words">{v.publishedBy ?? '—'}</dd>
              <dt className="text-muted">Công bố lúc</dt><dd>{fmtSeconds(v.publishedAt)}</dd>
              <dt className="text-muted">Điều khoản</dt><dd className="whitespace-pre-wrap break-words">{v.terms ?? '—'}</dd>
              {v.status === 'WITHDRAWN' ? <><dt className="text-muted">Người / giờ rút</dt><dd>{v.withdrawnBy ?? '—'} · {fmtSeconds(v.withdrawnAt)}</dd><dt className="text-muted">Lý do rút</dt><dd className="whitespace-pre-wrap break-words">{v.withdrawReason ?? '—'}</dd></> : null}
            </dl>
            {v.status === 'SCHEDULED' && canAct ? <div className="mt-2 text-right"><Button variant="link" disabled={busy} onClick={() => setWithdrawing(v)}>Rút v{v.id}</Button></div> : null}
          </li>)}</ol>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Trang {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))}</span><div className="flex gap-2"><Button disabled={query.loading || page === 0} onClick={() => setPage(p => p - 1)}>Trang trước</Button><Button disabled={query.loading || (page + 1) * data.size >= data.total} onClick={() => setPage(p => p + 1)}>Trang sau</Button></div></div>
        </Card>
      </section>
    </div>
    <Foot>Bảng giá đã công bố chỉ xem. Phiên bản đã lên lịch có thể rút trước khi hiệu lực và luôn được giữ trong lịch sử.</Foot>
    {confirming ? <Modal title="Xác nhận công bố bảng giá" topTitle={TITLE} width={640} onClose={() => { if (!sending.current) { setConfirming(false); setError(null) } }}>
      <p className="text-sm">Giá 1 / 2 / 3 năm: {[draft.price1y, draft.price2y, draft.price3y].map(v => `${fmtMoney(parseVnd(v))} đ`).join(' / ')}.</p><p className="mt-2 text-sm">{draft.mode === 'NOW' ? 'Áp dụng ngay khi công bố thành công.' : `Hiệu lực từ ${fmtDateTime(draft.effectiveAt)} (giờ Việt Nam).`}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">Điều khoản: {draft.terms.trim() || '—'}</p>
      {error ? <p role="alert" className="mt-3 text-sm text-err-fg">{error}</p> : null}
      <ModalFooter><ModalButton disabled={busy} onClick={() => { setConfirming(false); setError(null) }}>Quay lại</ModalButton><ModalButton variant="primary" disabled={busy} onClick={publish}>Xác nhận công bố</ModalButton></ModalFooter>
    </Modal> : null}
    {withdrawing ? <WithdrawDialog version={withdrawing} onClose={() => setWithdrawing(null)} onStale={refresh} onDone={() => { setMessage(`Đã rút lại phiên bản v${withdrawing.id}; phiên bản được giữ trong lịch sử.`); setWithdrawing(null); refresh() }} /> : null}
  </Layout>
}
