import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Badge, Button, Card, Checkbox, DateInput, Field, FileDropzone, Foot, Icon, Info, inputCls, KV, Note, Segmented, Select, Table, Td, Th } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import {
  commitEntryExcel,
  discardHerdEntryDraft,
  downloadEntryImportTemplate,
  entryExcelBackendEnabled,
  newEntryDefaults,
  herdEntryApi,
  getEntryDraftState,
  listEntrySellers,
  listEntryPens,
  listEntryVaccines,
  listEntryBreeds,
  listEntryParentCattle,
  listPendingEntryCalves,
  markCalfDiedBeforeRegistration,
  assignCalfParentage,
  previewEntryExcel,
} from '../api/index'
import { useQuery } from '../../../shared/hooks/useQuery'
import { PURPOSES } from '../constants/entryOptions'
import { ageOf, blankCow } from '../domain/entryCow'
import { lineAmount } from '../domain/entryTotals'
import { useEntryEditor } from '../hooks/useEntryEditor'
import { useEntryDraftWorkflow } from '../hooks/useEntryDraftWorkflow'
import { useEntryAttachments } from '../hooks/useEntryAttachments'
import { dmy, money } from '../../../shared/lib/format'
import { GhostSelect } from '../components/parts'
import RowEditModal from '../components/RowEditModal'
import ExcelModal from '../components/ExcelModal'
import PayModal from '../components/PayModal'
import { entryToday as localToday, validateEntryForPost } from '../validation/entryFormValidation'
import type { EntryCalf, EntryCow, HerdEntry } from '../types'
import type { Pen } from '../../pen-management'
import type { EntryBreedOption, EntryParentOption } from '../api/herdEntryBackendApi'
import { herdEntryError } from '../api/herdEntryError'
import { useSession } from '../../../app/session/sessionContext'

const TH = 'px-1! first:pl-3! last:pr-3!'
const KIND_BUY = 'Mua ngoài'
const KIND_CALF = 'Bê sinh tại trại'
const PURPOSE_CHOICES = PURPOSES.map((p) => ({ value: p, label: p }))
type EntryInput = Pick<EntryCow, 'code' | 'tag' | 'breed' | 'sex' | 'weight' | 'barn'> & { [key: string]: unknown }
type Calf = EntryCalf
const barnLabel = (b: Pen & { showName?: boolean }) => (b.showName ? `${b.code} ${b.name.split(' – ')[1]}` : b.code)
const num = (v: unknown) => Number(v) || 0
const displayError = herdEntryError

export default function ImportNew() {
  const [params] = useSearchParams()
  const draftId = params.get('id')
  const { data } = useQuery<HerdEntry[]>(() => herdEntryApi.list(), [])
  const { data: detailedDraft, error: draftError } = useQuery<HerdEntry | null>(
    () => draftId ? herdEntryApi.get(draftId) : Promise.resolve(null),
    [draftId],
  )
  const { data: canonicalPens } = useQuery(() => listEntryPens(), [])
  const { data: pendingCalves } = useQuery(() => listPendingEntryCalves(), [])
  const { data: sellers } = useQuery(() => listEntrySellers(), [])
  // Parent selectors are only needed on the farm-born flow. Avoid waiting on
  // the cattle lookup for purchase vouchers (and keep the purchase form
  // independent from the parentage endpoint).
  const isFarmBornRoute = params.get('kind') === 'calf'
  const { data: parentCattle } = useQuery<EntryParentOption[]>(
    () => isFarmBornRoute ? listEntryParentCattle() : Promise.resolve([]),
    [isFarmBornRoute],
  )
  if (!data || !canonicalPens || !pendingCalves || !sellers || (draftId && !detailedDraft && !draftError)) {
    return <Layout title="Phiếu nhập mới" user="manager"><p className="m-0 text-xs text-muted">Đang tải phiếu nhập…</p></Layout>
  }
  if (draftError) {
    return <Layout title="Phiếu nhập mới" user="manager"><Note tone="err">{displayError(draftError)}</Note></Layout>
  }
  const imports = detailedDraft
    ? [...data.filter((row) => row.id !== detailedDraft.id), detailedDraft]
    : data
  // Keep calves already attached to the draft visible when reopening it. The
  // backend marks those rows with draftVoucherId, so filtering every non-null
  // value used to produce the misleading 0/0 state and hide parent selectors.
  const currentDraftBackendId = Number((detailedDraft as (HerdEntry & { backendId?: number }) | null)?.backendId)
  const availablePendingCalves = pendingCalves.filter((calf) => calf.draftVoucherId == null || (Number.isFinite(currentDraftBackendId) && calf.draftVoucherId === currentDraftBackendId))
  return <ImportForm key={`${draftId ?? 'new'}-${params.get('kind') === 'calf' ? 'calf' : 'buy'}`} imports={imports} canonicalPens={canonicalPens} pendingCalves={availablePendingCalves} sellers={sellers} parentCattle={parentCattle ?? []} />
}

