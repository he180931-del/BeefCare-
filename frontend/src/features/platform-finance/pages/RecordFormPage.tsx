import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Button, Card, DateInput, ErrorBlock, Field, Foot, LoadingBlock, Note, PageHeader, Radio, Select, Textarea, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { FINANCE_BASE, FlashNote, StateBadge, useFlash } from '../components/common'
import { RecordDialogs } from '../components/RecordDialogs'
import { DEMO_TODAY, FINANCE_CATEGORIES, formatDateTime, formatVnd, validateRecordFields } from '../domain/financeRules'
import type { BankTransactionChoice, FinanceRecord, RecordErrors, RecordFields } from '../types'

const EMPTY: RecordFields = { type: 'EXPENSE', category: '', amountVnd: 0, occurredOn: DEMO_TODAY, scope: 'GENERAL', farmId: null, documentNumber: '', description: '', sourceType: 'MANUAL', sourceEvidenceId: null }
const toFields = (r: FinanceRecord): RecordFields => ({ type: r.type, category: r.category, amountVnd: r.amountVnd, occurredOn: r.occurredOn, scope: r.scope, farmId: r.farmId, documentNumber: r.documentNumber, description: r.description, sourceType: r.sourceType, sourceEvidenceId: r.sourceEvidenceId })
const Err = ({ text }: { text?: string }) => (text ? <span role="alert" className="text-[12px] text-err-fg">{text}</span> : null)

