import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Checkbox, DateInput, Docs, Field, Foot, Note, Radio, Segmented, Table, Td, Th, Textarea, inputCls } from '../../../components/ui'
import { confirmHerdExit, dismissHerdExit, downloadExitAttachment, herdExitApi, saveHerdExit } from '../api/index'
import { useMutation, useQuery } from '../../../hooks/useApi'
import { dmy } from '../../../data/format'
import { Box, CheckList, SummaryCard, TH } from './parts'
import RejectModal from './RejectModal'
import type { HerdExit, ExitDetail } from '../../../types'
import type { ExitChecks } from '../api/herdExitBackendApi'

const DISPOSALS = ['Tiêu hủy / chôn lấp tại trại', 'Giao thú y địa phương', 'Khác']
const displayError = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? 'Unknown error'

// Phiếu xuất "Chết / mất" tạo từ ca sức khỏe, chờ Chủ trại xác nhận.
export default function DeathView({ row }: { row: HerdExit }) {
  const { mutate: dismissExit, error: updateError } = useMutation<{ id: string; reason: string; expectedVersion: number }, HerdExit>(({ id, reason, expectedVersion }) => dismissHerdExit(id, reason, expectedVersion))
  const { mutate: persistExit, error: persistError } = useMutation(saveHerdExit)
  const nav = useNavigate()
  const [m, openModal, closeModal] = useModalParam()
  const d: ExitDetail = { cows: [], docs: [], history: [], checks: [], cow: { code: '', tag: '', breed: '', sex: '', barn: '', weight: 0, caseLine: ['', ''] }, ...row.detail }
  const cow = d.cow ?? { code: '', tag: '', breed: '', sex: '', barn: '', weight: 0, caseLine: ['', ''] }
  const pending = row.status === 'Chờ xác nhận'
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
  const [documentError, setDocumentError] = useState('')
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
  const persistedDocuments = d.docs ?? []
  const viewDocument = async (index: number) => {
    const persisted = persistedDocuments[index]
    try {
      let url = persisted && typeof persisted.url === 'string' ? persisted.url : ''
      if (persisted && typeof persisted.id === 'number' && persisted.id > 0) url = URL.createObjectURL(await downloadExitAttachment(row.id, persisted.id))
      if (!url) return
      window.open(url, '_blank', 'noopener,noreferrer')
      if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setDocumentError('')
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Không thể mở chứng từ.')
    }
  }

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
        <div className="mt-1"><Badge tone={pending ? 'warn' : undefined} className={pending ? '!border-0' : undefined}>{row.status}</Badge></div>
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
                    <Radio key={t} name="lossType" checked={lossType === t} onChange={() => pending && setLossType(t)}>{t}</Radio>
                  ))}
                </div>
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
            <Table>
              <thead>
                <tr>
                  <Th className={TH}>Mã bò</Th><Th className={TH}>Thẻ tai</Th><Th className={TH}>Giống · giới tính</Th><Th className={TH}>Tuổi</Th>
                  <Th className={TH}>Chuồng</Th><Th className={TH}>Cân gần nhất</Th><Th className={TH}>Ca sức khỏe</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td className={`${TH} font-medium`}>{cow.code}</Td><Td className={TH}>{cow.tag}</Td>
                  <Td className={TH}>{cow.breed} · {cow.sex}</Td><Td className={TH}>{cow.age}</Td>
                  <Td className={TH}>{cow.barn}</Td><Td className={TH}>{cow.weight} kg UT</Td>
                  <Td className={TH}>{(cow.caseLine ?? ['', ''])[0]}<br />{(cow.caseLine ?? ['', ''])[1]}</Td>
                </tr>
              </tbody>
            </Table>
          </Box>

          <Box title="3. Chứng từ đính kèm" sub="Ảnh, biên bản tiêu hủy hoặc xác nhận của thú y" gap="gap-3">
            {documentError && <Note tone="err">{documentError}</Note>}
            <Docs docs={persistedDocuments} onView={viewDocument} />
            {pending && <Note>Phiếu chờ xác nhận: chứng từ hiện có chỉ xem được; tải lên sau khi phiếu ở trạng thái Nháp.</Note>}
          </Box>
        </div>

        <div className="flex flex-col gap-[18px]">
          <SummaryCard
            badge={<Badge tone="warn" className="!border-0">Chờ xác nhận</Badge>}
            rows={[['Số con', 1], ['Loại xuất', 'Chết / mất'], ['Chuồng giảm', d.barnShift]]}
          >
            <Note>Phiếu chết / mất không có giá và thanh toán.</Note>
          </SummaryCard>

          <Box title="Kiểm tra trước khi xác nhận" gap="gap-[10px]">
            <CheckList rows={checks ? [
              ['Tổng quan', checks.cattle.some((check) => check.hasWarnings) ? `${checks.cattle.filter((check) => check.hasWarnings).length} mục có cảnh báo` : 'Không có cảnh báo', checks.cattle.some((check) => check.hasWarnings)],
              ...checks.cattle.map((check) => [check.cattleCode, check.hasWarnings ? check.messages.map((message) => message.text || message.code || 'Cảnh báo').join(' · ') || 'Có cảnh báo' : 'OK', check.hasWarnings] as [string, string, boolean?]),
              ...checks.occupancy.map((pen) => [`Chuồng ${pen.penCode}`, `${pen.before} → ${pen.after} / ${pen.capacity}`, false] as [string, string, boolean?]),
            ] : pending ? [['Tổng quan', checksError ? `Không tải được kiểm tra: ${displayError(checksError)}` : 'Đang tải kiểm tra…', true]] : (d.checks ?? [])} />
            {checks && !checksCurrent && <Note tone="warn">Thông tin phiếu đã thay đổi; cần lưu và kiểm tra lại trước khi xác nhận.</Note>}
            {Boolean(updateError || persistError) && <Note tone="err">{displayError(updateError || persistError)}</Note>}
            {pending ? (
              <>
                <Checkbox checked={confirmed} disabled={!checksCurrent} onChange={(e) => setConfirmed(e.target.checked)} className="text-xs font-semibold">
                  Tôi đã xem các mục trên và xác nhận xuất đàn *
                </Checkbox>
                {checks && !checksCurrent && <Button block disabled={Boolean(persistError)} onClick={() => { void refreshChecks() }}>Kiểm tra lại</Button>}
                <Button variant="primary" block className="!border-0 !py-[9px]" disabled={!confirmed || !checksCurrent || Boolean(persistError)} onClick={() => { void resolve('Đã xuất').catch(() => undefined) }}>Xác nhận xuất đàn</Button>
                <Button block disabled={!checksCurrent} onClick={() => openModal('reject')}>Bác đề xuất</Button>
                <Button variant="link" block onClick={() => nav('/herd-exit')}>Đóng</Button>
                <p className="m-0 text-[11px] text-muted">Bác đề xuất: bò vẫn ACTIVE, ca sức khỏe giữ nguyên kết quả; bắt buộc nhập lý do (GBR-34).</p>
              </>
            ) : (
              <p className="m-0 text-xs text-muted">Phiếu đã {row.status.toLowerCase()}; chỉ còn xem.</p>
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