function ImportForm({ imports, canonicalPens, pendingCalves, sellers, parentCattle }: { imports: HerdEntry[]; canonicalPens: Pen[]; pendingCalves: EntryCalf[]; sellers: Array<{ id: string; name: string; phone: string }>; parentCattle: EntryParentOption[] }) {
  const { saveDraft, postEntry, saving: loading, error: saveError } = useEntryDraftWorkflow()
  const nav = useNavigate()
  const sessionName = useSession()?.fullName ?? ''
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const editingParam = params.get('m')
  const editingIndex = editingParam?.startsWith('row-') ? Number(editingParam.slice(4)) : -1
  const draftId = params.get('id') ?? undefined
  const draftState = getEntryDraftState(imports, draftId)
  const draftRow = draftState.row?.status === 'Nháp' ? draftState.row : undefined
  const draft = draftRow?.draft
  const kind = draftRow?.type ?? (params.get('kind') === 'calf' ? KIND_CALF : KIND_BUY)
  const isBuy = kind === KIND_BUY
  const { data: vaccines } = useQuery(() => editingIndex >= 0 ? listEntryVaccines() : Promise.resolve([]), [editingIndex])
  const { data: breeds } = useQuery(() => (editingIndex >= 0 || !isBuy) ? listEntryBreeds() : Promise.resolve([]), [editingIndex, isBuy])
  // All receiving pens come from the farm endpoint. Do not reserve or remove
  // a hard-coded A3: farms may name their pens differently and purchase entry
  // must be able to select an active backend pen.
  const importBarns = canonicalPens
  const barnOptions = importBarns.map((barn) => ({ value: barn.code, label: barn.name }))
  const calfBarnOptions = canonicalPens.filter((pen) => pen.status === 'ACTIVE').map((pen) => ({ value: pen.code, label: pen.name }))
  const typeLocked = Boolean(draftRow)
  const nextNumber = Math.max(0, ...imports.map((row) => Number(row.id?.split('-')[2]) || 0)) + 1
  const defaults = newEntryDefaults({ isBuy, receiver: sessionName, nextNumber })
  const initialRecordId = draftRow?.id ?? defaults.recordId
  const setKind = (next: string) => {
    if (typeLocked) return
    const query = new URLSearchParams(params)
    if (next === KIND_CALF) query.set('kind', 'calf')
    else query.delete('kind')
    setParams(query)
  }

  const editor = useEntryEditor({ draft, defaults, pendingCalves, sellers, pens: importBarns, isBuy })
  const { sourceId, setSourceId, date, setDate, quarantine, setQuarantine, plate, setPlate, receiver, setReceiver, note, setNote,
    cows, setCows, pricing, setPricing, calves, setCalves, directCalfCount, freight, setFreight, paid, setPaid, method, setMethod, due, setDue,
    printQr, setPrintQr, patchCow, patchCalf, createDirectCalves, purchase, pensAfter: barnAfter, overflow, calfPen: calfBarn, calvesSummary } = editor
  // Payment belongs to the entry voucher (not an individual cattle row). Keep
  // the editor behind an explicit CTA so the payment action is discoverable.
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [persistedRecordId, setPersistedRecordId] = useState<string | null>(draftRow?.id ?? null)
  const [temporaryExcelDraftId, setTemporaryExcelDraftId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const recordId = persistedRecordId ?? initialRecordId
  const { documents, storedDocuments, setStoredDocuments, resetDocuments, attachmentError, addDocuments, viewDocument, removeDocument } = useEntryAttachments({ persistedRecordId, initialStored: draftRow?.detail?.docs ?? [] })
  const backTarget = (location.state as { from?: string } | null)?.from
  const backPath = backTarget === '/cattle' ? '/cattle' : '/herd-entry'

  const source = sellers.find((s) => s.id === sourceId) ?? sellers[0] ?? { id: '', name: '', phone: '' }
  const { cattleAmount: cowsMoney, totalWeight, total, debt, estimatedCount } = purchase

  const { picked, weight: calfWeight, estimatedCount: calfEstimated, after: calfAfter, over: calfOver } = calvesSummary
  const n = isBuy ? cows.length : picked.length

  const persistCalfParentage = async (calf: Calf, patch: Partial<Calf>) => {
    const damId = Number(patch.damId ?? calf.damId)
    if (!Number.isFinite(damId) || damId <= 0 || calf.calfOutcomeId == null) return
    const sireSource = patch.sireSource ?? calf.sireSource ?? (patch.sireId ?? calf.sireId ? 'INTERNAL' : 'NONE')
    try {
      const updated = await assignCalfParentage(Number(calf.calfOutcomeId), {
        damId,
        sireSource: sireSource as 'NONE' | 'INTERNAL' | 'AI',
        ...(sireSource === 'INTERNAL' && Number(patch.sireId ?? calf.sireId) > 0 ? { sireId: Number(patch.sireId ?? calf.sireId) } : {}),
        ...(sireSource === 'AI' && String(patch.externalSireCode ?? calf.externalSireCode ?? '').trim() ? { externalSireCode: String(patch.externalSireCode ?? calf.externalSireCode).trim() } : {}),
      })
      patchCalf(calves.indexOf(calf), { damId: updated.damId, mother: updated.mother, sireId: updated.sireId, father: updated.father, sireSource: updated.sireSource, externalSireCode: updated.externalSireName })
    } catch (error) {
      setValidationError(displayError(error))
    }
  }
  const markCalfDied = async (calf: Calf) => {
    const calfOutcomeId = calf.calfOutcomeId
    if (typeof calfOutcomeId !== 'number' || !Number.isFinite(calfOutcomeId)) return
    const reason = window.prompt('Lý do bê chết trước đăng ký', '')?.trim()
    if (!reason) return
    try {
      await markCalfDiedBeforeRegistration(calfOutcomeId, reason)
      setCalves((current) => current.filter((row) => row.calfOutcomeId !== calfOutcomeId))
    } catch (error) {
      setValidationError(displayError(error))
    }
  }

  const save = async (status: 'Nháp' | 'Đã nhập', navigateAfter = true): Promise<HerdEntry | undefined> => {
    setValidationError(null)
    if (status === 'Đã nhập') {
      if (date > localToday()) {
        setValidationError('Ngày nhập không được ở tương lai.')
        return
      }
    }
    const sourceText = isBuy
      ? `${source.name}${quarantine ? ` · ${quarantine}` : ''}${estimatedCount ? ` · ${estimatedCount} con cân ước tính` : ''}`
      : `Bê của ${[...new Set(picked.map((c) => c.mother))].join(', ')}`
    const editableDraft = {
      sourceId, date, quarantine, plate, receiver, note, cows, calves, freight, paid, method, due, printQr,
    }
    const inputs: EntryInput[] = isBuy
      ? cows.map((cow) => ({ ...cow, date }))
      : picked.map((calf) => ({ ...calf, breed: calf.sex === 'Đực' ? 'Bê đực' : 'Bê cái', unitPrice: 0, ageMonths: 0, stage: 'Bê', group: 'Bê', date: calf.born }))
    if (status === 'Đã nhập') {
      const requiredError = validateEntryForPost({
        date,
        type: kind,
        sourceId,
        receiver,
        cows: isBuy ? cows : inputs as EntryCow[],
        pricing: 'kg',
        paid: isBuy ? paid : 0,
        total: isBuy ? total : 0,
        method: isBuy ? method : undefined,
      })
      if (requiredError) {
        setValidationError(requiredError)
        return
      }
    }
    const record: Partial<HerdEntry> = isBuy
      ? {
          date,
          type: kind,
          source: sourceText,
          count: n,
          weight: totalWeight,
          total,
          debt,
          status,
          printQr,
        }
      : {
          date,
          type: kind,
          source: sourceText,
          count: n,
          weight: calfWeight,
          total: null,
          debt: null,
          status,
          printQr,
        }
    if (status === 'Nháp') {
      record.draft = editableDraft
    } else {
      record.detail = {
        sourceName: isBuy ? source.name : sourceText,
        quarantine: isBuy ? quarantine : '',
        phone: isBuy ? source.phone : '',
        plate,
        by: `${receiver} · ${date}`,
        note,
        cows: inputs.map((cow, index) => ({
          code: cow.code,
          tag: cow.tag || '—',
          breed: `${cow.breed || cow.stage || 'Bò'} · ${cow.sex || '—'}`,
          weight: cow.weight,
          barn: cow.barn,
          current: `ACTIVE · ${cow.barn}`,
          amount: isBuy ? lineAmount(cows[index], pricing) : 0,
        })),
        cowsTotal: isBuy ? cowsMoney : 0,
        freight: isBuy ? freight : 0,
        payments: isBuy && paid > 0 ? [{ date: dmy(date), by: receiver, method, ref: '', amount: Math.min(paid, total) }] : [],
        docs: [...storedDocuments, ...documents.map((file) => ({ ext: file.type === 'application/pdf' ? 'PDF' : 'JPG', name: file.name, size: file.size }))],
        history: [`${dmy(date)} · ${receiver} ${status === 'Đã nhập' ? 'lưu và xác nhận' : 'lưu'} phiếu ${recordId}`],
      }
      record.draft = undefined
    }
    const saveId = persistedRecordId ?? draftRow?.id ?? (entryExcelBackendEnabled ? undefined : recordId)
    const saveCommand = status === 'Đã nhập' ? postEntry : saveDraft
    const saved = await saveCommand({ id: saveId, record, cattleRows: entryExcelBackendEnabled || status === 'Đã nhập' ? inputs : [], documents })
    setPersistedRecordId(saved.id)
    if (saved.detail?.docs) {
      setStoredDocuments(saved.detail.docs)
      resetDocuments()
    }
    if (navigateAfter) nav('/herd-entry')
    return saved
  }

  const prepareBackendExcel = async (file: File) => {
    const alreadyPersisted = Boolean(persistedRecordId || draftRow)
    const saved = await save('Nháp', false)
    if (!saved) throw new Error('Không thể lưu nháp trước khi đọc file Excel')
    if (!alreadyPersisted) setTemporaryExcelDraftId(saved.id)
    return previewEntryExcel(saved.id, file) as Promise<import('../components/ExcelModal').EntryBackendImportResult>
  }
  const commitBackendExcel = async (file: File) => {
    const targetId = persistedRecordId ?? recordId
    await commitEntryExcel(targetId, file)
    const refreshed = await herdEntryApi.get(targetId)
    return refreshed.draft?.cows ?? []
  }
  const cancelExcelImport = async () => {
    if (temporaryExcelDraftId) {
      await discardHerdEntryDraft(temporaryExcelDraftId).catch(() => undefined)
      setPersistedRecordId(null)
      setTemporaryExcelDraftId(null)
    }
    closeModal()
  }

  const rowIndex = m && m.startsWith('row-') ? Number(m.slice(4)) - 1 : -1
  const editing = rowIndex >= 0 && rowIndex < cows.length ? rowIndex : -1
  const blocked = isBuy ? overflow.length > 0 : calfOver

  return (
    <Layout title={isBuy ? 'Phiếu nhập mới – Mua ngoài (theo phiếu)' : 'Phiếu nhập mới – Bê sinh tại trại'} user="manager">
      {/* gap-5 = gap của <main> trong Layout, để khoảng cách giữa tiêu đề, lưới và chú thích giữ như các màn khác. */}
      <div className="@container/entry flex min-w-0 flex-col gap-5 leading-[normal]">
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant="link"
            aria-label="Quay lại đàn bò"
            className="shrink-0 text-xs"
            onClick={() => nav(backPath)}
          >
            ← Về đàn bò
          </Button>
          <div>
            <h1 className="m-0 text-[22px] font-bold">Phiếu nhập mới</h1>
            <p className="mb-0 mt-1 text-xs text-muted">
              {isBuy ? 'Mỗi con trong phiếu sẽ được cấp 1 mã bò và thẻ QR khi lưu.' : 'Bê được tạo từ sự kiện đẻ đang ở trạng thái Chờ xác nhận.'}
            </p>
          </div>
        </div>
        <div>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[{ value: KIND_BUY, label: KIND_BUY, disabled: typeLocked }, { value: KIND_CALF, label: KIND_CALF, disabled: typeLocked }]}
          />
        </div>

        {/*
          Bento (docs/BeefCare-Bento-Grid.md §1–2, Figma Tab 16): form 8 + tóm tắt 4 khi vùng nội dung từ 1.024 px; từ 880 px
          (laptop 1.280 px có sidebar) form 5 + tóm tắt 3 trên lưới 8 cột để nút lưu vẫn nằm cạnh form; hẹp hơn thì xếp dọc.
        */}
        <div className="grid grid-cols-4 items-start gap-4 @min-[640px]/entry:grid-cols-8 @min-[1024px]/entry:grid-cols-12 @min-[1024px]/entry:gap-6">
          <section
            aria-label={isBuy ? 'Nội dung phiếu nhập mua ngoài' : 'Nội dung phiếu nhập bê sinh tại trại'}
            className="@container/entry-form col-span-full flex min-w-0 flex-col gap-4 @min-[880px]/entry:col-span-5 @min-[1024px]/entry:col-span-8 @min-[1024px]/entry:gap-6"
          >
            <Card variant="panel" title="1. Thông tin phiếu">
              <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-1 gap-3.5 @min-[460px]/entry-form:grid-cols-2 @min-[640px]/entry-form:grid-cols-3">
                  <Field id="entry-voucher-code" label="Mã phiếu"><input id="entry-voucher-code" className={inputCls} value={recordId} readOnly /></Field>
                  <Field id="entry-date" label={isBuy ? 'Ngày nhập trại *' : 'Ngày lập phiếu *'}>
                    <DateInput id="entry-date" value={date} onChange={setDate} />
                  </Field>
                  <Field id="entry-type" label="Loại nhập"><input id="entry-type" className={inputCls} value={kind} readOnly /></Field>
                  {isBuy && (
                    <>
                      <Field id="entry-source" label="Nguồn / chủ bò cũ *" hint={`${source.phone} · + Thêm nguồn mới`}>
                        <Select id="entry-source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                          {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                      </Field>
                      <Field id="entry-quarantine" label="Số giấy kiểm dịch">
                        <input id="entry-quarantine" maxLength={50} className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} />
                      </Field>
                      <Field id="entry-plate" label="Biển số xe">
                        <input id="entry-plate" maxLength={20} className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} />
                      </Field>
                    </>
                  )}
                  <Field id="entry-receiver" label="Người nhập"><input id="entry-receiver" className={inputCls} value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
                </div>
                <Field id="entry-note" label={isBuy ? 'Ghi chú khi nhận bò' : 'Ghi chú'}>
                  <input id="entry-note" maxLength={1000} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </div>
            </Card>

            {isBuy ? (
              <Card
                variant="panel"
                title={`2. Danh sách bò trong phiếu (${cows.length} con)`}
                sub='Lịch sử trước nhập đàn mặc định "Không rõ" · sửa từng con bằng nút bút chì'
                actions={
                  <>
                    <Button small onClick={() => openModal('excel')}><Icon name="upload" />Nhập từ Excel</Button>
                    <Button small onClick={() => { setCows([...cows, { ...blankCow(importBarns[0]?.code ?? ''), pricing }]); openModal(`row-${cows.length + 1}`) }}><Icon name="circle-plus" />Thêm con</Button>
                  </>
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold">Cách tính giá</span>
                  <Segmented
                    value={pricing}
                    onChange={(next) => { setPricing(next as 'kg' | 'con'); setCows(cows.map((c) => ({ ...c, pricing: next as 'kg' | 'con' }))) }}
                    options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]}
                  />
                </div>
                <Table scroll>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`}>#</Th>
                      <Th className={`${TH} w-[70px]`}>Thẻ tai</Th>
                      <Th className={`${TH} w-[150px]`}>Giống · giới tính · nhóm</Th>
                      <Th className={`${TH} w-[60px]`}>Tuổi</Th>
                      <Th className={`${TH} w-[70px]`}>Cân nặng</Th>
                      <Th className={`${TH} w-[100px]`}>Chuồng nhận</Th>
                      <Th className={`${TH} w-[90px]`}>{`Đơn giá/${pricing === 'con' ? 'con' : 'kg'}`}</Th>
                      <Th className={`${TH} w-[80px]`}>Thành tiền</Th>
                      <Th className={`${TH} w-[20px]`} />
                    </tr>
                  </thead>
                  <tbody>
                    {cows.map((c, i) => (
                      <tr key={i}>
                        <Td className={TH}>{i + 1}</Td>
                        <Td className={TH}>{c.tag || <span className="text-muted">Gắn sau</span>}</Td>
                        <Td className={TH}>{`${c.breed || '—'} · ${c.sex} · ${c.stage}`}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`~${ageOf(c.dob ?? '', date)} th`}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}</Td>
                        <Td className={TH}>
                          <GhostSelect value={c.barn} onChange={(barn) => patchCow(i, { barn })} options={barnOptions} />
                        </Td>
                        <Td className={`${TH} whitespace-nowrap`}>{money(c.unitPrice ?? 0)}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{money(lineAmount(c, pricing))}</Td>
                        <Td className={TH}>
                          <button type="button" aria-label={`Sửa con #${i + 1}`} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-brand" onClick={() => openModal(`row-${i + 1}`)}><Icon name="pencil" size={14} /></button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <Td className={TH} />
                      <Td className={TH}>{cows.length} con</Td>
                      <Td className={TH} /><Td className={TH} />
                      <Td className={`${TH} whitespace-nowrap`}>{`${money(totalWeight)} kg`}</Td>
                      <Td className={TH} /><Td className={TH} />
                      <Td className={`${TH} whitespace-nowrap`}>{money(cowsMoney)}</Td>
                      <Td className={TH} />
                    </tr>
                  </tfoot>
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  UT = cân nặng ước tính. Con chưa có thẻ tai vẫn được tạo hồ sơ & QR, gắn thẻ sau. Mỗi dòng được kiểm tra tiêu chí và sức chứa của chuồng nhận.
                </p>
              </Card>
            ) : (
              <Card variant="panel" title="2. Chọn bê chờ xác nhận" sub={`${picked.length} / ${calves.length} bê được chọn`}>
                {calves.length === 0 && (
                  <div className="mb-3 flex items-end gap-3 rounded-md border border-field bg-page p-3">
                    <Field label="Số lượng bê muốn nhập *">
                      <input aria-label="Số lượng bê muốn nhập" type="number" min="1" max="10" value={directCalfCount || ''} onChange={(e) => createDirectCalves(Number(e.target.value))} className="w-28 rounded border border-field bg-white px-2 py-1 text-sm" placeholder="Ví dụ: 2" />
                    </Field>
                    <span className="pb-1 text-xs text-muted">Tạo tối đa 10 dòng để nhập bố/mẹ, giống, ngày sinh, giới tính và cân sơ sinh.</span>
                  </div>
                )}
                <Table scroll>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`} />
                      <Th className={`${TH} w-[90px]`}>Bê · thẻ tai</Th>
                      <Th className={`${TH} w-[170px]`}>Bò mẹ trong đàn</Th>
                      <Th className={`${TH} w-[210px]`}>Bò bố trong đàn / nguồn</Th>
                      <Th className={`${TH} w-[78px]`}>Ngày sinh</Th>
                      <Th className={`${TH} w-[56px]`}>Giới tính</Th>
                      <Th className={`${TH} w-[72px]`}>Cân sơ sinh</Th>
                      <Th className={`${TH} w-[110px]`}>Chuồng nhận</Th>
                      <Th className={`${TH} w-[92px]`}>Mục đích nuôi</Th>
                      <Th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {calves.map((c, i) => (
                      <tr key={`${c.tag}-${c.mother}`}>
                        <Td className={TH}>
                          <Checkbox
                            checked={c.picked}
                            aria-label={`Chọn ${c.tag || c.name}`}
                            onChange={(e) => patchCalf(i, { picked: e.target.checked, barn: e.target.checked ? calfBarn.code : '' })}
                          />
                        </Td>
                        <Td className={TH}><span className="whitespace-nowrap">{c.tag || 'Chưa gắn thẻ'}</span><br />{c.name}</Td>
                        <Td className={TH}>
                          {c.calfOutcomeId != null && c.mother ? (
                            <span className="whitespace-nowrap">{c.mother}</span>
                          ) : (
                            <>
                          <select aria-label={`Bò mẹ của bê ${i + 1}`} className="w-full min-w-[150px] rounded border border-field bg-white px-2 py-1 text-[11px]" value={String(c.damId ?? '')} disabled={!parentCattle.some((row) => row.sex === 'FEMALE')} onChange={(e) => { const option = parentCattle.find((row) => String(row.id) === e.target.value); const next = { damId: option?.id, mother: option?.code ?? '' }; patchCalf(i, next); void persistCalfParentage(c, next) }}>
                            <option value="">{c.mother ? `Đang chọn: ${c.mother}` : 'Chọn bò mẹ trong đàn'}</option>
                            {parentCattle.filter((row) => row.sex === 'FEMALE').map((row) => <option key={row.id} value={row.id}>{row.code}{row.name ? ` · ${row.name}` : ''}</option>)}
                          </select>
                            </>
                          )}
                        </Td>
                        <Td className={TH}>
                          {c.calfOutcomeId != null && c.mother ? (
                            <span className="whitespace-nowrap">{c.father || 'Không rõ'}</span>
                          ) : (
                            <>
                          <select aria-label={`Bò bố của bê ${i + 1}`} className="w-full min-w-[190px] rounded border border-field bg-white px-2 py-1 text-[11px]" value={c.sireSource === 'AI' ? 'AI' : String(c.sireId ?? '')} onChange={(e) => { const option = parentCattle.find((row) => String(row.id) === e.target.value); const next = e.target.value === 'AI' ? { sireId: undefined, sireSource: 'AI', father: 'Thụ tinh nhân tạo' } : { sireId: option?.id, sireSource: option ? 'INTERNAL' : 'NONE', father: option?.code ?? 'Không rõ' }; patchCalf(i, next); void persistCalfParentage(c, next) }}>
                            <option value="">{c.sireId ? `Đang chọn: ${c.father}` : (c.father && c.father !== 'Không rõ' ? c.father : 'Chọn bò bố hoặc thụ tinh nhân tạo')}</option>
                            <option value="AI">Thụ tinh nhân tạo</option>
                            {parentCattle.filter((row) => row.sex === 'MALE').map((row) => <option key={row.id} value={row.id}>{row.code}{row.name ? ` · ${row.name}` : ''}</option>)}
                          </select>
                          {c.sireSource === 'AI' && <input aria-label={`Mã nguồn tinh cho bê ${i + 1}`} className="mt-1 w-full rounded border border-field px-2 py-1 text-[11px]" placeholder="Mã lô tinh / nguồn tinh" value={String(c.externalSireCode ?? '')} onChange={(e) => { const next = { externalSireCode: e.target.value }; patchCalf(i, next); void persistCalfParentage(c, next) }} />}
                          {(c.sireSource || c.externalSireName || c.semenBatch || c.sireBreed) && <small className="block text-[10px] text-muted">
                            {[c.sireSource, c.externalSireName, c.semenBatch, c.sireBreed ? `Giống ${c.sireBreed}` : ''].filter(Boolean).join(' · ')}
                          </small>}
                            </>
                          )}
                        </Td>
                        <Td className={`${TH} whitespace-nowrap`}>{dmy(c.born)}</Td>
                        <Td className={TH}>{c.sex}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}</Td>
                        <Td className={TH}>
                          {c.picked ? <GhostSelect value={c.barn} onChange={(barn) => patchCalf(i, { barn })} options={calfBarnOptions} /> : '—'}
                        </Td>
                        <Td className={TH}>
                          {c.picked ? <GhostSelect value={c.purpose} onChange={(purpose) => patchCalf(i, { purpose })} options={PURPOSE_CHOICES} /> : '—'}
                        </Td>
                        <Td className={TH}>
                          {c.calfOutcomeId != null && (
                            <button type="button" aria-label="Đánh dấu chết trước đăng ký" className="border-0 bg-transparent p-1 text-[11px] text-danger" onClick={() => { void markCalfDied(c) }}>
                              Đánh dấu chết trước đăng ký
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  Bố, mẹ, nguồn bố (bò nội bộ, bố ngoài đàn hoặc lô tinh), giống, giới tính và cân sơ sinh lấy từ sự kiện đẻ – chỉ đọc, không sửa ở phiếu nhập. Ngày nhập đàn của bê = ngày sinh; giai đoạn = Bê theo mẹ. Bê chưa gắn thẻ vẫn chọn được, hệ thống cấp mã và QR. Bê đã chết trước khi đăng ký được đánh dấu tại đây.
                </p>
              </Card>
            )}

            <div className={`grid grid-cols-1 items-start gap-4 @min-[1024px]/entry:gap-6 ${isBuy ? '@min-[640px]/entry-form:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]' : ''}`}>
              <Card variant="panel" title="3. Chứng từ đính kèm" sub={isBuy ? undefined : 'Không bắt buộc'}>
                <FileDropzone
                  label="Chọn chứng từ đính kèm"
                  hint={isBuy ? 'PDF, JPG ≤ 10MB' : 'Ảnh bê, biên bản đỡ đẻ · PDF, JPG ≤ 10MB'}
                  onFiles={addDocuments}
                />
                {(storedDocuments.length > 0 || documents.length > 0) && (
                  <AttachmentList
                    items={[...storedDocuments.map((doc, index) => ({ ...doc, key: `stored:${index}` })), ...documents.map((file, index) => ({ ext: file.type === 'application/pdf' ? 'PDF' : 'JPG', name: file.name, key: `new:${index}` }))].map((doc) => ({ key: doc.key, name: doc.name, extension: doc.ext }))}
                    onView={(key) => { const [kind, rawIndex] = key.split(':'); const index = Number(rawIndex); void viewDocument(kind === 'new' ? storedDocuments.length + index : index) }}
                    onRemove={(key) => { const [kind, rawIndex] = key.split(':'); const index = Number(rawIndex); void removeDocument(kind === 'new' ? storedDocuments.length + index : index) }}
                  />
                )}
              </Card>
              {isBuy && (
                <Card variant="panel" title="4. Thanh toán" actions={<Button size="sm" onClick={() => setPaymentModalOpen(true)}>Thanh toán</Button>}>
                  <Info cols={2} items={[
                    ['Tiền bò', `${money(cowsMoney)} đ`],
                    ['Phí vận chuyển', `${money(freight)} đ`],
                    ['Tổng phải trả', `${money(total)} đ`],
                    ['Đã thanh toán', `${money(paid)} đ`],
                    ['Còn nợ nguồn bán', `${money(debt)} đ`],
                    ['Phương thức', method || '—'],
                    ...(due ? [['Hạn trả phần nợ', dmy(due)]] : []),
                  ]} />
                </Card>
              )}
            </div>
          </section>

          <section
            aria-label="Tóm tắt và lưu phiếu"
            className="col-span-full flex min-w-0 flex-col gap-4 @min-[880px]/entry:col-span-3 @min-[1024px]/entry:col-span-4 @min-[1024px]/entry:gap-6"
          >
            <Card variant="panel" title="Tóm tắt phiếu nhập" actions={<Badge>Nháp</Badge>}>
              <div className="flex flex-col gap-3">
                <KV k="Số con">{n}</KV>
                <KV k="Loại nhập">{isBuy ? 'Mua ngoài · theo phiếu' : 'Bê sinh tại trại'}</KV>
                {isBuy ? (
                  <KV k="Tổng cân nặng">{`${money(totalWeight)} kg${estimatedCount ? ` (${estimatedCount} con ước tính)` : ''}`}</KV>
                ) : (
                  <KV k="Tổng cân sơ sinh">{`${money(calfWeight)} kg${calfEstimated ? ` (${calfEstimated} con ước tính)` : ''}`}</KV>
                )}
                {isBuy && <KV k="Tổng phải trả">{money(total)} đ</KV>}
                {isBuy ? (
                  <KV k="Chuồng nhận">
                    <span className="text-xs font-semibold">
                      {barnAfter.length ? barnAfter.map((b) => `${barnLabel(b)} (${b.count}/${b.capacity} → ${b.after}/${b.capacity})`).join(' · ') : '—'}
                    </span>
                  </KV>
                ) : (
                  <>
                    <KV k="Chuồng nhận">{picked.length ? `${calfBarn.name} (${calfBarn.count}/${calfBarn.capacity} → ${calfAfter}/${calfBarn.capacity})` : '—'}</KV>
                    <KV k="Giai đoạn sinh trưởng">Bê theo mẹ</KV>
                  </>
                )}
              </div>
              {!isBuy && <Note>Phiếu bê sinh tại trại không có giá và thanh toán.</Note>}
              {!isBuy && calfOver && <Note tone="err">{`Chuồng ${calfBarn.code} không thể nhận thêm (${calfAfter}/${calfBarn.capacity}).`}</Note>}
              {isBuy && estimatedCount > 0 && <Note tone="warn">{`Cân nặng ${estimatedCount} con sẽ được lưu là ƯỚC TÍNH.`}</Note>}
              {isBuy && !quarantine.trim() && <Note tone="warn">Chưa nhập số giấy kiểm dịch. Bạn vẫn có thể lưu phiếu và bổ sung sau.</Note>}
              {isBuy && barnAfter.filter((b) => b.after === b.capacity).map((b) => <Note tone="warn" key={b.code}>{`Chuồng ${b.code} sẽ đầy (${b.after}/${b.capacity}) sau khi nhập.`}</Note>)}
              {isBuy && overflow.map((b) => <Note tone="err" key={b.code}>{`Chuồng ${b.code} vượt sức chứa (${b.after}/${b.capacity}).`}</Note>)}
            </Card>

            <Card variant="panel" title="Kiểm tra trước khi lưu">
              {(isBuy
                ? [
                  'Thẻ tai không trùng với bò đang có trong trại',
                  'Tiêu chí chuồng nhận: phù hợp mục đích, giai đoạn, giới tính và ngưỡng tuổi/cân nặng',
                  overflow.length ? 'Sức chứa chuồng chưa đủ' : `Sức chứa chuồng đủ cho ${cows.length} con`,
                  'Ngày nhập hợp lệ theo hiện tại và ngày sinh',
                ]
                : [
                  'Bê đang Chờ xác nhận, chưa được đăng ký',
                  'Thẻ tai không trùng trong trại',
                  calfOver ? 'Sức chứa chuồng chưa đủ' : `Chuồng ${calfBarn.code} đủ chỗ cho ${picked.length} con`,
                  'Bò mẹ đang ACTIVE trong trại',
                ]
              ).map((t) => (
                <div key={t} className="flex gap-2 text-xs"><Icon name="circle-check" size={14} className="mt-px shrink-0 text-brand" />{t}</div>
              ))}
            </Card>

            <Card variant="panel">
              <Checkbox checked={printQr} onChange={(e) => setPrintQr(e.target.checked)}>
                <span className="text-[13px]">{`In tem QR cho ${n} con sau khi lưu`}</span>
              </Checkbox>
              {(validationError || attachmentError) && <Note tone="err">{validationError || attachmentError}</Note>}
              {Boolean(saveError) && <Note tone="err">{displayError(saveError)}</Note>}
              <Button variant="primary" block disabled={!n || blocked || loading} onClick={() => { void save('Đã nhập').catch(() => undefined) }}>
                <Icon name="circle-check" />{`Lưu & tạo hồ sơ ${n} con`}
              </Button>
              <Button block disabled={loading} onClick={() => { void save('Nháp').catch(() => undefined) }}>Lưu nháp phiếu</Button>
              <Button variant="link" block onClick={() => nav('/herd-entry')}>Hủy</Button>
            </Card>
          </section>
        </div>

        <Foot>
          {isBuy
            ? 'Phiếu nhập gom nhiều con cùng nguồn; khi lưu, mỗi con được tạo hồ sơ, mã bò, thẻ QR và phân chuồng; tiền bò và công nợ tính theo phiếu.'
            : 'Chỉ bê có kết quả đẻ đang Chờ xác nhận mới được chọn; khi lưu, mỗi bê được tạo hồ sơ, mã bò, thẻ QR và xếp vào chuồng nhận.'}
        </Foot>
      </div>

      {isBuy && editing >= 0 && (
        <RowEditModal
          key={editing}
          cow={cows[editing]}
          index={editing}
          recordId={recordId}
          dateIso={date}
          pens={importBarns}
          vaccines={vaccines ?? []}
          breeds={breeds ?? []}
          others={cows.filter((_, idx) => idx !== editing)}
          onSave={(next) => { patchCow(editing, { ...next, pricing }); closeModal() }}
          onRemove={() => { setCows(cows.filter((_, idx) => idx !== editing)); closeModal() }}
          onClose={closeModal}
        />
      )}
      {isBuy && paymentModalOpen && (
        <PayModal
          record={{
            id: recordId,
            status: draftRow?.status ?? 'Nháp',
            total,
            debt,
            source: source.name,
            detail: { sourceName: source.name, payments: paid > 0 ? [{ date: dmy(date), by: receiver, method, ref: '', amount: paid }] : [] },
          }}
          onSave={(payment) => {
            if (payment.amount <= 0 || payment.amount > total) {
              setValidationError(payment.amount <= 0 ? 'Số tiền thanh toán phải lớn hơn 0.' : 'Số tiền thanh toán không được vượt quá tổng phải trả.')
              return
            }
            // Initial payment is sent with the voucher POST. The standalone
            // payment endpoint is used from ImportDetail after the voucher is posted.
            setPaid(payment.amount)
            setMethod(payment.method)
            setDue(payment.date)
            setPaymentModalOpen(false)
            setValidationError(null)
          }}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}
      {isBuy && m === 'excel' && (
        <ExcelModal
          recordId={recordId}
          onBackendPreview={entryExcelBackendEnabled ? prepareBackendExcel : undefined}
          onBackendCommit={entryExcelBackendEnabled ? commitBackendExcel : undefined}
          onDownloadTemplate={entryExcelBackendEnabled ? downloadEntryImportTemplate : undefined}
          onAdd={(added) => {
            const mapped = added.map((cow) => ({
              tag: cow.tag ?? '', name: cow.name ?? '', breed: cow.breed ?? '', sex: cow.sex ?? 'Cái', dob: cow.dob ?? '',
              dobAccuracy: cow.dobAccuracy ?? 'Không rõ', stage: cow.stage ?? '', purpose: cow.purpose ?? '', weight: cow.weight ?? 0,
              estimated: cow.estimated ?? false, weightBasis: cow.weightBasis ?? (cow.weight > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null), barn: cow.barn ?? importBarns[0]?.code ?? '', unitPrice: cow.unitPrice ?? 0, pricing: cow.pricing ?? 'kg',
              hist: cow.hist ?? { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
            }))
            setCows(entryExcelBackendEnabled ? mapped : [...cows, ...mapped])
            setTemporaryExcelDraftId(null)
            closeModal()
          }}
          onClose={() => { void cancelExcelImport() }}
        />
      )}
    </Layout>
  )
}
