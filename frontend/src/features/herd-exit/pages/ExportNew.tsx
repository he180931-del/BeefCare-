import { MoneyInput } from '../../../shared/ui'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Checkbox, DateInput, Field, Foot, Icon, inputCls, Note, QrCamera, Radio, SearchSelect, Segmented, Select, Table, Td, Th } from '../../../shared/ui'
import { AttachmentList, FileDropzone } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { PAY_METHODS } from '../constants/exitOptions'
import { businessDate as todayIso } from '../../../shared/lib/date/farmTime'
import { dmy, money } from '../../../shared/lib/format'
import { getExitDraftState, herdExitApi, listExitBuyers, saveExitBuyer, listSelectableExitCattle, exitPenShift, newExitVoucherId } from '../api/index'
import { useQuery } from '../../../shared/hooks/useQuery'
import { Box, CheckList, ExitStatusBadge, SummaryCard, TH, cx, useIsOwner } from '../components/parts'
import PickModal from '../components/PickModal'
import type { ExitBuyer, ExitCandidateCow, ExitDraftCow, HerdExit, ExitType, LossKind } from '../types'
import { useExitEditor } from '../hooks/useExitEditor'
import { useExitWorkflow } from '../hooks/useExitWorkflow'
import { useExitDocuments } from '../hooks/useExitDocuments'
import { useExitComposition } from '../hooks/useExitComposition'
import { useExitQrPick } from '../hooks/useExitQrPick'
import { userFacingError } from '../../../shared/api/userFacingError'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import AddBuyerModal from '../components/AddBuyerModal'

const TYPES: ExitType[] = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const displayError = userFacingError
type HerdCow = ExitCandidateCow
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
  const [reloadedDraft, setReloadedDraft] = useState<{ routeId: string | null; row: HerdExit } | null>(null)
  const [reloadRevision, setReloadRevision] = useState(0)
  const { data: exports } = useQuery<HerdExit[]>(() => herdExitApi.list(), [])
  const { data: hydratedDraft } = useQuery<HerdExit | null>(() => draftId ? herdExitApi.get(draftId) : Promise.resolve(null), [draftId])
  const { data: selectableCattle } = useQuery(() => listSelectableExitCattle(), [])
  const { data: loadedBuyers } = useQuery(() => listExitBuyers(), [])
  const [addedBuyers, setAddedBuyers] = useState<ExitBuyer[]>([])
  if (!isOwner) {
    return (
      <Layout title="Phiếu xuất mới">
        <Note tone="warn">Chỉ Chủ trại lập và xác nhận phiếu xuất. Quản lý chỉ xem danh sách và chi tiết phiếu.</Note>
      </Layout>
    )
  }
  if (!exports || !selectableCattle || !loadedBuyers || (draftId && !hydratedDraft)) {
    return (
      <Layout title="Phiếu xuất mới">
        <p className="m-0 text-xs text-muted">Đang tải…</p>
      </Layout>
    )
  }
  const activeDraft = reloadedDraft?.routeId === draftId ? reloadedDraft.row : hydratedDraft
  const reloadDraft = async (id: string) => {
    const latest = await herdExitApi.get(id)
    setReloadedDraft({ routeId: draftId, row: latest })
    setReloadRevision((value) => value + 1)
  }
  if (activeDraft && activeDraft.status !== 'Nháp') return <Layout title="Phiếu xuất"><Note>Phiếu {activeDraft.id} hiện ở trạng thái {activeDraft.status}. Vui lòng mở lại từ danh sách phiếu xuất.</Note></Layout>
  const rows = activeDraft ? [...exports.filter((row) => row.id !== activeDraft.id), activeDraft] : exports
  const activeBuyers = loadedBuyers.filter((buyer) => buyer.active !== false)
  const buyers = [...activeBuyers, ...addedBuyers.filter((buyer) => !activeBuyers.some((existing) => existing.id === buyer.id))]
  const addBuyer = async (input: { name: string; phone: string; area: string }, options?: { key?: string }) => {
    const buyer = await saveExitBuyer(input, options)
    setAddedBuyers((current) => current.some((row) => row.id === buyer.id) ? current : [...current, buyer])
    return buyer
  }
  return <ExportForm key={`${draftId ?? 'new'}-${reloadRevision}`} onReload={reloadDraft} onAddBuyer={addBuyer} draftId={activeDraft?.id ?? draftId} exports={rows} selectableCattle={selectableCattle} buyers={buyers} />
}