/** SCR-72: biểu mẫu khoản thu chi (mới, nháp, đã ghi sổ, đã hủy bỏ). */
export default function RecordFormPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [m, open, close] = useModalParam()
  const [flash, setFlash] = useFlash()
  const [fields, setFields] = useState<RecordFields>(EMPTY)
  const [errors, setErrors] = useState<RecordErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pick, setPick] = useState<BankTransactionChoice | null>(null)
  const [conflict, setConflict] = useState<BankTransactionChoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const farms = useQuery(() => financeApi.listFarms(), [])
  const bank = useQuery(() => financeApi.listBankTransactions(), [m])
  const { data, loading, error, refetch } = useQuery(async () => (code ? financeApi.getRecord(code) : null), [code, reloadKey])
  const record = data?.record ?? null

  useEffect(() => { if (record) setFields(toFields(record)) }, [record])
  useEffect(() => {
    if (!record?.sourceReference || !bank.data?.length || fields.sourceEvidenceId) return
    const source = bank.data.find((item) => item.sourceReference === record.sourceReference)
    if (source) setFields((current) => ({ ...current, sourceEvidenceId: source.evidenceId ?? source.transactionId, sourceType: 'BANK' }))
  }, [record, bank.data, fields.sourceEvidenceId])

  if (loading && code && !data) return <Layout title="Khoản thu chi"><LoadingBlock /></Layout>
  if (error) return <Layout title="Khoản thu chi"><ErrorBlock message={userFacingError(error, 'Không tải được khoản thu chi.')} onRetry={refetch} /></Layout>

  const editable = !record || record.state === 'DRAFT'
  const set = (p: Partial<RecordFields>) => setFields((f) => ({ ...f, ...p }))
  const title = record ? `Khoản thu chi ${record.recordCode}` : 'Khoản thu chi mới'
  const sub = !record ? 'Nhập khoản thu hoặc chi của nền tảng. Lưu nháp trước, kiểm tra rồi ghi sổ.' : record.state === 'DRAFT' ? 'Chỉ khoản nháp được sửa. Khi ghi sổ, khoản này không thể sửa nữa.' : record.state === 'POSTED' ? 'Khoản đã ghi sổ chỉ đọc; sửa sai bằng Hủy bỏ kèm lý do.' : 'Khoản đã hủy bỏ chỉ đọc; có thể tạo nháp thay thế.'
  const categories = FINANCE_CATEGORIES[fields.type]
  const changeReload = () => setReloadKey((k) => k + 1)

  const save = async (): Promise<FinanceRecord | null> => {
    const found = validateRecordFields(fields)
    setErrors(found)
    if (Object.keys(found).length) return null
    setBusy(true); setFormError(null)
    try {
      if (!record) {
        const created = await financeApi.createDraft(fields)
        navigate(`${FINANCE_BASE}/${created.recordCode}`, { state: { flash: { tone: 'ok', text: `Khoản thu chi ${created.recordCode} đã được lưu ở trạng thái nháp.` } } })
        return created
      }
      const saved = await financeApi.saveDraft(record.recordCode, fields, record.version)
      setFlash({ tone: 'ok', text: `Khoản thu chi ${saved.recordCode} đã được lưu ở trạng thái nháp.` })
      changeReload()
      return saved
    } catch (e) {
      setFormError(userFacingError(e, 'Không lưu được dữ liệu. Vui lòng thử lại.'))
      return null
    } finally { setBusy(false) }
  }
  const startPost = async () => {
    const found = validateRecordFields(fields)
    setErrors(found)
    if (Object.keys(found).length) { open('kiem-tra'); return }
    const saved = await save()
    if (saved) open('ghi-so')
  }
  const useSource = () => {
    if (!pick) return
    if (pick.claimedBy && fields.type === 'INCOME') { setConflict(pick); open('nguon-loi'); return }
    set({ sourceEvidenceId: pick.evidenceId ?? pick.transactionId, amountVnd: pick.amount, occurredOn: pick.bankPaidAt.slice(0, 10) })
    close()
  }
  const chosen = (bank.data ?? []).find((b) => (b.evidenceId ?? b.transactionId) === fields.sourceEvidenceId)
  const sourceNotice = formError && /đã được ghi nhận là/.test(formError) ? formError : null

  return (
    <Layout title="Thu chi khác">
      <div className="flex flex-col gap-4">
        <PageHeader title={title} sub={sub}>
          {record?.state === 'DRAFT' && <Button onClick={() => open('bo-nhap')}>Bỏ nháp</Button>}
          {editable && <Button onClick={() => { void save() }} disabled={busy}>Lưu nháp</Button>}
          {record?.state === 'DRAFT' && <Button variant="primary" onClick={() => { void startPost() }} disabled={busy}><Icon name="circle-check" size={16} /> Ghi sổ</Button>}
          {record?.state === 'POSTED' && <Button variant="danger" onClick={() => open('huy')}>Hủy bỏ khoản đã ghi sổ</Button>}
          {record?.state === 'VOID' && <Button variant="primary" onClick={() => open('thay-the')}><Icon name="circle-plus" size={16} /> Tạo nháp thay thế</Button>}
          <Button variant="link" onClick={() => navigate(FINANCE_BASE)}>Về danh sách</Button>
        </PageHeader>
        <FlashNote flash={flash} />
        {formError && !sourceNotice && <Note tone="err">{formError}</Note>}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_356px]">
          <Card title="Thông tin khoản" actions={record ? <StateBadge state={record.state} /> : <StateBadge state="DRAFT" />}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Loại *"><div className="flex gap-4">
                  <Radio name="type" checked={fields.type === 'INCOME'} onChange={() => editable && set({ type: 'INCOME', category: '' })}>Thu</Radio>
                  <Radio name="type" checked={fields.type === 'EXPENSE'} onChange={() => editable && set({ type: 'EXPENSE', category: '' })}>Chi</Radio>
                </div></Field>
                <Field label="Phạm vi *"><div className="flex flex-wrap gap-4">
                  <Radio name="scope" checked={fields.scope === 'GENERAL'} onChange={() => editable && set({ scope: 'GENERAL', farmId: null })}>Chung nền tảng</Radio>
                  <Radio name="scope" checked={fields.scope === 'FARM'} onChange={() => editable && set({ scope: 'FARM' })}>Gắn với trại</Radio>
                </div></Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Danh mục *" id="fr-cat" hint={<Err text={errors.category} />}>
                  <Select id="fr-cat" value={fields.category} disabled={!editable} onChange={(e) => set({ category: e.target.value })}>
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                    {fields.category && !categories.includes(fields.category) && <option>{fields.category}</option>}
                  </Select>
                </Field>
                <Field label="Số tiền *" id="fr-amount" hint={<Err text={errors.amountVnd} />}>
                  <div className="relative"><input id="fr-amount" className={`${inputCls} pr-8`} inputMode="numeric" readOnly={!editable} value={fields.amountVnd ? formatVnd(fields.amountVnd) : ''} onChange={(e) => set({ amountVnd: Number(e.target.value.replace(/\D/g, '')) || 0 })} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">đ</span></div>
                </Field>
                <Field label="Ngày phát sinh *" id="fr-date" hint={<Err text={errors.occurredOn} />}><DateInput id="fr-date" value={fields.occurredOn} readOnly={!editable} onChange={(v) => set({ occurredOn: v })} /></Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={fields.scope === 'FARM' ? 'Trang trại *' : 'Trang trại'} id="fr-farm" hint={<Err text={errors.farmId} />}>
                  <Select id="fr-farm" value={fields.farmId ?? ''} disabled={!editable || fields.scope === 'GENERAL'} onChange={(e) => set({ farmId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">{fields.scope === 'GENERAL' ? 'Không gắn trại' : 'Chọn trang trại'}</option>
                    {(farms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                </Field>
                <Field label="Số chứng từ" id="fr-doc" hint={<Err text={errors.documentNumber} />}><input id="fr-doc" className={inputCls} maxLength={100} readOnly={!editable} value={fields.documentNumber} onChange={(e) => set({ documentNumber: e.target.value })} /></Field>
              </div>
              <Field label="Diễn giải" id="fr-desc" hint={<Err text={errors.description} />}><Textarea id="fr-desc" maxLength={500} readOnly={!editable} value={fields.description} onChange={(e) => set({ description: e.target.value })} /></Field>
              <Field label="Nguồn khoản"><div className="flex flex-wrap items-center gap-4">
                <Radio name="source" checked={fields.sourceType === 'MANUAL'} onChange={() => editable && set({ sourceType: 'MANUAL', sourceEvidenceId: null })}>Nhập thủ công</Radio>
                <Radio name="source" checked={fields.sourceType === 'BANK'} onChange={() => editable && set({ sourceType: 'BANK' })}>Giao dịch ngân hàng</Radio>
                {editable && fields.sourceType === 'BANK' && <Button size="sm" onClick={() => { setPick(chosen ?? null); open('chon-nguon') }}>{chosen ? 'Đổi chứng từ' : 'Chọn chứng từ ngân hàng'}</Button>}
              </div></Field>
              {fields.sourceType === 'BANK' && <div className="text-[12px] text-muted">{chosen ? `${chosen.evidenceCode} · ${chosen.sourceReference}` : record?.sourceReference || 'Chưa chọn chứng từ.'} <Err text={errors.sourceEvidenceId} /></div>}
              {sourceNotice && <div role="alert"><Note tone="err">{sourceNotice}</Note></div>}
              <p className="m-0 text-[11px] text-muted">Nếu khoản lấy từ ngân hàng, chọn chứng từ đã xác thực để giữ định danh nguồn. Số chứng từ tự nhập chỉ để tham khảo.</p>
              <Note tone="info">Số tiền là số nguyên đồng lớn hơn 0; danh mục phải phù hợp loại; chọn &quot;Gắn với trại&quot; thì bắt buộc chọn trại.</Note>
            </div>
          </Card>
          <div className="flex flex-col gap-4">
            <Card title="Lịch sử thao tác">
              {(record?.history ?? []).length === 0 ? <p className="m-0 text-[12px] text-muted">Chưa có thao tác. Lịch sử bắt đầu khi lưu nháp.</p> : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {record!.history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      <div><div className="text-[12px] font-medium text-ink">{h.action}{h.detail ? ` ${h.detail}` : ''} · {h.actor}</div><div className="text-[11px] text-muted">{formatDateTime(h.changedAt).slice(0, 5)} {h.changedAt.slice(11, 16)}{h.reason ? ` · ${h.reason}` : ''}</div></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Note>Đây là tài chính nền tảng cơ bản – không phải kế toán trại, ERP hay kế toán thuế. Khoản đã ghi sổ chỉ có thể hủy bỏ kèm lý do.</Note>
          </div>
        </div>
        <Foot>Biểu mẫu khoản thu chi (PM). Ba nút ở đầu trang: bỏ nháp, lưu nháp và ghi sổ. Khung phải ghi lịch sử thao tác của khoản.</Foot>
      </div>

      <RecordDialogs code={record?.recordCode ?? null} onChanged={changeReload} />

      {m === 'chon-nguon' && (
        <Modal title="Chọn chứng từ ngân hàng" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <Field label="Tìm giao dịch đã xác thực" id="tx-pick">
              <Select id="tx-pick" value={pick?.transactionId ?? ''} onChange={(e) => setPick((bank.data ?? []).find((b) => b.transactionId === Number(e.target.value)) ?? null)}>
                <option value="">Chọn giao dịch</option>
                {(bank.data ?? []).map((b) => <option key={b.transactionId} value={b.transactionId}>{b.evidenceCode} · {b.paymentReference} · {b.bankPaidAt.slice(8, 10)}/{b.bankPaidAt.slice(5, 7)}/{b.bankPaidAt.slice(0, 4)}</option>)}
              </Select>
            </Field>
            {pick && (
              <>
                <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Nguồn đã chọn (chỉ đọc)</span><input className={inputCls} readOnly value={pick.sourceReference} aria-label="Nguồn đã chọn" /></div>
                <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Chiều / tiền / ngày ngân hàng</span><input className={inputCls} readOnly value={`${pick.direction} · ${formatVnd(pick.amount)} VND · ${formatDateTime(pick.bankPaidAt)}`} aria-label="Chiều tiền ngày ngân hàng" /></div>
              </>
            )}
            <Note tone="info">Định danh nguồn được chọn từ chứng từ tin cậy; không dùng Số chứng từ tự nhập làm khóa. Không nhận nguồn đã thuộc đăng ký gói, tiền nhầm gói hoặc khoản hoàn của nó.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
            <ModalButton variant="primary" onClick={useSource} disabled={!pick}>Dùng nguồn này</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'nguon-loi' && conflict && (
        <Modal title="Nguồn không thể dùng cho thu chi" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Nguồn</span><input className={inputCls} readOnly value={`${conflict.evidenceCode} · ${conflict.sourceReference.split(' / ').pop()}`} aria-label="Nguồn" /></div>
            <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Xung đột</span><input className={inputCls} readOnly value={`Nguồn đã phân bổ cho ${conflict.claimedBy}`} aria-label="Xung đột" /></div>
            <Note tone="warn">Không thể ghi sổ thu trùng đăng ký gói hoặc dùng nguồn đang khóa/đã hoàn. Chưa ghi sổ khoản này. Chọn nguồn khác hoặc sửa bằng thao tác PM được phép; không tự Hủy bỏ.</Note>
          </div>
          <ModalFooter>
            <ModalButton onClick={() => { setConflict(null); close() }}><Icon name="arrow-left" size={16} /> Về nháp</ModalButton>
            <ModalButton variant="primary" onClick={() => { setConflict(null); open('chon-nguon') }}>Chọn nguồn khác</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {m === 'kiem-tra' && (
        <Modal title="Kiểm tra khoản nháp" width={640} onClose={close}>
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Số tiền *</span><input className={inputCls} readOnly value={errors.amountVnd ?? `${formatVnd(fields.amountVnd)} · hợp lệ`} aria-label="Kiểm tra số tiền" /></div>
              <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Danh mục *</span><input className={inputCls} readOnly value={errors.category ?? 'Phù hợp Thu / Chi'} aria-label="Kiểm tra danh mục" /></div>
            </div>
            <div className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink">Phạm vi *</span><input className={inputCls} readOnly value={errors.farmId ?? 'FARM cần trại · Chung nền tảng không gắn trại'} aria-label="Kiểm tra phạm vi" /></div>
            <Note tone="info">Không lưu hoặc ghi sổ dữ liệu không hợp lệ. Nháp giữ dữ liệu đã nhập để sửa.</Note>
          </div>
          <ModalFooter><ModalButton variant="primary" onClick={close}><Icon name="arrow-left" size={16} /> Về sửa nháp</ModalButton></ModalFooter>
        </Modal>
      )}
    </Layout>
  )
}
