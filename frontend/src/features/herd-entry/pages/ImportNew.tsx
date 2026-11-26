import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { AttachmentList, Modal, ModalButton, ModalFooter, Badge, Button, Card, Checkbox, DateInput, Field, FileDropzone, Icon, Info, inputCls, KV, Note, SearchSelect, Segmented, Table, Td, Th } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { PURPOSES } from '../constants/entryOptions'
import { ageOf, blankCow } from '../domain/entryCow'
import { lineAmount } from '../domain/entryTotals'
import { useEntryEditor } from '../hooks/useEntryEditor'
import { useEntryDraftWorkflow } from '../hooks/useEntryDraftWorkflow'
import { useEntryAttachments } from '../hooks/useEntryAttachments'
import { useEntryCatalogues, useEntryNewQueries } from '../hooks/useEntryNewQueries'
import { useEntryNewCommands } from '../hooks/useEntryNewCommands'
import { dmy, money } from '../../../shared/lib/format'
import { GhostSelect } from '../components/parts'
import RowEditModal from '../components/RowEditModal'
import CalfDeathModal from '../components/CalfDeathModal'
import ExcelModal from '../components/ExcelModal'
import AddSellerModal from '../components/AddSellerModal'
import PayModal from '../components/PayModal'
import { entryToday as localToday, missingKgWeightLines, validateEntryForPost, validateEntryWeights } from '../validation/entryFormValidation'
import type { EntryCalf, EntryCow, HerdEntry } from '../types'
import type { Pen } from '../../pen-management'
import { herdEntryError } from '../api/herdEntryError'
import { useSession } from '../../../app/session/sessionContext'
import { entryReceiverEditable, herdEntryApi, saveEntrySeller, type EntrySeller, type EntrySellerInput } from '../api'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'

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
  const [reloadedDraft, setReloadedDraft] = useState<{ routeId: string | null; row: HerdEntry } | null>(null)
  const [reloadRevision, setReloadRevision] = useState(0)
  const [addedSellers, setAddedSellers] = useState<EntrySeller[]>([])
  const { data, detailedDraft, draftError, canonicalPens, pendingCalves, sellers, getEntryDraftState, newEntryDefaults } = useEntryNewQueries({ draftId: draftId ?? undefined })
  if (!data || !canonicalPens || !pendingCalves || !sellers || (draftId && !detailedDraft && !draftError)) {
    return <Layout title={draftId ? `Sửa phiếu nháp ${detailedDraft?.id ?? draftId}` : 'Phiếu nhập bò mới'} user="manager"><p className="m-0 text-xs text-muted">Đang tải phiếu nhập…</p></Layout>
  }
  if (draftError) {
    return <Layout title={draftId ? `Sửa phiếu nháp ${detailedDraft?.id ?? draftId}` : 'Phiếu nhập bò mới'} user="manager"><Note tone="err">{displayError(draftError)}</Note></Layout>
  }
  const activeDraft = reloadedDraft?.routeId === draftId ? reloadedDraft.row : detailedDraft
  const reloadDraft = async (id: string) => {
    const latest = await herdEntryApi.get(id)
    setReloadedDraft({ routeId: draftId, row: latest })
    setReloadRevision((value) => value + 1)
  }
  if (activeDraft && activeDraft.status !== 'Nháp') return <Layout title="Phiếu nhập"><Note>Phiếu {activeDraft.id} hiện ở trạng thái {activeDraft.status}. Vui lòng mở lại từ danh sách phiếu nhập.</Note></Layout>
  const imports = activeDraft
    ? [...data.filter((row) => row.id !== activeDraft.id), activeDraft]
    : data
  // Keep calves already attached to the draft visible when reopening it. The
  // backend marks those rows with draftVoucherId, so filtering every non-null
  // value used to produce the misleading 0/0 state and hide source birth facts.
  const currentDraftBackendId = Number(activeDraft?.backendId)
  const availablePendingCalves = pendingCalves.filter((calf) => calf.draftVoucherId == null || (Number.isFinite(currentDraftBackendId) && calf.draftVoucherId === currentDraftBackendId))
  // FE-06 field 4 lists ACTIVE sellers; a draft keeps showing the seller it already references.
  const draftSourceId = activeDraft?.draft?.sourceId
  const loadedSellers = sellers.filter((seller) => seller.active !== false || seller.id === draftSourceId)
  const sellerOptions = [...loadedSellers, ...addedSellers.filter((added) => !loadedSellers.some((seller) => seller.id === added.id))]
  const addSeller = async (input: EntrySellerInput, options: { key: string }) => {
    const seller = await saveEntrySeller(input, options)
    setAddedSellers((current) => current.some((row) => row.id === seller.id) ? current : [...current, seller])
    return seller
  }
  return <ImportForm key={`${draftId ?? 'new'}-${params.get('kind') === 'calf' ? 'calf' : 'buy'}-${reloadRevision}`} loadedDraftId={activeDraft?.id} onReload={reloadDraft} imports={imports} canonicalPens={canonicalPens} pendingCalves={availablePendingCalves} sellers={sellerOptions} onAddSeller={addSeller} getEntryDraftState={getEntryDraftState} newEntryDefaults={newEntryDefaults} />
}

