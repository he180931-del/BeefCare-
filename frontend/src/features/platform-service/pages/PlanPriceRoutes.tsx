import { useEffect, useState } from 'react'
import Layout from '../../../components/Layout'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader, Radio, inputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformServiceApi } from '../api/platformServiceApi'
import { ReadField, ReasonField, useAction, usePmAccess } from '../components/common'
import type { PriceDraft, PriceStatus, PriceVersionView, PublishPriceCommand } from '../types'
import { fmtDateTime, fmtMoney, vnNow } from '../domain/dates'
import { PAST_ERROR, PRICE_ERROR, parseVnd, validPrice, validateEffective } from '../domain/pricing'
import { validateReason } from '../domain/servicePeriods'

const TITLE = 'Bảng giá gói'
const STATUS: Record<PriceStatus, { label: string; tone: 'ok' | 'info' | 'outline' | 'err' }> = {
  EFFECTIVE: { label: 'Đang hiệu lực', tone: 'ok' }, SCHEDULED: { label: 'Lên lịch', tone: 'info' }, SUPERSEDED: { label: 'Hết hiệu lực', tone: 'outline' }, WITHDRAWN: { label: 'Đã rút lại', tone: 'err' },
}
const million = (n: number) => (n / 1_000_000).toFixed(2).replace('.', ',')
const summary = (v: { price1y: number; price2y: number; price3y: number }) => `${million(v.price1y)} / ${million(v.price2y)} / ${million(v.price3y)} triệu`
const triple = (c: { price1y: number; price2y: number; price3y: number }) => `${fmtMoney(c.price1y)} / ${fmtMoney(c.price2y)} / ${fmtMoney(c.price3y)} VND`
const withSeconds = (s: string) => (s.length === 16 ? `${s}:00` : s)

function toCommand(d: PriceDraft): PublishPriceCommand {
  return { price1y: parseVnd(d.price1y), price2y: parseVnd(d.price2y), price3y: parseVnd(d.price3y), mode: d.mode, effectiveAt: d.effectiveAt, terms: d.terms }
}

