import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Checkbox, DateInput, Docs, Dropzone, Field, Foot, Note, Segmented, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { useModalParam } from '../../../components/Modal'
import { BARNS, PAY_METHODS } from '../data/exitData'
import { todayIso } from '../data/exportsData'
import { dm, money } from '../../../data/format'
import { backendMode } from '../../../api/backendTransport'
import { confirmHerdExit, downloadExitAttachment, getExitDraftState, herdExitApi, removeExitAttachment, saveHerdExit, pens, listExitBuyers, listSelectableExitCattle } from '../api/index'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { Icon } from '../../../components/Icon'
import { Box, CheckList, ExitStatusBadge, MoneyInput, SummaryCard, TH, cx, useIsOwner } from '../components/parts'
import PickModal from '../components/PickModal'
import type { ExitDraftCow, HerdExit, ExitType } from '../../../types'
import { userFacingError } from '../../../api/userFacingError'
import type { ExitChecks } from '../api/herdExitBackendApi'

const TYPES: ExitType[] = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const displayError = userFacingError
type HerdCow = { code: string; backendId?: number; tag: string; breed: string; sex: string; age: string; group: string; groupKey?: string; stage: string; stageKey?: string; barn: string; weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string; penCount?: number; penCapacity?: number }
const normalizeHerdCow = (cow: ExitDraftCow, source?: HerdCow): HerdCow => {
  return {
    code: cow.code || source?.code || '',
    ...(typeof cow.backendId === 'number' ? { backendId: cow.backendId } : source?.backendId ? { backendId: source.backendId } : {}),
    tag: cow.tag || '',
    breed: source?.breed || cow.breed || '',
    sex: source?.sex || cow.sex || '',
    age: source?.age || cow.age || '',
    group: source?.group || cow.group || '',
    ...(typeof cow.groupKey === 'string' ? { groupKey: cow.groupKey } : source?.groupKey ? { groupKey: source.groupKey } : {}),
    stage: source?.stage || cow.stage || '',
    ...(typeof cow.stageKey === 'string' ? { stageKey: cow.stageKey } : source?.stageKey ? { stageKey: source.stageKey } : {}),
    barn: cow.barn || source?.barn || '',
    weight: cow.weight ?? source?.weight ?? 0,
    weightNote: cow.weightNote || source?.weightNote || '',
    estimated: cow.estimated ?? source?.estimated ?? false,
    unitPrice: cow.unitPrice ?? source?.unitPrice ?? 0,
    ...(cow.withdrawalUntil || source?.withdrawalUntil ? { withdrawalUntil: cow.withdrawalUntil || source?.withdrawalUntil } : {}),
    ...(cow.openCase || source?.openCase ? { openCase: cow.openCase || source?.openCase } : {}),
  }
}

// Tải danh sách phiếu trước, rồi mới dựng form (form lấy phiếu Nháp làm giá trị ban đầu).
export default function ExportNew() {
  const isOwner = useIsOwner()
  const [params] = useSearchParams()
  const draftId = params.get('id')
  const { data: exports } = useQuery<HerdExit[]>(() => herdExitApi.list(), [])
  const { data: hydratedDraft } = useQuery<HerdExit | null>(() => draftId ? herdExitApi.get(draftId) : Promise.resolve(null), [draftId])
  const { data: selectableCattle } = useQuery(() => listSelectableExitCattle(), [])
  const { data: buyers } = useQuery(() => listExitBuyers(), [])
  if (!isOwner) {
    return (
      <Layout title="Phiếu xuất mới">
        <Note tone="warn">Chỉ Chủ trại lập và xác nhận phiếu xuất. Quản lý chỉ xem danh sách và chi tiết phiếu.</Note>
      </Layout>
    )
  }
  if (!exports || !selectableCattle || !buyers || (draftId && !hydratedDraft)) {
    return (
      <Layout title="Phiếu xuất mới">
        <p className="m-0 text-xs text-muted">Đang tải…</p>
      </Layout>
    )
  }
  const rows = draftId && hydratedDraft ? exports.map((row) => row.id === draftId ? hydratedDraft : row) : exports
  return <ExportForm key={draftId ?? 'new'} draftId={draftId} exports={rows} selectableCattle={selectableCattle} buyers={buyers} />
}