function ImportForm({ loadedDraftId, onReload, imports, canonicalPens, pendingCalves, sellers, onAddSeller, getEntryDraftState, newEntryDefaults }: { loadedDraftId?: string; onReload: (id: string) => Promise<void>; imports: HerdEntry[]; canonicalPens: Pen[]; pendingCalves: EntryCalf[]; sellers: EntrySeller[]; onAddSeller: (input: EntrySellerInput, options: { key: string }) => Promise<EntrySeller>; getEntryDraftState: typeof import('../api').getEntryDraftState; newEntryDefaults: typeof import('../api').newEntryDefaults }) {
  const { saveDraft, postEntry, saving: loading, error: saveError } = useEntryDraftWorkflow()
  const nav = useNavigate()
  const sessionName = useSession()?.fullName ?? ''
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [m, openModal, closeModal] = useModalParam()
  const editingParam = params.get('m')
  const editingIndex = editingParam === 'row-new' ? 0 : editingParam?.startsWith('row-') ? Number(editingParam.slice(4)) : -1
  const draftId = loadedDraftId ?? params.get('id') ?? undefined
  const draftState = getEntryDraftState(imports, draftId)
  const draftRow = draftState.row?.status === 'Nháp' ? draftState.row : undefined
  const draft = draftRow?.draft
  const kind = draftRow?.type ?? (params.get('kind') === 'calf' ? KIND_CALF : KIND_BUY)
  const isBuy = kind === KIND_BUY
  const { vaccines, breeds, purposes } = useEntryCatalogues({ editingIndex, isBuy })
  const { commitEntryExcel, discardHerdEntryDraft, downloadEntryImportTemplate, entryExcelBackendEnabled, markCalfDiedBeforeRegistration, previewEntryExcel, getEntry } = useEntryNewCommands()
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

  const editor = useEntryEditor({ draft, defaults, pendingCalves, pens: importBarns, isBuy })
  const { sourceId, setSourceId, date, setDate, quarantine, setQuarantine, plate, setPlate, receiver, setReceiver, note, setNote,
    cows, setCows, pricing, setPricing, calves, setCalves, freight, setFreight, paid, setPaid, method, setMethod, due, setDue,
    printQr, setPrintQr, patchCow, patchCalf, purchase, pensAfter: barnAfter, overflow, calfPen: calfBarn, calvesSummary } = editor
  // Payment belongs to the entry voucher (not an individual cattle row). Keep
  // the editor behind an explicit CTA so the payment action is discoverable.
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [persistedRecordId, setPersistedRecordId] = useState<string | null>(draftRow?.id ?? null)
  const [snapshotRecord, setSnapshotRecord] = useState(draftRow)
  const [commandError, setCommandError] = useState<unknown>(null)
  const [temporaryExcelDraftId, setTemporaryExcelDraftId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [priceResetNotice, setPriceResetNotice] = useState(false)
  const [newCow, setNewCow] = useState<EntryCow>(() => ({...blankCow(importBarns.find(p => p.status === 'ACTIVE')?.code ?? ''),pricing}))
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const removeCow = (index: number) => { setCows(current => current.filter((_,i) => i !== index)); setRemoveIndex(null); closeModal() }

  const recordId = persistedRecordId ?? initialRecordId
  const { documents, storedDocuments, setStoredDocuments, resetDocuments, attachmentError, addDocuments, viewDocument, removeDocument } = useEntryAttachments({ persistedRecordId, initialStored: draftRow?.detail?.docs ?? [] })
  const backTarget = (location.state as { from?: string } | null)?.from
  const backPath = backTarget === '/cattle' ? '/cattle' : '/herd-entry'

  const source = sellers.find((s) => s.id === sourceId) ?? { id: '', name: '', phone: '', area: '' }
  const { cattleAmount: cowsMoney, totalWeight, total, debt, estimatedCount } = purchase

  const { picked, weight: calfWeight, estimatedCount: calfEstimated, after: calfAfter, over: calfOver } = calvesSummary
  const n = isBuy ? cows.length : picked.length
  const missingWeightLines = isBuy ? missingKgWeightLines(cows, pricing) : []
  const changePricing = (next: string) => {
    if (next === pricing) return
    const nextPricing = next as 'kg' | 'con'
    setPriceResetNotice(cows.some((cow) => cow.unitPrice > 0))
    setPricing(nextPricing)
    setCows(cows.map((cow) => ({ ...cow, pricing: nextPricing, unitPrice: 0 })))
  }

  const [deathCalf, setDeathCalf] = useState<Calf | null>(null)
  const [deathNotice, setDeathNotice] = useState('')

  const save = async (status: 'Nháp' | 'Đã nhập', navigateAfter = true): Promise<HerdEntry | undefined> => {
    setValidationError(null)
    setCommandError(null)
    if (status === 'Đã nhập') {
      if (date > localToday()) {
        setValidationError('Ngày nhập không được ở tương lai.')
        return
      }
    }
    if (isBuy) {
      const weightError = validateEntryWeights(cows, pricing)
      if (weightError) { setValidationError(weightError); return }
    }
    const sourceText = isBuy
      ? `${source.name}${quarantine ? ` · ${quarantine}` : ''}${estimatedCount ? ` · ${estimatedCount} con cân ước tính` : ''}`
      : `Bê của ${[...new Set(picked.map((c) => c.mother))].join(', ')}`
    const editableDraft = {
      sourceId, date, quarantine, plate, receiver, note, cows, calves, freight, paid, method, due, printQr, ...(isBuy ? { pricing } : {}),
    }
    const inputs: EntryInput[] = isBuy
      ? cows.map((cow) => ({ ...cow, date }))
      : picked.map((calf) => ({ ...calf, breed: calf.sex === 'Đực' ? 'Bê đực' : 'Bê cái', unitPrice: 0, ageMonths: 0, stage: 'Bê', group: 'Bê', date: calf.born }))
    if (status === 'Đã nhập') {
      const requiredError = validateEntryForPost({
        date,
        type: kind,
        sourceId,
        // Máy chủ tự ghi người tạo / ghi sổ theo phiên; chỉ bản mô phỏng bắt nhập tay.
        receiver: entryReceiverEditable ? receiver : undefined,
        cows: isBuy ? cows : inputs as EntryCow[],
        pricing: isBuy ? pricing : 'kg',
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
          pricing,
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
    record.backendId = snapshotRecord?.backendId
    const saved = await saveCommand({ id: saveId, expectedVersion: snapshotRecord?.version, record, cattleRows: entryExcelBackendEnabled || status === 'Đã nhập' ? inputs : [], documents })
    setSnapshotRecord(saved)
    setPriceResetNotice(false)
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
    const refreshed = await getEntry(targetId)
    setSnapshotRecord(refreshed)
    return refreshed.draft?.cows ?? []
  }
  const cancelExcelImport = async () => {
    setCommandError(null)
    if (temporaryExcelDraftId) {
      try { await discardHerdEntryDraft(temporaryExcelDraftId, snapshotRecord?.version, snapshotRecord?.backendId) }
      catch (error) { setCommandError(error); return }
      setPersistedRecordId(null)
      setSnapshotRecord(undefined)
      setTemporaryExcelDraftId(null)
    }
    closeModal()
  }

  const rowIndex = m && m.startsWith('row-') ? Number(m.slice(4)) - 1 : -1
  const editing = rowIndex >= 0 && rowIndex < cows.length ? rowIndex : -1
  const blocked = isBuy ? overflow.length > 0 : calfOver
  const title = persistedRecordId ? `Sửa phiếu nháp ${recordId}` : 'Phiếu nhập bò mới'
  const adding = m === 'row-new'

  return (
    <Layout title={title} user="manager">
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
            <h1 className="m-0 text-[22px] font-bold">{title}</h1>
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
                      <Field id="entry-source" label="Nguồn / chủ bò cũ *" hint={<>{source.phone ? `${source.phone} · ` : ''}<button type="button" onClick={() => openModal('seller')} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-brand">+ Thêm nguồn mới</button></>}>
                        <SearchSelect
                          id="entry-source"
                          aria-label="Nguồn / chủ bò cũ"
                          value={sourceId}
                          onChange={setSourceId}
                          clearable={false}
                          allLabel="Chọn người bán"
                          options={sellers.map((s) => ({ value: s.id, label: s.name, hint: [s.phone, s.area].filter(Boolean).join(' · ') }))}
                          className="w-full"
                        />
                      </Field>
                      <Field id="entry-quarantine" label="Số giấy kiểm dịch">
                        <input id="entry-quarantine" maxLength={50} className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} />
                      </Field>
                      <Field id="entry-plate" label="Biển số xe">
                        <input id="entry-plate" maxLength={20} className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} />
                      </Field>
                    </>
                  )}
                  <Field id="entry-receiver" label="Người nhập" hint={entryReceiverEditable ? undefined : 'Tự ghi theo người đang đăng nhập'}>
                    <input id="entry-receiver" className={inputCls} value={entryReceiverEditable ? receiver : sessionName} readOnly={!entryReceiverEditable} onChange={entryReceiverEditable ? (e) => setReceiver(e.target.value) : undefined} />
                  </Field>
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
                    <Button small onClick={() => { setNewCow({...blankCow(importBarns.find(p => p.status === 'ACTIVE')?.code ?? ''), pricing}); openModal('row-new') }}><Icon name="circle-plus" />Thêm con</Button>
                  </>
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold">Cách tính giá</span>
                  <Segmented
                    value={pricing}
                    onChange={changePricing}
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
                      {pricing === 'kg' && <Th className={`${TH} w-[90px]`}>Đơn giá/kg</Th>}
                      <Th className={`${TH} w-[80px]`}>Thành tiền</Th>
                      <Th className={`${TH} w-[20px]`} />
                    </tr>
                  </thead>
                  <tbody>
                    {cows.length === 0 && (
                      <tr><Td colSpan={pricing === 'kg' ? 9 : 8} className={`${TH} py-6 text-center text-muted`}>Trống</Td></tr>
                    )}
                    {cows.map((c, i) => (
                      <tr key={i}>
                        <Td className={TH}>{i + 1}</Td>
                        <Td className={TH}>{c.tag || <span className="text-muted">Gắn sau</span>}</Td>
                        <Td className={TH}>{`${c.breed || '—'} · ${c.sex} · ${c.stage}`}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{c.dob ? `~${ageOf(c.dob, date)} th` : c.ageMonths != null ? `~${c.ageMonths} th` : '—'}</Td>
                        <Td className={`${TH} whitespace-nowrap`}>{`${money(c.weight)} kg${c.estimated ? ' UT' : ''}`}</Td>
                        <Td className={TH}>
                          <GhostSelect value={c.barn} onChange={(barn) => patchCow(i, { barn })} options={barnOptions} />
                        </Td>
                        {pricing === 'kg' && <Td className={`${TH} whitespace-nowrap`}>{money(c.unitPrice ?? 0)}</Td>}
                        <Td className={`${TH} whitespace-nowrap`}>{money(lineAmount(c, pricing))}</Td>
                        <Td className={TH}>
                          <button type="button" aria-label={`Sửa con #${i + 1}`} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-brand" onClick={() => openModal(`row-${i + 1}`)}><Icon name="pencil" size={14} /></button>
                          <button type="button" aria-label={`Xóa con #${i + 1}`} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-err-fg" onClick={() => setRemoveIndex(i)}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  {cows.length > 0 && <tfoot>
                    <tr className="font-semibold">
                      <Td className={TH} />
                      <Td className={TH}>{cows.length} con</Td>
                      <Td className={TH} /><Td className={TH} />
                      <Td className={`${TH} whitespace-nowrap`}>{`${money(totalWeight)} kg`}</Td>
                      <Td className={TH} />{pricing === 'kg' && <Td className={TH} />}
                      <Td className={`${TH} whitespace-nowrap`}>{money(cowsMoney)}</Td>
                      <Td className={TH} />
                    </tr>
                  </tfoot>}
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  UT = cân nặng ước tính. Con chưa có thẻ tai vẫn được tạo hồ sơ & QR, gắn thẻ sau. Mỗi dòng được kiểm tra tiêu chí và sức chứa của chuồng nhận.
                </p>
              </Card>
            ) : (
              <Card variant="panel" title="2. Chọn bê chờ xác nhận" sub={`${picked.length} / ${calves.length} bê được chọn`}>
                {deathNotice && <Note tone="ok">{deathNotice}</Note>}
                {calves.length === 0 && <Note>Chưa có bê chờ xác nhận. Hãy ghi kết quả lần đẻ tại Sinh sản rồi quay lại chọn bê.</Note>}
                <Table scroll>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`} />
                      <Th className={`${TH} w-[90px]`}>Bê · thẻ tai</Th>
                      <Th className={`${TH} w-[170px]`}>Mẹ</Th>
                      <Th className={`${TH} w-[210px]`}>Bố / nguồn tinh</Th>
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
                        <Td className={TH}><span className="whitespace-nowrap">{c.mother || 'Không rõ'}</span></Td>
                        <Td className={TH}><span className="whitespace-nowrap">{c.sireSource === 'AI' || c.semenBatch
                          ? `TTNT · ${c.semenBatch || c.externalSireName || c.father || 'Không rõ'}` : c.father || 'Không rõ'}</span></Td>
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
                            <button type="button" aria-label="Đánh dấu chết trước đăng ký" className="min-w-[120px] cursor-pointer border-0 bg-transparent p-1 text-left text-[11px] font-semibold text-err-fg [overflow-wrap:normal] hover:underline" onClick={() => setDeathCalf(c)}>
                              Đánh dấu chết trước đăng ký
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <p className="m-0 text-[11px] text-muted">
                  Bố, mẹ, nguồn bố (bò nội bộ, bố ngoài đàn hoặc lô tinh), giống, giới tính và cân sơ sinh lấy từ sự kiện đẻ – chỉ đọc, không sửa ở phiếu nhập. Ngày nhập đàn của bê = ngày sinh; giai đoạn = Bê theo mẹ. Bê chưa gắn thẻ vẫn chọn được, hệ thống cấp mã và QR. Muốn sửa bố mẹ, hãy sửa bản ghi lần phối / lần đẻ nguồn. Bê đã chết trước khi đăng ký được đánh dấu tại đây sau khi xác nhận.
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
                <KV k="Loại nhập">{isBuy ? 'Mua ngoài' : 'Bê sinh tại trại'}</KV>
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
              {isBuy && estimatedCount > 0 && <Note tone="err">{`Cân nặng ${estimatedCount} con sẽ được lưu là ƯỚC TÍNH.`}</Note>}
              {missingWeightLines.length > 0 && <Note tone="err">{`Con ${missingWeightLines.slice(0, 5).map((line) => `#${line}`).join(', ')}${missingWeightLines.length > 5 ? ` và ${missingWeightLines.length - 5} con khác` : ''} chưa có cân. Bạn vẫn lưu nháp được, nhưng cần nhập cân trước khi ghi sổ.`}</Note>}
              {isBuy && priceResetNotice && <Note tone="err">{`Đã đổi cách tính giá sang ${pricing === 'con' ? 'Theo con' : 'Theo kg'}. Đơn giá các dòng đã được đặt về 0, vui lòng nhập lại.`}</Note>}
              {isBuy && !quarantine.trim() && <Note tone="err">Chưa nhập số giấy kiểm dịch. Bạn vẫn có thể lưu phiếu và bổ sung sau.</Note>}
              {isBuy && barnAfter.filter((b) => b.after === b.capacity).map((b) => <Note tone="err" key={b.code}>{`Chuồng ${b.code} sẽ đầy (${b.after}/${b.capacity}) sau khi nhập.`}</Note>)}
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
              <VoucherCommandError error={commandError ?? saveError} formatError={displayError} onReload={() => onReload(recordId)} />
              <Button variant="primary" block disabled={!n || blocked || loading} onClick={() => { void save('Đã nhập').catch(() => undefined) }}>
                <Icon name="circle-check" />{`Lưu & tạo hồ sơ ${n} con`}
              </Button>
              <Button block disabled={loading} onClick={() => { void save('Nháp').catch(() => undefined) }}>Lưu nháp phiếu</Button>
              <Button variant="link" block onClick={() => nav('/herd-entry')}>Hủy</Button>
            </Card>
          </section>
        </div>

      </div>

      {deathCalf && <CalfDeathModal calf={deathCalf} onClose={() => setDeathCalf(null)} onConfirm={async reason => {
        const id = deathCalf.calfOutcomeId
        if (typeof id !== 'number' || !Number.isFinite(id)) throw new Error('Không tìm thấy kết quả bê nguồn.')
        await markCalfDiedBeforeRegistration(id, reason)
        setCalves(current => current.filter(row => row.calfOutcomeId !== id))
        setDeathNotice('Đã đánh dấu bê chết trước khi đăng ký.')
        setDeathCalf(null)
      }} />}

      {isBuy && (adding || editing >= 0) && (
        <RowEditModal
          key={adding ? 'new' : editing}
          cow={adding ? newCow : cows[editing]}
          isNew={adding}
          index={adding ? cows.length : editing}
          recordId={recordId}
          dateIso={date}
          pricing={pricing}
          pens={importBarns}
          vaccines={vaccines ?? []}
          breeds={breeds ?? []}
          purposes={purposes ?? undefined}
          others={adding ? cows : cows.filter((_, idx) => idx !== editing)}
          onSave={(next) => { if (adding) setCows(current => [...current,{...next,pricing}]); else patchCow(editing, { ...next, pricing }); setPriceResetNotice(false); closeModal() }}
          onRemove={() => removeCow(editing)}
          onClose={closeModal}
        />
      )}
      {removeIndex != null && <Modal title={`Xóa con #${removeIndex + 1} khỏi phiếu?`} width={420} onClose={() => setRemoveIndex(null)}><p>Con này sẽ được bỏ khỏi phiếu nháp.</p><ModalFooter><ModalButton onClick={() => setRemoveIndex(null)}>Hủy</ModalButton><ModalButton variant="primary" onClick={() => removeCow(removeIndex)}>Xóa con</ModalButton></ModalFooter></Modal>}
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
          draftPayment={{
            freight,
            cattleAmount: cowsMoney,
            onSave: (nextFreight, payment) => {
              setFreight(nextFreight)
              setPaid(payment.amount)
              if (payment.amount > 0) {
                setMethod(payment.method)
                setDue(payment.date)
              }
              setPaymentModalOpen(false)
              setValidationError(null)
            },
          }}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}
      {isBuy && m === 'seller' && (
        <AddSellerModal
          onClose={closeModal}
          onSave={async (input, options) => {
            const seller = await onAddSeller(input, options)
            setSourceId(seller.id)
            closeModal()
            return seller
          }}
        />
      )}
      {isBuy && m === 'excel' && (
        <ExcelModal
          commandError={commandError ?? saveError}
          onReload={() => onReload(recordId)}
          recordId={recordId}
          onBackendPreview={entryExcelBackendEnabled ? prepareBackendExcel : undefined}
          onBackendCommit={entryExcelBackendEnabled ? commitBackendExcel : undefined}
          onDownloadTemplate={entryExcelBackendEnabled ? downloadEntryImportTemplate : undefined}
          onAdd={(added) => {
            // Backend mode: the lines come back from the server already mapped (ids, age, markings, quarantine); keep them whole.
            const mapped = entryExcelBackendEnabled ? added.map((cow) => ({ ...cow, pricing })) : added.map((cow) => ({
              tag: cow.tag ?? '', name: cow.name ?? '', breed: cow.breed ?? '', sex: cow.sex ?? 'Cái', dob: cow.dob ?? '',
              dobAccuracy: cow.dobAccuracy ?? 'Không rõ', stage: cow.stage ?? '', purpose: cow.purpose ?? '', weight: cow.weight ?? 0,
              estimated: cow.estimated ?? false, weightBasis: cow.weightBasis ?? (cow.weight > 0 ? (cow.estimated ? 'ESTIMATED' : 'MEASURED') : null), barn: cow.barn ?? importBarns[0]?.code ?? '', unitPrice: cow.unitPrice ?? 0, pricing,
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