function ExportForm({ onReload, onAddBuyer, exports, draftId, selectableCattle, buyers }: { onReload: (id: string) => Promise<void>; onAddBuyer: (input: { name: string; phone: string; area: string }, options?: { key?: string }) => Promise<ExitBuyer>; exports: HerdExit[]; draftId: string | null; selectableCattle: HerdCow[]; buyers: ExitBuyer[] }) {
  const nav = useNavigate()
  const [m, openModal, closeModal] = useModalParam()

  // Phiếu Nháp còn dở được tiếp tục sửa; không có thì lập phiếu mới.
  const draftState = draftId ? getExitDraftState(exports, draftId) : { type: 'Bán' as const, row: undefined }
  const draftRow = draftState.row?.status === 'Nháp' ? draftState.row : undefined
  const d = draftState
  const nextId = newExitVoucherId(exports)
  const id = draftRow?.id ?? nextId ?? (draftId ? '' : 'Tự động khi lưu')

  const candidateByCode = new Map(selectableCattle.map((cow) => [cow.code, cow]))
  const candidateById = new Map(selectableCattle.filter((cow) => typeof cow.backendId === 'number').map((cow) => [cow.backendId as number, cow]))
  const editor = useExitEditor({
    type: (d.type as ExitType | undefined) ?? 'Bán', lossKind: d.lossKind ?? (draftRow?.detail?.lossType === 'Mất tích' ? 'MISSING' : 'DIED'),
    deathCause: d.deathCause ?? (d.type === 'Chết / mất' ? d.note ?? '' : ''), carcassDisposal: d.carcassDisposal ?? '', date: d?.date ?? todayIso(),
    pricing: d?.pricing ?? 'kg', buyerId: d?.buyerId ?? '', quarantine: d?.quarantine ?? '', plate: d?.plate ?? '', destination: d?.destination ?? '', note: d?.note ?? '',
    picked: (d?.cows ?? []).map((cow) => normalizeHerdCow(cow, candidateByCode.get(cow.code) ?? (typeof cow.backendId === 'number' ? candidateById.get(cow.backendId) : undefined))),
    deduction: d?.deduction ?? 0, collected: d?.collected ?? 0, method: d?.method ?? '', dueDate: d?.dueDate ?? '',
  })
  const { type, setType, lossKind, setLossKind, date, setDate, pricing, setPricing, buyerId, setBuyerId, quarantine, setQuarantine, plate, setPlate, destination, setDestination, note, setNote, deathCause, setDeathCause, carcassDisposal, setCarcassDisposal, picked, setPicked, patch, deduction, setDeduction, collected, setCollected, method, setMethod, dueDate, setDueDate, documents, setDocuments, removedAttachmentIds, setRemovedAttachmentIds, formSnapshot } = editor
  const [menu, setMenu] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const selectedQrCodes = new Set(picked.map((cow) => cow.code))
  const blockedQrMessages = new Map(
    exports
      .filter((row) => row.id !== id && ['Nháp', 'Chờ xác nhận', 'Đã xuất'].includes(row.status))
      .flatMap((row) => (row.draft?.cows ?? row.detail?.cows ?? [])
        .filter((cow): cow is typeof cow & { code: string } => Boolean(cow.code))
        .map((cow) => [cow.code, `Bò ${cow.code} đã có trên phiếu ${row.id}.`] as const)),
  )
  const qrPick = useExitQrPick({
    candidates: selectableCattle,
    selectedCodes: selectedQrCodes,
    blockedMessages: blockedQrMessages,
    onPick: (candidate) => setPicked((current) => [{ ...candidate, unitPrice: candidate.unitPrice ?? 0 }, ...current]),
  })
  const recentQrCodes = new Set(qrPick.recentCodes)

  const needsBuyer = type === 'Bán' || type === 'Loại thải'
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
  const deductionInvalid = deduction < 0 || deduction > cowsMoney
  const collectedInvalid = collected < 0 || collected > receivable
  const methodInvalid = collected > 0 && !method
  const barnDelta = exitPenShift(picked)

  const persistedDocuments = (d.docs ?? []).filter((document) => typeof document.id !== 'number' || !removedAttachmentIds.includes(document.id))
  const documentWorkflow = useExitDocuments({ id, persistedDocuments, canRemovePersisted: Boolean(draftRow), documents, setDocuments, removedAttachmentIds, setRemovedAttachmentIds })
  const { documentError, documentRows, addDocuments, removeDocument, viewDocument } = documentWorkflow
  const buildDraftRecord = (): Partial<HerdExit> => ({
    date,
    type,
    who: needsBuyer ? (buyer?.name ?? '') : isLoss ? note : destination,
    sub: `${picked.length} con · chuồng ${[...new Set(picked.map((c) => c.barn))].join(', ')}`,
    count: picked.length,
    weight: `${money(totalWeight)} kg`,
    total: hasPricing ? receivable : null,
    due: hasPricing ? remaining : null,
    dueNote: '(nháp)',
    status: 'Nháp',
    draft: {
      type, lossKind: isLoss ? lossKind : undefined, deathCause: isLoss ? deathCause : undefined, carcassDisposal: isLoss && lossKind === 'DIED' ? carcassDisposal : undefined,
      date, buyerId, quarantine, plate, ...(type === 'Khác' ? { destination } : {}), note: isLoss ? deathCause : note, pricing, deduction, collected,
      ...(collected > 0 ? { method } : {}),
      dueDate: remaining > 0 ? dueDate : '',
      docs: documentRows,
      cows: picked.map((c) => ({ code: c.code, weight: c.weight, unitPrice: c.unitPrice, estimated: c.estimated })),
    },
  })

  const missingRequiredField = () => {
    if (needsBuyer && !buyer) {
      setFormError('Vui lòng chọn người mua.')
      return true
    }
    if (!needsBuyer && !(isLoss ? deathCause : destination).trim()) {
      setFormError(isLoss ? 'Vui lòng nhập nguyên nhân.' : 'Vui lòng nhập nơi đến.')
      return true
    }
    if (isLoss && lossKind === 'DIED' && !carcassDisposal.trim()) {
      setFormError('Vui lòng nhập phương án xử lý xác.')
      return true
    }
    setFormError(null)
    return false
  }

  const validateAmountsAndDates = () => {
    if (date > todayIso()) {
      setFormError('Ngày xuất không được ở tương lai.')
      return true
    }
    if (deduction < 0 || deduction > cowsMoney) {
      setFormError('Khấu trừ phải từ 0 đến tiền bò.')
      return true
    }
    if (collected < 0 || collected > receivable) {
      setFormError('Đã thu không được vượt tổng phải thu.')
      return true
    }
    if (collected > 0 && !method) {
      setFormError('Vui lòng chọn hình thức thu.')
      return true
    }
    if (dueDate && dueDate < date) {
      setFormError('Hạn thu không được trước ngày xuất.')
      return true
    }
    setFormError(null)
    return false
  }

  const workflow = useExitWorkflow({
    baseId: draftRow?.id || draftId || nextId,
    initialSavedId: draftId ?? '',
    initialRecord: draftRow,
    picked,
    documents,
    formSnapshot,
    buildDraftRecord,
    beforeSave: () => {
      if (missingRequiredField()) return true
      if (validateAmountsAndDates()) return true
      const missingWeight = hasPricing && pricing === 'kg' && picked.find((cow) => cow.weight === 0)
      if (missingWeight) {
        setFormError(`Vui lòng nhập cân xuất cho bò ${missingWeight.code} khi tính giá theo kg.`)
        return true
      }
      return false
    },
  })
  const { savedId, saving, saveError, checks, checksError, checking, confirmed, setConfirmed, confirmError, saveDraftAndLoadChecks, saveDraft, confirm } = workflow
  const { checkRows, checksReady } = useExitComposition({ checks, checksError, checking, displayError })

  return (
    <Layout title={`Phiếu xuất mới – ${type}`}>
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu xuất mới</h1>
        <p className="mb-0 mt-1 text-xs text-muted">Chỉ Chủ trại xác nhận · bò chuyển ĐÃ XUẤT sau khi xác nhận.</p>
      </div>
      <div>
      <Segmented value={type} onChange={(value) => { if (!typeLocked) setType(value as ExitType) }} options={TYPES.map((t) => ({ value: t, label: t, disabled: typeLocked && t !== type }))} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 @min-[880px]:grid-cols-[minmax(0,5fr)_minmax(0,3fr)] @min-[1024px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] @min-[1024px]:gap-6">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="1. Thông tin phiếu" gap="gap-[14px]">
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={id} readOnly /></Field>
              <Field label="Ngày xuất *"><DateInput value={date} onChange={setDate} /></Field>
              {needsBuyer && (
                <>
                  <Field label="Người mua / thương lái *" hint={<>{buyer?.phone ? `${buyer.phone} · ` : ''}<button type="button" onClick={() => openModal('buyer')} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-brand">+ Thêm người mua</button></>}>
                    <SearchSelect
                      aria-label="Người mua / thương lái"
                      value={buyerId}
                      onChange={setBuyerId}
                      clearable={false}
                      allLabel="Chọn người mua"
                      options={buyers.map((b) => ({ value: b.id, label: b.name, hint: [b.phone, b.area].filter(Boolean).join(' · ') }))}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Số giấy kiểm dịch vận chuyển"><input className={inputCls} maxLength={50} value={quarantine} onChange={(e) => setQuarantine(e.target.value)} /></Field>
                  <Field label="Biển số xe"><input className={inputCls} maxLength={20} value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
                </>
              )}
            </div>
            {isLoss ? (
              <>
                <Field label="Loại chết / mất">
                  <Select aria-label="Loại chết / mất" value={lossKind} onChange={(e) => setLossKind(e.target.value as LossKind)} className="w-full">
                    <option value="DIED">Chết</option>
                    <option value="MISSING">Mất tích</option>
                  </Select>
                </Field>
                  <Field id="exit-death-cause" label={lossKind === 'DIED' ? 'Nguyên nhân chết *' : 'Nguyên nhân mất tích *'}>
                  <input id="exit-death-cause" className={inputCls} maxLength={1000} value={deathCause} onChange={(e) => setDeathCause(e.target.value)} />
                </Field>
                {lossKind === 'DIED' && (
                  <Field id="exit-carcass-disposal" label="Phương án xử lý xác *">
                    <input id="exit-carcass-disposal" className={inputCls} maxLength={1000} value={carcassDisposal} onChange={(e) => setCarcassDisposal(e.target.value)} />
                  </Field>
                )}
              </>
            ) : (
              <>
                {!needsBuyer && (
                  <Field id="exit-destination" label="Nơi đến *">
                    <input id="exit-destination" className={inputCls} value={destination} maxLength={150} onChange={(e) => setDestination(e.target.value)} />
                  </Field>
                )}
                <Field id="exit-note" label="Ghi chú">
                  <input id="exit-note" className={inputCls} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
                </Field>
              </>
            )}
          </Box>

          <Box
            title={`2. Danh sách bò trong phiếu (${picked.length} con)`}
            gap="gap-3"
            actions={
              <>
                <Button size="sm" onClick={() => openModal('pick')}><Icon name="circle-plus" />Chọn bò</Button>
                <Button size="sm" onClick={() => qrPick.setShowQr((current) => !current)}><Icon name="qrcode" />{qrPick.showQr ? 'Tắt camera' : 'Quét QR'}</Button>
              </>
            }
          >
            {qrPick.showQr && (
              <div className="flex flex-wrap items-end gap-3 rounded-lg bg-page p-3">
                <Field label="Mã thẻ QR">
                  <input aria-label="Mã thẻ QR" className={inputCls} value={qrPick.qrCode} onChange={(event) => qrPick.setQrCode(event.target.value)} />
                </Field>
                <Button disabled={qrPick.checkingQr || !qrPick.qrCode.trim()} onClick={() => void qrPick.selectFromQr(qrPick.qrCode)}>Chọn theo mã</Button>
                <QrCamera onCode={(code) => void qrPick.selectFromQr(code)} />
              </div>
            )}
            {qrPick.qrFeedback && <Note tone={qrPick.qrFeedback.ok ? undefined : 'warn'}>{qrPick.qrFeedback.message}</Note>}
            {hasPricing && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold">Cách tính giá *</span>
                <Segmented value={pricing} onChange={(value) => setPricing(value as 'kg' | 'con')} options={[{ value: 'kg', label: 'Theo kg' }, { value: 'con', label: 'Theo con' }]} />
                <span className="text-[11px] text-muted">Cân xuất mặc định = cân gần nhất (ước tính) · cân lại để ghi thực tế</span>
              </div>
            )}
            <Table stack={false}>
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
                  const blocked = needsBuyer && c.withdrawalUntil && date < c.withdrawalUntil
                  return (
                    <tr key={c.code} className={recentQrCodes.has(c.code) ? 'bg-page' : undefined}>
                      <Td className={TH}>{i + 1}</Td>
                      <Td className={cx(TH, 'whitespace-nowrap')}>{c.code}<br />{c.tag}</Td>
                      <Td className={TH}>{c.breed} · {c.sex}<br />{c.age} · {c.group}<br />{c.stage}</Td>
                      <Td className={TH}>{c.barn}</Td>
                      <Td className={cx(TH, 'whitespace-nowrap')}>
                        <input
                          aria-label={`Cân xuất ${c.code}`}
                          inputMode="numeric"
                          value={c.weight || ''}
                          onChange={(e) => patch(c.code, { weight: Number(e.target.value.replace(/\D/g, '')) || 0, estimated: false })}
                          placeholder="0"
                          className="h-8 w-[7ch] rounded-lg border border-field bg-white px-2 text-right text-xs outline-none focus:border-brand"
                        />
                        {' kg'}{c.estimated && ' UT'}
                      </Td>
                      {hasPricing && (
                        <>
                          <Td className={TH}>
                            <MoneyInput value={c.unitPrice} onChange={(v) => patch(c.code, { unitPrice: v })} className="w-[96px]" formatWhileTyping />
                          </Td>
                          <Td className={TH}>{money(amount(c))}</Td>
                        </>
                      )}
                      <Td className={TH}>{recentQrCodes.has(c.code) && <Badge tone="ok">Vừa quét</Badge>}{blocked ? <Badge tone="err">Ngưng GM → {dmy(c.withdrawalUntil)}</Badge> : <Badge tone="ok" icon="circle-check">OK</Badge>}</Td>
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
            {needsBuyer && withdrawal.map((c) => (
              <Note tone="err" key={c.code}>
                {c.code} đang trong thời gian ngưng giết mổ đến {dmy(c.withdrawalUntil)}. Bán để giết mổ trước ngày này vi phạm an toàn thực phẩm – nên dời ngày xuất hoặc bỏ con khỏi phiếu.
              </Note>
            ))}
          </Box>

          <div className={cx('grid items-start gap-[18px]', needsBuyer ? 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1 lg:grid-cols-[300px]')}>
            <Box title="3. Chứng từ đính kèm" gap="gap-[10px]">
              <FileDropzone label="Chọn chứng từ đính kèm" hint="Hợp đồng, phiếu cân, giấy kiểm dịch · PDF, JPG ≤ 10MB" onFiles={addDocuments} />
              {documentError && <Note tone="err">{documentError}</Note>}
              <AttachmentList
                items={documentRows.map((doc, index) => ({ key: `${index < persistedDocuments.length ? 'saved' : 'new'}:${index < persistedDocuments.length ? index : index - persistedDocuments.length}`, name: doc.name, extension: doc.ext }))}
                onView={(key) => viewDocument(Number(key.split(':')[1]) + (key.startsWith('saved:') ? 0 : persistedDocuments.length))}
                onRemove={(key) => removeDocument(Number(key.split(':')[1]) + (key.startsWith('saved:') ? 0 : persistedDocuments.length))}
              />
            </Box>
            {needsBuyer && (
              <Box title="4. Thanh toán" gap="gap-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div><div className="mb-[3px] text-[11px] text-faint">Tiền bò</div><div className="text-[13px] font-medium">{money(cowsMoney)} đ</div></div>
                  <div><div className="mb-[3px] text-[11px] text-faint">Tổng phải thu</div><div className="text-[13px] font-medium">{money(receivable)} đ</div></div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label="Khấu trừ (hao hụt, môi giới)"><MoneyInput value={deduction} onChange={setDeduction} suffix="đ" formatWhileTyping />{deductionInvalid && <span className="text-[11px] text-err-fg">Khấu trừ phải từ 0 đến tiền bò.</span>}</Field>
                  <Field label="Đã thu (đặt cọc)"><MoneyInput value={collected} onChange={setCollected} suffix="đ" formatWhileTyping />{collectedInvalid && <span className="text-[11px] text-err-fg">Đã thu không được vượt tổng phải thu.</span>}</Field>
                </div>
                <div>
                  <div className="mb-[3px] text-[11px] text-faint">Còn phải thu</div>
                  <div className="text-[13px] font-semibold text-warn-fg">{money(remaining)} đ</div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <Field label={`Phương thức${collected > 0 ? ' *' : ''}`}>
                    <div role="radiogroup" aria-label="Phương thức" className="flex flex-wrap gap-3 pt-2">
                      {PAY_METHODS.map((paymentMethod) => <Radio key={paymentMethod} name="exit-payment-method" checked={method === paymentMethod} onChange={() => setMethod(paymentMethod)}>{paymentMethod}</Radio>)}
                    </div>
                    {methodInvalid && <span className="text-[11px] text-err-fg">Vui lòng chọn hình thức thu.</span>}
                  </Field>
                  {remaining > 0 && <Field label="Hạn thu phần còn lại"><DateInput value={dueDate} onChange={setDueDate} /></Field>}
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
              ['Chuồng giảm', barnDelta.length ? barnDelta.map((b) => (b.count == null ? `${b.name} (−${b.out})` : `${b.name} (${b.count} → ${b.count - b.out})`)).join(' · ') : '—'],
              ...(hasPricing ? [['Tổng phải thu', `${money(receivable)} đ`]] : []),
            ]}
          />
          <Box title="Kiểm tra trước khi xác nhận" gap="gap-[10px]">
            <CheckList rows={checkRows} />
            <Checkbox checked={confirmed} disabled={!checksReady || saving} onChange={(e) => setConfirmed(e.target.checked)} className="text-xs font-semibold">
              Tôi đã xem các mục trên và xác nhận xuất đàn *
            </Checkbox>
            {formError && <Note tone="err">{formError}</Note>}
            <VoucherCommandError error={confirmError ?? saveError ?? checksError} onReload={() => onReload(savedId || draftId || id)} />
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
      {m === 'buyer' && (
        <AddBuyerModal onClose={closeModal} onSave={async (input, options) => { const buyer = await onAddBuyer(input, options); setBuyerId(buyer.id); closeModal(); return buyer }} />
      )}
    </Layout>
  )
}