function ExportForm({ exports, draftId, selectableCattle, buyers }: { exports: HerdExit[]; draftId: string | null; selectableCattle: HerdCow[]; buyers: Array<{ id: string; name: string; phone: string }> }) {
  const { mutate: persistExit, error: saveError, loading: saving } = useMutation(saveHerdExit)
  const savingRef = useRef(false)
  const formRevision = useRef(0)
  const nav = useNavigate()
  const [m, openModal, closeModal] = useModalParam()

  // Phiếu Nháp còn dở được tiếp tục sửa; không có thì lập phiếu mới.
  const draftState = draftId ? getExitDraftState(exports, draftId) : { type: 'Bán' as const, row: undefined }
  const draftRow = draftState.row?.status === 'Nháp' ? draftState.row : undefined
  const d = draftState
  const [savedId, setSavedId] = useState(draftId ?? '')
  const isBackend = backendMode === 'backend'
  const nextId = isBackend ? '' : `PX-2026-${String(Math.max(0, ...exports.map((r) => Number(r.id.split('-')[2]) || 0)) + 1).padStart(4, '0')}`
  const id = draftRow?.id ?? (isBackend && !draftId ? 'Tự động khi lưu' : nextId)
  const saveId = savedId || draftRow?.id || draftId || (isBackend ? undefined : id)

  const [type, setType] = useState<ExitType>((d.type as ExitType | undefined) ?? 'Bán')
  const [date, setDate] = useState(d?.date ?? todayIso())
  const [pricing, setPricing] = useState<'kg' | 'con'>(d?.pricing ?? 'kg')
  const [buyerId, setBuyerId] = useState(d?.buyerId ?? buyers[0]?.id ?? '')
  const [quarantine, setQuarantine] = useState(d?.quarantine ?? '')
  const [plate, setPlate] = useState(d?.plate ?? '')
  const [note, setNote] = useState(d?.note ?? '')
  const candidateByCode = new Map(selectableCattle.map((cow) => [cow.code, cow]))
  const candidateById = new Map(selectableCattle.filter((cow) => typeof cow.backendId === 'number').map((cow) => [cow.backendId as number, cow]))
  const [picked, setPicked] = useState<HerdCow[]>(() => (d?.cows ?? []).map((cow) => normalizeHerdCow(cow, candidateByCode.get(cow.code) ?? (typeof cow.backendId === 'number' ? candidateById.get(cow.backendId) : undefined))))
  const [deduction, setDeduction] = useState(d?.deduction ?? 0)
  const [collected, setCollected] = useState(d?.collected ?? 0)
  const [method, setMethod] = useState(d?.method ?? PAY_METHODS[0])
  const [dueDate, setDueDate] = useState(d?.dueDate ?? todayIso())
  const [confirmed, setConfirmed] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [documents, setDocuments] = useState<File[]>([])
  const [documentError, setDocumentError] = useState('')
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<number[]>([])
  const [checks, setChecks] = useState<ExitChecks | null>(null)
  const [checksError, setChecksError] = useState<unknown>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<unknown>(null)

  const isSale = type === 'Bán'
  const isLoss = type === 'Chết / mất'
  const hasPricing = !isLoss
  const typeLocked = Boolean(draftRow)
  const buyer = buyers.find((b) => b.id === buyerId)
  const amount = (c: HerdCow) => pricing === 'con' ? c.unitPrice : c.weight * c.unitPrice
  const withdrawal = picked.filter((c) => c.withdrawalUntil && date < c.withdrawalUntil)
  const totalWeight = picked.reduce((s, c) => s + c.weight, 0)
  const estimated = picked.filter((c) => c.estimated).length
  const cowsMoney = hasPricing ? picked.reduce((s, c) => s + amount(c), 0) : 0
  const receivable = Math.max(cowsMoney - deduction, 0)
  const remaining = Math.max(receivable - collected, 0)
  const barnDelta = BARNS.map((b) => ({ ...b, out: picked.filter((c) => c.barn === b.code).length })).filter((b) => b.out)

  const formSnapshot = () => JSON.stringify({
    date, type, pricing, buyerId, quarantine, plate, note, picked, deduction, collected, method, dueDate,
    documents: documents.map((file) => ({ name: file.name, size: file.size, type: file.type })),
    removedAttachmentIds,
  })

  const patch = (code: string, p: Partial<HerdCow>) => setPicked(picked.map((c) => (c.code === code ? { ...c, ...p } : c)))
  const persistedDocuments = (d.docs ?? []).filter((document) => typeof document.id !== 'number' || !removedAttachmentIds.includes(document.id))
  const selectedDocuments = documents.map((file) => ({ name: file.name, ext: file.type === 'application/pdf' ? 'PDF' : 'JPG', size: file.size }))
  const documentRows = [...persistedDocuments, ...selectedDocuments]
  const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isJpg = (file: File) => ['image/jpeg', 'image/jpg'].includes(file.type) || /\.jpe?g$/i.test(file.name)
  const addDocuments = (files: File[]) => {
    const invalid = files.find((file) => (!isPdf(file) && !isJpg(file)) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setDocumentError(`Tệp ${invalid.name} không hợp lệ. Chỉ nhận PDF/JPG tối đa 10MB.`)
      return
    }
    setDocumentError('')
    setDocuments((current) => [...current, ...files.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))])
  }
  const removeDocument = async (index: number) => {
    if (index < persistedDocuments.length) {
      const persisted = persistedDocuments[index]
      if (typeof persisted.id !== 'number' || persisted.id <= 0 || !draftRow) return
      try {
        await removeExitAttachment(id, persisted.id)
        setRemovedAttachmentIds((current) => [...current, persisted.id as number])
        setDocumentError('')
      } catch (error) {
        setDocumentError(error instanceof Error ? error.message : 'Không thể xóa chứng từ.')
      }
      return
    }
    setDocuments((current) => current.filter((_, currentIndex) => currentIndex !== index - persistedDocuments.length))
  }
  const viewDocument = async (index: number) => {
    const persisted = persistedDocuments[index]
    if (persisted) {
      try {
        let url = typeof persisted.url === 'string' ? persisted.url : ''
        if (typeof persisted.id === 'number' && persisted.id > 0) url = URL.createObjectURL(await downloadExitAttachment(id, persisted.id))
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer')
          if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        }
      } catch (error) {
        setDocumentError(error instanceof Error ? error.message : 'Không thể mở chứng từ.')
      }
      return
    }
    const file = documents[index - persistedDocuments.length]
    if (!file) return
    const url = URL.createObjectURL(file)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  useEffect(() => {
    formRevision.current += 1
    setChecks(null)
    setChecksError(null)
    setConfirmed(false)
    setConfirmError(null)
  }, [date, type, pricing, buyerId, quarantine, plate, note, picked, deduction, collected, method, dueDate, documents, removedAttachmentIds])

  const checkMessages = (check: ExitChecks['cattle'][number]) => check.messages.map((message) => message.text || message.code || 'Cảnh báo').join(' · ')
  const warningChecks = checks?.cattle.filter((check) => check.hasWarnings) ?? []
  const checkRows: Array<[string, ReactNode, boolean?]> = checks
    ? [
      ['Tổng quan', warningChecks.length ? `${warningChecks.length} con có cảnh báo` : 'Không có cảnh báo', warningChecks.length > 0],
      ...checks.cattle.map((check) => [check.cattleCode, check.hasWarnings ? checkMessages(check) || 'Có cảnh báo' : 'OK', check.hasWarnings] as [string, ReactNode, boolean?]),
    ]
    : [['Tổng quan', checksError ? `Không tải được kiểm tra: ${displayError(checksError)}` : 'Đang tải kết quả kiểm tra…', true]]
  const checksReady = Boolean(checks)

  const buildDraftRecord = (): Partial<HerdExit> => ({
    date,
    type,
    who: isSale ? (buyer?.name ?? '') : note || type,
    sub: `${picked.length} con · chuồng ${[...new Set(picked.map((c) => c.barn))].join(', ')}`,
    count: picked.length,
    weight: `${money(totalWeight)} kg`,
    total: hasPricing ? receivable : null,
    due: hasPricing ? remaining : null,
    dueNote: '(nháp)',
    status: 'Nháp',
    draft: {
      type, date, buyerId, quarantine, plate, note, pricing, deduction, collected, method, dueDate,
      docs: documentRows,
      cows: picked.map((c) => ({ code: c.code, weight: c.weight, unitPrice: c.unitPrice, estimated: c.estimated })),
    },
  })

  // GBR-34: every non-sale exit needs a reason.
  const missingReason = () => {
    if (!isSale && !note.trim()) { setFormError('Vui lòng nhập lý do xuất.'); return true }
    setFormError(null)
    return false
  }

  const saveDraftAndLoadChecks = async () => {
    if (savingRef.current || missingReason()) return
    const revision = formRevision.current
    const snapshot = formSnapshot()
    const isCurrentForm = () => revision === formRevision.current && snapshot === formSnapshot()
    savingRef.current = true
    setChecks(null)
    setChecksError(null)
    setConfirmed(false)
    setConfirmError(null)
    try {
      const saved = await persistExit({ id: saveId, record: buildDraftRecord(), cattleRows: picked.map((cow) => ({ ...cow, barn: cow.barn })), documents })
      const nextId = saved.id || savedId || draftRow?.id || id
      setSavedId(nextId)
      if (!isCurrentForm()) return
      const nextChecks = await herdExitApi.checks(nextId)
      if (!isCurrentForm()) return
      setChecks(nextChecks)
    } catch (error) {
      // useMutation exposes the rejection through saveError; keep the form and
      // selected files mounted so the user can retry without losing the draft.
      if (revision === formRevision.current) setChecksError(error)
    } finally {
      savingRef.current = false
    }
  }

  const saveDraft = async () => {
    if (savingRef.current || missingReason()) return
    savingRef.current = true
    try {
      await persistExit({ id: saveId, record: buildDraftRecord(), cattleRows: picked.map((cow) => ({ ...cow, barn: cow.barn })), documents })
      nav('/herd-exit')
    } catch {
      // Keep the draft and selected files visible for a retry.
    } finally {
      savingRef.current = false
    }
  }

  const confirm = async () => {
    if (savingRef.current || !checks || !confirmed) return
    savingRef.current = true
    try {
      await confirmHerdExit(savedId || draftRow?.id || id, checks.version)
      nav('/herd-exit')
    } catch (error) {
      // useMutation errors remain visible; a direct confirm failure also keeps
      // this form mounted so the user can safely retry.
      setConfirmError(error)
    } finally {
      savingRef.current = false
    }
  }

  return (
    <Layout title={`Phiếu xuất mới – ${type}`}>
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu xuất mới</h1>
        <p className="mb-0 mt-1 text-xs text-muted">Chỉ Chủ trại xác nhận · bò chuyển ĐÃ XUẤT sau khi xác nhận.</p>
      </div>
      <div>
      <Segmented value={type} onChange={(value) => { if (!typeLocked) setType(value as ExitType) }} options={TYPES.map((t) => ({ value: t, label: t, disabled: typeLocked && t !== type }))} />
      </div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_354px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="1. Thông tin phiếu" gap="gap-[14px]">
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={id} readOnly /></Field>
              <Field label="Ngày xuất *"><DateInput value={date} onChange={setDate} /></Field>
              <Field label="Loại xuất"><input className={inputCls} value={type} readOnly /></Field>
              {isSale && (
                <>
                  <Field label="Người mua / thương lái *" hint={`${buyer?.phone ?? ''} · + Thêm người mua`}>
                    <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-full">
                      {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Số giấy kiểm dịch vận chuyển"><input className={inputCls} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} /></Field>
                  <Field label="Biển số xe"><input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
                </>
              )}
            </div>
            <Field label={isSale ? 'Ghi chú' : 'Lý do *'}>
              <input className={inputCls} value={note} placeholder={isSale ? '' : 'Nhập lý do xuất'} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </Box>

          <Box
            title={`2. Danh sách bò trong phiếu (${picked.length} con)`}
            gap="gap-3"
            actions={
              <>
                <Button size="sm" onClick={() => openModal('pick')}><Icon name="circle-plus" />Chọn bò</Button>
              </>
            }
          >
            {hasPricing && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold">Cách tính giá *</span>
                <Segmented value={pricing} onChange={(value) => setPricing(value as 'kg' | 'con')} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
                <span className="text-[11px] text-muted">Cân xuất mặc định = cân gần nhất (ước tính) · cân lại để ghi thực tế</span>
              </div>
            )}
            <Table scroll>
              <thead>
                <tr>
                  <Th className={TH}>#</Th><Th className={TH}>Mã bò · thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Chuồng</Th>
                  <Th className={TH}>Cân xuất</Th>
                  {hasPricing && <><Th className={TH}>Đơn giá/{pricing === 'con' ? 'con' : 'kg'}</Th><Th className={TH}>Thành tiền</Th></>}
                  <Th className={TH}>Kiểm tra</Th><Th className={TH} />
                </tr>
              </thead>
              <tbody>
                {picked.map((c, i) => {
                  const blocked = c.withdrawalUntil && date < c.withdrawalUntil
                  return (
                    <tr key={c.code}>
                      <Td className={TH}>{i + 1}</Td>
                      <Td className={cx(TH, 'whitespace-nowrap')}>{c.code}<br />{c.tag}</Td>
                      <Td className={TH}>{c.breed} · {c.sex}<br />{c.age} · {c.group}<br />{c.stage}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={TH}>
                        <input
                          inputMode="numeric"
                          value={c.weight}
                          onChange={(e) => patch(c.code, { weight: Number(e.target.value.replace(/\D/g, '')) || 0, estimated: false })}
                          className="w-[4ch] border-0 bg-transparent p-0 text-xs outline-none focus:bg-chip"
                        />
                        {' kg'}{c.estimated && ' UT'}
                      </Td>
                      {hasPricing && (
                        <>
                          <Td className={TH}>
                            <MoneyInput value={c.unitPrice} onChange={(v) => patch(c.code, { unitPrice: v })} className="w-[70px]" />
                          </Td>
                          <Td className={TH}>{money(amount(c))}</Td>
                        </>
                      )}
                      <Td className={TH}>{blocked ? <Badge tone="err">Ngưng GM → {dm(c.withdrawalUntil)}</Badge> : <Badge tone="ok" icon="circle-check">OK</Badge>}</Td>
                      <Td className={cx(TH, 'relative')}>
                        <button type="button" className="cursor-pointer px-1 text-muted" onClick={() => setMenu(menu === c.code ? null : c.code)}>⋯</button>
                        {menu === c.code && (
                          <button
                            type="button"
                            className="absolute right-0 top-full z-10 cursor-pointer rounded border border-edge bg-white px-3 py-1.5 text-xs text-err-fg"
                            onClick={() => { setPicked(picked.filter((x) => x.code !== c.code)); setMenu(null) }}
                          >
                            Bỏ khỏi phiếu
                          </button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <Td className={TH} /><Td className={TH}>{picked.length} con</Td><Td className={TH} /><Td className={TH} />
                  <Td className={TH}>{money(totalWeight)} kg</Td>
                  {hasPricing && <><Td className={TH} /><Td className={TH}>{money(cowsMoney)}</Td></>}
                  <Td className={TH} /><Td className={TH} />
                </tr>
              </tfoot>
            </Table>
            {withdrawal.map((c) => (
              <Note tone="err" key={c.code}>
                {c.code} đang trong thời gian ngưng giết mổ đến {dm(c.withdrawalUntil)}/2026{c.code === 'BC-000205' ? ' (điều trị kháng sinh 18/10)' : ''}. Bán để giết mổ trước ngày này vi phạm an toàn thực phẩm – nên dời ngày xuất hoặc bỏ con khỏi phiếu.
              </Note>
            ))}
          </Box>

          <div className={cx('grid items-start gap-[18px]', isSale ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[300px]')}>
            <Box title="3. Chứng từ đính kèm" gap="gap-[10px]">
              <Dropzone hint="Hợp đồng, phiếu cân, giấy kiểm dịch · PDF, JPG ≤ 10MB" onFiles={addDocuments} />
              {documentError && <Note tone="err">{documentError}</Note>}
              <Docs
                docs={documentRows}
                onView={viewDocument}
                onRemove={removeDocument}
              />
            </Box>
            {isSale && (
              <Box title="4. Thanh toán" gap="gap-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div><div className="mb-[3px] text-[11px] text-faint">Tiền bò</div><div className="text-[13px] font-medium">{money(cowsMoney)} đ</div></div>
                  <div><div className="mb-[3px] text-[11px] text-faint">Tổng phải thu</div><div className="text-[13px] font-medium">{money(receivable)} đ</div></div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Khấu trừ (hao hụt, môi giới)"><MoneyInput value={deduction} onChange={setDeduction} suffix="đ" /></Field>
                  <Field label="Đã thu (đặt cọc)"><MoneyInput value={collected} onChange={setCollected} suffix="đ" /></Field>
                </div>
                <div>
                  <div className="mb-[3px] text-[11px] text-faint">Còn phải thu</div>
                  <div className="text-[13px] font-semibold text-warn-fg">{money(remaining)} đ</div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Phương thức">
                    <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full">
                      {PAY_METHODS.map((p) => <option key={p}>{p}</option>)}
                    </Select>
                  </Field>
                  <Field label="Hạn thu phần còn lại"><DateInput value={dueDate} onChange={setDueDate} /></Field>
                </div>
              </Box>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <SummaryCard
            badge={<ExitStatusBadge status="Nháp" />}
            rows={[
              ['Số con', picked.length],
              ['Loại xuất', type],
              ['Tổng cân xuất', `${money(totalWeight)} kg${estimated ? ` (${estimated} con ước tính)` : ''}`],
              ['Chuồng giảm', barnDelta.length ? barnDelta.map((b) => `${b.name} (${b.count} → ${b.count - b.out})`).join(' · ') : '—'],
              ...(hasPricing ? [['Tổng phải thu', `${money(receivable)} đ`]] : []),
            ]}
          />
          <Box title="Kiểm tra trước khi xác nhận" gap="gap-[10px]">
            <CheckList rows={checkRows} />
            <Checkbox checked={confirmed} disabled={!checksReady || saving} onChange={(e) => setConfirmed(e.target.checked)} className="text-xs font-semibold">
              Tôi đã xem các mục trên và xác nhận xuất đàn *
            </Checkbox>
            {formError && <Note tone="err">{formError}</Note>}
            {Boolean(saveError || confirmError) && <Note tone="err">{displayError(confirmError ?? saveError)}</Note>}
            <Button variant="primary" block className="!py-[9px]" disabled={!picked.length || saving || (checksReady ? !confirmed : false)} onClick={checksReady ? confirm : saveDraftAndLoadChecks}>
              {checksReady ? `Xác nhận xuất ${picked.length} con` : 'Lưu và kiểm tra trước khi xác nhận'}
            </Button>
            <Button block disabled={saving} onClick={saveDraft}>Lưu nháp phiếu</Button>
            <Button variant="link" block onClick={() => nav('/herd-exit')}>Hủy</Button>
            <p className="m-0 text-[11px] text-muted">
              Khi xác nhận, mỗi con: chuyển ĐÃ XUẤT, đóng phân chuồng, hủy mũi tiêm / nhắc việc sau ngày xuất, đóng ca bệnh và thai đang mở (GBR-35). Hồ sơ chỉ còn xem.
            </p>
          </Box>
        </div>
      </div>

      <Foot>Loại xuất cố định sau lần lưu đầu. Cân xuất mặc định là cân gần nhất (ước tính); cảnh báo không chặn lưu nháp nhưng phải xem lại trước khi xác nhận.</Foot>

      {m === 'pick' && (
        <PickModal id={id} herdExits={exports} candidates={selectableCattle} picked={picked} setPicked={(rows) => setPicked(rows)} onClose={closeModal} />
      )}
    </Layout>
  )
}
