import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Checkbox, DateInput, Docs, Dropzone, Field, Foot, KV, Note, Segmented, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { useModalParam } from '../../../components/Modal'
import {
  commitEntryExcel,
  discardHerdEntryDraft,
  downloadEntryAttachment,
  downloadEntryImportTemplate,
  entryExcelBackendEnabled,
  herdEntryApi,
  saveHerdEntry,
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
  removeEntryAttachment,
} from '../api/index'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { PAY_METHODS, PURPOSES } from '../data/entryData'
import { INITIAL_COWS, TODAY, ageOf, blankCow } from '../data/importsData'
import { dmy, money } from '../../../data/format'
import { GhostSelect } from '../components/parts'
import RowEditModal from '../components/RowEditModal'
import ExcelModal from '../components/ExcelModal'
import PayModal from '../components/PayModal'
import { validateEntryForPost } from '../entryValidation'
import type { DocumentRow, EntryCalf, EntryCow, HerdEntry, Pen } from '../../../types'
import type { EntryBreedOption, EntryParentOption } from '../api/herdEntryBackendApi'
import { userFacingError } from '../../../api/userFacingError'

const TH = 'px-1! first:pl-3! last:pr-3!'
const KIND_BUY = 'Mua ngoài'
const KIND_CALF = 'Bê sinh tại trại'
const PURPOSE_CHOICES = PURPOSES.map((p) => ({ value: p, label: p }))
type EntryInput = Pick<EntryCow, 'code' | 'tag' | 'breed' | 'sex' | 'weight' | 'barn'> & { [key: string]: unknown }
type Calf = EntryCalf
const barnLabel = (b: Pen & { showName?: boolean }) => (b.showName ? `${b.code} ${b.name.split(' – ')[1]}` : b.code)
const num = (v: unknown) => Number(v) || 0
const displayError = userFacingError
const localToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
  const { mutate: persistEntry, loading, error: saveError } = useMutation(saveHerdEntry)
  const nav = useNavigate()
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
  const calfBarn = canonicalPens.find((pen) => pen.status === 'ACTIVE') ?? {
    code: '', name: 'Chưa chọn chuồng', count: 0, capacity: 0, status: 'INACTIVE' as const, cows: [],
  }
  const barnOptions = importBarns.map((barn) => ({ value: barn.code, label: barn.name }))
  const calfBarnOptions = canonicalPens.filter((pen) => pen.status === 'ACTIVE').map((pen) => ({ value: pen.code, label: pen.name }))
  const typeLocked = Boolean(draftRow)
  const nextNumber = Math.max(0, ...imports.map((row) => Number(row.id?.split('-')[2]) || 0)) + 1
  const initialRecordId = draftRow?.id ?? (entryExcelBackendEnabled ? 'Tự động khi lưu' : `PN-2026-${String(nextNumber).padStart(4, '0')}`)
  const setKind = (next: string) => {
    if (typeLocked) return
    const query = new URLSearchParams(params)
    if (next === KIND_CALF) query.set('kind', 'calf')
    else query.delete('kind')
    setParams(query)
  }

  const [sourceId, setSourceId] = useState(draft?.sourceId ?? sellers[0]?.id ?? '')
  const [date, setDate] = useState(draft?.date ?? (entryExcelBackendEnabled ? localToday() : TODAY))
  const [quarantine, setQuarantine] = useState(draft?.quarantine ?? '')
  const [plate, setPlate] = useState(draft?.plate ?? '')
  const [receiver, setReceiver] = useState(draft?.receiver ?? (entryExcelBackendEnabled ? '' : 'Anh A'))
  const [note, setNote] = useState(draft?.note ?? '')
  const [cows, setCows] = useState<EntryCow[]>(draft?.cows ?? (entryExcelBackendEnabled ? [] : INITIAL_COWS))
  const [calves, setCalves] = useState<Calf[]>(draft?.calves ?? pendingCalves)
  const [directCalfCount, setDirectCalfCount] = useState(0)
  const [freight, setFreight] = useState(draft?.freight ?? (entryExcelBackendEnabled ? 0 : 1500000))
  const [paid, setPaid] = useState(draft?.paid ?? (entryExcelBackendEnabled ? 0 : 40000000))
  const [method, setMethod] = useState(draft?.method ?? (entryExcelBackendEnabled ? '' : PAY_METHODS[0]))
  const [due, setDue] = useState(draft?.due ?? (entryExcelBackendEnabled ? '' : '2026-11-05'))
  // Payment belongs to the entry voucher (not an individual cattle row). Keep
  // the editor behind an explicit CTA so the payment action is discoverable.
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [printQr, setPrintQr] = useState(draft?.printQr ?? true)
  const [documents, setDocuments] = useState<File[]>([])
  const [storedDocuments, setStoredDocuments] = useState<DocumentRow[]>(draftRow?.detail?.docs ?? [])
  const [persistedRecordId, setPersistedRecordId] = useState<string | null>(draftRow?.id ?? null)
  const [temporaryExcelDraftId, setTemporaryExcelDraftId] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const recordId = persistedRecordId ?? initialRecordId
  const backTarget = (location.state as { from?: string } | null)?.from
  const backPath = backTarget === '/cattle' ? '/cattle' : '/herd-entry'

  const source = sellers.find((s) => s.id === sourceId) ?? sellers[0] ?? { id: '', name: '', phone: '' }
  // Pricing is selected per cattle line: by kg or per head.
  const lineAmount = (c: EntryCow) => c.pricing === 'con' ? (c.unitPrice ?? 0) : (c.weightBasis ? (c.weight ?? 0) * (c.unitPrice ?? 0) : 0)
  const cowsMoney = cows.reduce((s, c) => s + lineAmount(c), 0)
  const totalWeight = cows.reduce((s, c) => s + (c.weight ?? 0), 0)
  const total = cowsMoney + freight
  const debt = Math.max(total - paid, 0)
  const estimatedCount = cows.filter((c) => c.estimated).length
  const barnAfter = importBarns.map((b) => ({ ...b, after: b.count + cows.filter((c) => c.barn === b.code).length })).filter((b) => b.after !== b.count)
  const overflow = barnAfter.filter((b) => b.after > b.capacity)

  const picked = calves.filter((c) => c.picked)
  const calfWeight = picked.reduce((s, c) => s + c.weight, 0)
  const calfEstimated = picked.filter((c) => c.estimated).length
  const calfAfter = calfBarn.count + picked.length
  const calfOver = picked.some((calf) => {
    const pen = canonicalPens.find((candidate) => candidate.code === calf.barn)
    const count = picked.filter((row) => row.barn === calf.barn).length
    return !pen || pen.status !== 'ACTIVE' || pen.count + count > pen.capacity
  })
  const n = isBuy ? cows.length : picked.length

  const patchCow = (i: number, p: Partial<EntryCow>) => setCows(cows.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  const patchCalf = (i: number, p: Partial<Calf>) => setCalves(calves.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
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
  const createDirectCalves = (count: number) => {
    const n = Math.max(0, Math.min(10, Math.trunc(count || 0)))
    setDirectCalfCount(n)
    setCalves(Array.from({ length: n }, (_, index) => ({
      name: `Bê số ${index + 1}`, tag: '', mother: '', father: 'Không rõ', damId: undefined, sireId: undefined,
      born: date, sex: 'Cái', weight: 0, estimated: false, purpose: 'Chưa xác định', picked: true, barn: calfBarn.code,
      calfOutcomeId: undefined,
    })))
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
  const addDocuments = (files: File[]) => {
    const invalid = files.find((file) => !['application/pdf', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setValidationError(`Tệp ${invalid.name} không hợp lệ. Chỉ nhận PDF/JPG tối đa 10MB.`)
      return
    }
    setValidationError(null)
    setDocuments((current) => [...current, ...files.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
  }
  const viewDocument = async (index: number) => {
    try {
      if (index < storedDocuments.length) {
        const document = storedDocuments[index]
        const attachmentId = Number(document.id)
        if (!persistedRecordId || !Number.isFinite(attachmentId)) throw new Error('Không xác định được chứng từ đã lưu')
        const blob = await downloadEntryAttachment(persistedRecordId, attachmentId)
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }
      const file = documents[index - storedDocuments.length]
      if (!file) return
      const url = URL.createObjectURL(file)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setValidationError(displayError(error))
    }
  }
  const removeDocument = async (index: number) => {
    try {
      if (index < storedDocuments.length) {
        const document = storedDocuments[index]
        const attachmentId = Number(document.id)
        if (!persistedRecordId || !Number.isFinite(attachmentId)) throw new Error('Không xác định được chứng từ đã lưu')
        await removeEntryAttachment(persistedRecordId, attachmentId)
        setStoredDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index))
        return
      }
      const localIndex = index - storedDocuments.length
      setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== localIndex))
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
          amount: isBuy ? lineAmount(cows[index]) : 0,
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
    const saved = await persistEntry({ id: saveId, record, cattleRows: entryExcelBackendEnabled || status === 'Đã nhập' ? inputs : [], documents })
    setPersistedRecordId(saved.id)
    if (saved.detail?.docs) {
      setStoredDocuments(saved.detail.docs)
      setDocuments([])
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
      <div className="contents leading-[normal]">
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
              {isBuy ? 'Mỗi con trong phiếu sẽ được tạo 1 mã nội bộ cố định và thẻ QR khi lưu.' : 'Bê được tạo từ sự kiện đẻ đang ở trạng thái Chờ xác nhận.'}
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

        <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card title="1. Thông tin phiếu">
              <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
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
                  <Field id="entry-receiver" label="Người nhập *"><input id="entry-receiver" className={inputCls} value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
                </div>
                <Field id="entry-note" label={isBuy ? 'Ghi chú khi nhận bò' : 'Ghi chú'}>
                  <input id="entry-note" maxLength={1000} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </div>
            </Card>

            {isBuy ? (
              <Card
                title={`2. Danh sách bò trong phiếu (${cows.length} con)`}
                sub='Lịch sử trước nhập đàn mặc định "Không rõ" · sửa từng con bằng ✎'
                actions={
                  <>
                    <Button small onClick={() => openModal('excel')}>Nhập từ Excel</Button>
                    <Button small onClick={() => { setCows([...cows, blankCow(importBarns[0]?.code ?? '')]); openModal(`row-${cows.length + 1}`) }}>+ Thêm con</Button>
                  </>
                }
              >
                <div className="max-h-[420px] overflow-auto rounded-md">
                <Table wide>
                  <thead>
                    <tr>
                      <Th className={`${TH} w-[20px]`}>#</Th>
                      <Th className={`${TH} w-[70px]`}>Thẻ tai</Th>
                      <Th className={`${TH} w-[150px]`}>Giống · giới tính · nhóm</Th>
                      <Th className={`${TH} w-[60px]`}>Tuổi</Th>
                      <Th className={`${TH} w-[70px]`}>Cân nặng</Th>
                      <Th className={`${TH} w-[100px]`}>Chuồng nhận</Th>
                      <Th className={`${TH} w-[90px]`}>Đơn giá</Th>
                      <Th className={`${TH} w-[80px]`}>Thành tiền</Th>
                      <Th className={`${TH} w-[20px]`} />
                      <Th className={TH} />
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
                        <Td className={TH}>{money(c.unitPrice ?? 0)} <span className="text-[10px] text-muted">đ/{c.pricing === 'con' ? 'con' : 'kg'}</span></Td>
                        <Td className={`${TH} whitespace-nowrap`}>{money(lineAmount(c))}</Td>
                        <Td className={TH}>
                          <button type="button" aria-label={`Sửa con #${i + 1}`} className="cursor-pointer border-0 bg-transparent p-1 text-muted hover:text-brand" onClick={() => openModal(`row-${i + 1}`)}>✎</button>
                        </Td>
                        <Td className={TH} />
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
                      <Td className={TH} /><Td className={TH} />
                    </tr>
                  </tfoot>
                </Table>
                </div>
                <p className="m-0 text-[11px] text-muted">
                  UT = cân nặng ước tính. Con chưa có thẻ tai vẫn được tạo hồ sơ & QR, gắn thẻ sau. Mỗi dòng được kiểm tra tiêu chí và sức chứa của chuồng nhận.
                </p>
              </Card>
            ) : (
              <Card title="2. Chọn bê chờ xác nhận" sub={`${picked.length} / ${calves.length} bê được chọn`}>
                {calves.length === 0 && (
                  <div className="mb-3 flex items-end gap-3 rounded-md border border-field bg-page p-3">
                    <Field label="Số lượng bê muốn nhập *">
                      <input aria-label="Số lượng bê muốn nhập" type="number" min="1" max="10" value={directCalfCount || ''} onChange={(e) => createDirectCalves(Number(e.target.value))} className="w-28 rounded border border-field bg-white px-2 py-1 text-sm" placeholder="Ví dụ: 2" />
                    </Field>
                    <span className="pb-1 text-xs text-muted">Tạo tối đa 10 dòng để nhập bố/mẹ, giống, ngày sinh, giới tính và cân sơ sinh.</span>
                  </div>
                )}
                <div className="max-h-[420px] overflow-auto rounded-md">
                <Table wide>
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
                        <Td className={TH}>{c.tag || 'Chưa gắn thẻ'}<br />{c.name}</Td>
                        <Td className={TH}>
                          <select aria-label={`Bò mẹ của bê ${i + 1}`} className="w-full min-w-[150px] rounded border border-field bg-white px-2 py-1 text-[11px]" value={String(c.damId ?? '')} disabled={!parentCattle.some((row) => row.sex === 'FEMALE')} onChange={(e) => { const option = parentCattle.find((row) => String(row.id) === e.target.value); const next = { damId: option?.id, mother: option?.code ?? '' }; patchCalf(i, next); void persistCalfParentage(c, next) }}>
                            <option value="">{c.mother ? `Đang chọn: ${c.mother}` : 'Chọn bò mẹ trong đàn'}</option>
                            {parentCattle.filter((row) => row.sex === 'FEMALE').map((row) => <option key={row.id} value={row.id}>{row.code}{row.name ? ` · ${row.name}` : ''}</option>)}
                          </select>
                        </Td>
                        <Td className={TH}>
                          <select aria-label={`Bò bố của bê ${i + 1}`} className="w-full min-w-[190px] rounded border border-field bg-white px-2 py-1 text-[11px]" value={c.sireSource === 'AI' ? 'AI' : String(c.sireId ?? '')} onChange={(e) => { const option = parentCattle.find((row) => String(row.id) === e.target.value); const next = e.target.value === 'AI' ? { sireId: undefined, sireSource: 'AI', father: 'Thụ tinh nhân tạo' } : { sireId: option?.id, sireSource: option ? 'INTERNAL' : 'NONE', father: option?.code ?? 'Không rõ' }; patchCalf(i, next); void persistCalfParentage(c, next) }}>
                            <option value="">{c.sireId ? `Đang chọn: ${c.father}` : (c.father && c.father !== 'Không rõ' ? c.father : 'Chọn bò bố hoặc thụ tinh nhân tạo')}</option>
                            <option value="AI">Thụ tinh nhân tạo</option>
                            {parentCattle.filter((row) => row.sex === 'MALE').map((row) => <option key={row.id} value={row.id}>{row.code}{row.name ? ` · ${row.name}` : ''}</option>)}
                          </select>
                          {c.sireSource === 'AI' && <input aria-label={`Mã nguồn tinh cho bê ${i + 1}`} className="mt-1 w-full rounded border border-field px-2 py-1 text-[11px]" placeholder="Mã lô tinh / nguồn tinh" value={String(c.externalSireCode ?? '')} onChange={(e) => { const next = { externalSireCode: e.target.value }; patchCalf(i, next); void persistCalfParentage(c, next) }} />}
                          {(c.sireSource || c.externalSireName || c.semenBatch || c.sireBreed) && <small className="block text-[10px] text-muted">
                            {[c.sireSource, c.externalSireName, c.semenBatch, c.sireBreed ? `Giống ${c.sireBreed}` : ''].filter(Boolean).join(' · ')}
                          </small>}
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
                </div>
                <p className="m-0 text-[11px] text-muted">
                  Bố, mẹ, nguồn bố (bò nội bộ, bố ngoài đàn hoặc lô tinh), giống, giới tính và cân sơ sinh lấy từ sự kiện đẻ – chỉ đọc, không sửa ở phiếu nhập. Ngày nhập đàn của bê = ngày sinh; giai đoạn = Bê theo mẹ. Bê chưa gắn thẻ vẫn chọn được, hệ thống cấp mã và QR. Bê đã chết trước khi đăng ký được đánh dấu tại đây.
                </p>
              </Card>
            )}

            <div className={`grid items-start gap-[18px] ${isBuy ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
              <Card title="3. Chứng từ đính kèm" sub={isBuy ? undefined : 'Không bắt buộc'}>
                <Dropzone
                  hint={isBuy ? 'PDF, JPG ≤ 10MB' : 'Ảnh bê, biên bản đỡ đẻ · PDF, JPG ≤ 10MB'}
                  onFiles={addDocuments}
                />
                {(storedDocuments.length > 0 || documents.length > 0) && (
                  <Docs
                    docs={[...storedDocuments, ...documents.map((file) => ({ ext: file.type === 'application/pdf' ? 'PDF' : 'JPG', name: file.name }))]}
                    onView={viewDocument}
                    onRemove={removeDocument}
                  />
                )}
              </Card>
              {isBuy && (
                <Card title="4. Thông tin thanh toán" actions={<Button size="sm" variant="primary" onClick={() => setPaymentModalOpen(true)}>Thanh toán</Button>}>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span>Tổng phải trả: <strong className="text-ink">{money(total)} đ</strong></span>
                    <span>Đã trả: <strong className="text-ink">{money(paid)} đ</strong> · Còn nợ: <strong className="text-ink">{money(debt)} đ</strong></span>
                  </div>
                </Card>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[18px]">
            <Card title="Tóm tắt phiếu nhập" actions={<Badge>Nháp</Badge>}>
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

            <Card title="Kiểm tra trước khi lưu">
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
                <div key={t} className="flex gap-2 text-xs"><span className="font-semibold text-brand">✓</span>{t}</div>
              ))}
            </Card>

            <Card>
              <Checkbox checked={printQr} onChange={(e) => setPrintQr(e.target.checked)}>
                <span className="text-[13px]">{`In tem QR cho ${n} con sau khi lưu`}</span>
              </Checkbox>
              {validationError && <Note tone="err">{validationError}</Note>}
              {Boolean(saveError) && <Note tone="err">{displayError(saveError)}</Note>}
              <Button variant="primary" block disabled={!n || blocked || loading} onClick={() => { void save('Đã nhập').catch(() => undefined) }}>
                {`Lưu & tạo hồ sơ ${n} con`}
              </Button>
              <Button variant="link" block onClick={() => nav('/herd-entry')}>Hủy</Button>
            </Card>
          </div>
        </div>

        <Foot>
          {isBuy
            ? 'Phiếu nhập gom nhiều con cùng nguồn; khi lưu, mỗi con được tạo hồ sơ, mã nội bộ, thẻ QR và phân chuồng; tiền bò và công nợ tính theo phiếu.'
            : 'Chỉ bê có kết quả đẻ đang Chờ xác nhận mới được chọn; khi lưu, mỗi bê được tạo hồ sơ, mã nội bộ, thẻ QR và xếp vào chuồng nhận.'}
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
          onSave={(next) => { patchCow(editing, next); closeModal() }}
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