function PriceCard({ title, sub, value, onChange, error, id }: { title: string; sub?: string; value: string; onChange: (v: string) => void; error?: boolean; id: string }) {
  return (
    <Field label={`${title} *`} id={id} hint={sub}>
      <div className="relative">
        <input id={id} inputMode="numeric" className={`${inputCls} pr-8 ${error ? 'border-err-fg' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">đ</span>
      </div>
    </Field>
  )
}

function PublishDialog({ kind, draft, version, onClose, onPublished }: { kind: 'confirm' | 'now'; draft: PriceDraft; version: number; onClose: () => void; onPublished: (v: PriceVersionView) => void }) {
  const { run, busy, error } = useAction()
  const now = kind === 'now'
  async function publish() {
    const res = await run(() => platformServiceApi.publishPrice(toCommand({ ...draft, mode: now ? 'NOW' : 'SCHEDULE' })))
    if (res) onPublished(res)
  }
  return (
    <Modal title={now ? 'Công bố và áp dụng ngay' : `Xác nhận công bố bảng giá v${version}`} topTitle={TITLE} width={640} onClose={onClose}>
      <div className="grid gap-3">
        <ReadField id="pb-prices" label="Giá 1 / 2 / 3 năm" value={triple(toCommand(draft))} />
        <ReadField id="pb-apply" label="Áp dụng" value={now ? 'Ngay khi công bố thành công' : `Lên lịch · ${fmtDateTime(withSeconds(draft.effectiveAt))}`} />
        <ReadField id="pb-terms" label="Điều khoản" value={draft.terms || '—'} />
      </div>
      <Note tone="info">{now ? 'Hiệu lực được hệ thống chốt lúc công bố thành công. Không nhập thời điểm quá khứ.' : 'Thời hạn 1/2/3 năm và báo giá 24 giờ cố định. Bảng mới chỉ dùng khi đến hiệu lực; không sửa báo giá hay kỳ đã mua.'}</Note>
      {error ? <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p> : null}
      <ModalFooter>
        <ModalButton onClick={onClose}><Icon name="arrow-left" size={16} />Quay lại</ModalButton>
        <ModalButton variant="primary" disabled={busy} onClick={publish}><Icon name="speakerphone" size={16} />{now ? 'Công bố ngay' : 'Công bố phiên bản'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

function InvalidDialog({ priceError, timeError, onClose, onReload }: { priceError: string | null; timeError: string | null; onClose: () => void; onReload: () => void }) {
  return (
    <Modal title="Chưa thể công bố bảng giá" topTitle={TITLE} width={640} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadField id="iv-price" label="Giá" value={priceError ?? 'Hợp lệ'} />
        <ReadField id="iv-time" label="Hiệu lực" value={timeError ?? 'Hợp lệ'} />
      </div>
      <Note tone="info">Mỗi giá phải là số nguyên VND &gt; 0; đủ ba thời hạn. Lịch hiệu lực phải rõ ràng và không xung đột. Nếu phiên bản vừa thay đổi, tải lại trước khi công bố. Không công bố một phần.</Note>
      <ModalFooter>
        <ModalButton onClick={onClose}><Icon name="arrow-left" size={16} />Về chỉnh bảng giá</ModalButton>
        <ModalButton variant="primary" onClick={onReload}><Icon name="refresh" size={16} />Tải lại phiên bản</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

function PublishedDialog({ v, onClose }: { v: PriceVersionView; onClose: () => void }) {
  const now = v.status === 'EFFECTIVE'
  return (
    <Modal title={`Đã công bố bảng giá v${v.version}`} topTitle={TITLE} width={640} onClose={onClose}>
      <div className="grid gap-3">
        <ReadField id="pd-status" label="Trạng thái" value={now ? 'Đang hiệu lực · Áp dụng ngay' : 'Đã công bố · Chưa đến hiệu lực'} />
        <ReadField id="pd-eff" label="Hiệu lực" value={`${fmtDateTime(v.effectiveAt)} · Asia/Ho_Chi_Minh`} />
        <ReadField id="pd-by" label="Người / thời điểm công bố" value={`${v.publishedBy} · ${fmtDateTime(v.publishedAt)}`} />
      </div>
      <Note tone="info">{now ? `v${v.version} áp dụng cho bảng giá công khai và yêu cầu mới từ thời điểm công bố. Báo giá đã phát hành vẫn giữ giá cũ.` : `Bảng giá hiện hành vẫn áp dụng. Landing và báo giá mới dùng v${v.version} khi đến hiệu lực; báo giá cũ giữ giá cũ.`}</Note>
      <ModalFooter><ModalButton variant="primary" onClick={onClose}><Icon name="arrow-left" size={16} />Về bảng giá</ModalButton></ModalFooter>
    </Modal>
  )
}

function WithdrawDialog({ version, onClose, onDone }: { version: number; onClose: () => void; onDone: (text: string) => void }) {
  const [reason, setReason] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { run, busy, error } = useAction()
  async function withdraw() {
    const err = validateReason(reason)
    setFieldError(err)
    if (err) return
    const ok = await run(async () => { await platformServiceApi.withdrawPrice(version, reason); return true })
    if (ok) onDone(`Đã rút lại phiên bản v${version}; phiên bản được giữ trong lịch sử.`)
  }
  return (
    <Modal title={`Rút lại bảng giá v${version}`} topTitle={TITLE} width={640} onClose={onClose}>
      <ReasonField id="wd-reason" label="Lý do *" value={reason} onChange={setReason} error={fieldError} />
      {error ? <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p> : null}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="danger" disabled={busy} onClick={withdraw}>Rút lại phiên bản</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

export default function PlanPriceRoutes() {
  const canAct = usePmAccess()
  const [m, openModal, closeModal] = useModalParam()
  const [tick, setTick] = useState(0)
  const versions = useQuery(() => platformServiceApi.listPriceVersions(), [tick])
  const saved = useQuery(() => platformServiceApi.getPriceDraft(), [tick])
  const [draft, setDraft] = useState<PriceDraft | null>(null)
  const [published, setPublished] = useState<PriceVersionView | null>(null)
  const [withdrawing, setWithdrawing] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ prices: boolean[]; priceMsg: string | null; timeMsg: string | null }>({ prices: [false, false, false], priceMsg: null, timeMsg: null })

  useEffect(() => { if (saved.data && !draft) setDraft(saved.data) }, [saved.data, draft])

  if ((versions.loading && !versions.data) || !draft) {
    if (versions.error) return <Layout title={TITLE}><ErrorBlock message={userFacingError(versions.error, 'Không tải được bảng giá.')} onRetry={versions.refetch} /></Layout>
    return <Layout title={TITLE}><LoadingBlock /></Layout>
  }
  if (versions.error || !versions.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(versions.error, 'Không tải được bảng giá.')} onRetry={versions.refetch} /></Layout>

  const list = versions.data
  const current = list.find((v) => v.status === 'EFFECTIVE')
  const nextVersion = Math.max(0, ...list.map((v) => v.version)) + 1
  const set = (patch: Partial<PriceDraft>) => setDraft({ ...draft, ...patch })

  function validate() {
    const prices = [draft!.price1y, draft!.price2y, draft!.price3y].map((p) => !validPrice(parseVnd(p)))
    const priceMsg = prices.some(Boolean) ? PRICE_ERROR : null
    const timeMsg = validateEffective(draft!.mode, draft!.effectiveAt, vnNow(), list.map((v) => ({ ...v })).filter((v) => v.status !== 'WITHDRAWN'))
    setErrors({ prices, priceMsg, timeMsg })
    return !priceMsg && !timeMsg
  }
  function publish() {
    if (!validate()) { openModal('invalid'); return }
    openModal(draft!.mode === 'NOW' ? 'now' : 'confirm')
  }
  async function saveDraft() {
    await platformServiceApi.savePriceDraft(draft!)
    setMessage('Đã lưu bản nháp bảng giá.')
  }
  const reload = () => { setDraft(null); setErrors({ prices: [false, false, false], priceMsg: null, timeMsg: null }); setTick((t) => t + 1); closeModal() }

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub="Một gói duy nhất với giá theo 1, 2 hoặc 3 năm. Bảng giá mới chỉ áp dụng cho báo giá tạo sau thời điểm hiệu lực.">
        <Button variant="primary" disabled={!canAct} onClick={publish}><Icon name="speakerphone" size={16} />Công bố bảng giá mới</Button>
      </PageHeader>
      {message ? <Note tone="ok">{message}</Note> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
        <div className="grid content-start gap-4">
          <Card title={`Bảng giá hiện hành${current ? ` · v${current.version}` : ''}`} sub={current ? `Hiệu lực từ ${fmtDateTime(current.effectiveAt)} · công bố bởi ${current.publishedBy}` : undefined} actions={<Badge tone="ok">Đang hiệu lực</Badge>}>
            {current ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {([['1 năm', current.price1y], ['2 năm', current.price2y], ['3 năm', current.price3y]] as const).map(([label, price]) => (
                  <div key={label} className="rounded-md bg-page p-3"><div className="text-[12px] font-medium text-muted">{label}</div><div className="text-[20px] font-bold text-ink">{fmtMoney(price)} đ</div></div>
                ))}
              </div>
            ) : <EmptyBlock title="Chưa có bảng giá hiệu lực" />}
          </Card>
          <Card title={`Soạn bảng giá v${nextVersion}`} sub="Bản nháp" actions={<Badge tone="info" icon="pencil">Nháp</Badge>}>
            <fieldset disabled={!canAct} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <PriceCard id="p1" title="Giá 1 năm" value={draft.price1y} onChange={(v) => set({ price1y: v })} error={errors.prices[0]} />
                <PriceCard id="p2" title="Giá 2 năm" value={draft.price2y} onChange={(v) => set({ price2y: v })} error={errors.prices[1]} />
                <PriceCard id="p3" title="Giá 3 năm" value={draft.price3y} onChange={(v) => set({ price3y: v })} error={errors.prices[2]} />
              </div>
              {errors.priceMsg ? <p role="alert" className="text-[12px] text-err-fg">{errors.priceMsg}</p> : null}
              <div className="flex gap-6">
                <Radio name="apply" checked={draft.mode === 'SCHEDULE'} onChange={() => set({ mode: 'SCHEDULE' })}>Lên lịch</Radio>
                <Radio name="apply" checked={draft.mode === 'NOW'} onChange={() => set({ mode: 'NOW' })}>Áp dụng ngay</Radio>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Thời hạn (cố định)" id="terms-fixed"><input id="terms-fixed" readOnly className={inputCls} value="1, 2, 3 năm" /></Field>
                {draft.mode === 'SCHEDULE' ? (
                  <Field label="Hiệu lực từ *" id="eff" hint="Giờ Việt Nam (Asia/Ho_Chi_Minh)">
                    <input id="eff" type="datetime-local" className={inputCls} value={draft.effectiveAt} onChange={(e) => set({ effectiveAt: e.target.value })} />
                    {errors.timeMsg ? <p role="alert" className="mt-1 text-[12px] text-err-fg">{errors.timeMsg}</p> : null}
                  </Field>
                ) : <Field label="Hiệu lực từ" id="eff-now"><input id="eff-now" readOnly className={inputCls} value="Ngay khi công bố thành công" /></Field>}
              </div>
              <Field label="Điều khoản hỗ trợ" id="terms-text"><input id="terms-text" maxLength={500} className={inputCls} value={draft.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>
            </fieldset>
            <div className="mt-3"><Note tone="info">Ba giá là số nguyên đồng, lớn hơn 0. Không chọn ngày quá khứ hoặc trùng lịch hiệu lực khác. Báo giá đã phát hành và kỳ đã mua giữ nguyên.</Note></div>
          </Card>
          <Card title="Hiệu lực và điều khoản công bố">
            <Info cols={3} items={[
              ['Cách áp dụng', draft.mode === 'NOW' ? 'Áp dụng ngay' : 'Lên lịch'],
              ['Hiệu lực', draft.mode === 'NOW' ? 'Ngay khi công bố' : draft.effectiveAt ? fmtDateTime(withSeconds(draft.effectiveAt)) : '—', !!errors.timeMsg],
              ['Điều khoản hỗ trợ', draft.terms || '—'],
            ]} />
            <p className="mt-2 text-[11px] text-muted">Thời hạn cố định 1 / 2 / 3 năm. Mỗi báo giá giữ giá trong 24 giờ.</p>
            <div className="mt-3 flex gap-2">
              <Button disabled={!canAct} onClick={saveDraft}>Lưu nháp</Button>
              <Button variant="primary" disabled={!canAct} onClick={publish}><Icon name="speakerphone" size={16} />Công bố v{nextVersion}</Button>
            </div>
          </Card>
        </div>
        <Card title="Lịch sử công bố">
          <ul className="grid gap-2">
            {list.map((v) => (
              <li key={v.version} className="flex items-center gap-3 rounded-md border border-rule p-3">
                <span className="text-[14px] font-bold text-brand">v{v.version}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-ink">{summary(v)}</div>
                  <div className="text-[11px] text-muted">Hiệu lực {fmtDateTime(v.effectiveAt).slice(6)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge>
                  {v.status === 'SCHEDULED' && canAct ? <Button variant="link" onClick={() => { setWithdrawing(v.version); openModal('withdraw') }}>Rút lại</Button> : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Foot>Bảng giá gói (PM). Bảng giá hiện hành chỉ xem; soạn phiên bản mới rồi công bố ngay hoặc lên lịch. Lịch sử công bố bên phải giữ mọi phiên bản cũ để đối chiếu báo giá đã phát hành.</Foot>
      {m === 'confirm' || m === 'now' ? (
        <PublishDialog kind={m} draft={draft} version={nextVersion} onClose={closeModal} onPublished={(v) => { setPublished(v); setMessage(`Đã công bố bảng giá v${v.version}, hiệu lực ${fmtDateTime(v.effectiveAt)}.`); setTick((t) => t + 1); openModal('published') }} />
      ) : null}
      {m === 'invalid' ? <InvalidDialog priceError={errors.priceMsg} timeError={errors.timeMsg ?? (draft.mode === 'SCHEDULE' && !draft.effectiveAt ? PAST_ERROR : null)} onClose={closeModal} onReload={reload} /> : null}
      {m === 'published' && published ? <PublishedDialog v={published} onClose={closeModal} /> : null}
      {m === 'withdraw' && withdrawing ? <WithdrawDialog version={withdrawing} onClose={closeModal} onDone={(t) => { setMessage(t); setTick((x) => x + 1); closeModal() }} /> : null}
    </Layout>
  )
}
