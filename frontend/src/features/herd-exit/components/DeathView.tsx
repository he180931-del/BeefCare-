import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Badge, Button, Checkbox, DateInput, Field, FileDropzone, Foot, inputCls, Note, Radio, Segmented, Table, Td, Textarea, Th } from '../../../shared/ui'
import { AttachmentList } from '../../../shared/ui'
import { confirmHerdExit, dismissHerdExit, herdExitApi, saveHerdExit } from '../api/index'
import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { dmy } from '../../../shared/lib/format'
import { Box, CheckList, ExitStatusBadge, SummaryCard, TH, useIsOwner } from './parts'
import RejectModal from './RejectModal'
import type { HerdExit, ExitDetail } from '../types'
import type { ExitChecks } from '../api/herdExitBackendApi'
import { useExitDocuments } from '../hooks/useExitDocuments'

const DISPOSALS = ['Tiêu hủy / chôn lấp tại trại', 'Giao thú y địa phương', 'Khác']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'

// Phiếu xuất "Chết / mất" tạo từ ca sức khỏe, chờ Chủ trại xác nhận.
export default function DeathView({ row }: { row: HerdExit }) {
  const { mutate: dismissExit, error: updateError } = useMutation<{ id: string; reason: string; expectedVersion: number }, HerdExit>(({ id, reason, expectedVersion }) => dismissHerdExit(id, reason, expectedVersion))
  const { mutate: persistExit, error: persistError, loading: persisting } = useMutation(saveHerdExit)
  const nav = useNavigate()
  const isOwner = useIsOwner()
  const [m, openModal, closeModal] = useModalParam()
  const d: ExitDetail = { cows: [], docs: [], history: [], checks: [], cow: { code: '', tag: '', breed: '', sex: '', barn: '', weight: 0, caseLine: ['', ''] }, ...row.detail }
  const cow = d.cow ?? { code: '', tag: '', breed: '', sex: '', barn: '', weight: 0, caseLine: ['', ''] }
  const pending = row.status === 'Chờ xác nhận'
  const canAct = pending && isOwner
  const { data: liveChecks, error: checksError } = useQuery<ExitChecks | null>(() => pending ? herdExitApi.checks(row.id) : Promise.resolve(null), [row.id, pending])
  const [lossType, setLossType] = useState(d.lossType)
  const [reason, setReason] = useState(d.reason)
  const [disposal, setDisposal] = useState(d.disposal)
  const [date, setDate] = useState(d.date ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const editableSnapshot = JSON.stringify({ date, lossType, reason, disposal })
  const initialSnapshot = useRef(editableSnapshot)
  const [reviewedChecks, setReviewedChecks] = useState<ExitChecks | null>(null)
  const [reviewedSnapshot, setReviewedSnapshot] = useState<string | null>(null)
  const [documents, setDocuments] = useState<File[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<number[]>([])
  const [savedDocuments, setSavedDocuments] = useState(d.docs ?? [])
  const lossKindReadOnly = pending && d.sourceHealthCaseId != null
  const checks = reviewedChecks ?? liveChecks
  const checksCurrent = Boolean(checks && reviewedSnapshot === editableSnapshot)
  useEffect(() => {
    if (liveChecks && !reviewedChecks) {
      setReviewedChecks(liveChecks)
      setReviewedSnapshot(initialSnapshot.current)
    }
  }, [liveChecks, reviewedChecks])
  useEffect(() => {
    if (reviewedSnapshot && reviewedSnapshot !== editableSnapshot) setConfirmed(false)
  }, [editableSnapshot, reviewedSnapshot])
  const persistedDocuments = savedDocuments.filter((document) => typeof document.id !== 'number' || !removedAttachmentIds.includes(document.id))
  const { documentError, documentRows, addDocuments, removeDocument, viewDocument: viewExitDocument } = useExitDocuments({
    id: row.id,
    persistedDocuments,
    canRemovePersisted: pending && isOwner,
    documents,
    setDocuments,
    removedAttachmentIds,
    setRemovedAttachmentIds,
  })
  const buildPatch = (status: 'Đã xuất' | 'Đã bác', extra: Record<string, unknown> = {}) => ({
      status,
      ...extra,
      type: 'Chết / mất' as const,
      date,
      reason,
      note: reason,
      detail: {
        ...d,
        lossType,
        reason,
        disposal,
        date,
        history: [...(d.history ?? []), `${dmy(date).slice(0, 5)} · N. V. Hùng ${status === 'Đã xuất' ? 'xác nhận xuất đàn' : 'bác đề xuất'}`],
      },
    })

  const saveDocuments = async () => {
    if (!documents.length) return
    try {
      const saved = await persistExit({
        id: row.id,
        record: { ...buildPatch('Đã xuất'), status: 'Nháp' },
        cattleRows: [{ ...cow, barn: String(cow.barn ?? '').split(/[\s–-]/)[0] }],
        documents,
      })
      setDocuments([])
      if (saved.detail?.docs) setSavedDocuments(saved.detail.docs)
      const latestChecks = await herdExitApi.checks(row.id)
      setReviewedChecks(latestChecks)
      setReviewedSnapshot(editableSnapshot)
      setConfirmed(false)
    } catch {
      // The mutation error is rendered below; keep selected files so the Owner can retry.
    }
  }

  const refreshChecks = async () => {
    if (!pending || !checks) return
    const snapshot = editableSnapshot
    try {
      const patch = buildPatch('Đã xuất')
      const barn = String(cow.barn ?? '').split(/[\s–-]/)[0]
      await persistExit({ id: row.id, record: { ...patch, status: 'Nháp' }, cattleRows: [{ ...cow, barn }] })
      const latestChecks = await herdExitApi.checks(row.id)
      if (snapshot !== JSON.stringify({ date, lossType, reason, disposal })) return
      setReviewedChecks(latestChecks)
      setReviewedSnapshot(snapshot)
      setConfirmed(false)
    } catch {
      // Keep the old review visible; the mutation error explains why refresh failed.
    }
  }

  const resolve = async (status: 'Đã xuất' | 'Đã bác', extra: Record<string, unknown> = {}) => {
    if (pending && (!checks || !checksCurrent)) return
    const checkedVersion = checks?.version ?? Number(row.version ?? 0)
    if (status === 'Đã xuất') {
      await confirmHerdExit(row.id, checkedVersion)
    } else {
      await dismissExit({ id: row.id, reason: String(extra.rejectReason ?? 'Bác đề xuất'), expectedVersion: checkedVersion })
    }
    nav('/herd-exit')
  }

  return (
    <Layout title={pending ? 'Phiếu xuất – Chết / mất (chờ xác nhận)' : `Phiếu xuất – Chết / mất (${row.status})`}>
      <div>
        <h1 className="m-0 text-[22px] font-bold">Phiếu xuất {row.id}</h1>
        <p className="mb-0 mt-1 text-xs text-muted">Tạo tự động khi ca sức khỏe đóng với kết quả Chết / Mất tích.</p>
        <div className="mt-1"><ExitStatusBadge status={row.status} /></div>
      </div>
      <div><Segmented value="Chết / mất" onChange={() => {}} options={[{ value: 'Bán', label: 'Bán', disabled: true }, { value: 'Loại thải', label: 'Loại thải', disabled: true }, { value: 'Chết / mất', label: 'Chết / mất' }, { value: 'Khác', label: 'Khác', disabled: true }]} /></div>

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_354px]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Box title="1. Thông tin phiếu" gap="gap-[14px]">
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
              <Field label="Mã phiếu"><input className={inputCls} value={row.id} readOnly /></Field>
              <Field label="Ngày chết / mất *" hint="Mặc định = ngày đóng ca"><DateInput value={date} onChange={setDate} /></Field>
              <Field label="Loại mất *">
                <div className="flex gap-[18px] pt-2">
                  {['Chết', 'Mất tích'].map((t) => (
                    <Radio key={t} name="lossType" checked={lossType === t} className={lossKindReadOnly ? 'pointer-events-none opacity-60' : undefined} onChange={() => !lossKindReadOnly && pending && setLossType(t)}>{t}</Radio>
                  ))}
                </div>
                {lossKindReadOnly && <Note>Loại chết / mất lấy từ kết quả ca sức khỏe và chỉ đọc.</Note>}
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              <Field label="Nguồn đề xuất"><input className={inputCls} value={d.source} readOnly /></Field>
              <Field label="Người báo"><input className={inputCls} value={d.reporter} readOnly /></Field>
            </div>
            <Field label="Nguyên nhân / ghi chú *">
              <Textarea className="!leading-[normal] h-14" rows={1} value={reason} readOnly={!pending} onChange={(e) => setReason(e.target.value)} />
            </Field>
            {lossType === 'Chết' && (
              <Field label="Xử lý xác *">
                <div className="flex flex-wrap gap-[18px] pt-1">
                  {DISPOSALS.map((t) => (
                    <Radio key={t} name="disposal" checked={disposal === t} onChange={() => pending && setDisposal(t)}>{t}</Radio>
                  ))}
                </div>
              </Field>
            )}
          </Box>

          <Box title="2. Bò trong phiếu" sub="1 con" gap="gap-3">
            <Table scroll>
              <thead>
                <tr>
                  <Th className={TH}>Mã bò · thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Tuổi</Th>
                  <Th className={TH}>Chuồng</Th><Th className={TH}>Cân gần nhất</Th><Th className={TH}>Ca sức khỏe</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td className={`${TH} font-medium`}>{cow.code} / {cow.tag}</Td>
                  <Td className={TH}>{cow.breed} · {cow.sex}</Td><Td className={TH}>{cow.age}</Td>
                  <Td className={TH}>{cow.barn}</Td><Td className={TH}>{cow.weight} kg UT</Td>
                  <Td className={TH}>{(cow.caseLine ?? ['', ''])[0]}<br />{(cow.caseLine ?? ['', ''])[1]}</Td>
                </tr>
              </tbody>
            </Table>
          </Box>

          <Box title="3. Chứng từ đính kèm" sub="Ảnh, biên bản tiêu hủy hoặc xác nhận của thú y" gap="gap-3">
            {documentError && <Note tone="err">{documentError}</Note>}
            <AttachmentList
              items={documentRows.map((doc, index) => ({ key: `${index < persistedDocuments.length ? 'saved' : 'new'}:${index < persistedDocuments.length ? index : index - persistedDocuments.length}`, name: doc.name, extension: doc.ext }))}
              onView={(key) => { const index = Number(key.split(':')[1]); if (Number.isInteger(index)) void viewExitDocument(index + (key.startsWith('saved:') ? 0 : persistedDocuments.length)) }}
              onRemove={pending && isOwner ? (key) => { const index = Number(key.split(':')[1]); if (Number.isInteger(index)) void removeDocument(index + (key.startsWith('saved:') ? 0 : persistedDocuments.length)) } : undefined}
            />
            {pending && isOwner && (
              <>
                <FileDropzone label="Thêm chứng từ bằng chứng" hint="PDF/JPG, tối đa 10MB mỗi tệp" accept="application/pdf,image/jpeg" onFiles={addDocuments} />
                {documents.length > 0 && <Button block disabled={persisting} onClick={() => { void saveDocuments() }}>Lưu chứng từ ({documents.length})</Button>}
              </>
            )}
            {pending && !isOwner && <Note>Phiếu chờ xác nhận: chỉ Chủ trại được thêm hoặc xóa chứng từ; thành viên khác chỉ xem.</Note>}
          </Box>
        </div>

        <div className="flex flex-col gap-[18px]">
          <SummaryCard
            badge={<ExitStatusBadge status={row.status} />}
            rows={[['Số con', 1], ['Loại xuất', 'Chết / mất'], ['Chuồng giảm', d.barnShift]]}
          >
            <Note>Phiếu chết / mất không có giá và thanh toán.</Note>
          </SummaryCard>

          <Box title="Kiểm tra trước khi xác nhận" gap="gap-[10px]">
            <CheckList rows={(d.checks ?? []).length ? (d.checks ?? []) : checks ? [
              ['Tổng quan', checks.cattle.some((check) => check.hasWarnings) ? `${checks.cattle.filter((check) => check.hasWarnings).length} mục có cảnh báo` : 'Không có cảnh báo', checks.cattle.some((check) => check.hasWarnings)],
              ...checks.cattle.map((check) => [check.cattleCode, check.hasWarnings ? check.messages.map((message) => message.text || message.code || 'Cảnh báo').join(' · ') || 'Có cảnh báo' : 'OK', check.hasWarnings] as [string, string, boolean?]),
              ...checks.occupancy.map((pen) => [`Chuồng ${pen.penCode}`, `${pen.before} → ${pen.after} / ${pen.capacity}`, false] as [string, string, boolean?]),
            ] : pending ? [['Tổng quan', checksError ? `Không tải được kiểm tra: ${displayError(checksError)}` : 'Đang tải kiểm tra…', true]] : (d.checks ?? [])} />
            {checks && !checksCurrent && <Note tone="warn">Thông tin phiếu đã thay đổi; cần lưu và kiểm tra lại trước khi xác nhận.</Note>}
            {Boolean(updateError || persistError) && <Note tone="err">{displayError(updateError || persistError)}</Note>}
            {canAct ? (
              <>
                <Checkbox checked={confirmed} disabled={!checksCurrent} onChange={(e) => setConfirmed(e.target.checked)} className="text-xs font-semibold">
                  Tôi đã xem các mục trên và xác nhận xuất đàn *
                </Checkbox>
                {checks && !checksCurrent && <Button block disabled={Boolean(persistError)} onClick={() => { void refreshChecks() }}>Kiểm tra lại</Button>}
                <Button variant="primary" block className="!py-[9px]" disabled={!confirmed || !checksCurrent || Boolean(persistError)} onClick={() => { void resolve('Đã xuất').catch(() => undefined) }}>Xác nhận xuất đàn</Button>
                <Button block disabled={!checksCurrent} onClick={() => openModal('reject')}>Bác đề xuất</Button>
                <Button variant="link" block onClick={() => nav('/herd-exit')}>Đóng</Button>
                <p className="m-0 text-[11px] text-muted">Bác đề xuất: bò vẫn ACTIVE, ca sức khỏe giữ nguyên kết quả; bắt buộc nhập lý do (GBR-34).</p>
              </>
            ) : (
              <>
                <p className="m-0 text-xs text-muted">{pending ? 'Chỉ Chủ trại xác nhận hoặc bác đề xuất; Quản lý chỉ xem.' : `Phiếu đã ${row.status.toLowerCase()}; chỉ còn xem.`}</p>
                <Button variant="link" block onClick={() => nav('/herd-exit')}>Đóng</Button>
              </>
            )}
          </Box>
        </div>
      </div>

      <Foot>Phiếu từ ca sức khỏe giữ bò ACTIVE đến khi Chủ trại xác nhận; "Xử lý xác" không hiện khi Loại mất = Mất tích.</Foot>

      {m === 'reject' && (
        <RejectModal row={row} onClose={closeModal} onRejected={(rejectReason: string) => resolve('Đã bác', { rejectReason })} />
      )}
    </Layout>
  )
}
