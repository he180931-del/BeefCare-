import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Field, Foot, Info, LoadingBlock, Note, PageHeader, Segmented, inputCls } from '../../../components/ui'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { supportApi } from '../api/supportApi'
import { errText, useActor, useFlash } from '../components/common'
import { ResultForm } from '../components/ResultForm'
import { IR_STATUS_LABEL, OUTCOME_LABEL, ROLE_LABEL, SupportError, formatStamp } from '../domain/supportRules'
import type { CompleteCommand, InternalStatus, InternalView } from '../types'

const TITLE = 'Yêu cầu nội bộ được giao'
const BASE = '/nen-tang/yeu-cau'
const irTone = (s: InternalStatus) => (s === 'OPEN' ? 'info' : s === 'DONE' ? 'ok' : 'outline')

export default function InternalRequestsPage() {
  const { code } = useParams()
  const me = useActor()
  const navigate = useNavigate()
  const demo = useDemoState()
  const [m, openModal, closeModal] = useModalParam()
  const [flash, showFlash] = useFlash()
  const [tabState, setTab] = useState<InternalStatus>('OPEN')
  const [pending, setPending] = useState<CompleteCommand | null>(null)
  const { data: all, loading, error, refetch } = useQuery(() => supportApi.listAssigned(me), [me])
  const { data: access } = useQuery(async () => {
    if (!code) return 'none'
    try { await supportApi.getAssigned(me, code); return 'ok' } catch (e) { return e instanceof SupportError ? e.code : 'ERROR' }
  }, [code, me, all])

  if (loading && !all) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !all) return <Layout title={TITLE}><ErrorBlock message={errText(error, 'Không tải được danh sách yêu cầu.')} onRetry={refetch} /></Layout>

  const selectedFromUrl = code ? all.find((r) => r.code === code) : undefined
  const tab = selectedFromUrl ? selectedFromUrl.status : tabState
  const items = all.filter((r) => r.status === tab)
  const selected = selectedFromUrl ?? (code ? undefined : items[0])
  const count = (s: InternalStatus) => all.filter((r) => r.status === s).length
  const back = () => { closeModal(); navigate(BASE) }
  const goTo = (r: InternalView) => navigate(`${BASE}/${r.code}`)

  const done = async (updated: InternalView) => {
    await refetch()
    showFlash(`Kết quả ${updated.code} đã được gửi cho ${updated.from}.`)
    setPending(null)
    navigate(`${BASE}/${updated.code}?m=hoan-thanh`)
  }
  const saveFailed = (cmd: CompleteCommand) => { setPending(cmd); openModal('thu-lai') }
  const retry = async () => {
    if (!selected || !pending) return
    done(await supportApi.completeInternal(me, selected.code, { ...pending, simulateSaveFailure: false }))
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={`Yêu cầu CS gửi đích danh cho bạn – chỉ xử lý trong phạm vi ${me.role}, không giải quyết hay đóng ticket`} />
        <div>
          <Segmented value={tab} onChange={(v) => { setTab(v as InternalStatus); if (code) navigate(BASE) }} options={[
            { value: 'OPEN', label: `Đang mở ${count('OPEN')}` }, { value: 'DONE', label: `Hoàn thành ${count('DONE')}` }, { value: 'CANCELLED', label: `Đã hủy ${count('CANCELLED')}` },
          ]} />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(280px,400px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {items.length === 0 && <EmptyBlock title="Không có yêu cầu" sub="Chưa có yêu cầu nào ở tab này." />}
            {items.map((r) => (
              <button key={r.code} type="button" onClick={() => goTo(r)} aria-current={selected?.code === r.code} className={`flex flex-col gap-1 rounded-md border p-4 text-left ${selected?.code === r.code ? 'border-brand bg-[#eef4ef]' : 'border-edge bg-white'}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-brand">{r.code}</span><Badge tone={irTone(r.status)} icon={r.status === 'OPEN' ? 'clock' : undefined}>{IR_STATUS_LABEL[r.status]}</Badge></span>
                <span className="text-[13px] font-semibold text-ink">{r.title}</span>
                <span className="text-[11px] text-muted">{r.ticketCode} · {r.farmName}</span>
                <span className="text-[11px] text-muted">Từ CS {r.from} · {formatStamp(r.createdAt)}</span>
              </button>
            ))}
          </div>
          {code && !selected && access === 'NOT_FOUND' ? (
            <EmptyBlock title={`Không tìm thấy yêu cầu ${code}`} sub="Mã yêu cầu không tồn tại. Hãy chọn một yêu cầu trong danh sách." action={<Button onClick={() => navigate(BASE)}>Về danh sách được giao</Button>} />
          ) : selected ? (
            <Detail ir={selected} simulateFailure={demo === 'luu-loi'} onDone={done} onSaveFailed={saveFailed} />
          ) : (
            !code && <EmptyBlock title="Chưa chọn yêu cầu" sub="Chọn một yêu cầu bên trái để xem chi tiết." />
          )}
        </div>
        <Foot>Yêu cầu nội bộ {me.role} được giao. Danh sách bên trái theo tab trạng thái; khung phải hiển thị nội dung từ CS và biểu mẫu trả kết quả. {me.role} chỉ gửi kết quả, không giải quyết hay đóng ticket. Chọn "Ngoài phạm vi" khi yêu cầu vượt quyền {me.role}, kèm lý do để CS hướng dẫn khách.</Foot>
      </div>

      {code && access === 'FORBIDDEN' && (
        <Modal title="Yêu cầu không còn được giao cho bạn" width={640} onClose={back}>
          <Note tone="warn">Người nhận hoặc quyền truy cập đã thay đổi. Không thể xem chi tiết hay gửi kết quả cho yêu cầu này.</Note>
          <ModalFooter className="!px-0 !pb-0"><ModalButton variant="primary" onClick={back}><Icon name="arrow-left" size={16} /> Về danh sách được giao</ModalButton></ModalFooter>
        </Modal>
      )}
      {selected && (m === 'hoan-thanh' || m === 'ket-thuc') && <SummaryDialog ir={selected} finished={m === 'ket-thuc'} onClose={back} />}
      {selected && (m === 'gui-ket-qua' || m === 'khong-the') && (
        <Modal title={m === 'khong-the' ? 'Không thể thực hiện / Ngoài phạm vi' : `Gửi kết quả xử lý ${selected.code}`} width={640} onClose={closeModal}>
          <ResultForm ir={selected} me={me} simulateFailure={demo === 'luu-loi'} onlyReasons={m === 'khong-the'} initialOutcome={m === 'khong-the' ? 'UNABLE' : undefined} onDone={done} onSaveFailed={saveFailed} />
        </Modal>
      )}
      {selected && m === 'thu-lai' && (
        <Modal title="Kết quả miền đã lưu, chưa lưu Hoàn thành" width={640} onClose={closeModal}>
          <Field label="IR hiện tại" id="rt-ir"><input id="rt-ir" readOnly className={inputCls} value={`${selected.code} · ${IR_STATUS_LABEL[selected.status]} · người nhận ${selected.recipient}`} /></Field>
          <Note tone="info">Chỉ thử lại bước lưu kết quả IR với tham chiếu cũ. Không thực hiện Chấp nhận, gia hạn hoặc thao tác tài khoản lần nữa.</Note>
          <ModalFooter className="!px-0 !pb-0">
            <ModalButton onClick={closeModal}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
            <ModalButton variant="primary" disabled={!pending} onClick={() => void retry()}><Icon name="refresh" size={16} /> Thử lại lưu Hoàn thành</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {flash}
    </Layout>
  )
}

function Detail({ ir, simulateFailure, onDone, onSaveFailed }: { ir: InternalView; simulateFailure: boolean; onDone: (r: InternalView) => void; onSaveFailed: (c: CompleteCommand) => void }) {
  const me = useActor()
  const navigate = useNavigate()
  return (
    <Card title={`${ir.code} · ${ir.title}`} sub={`Câu hỏi từ CS · ${ir.context.length ? ir.context.map((c) => c.label).join(', ') : `ticket ${ir.ticketCode}`}`} actions={<Badge tone={irTone(ir.status)} icon={ir.status === 'OPEN' ? 'clock' : undefined}>{IR_STATUS_LABEL[ir.status]}</Badge>}>
      <Info cols={2} items={[
        ['Ticket', `${ir.ticketCode} · ${ir.farmName}`],
        ['Người gửi', `CS ${ir.from} · ${formatStamp(ir.createdAt, true)}`],
        ['Người nhận', `${ir.recipient} (${ir.targetRole})`],
        ['Liên kết', ir.context.length ? ir.context.map((c) => c.label).join(' · ') : '—'],
        ['Phạm vi', `Chỉ trong quyền ${ROLE_LABEL[ir.targetRole]}`],
      ]} />
      <div className="rounded-md bg-page px-3 py-2.5 text-xs text-[#183528]"><b className="mb-1 block font-semibold">Câu hỏi từ CS</b>{ir.question}</div>
      <h3 className="m-0 text-sm font-semibold text-ink">Kết quả nội bộ (đã làm sạch)</h3>
      {ir.status === 'OPEN' ? (
        <ResultForm ir={ir} me={me} simulateFailure={simulateFailure} onDone={onDone} onSaveFailed={onSaveFailed} />
      ) : (
        <>
          <Info cols={2} items={[
            ['Kết quả', ir.outcome ? OUTCOME_LABEL[ir.outcome] : IR_STATUS_LABEL[ir.status]],
            ['Hoàn thành', ir.completedAt ? `${ir.completedBy ?? ''} · ${formatStamp(ir.completedAt, true)}` : '—'],
          ]} />
          {ir.result && <div className="rounded-md bg-page px-3 py-2.5 text-xs text-[#183528]">{ir.result}</div>}
          <Note tone="grey">Chỉ CS và bạn thấy kết quả này – không gửi trực tiếp cho Chủ trại. Yêu cầu đã hoàn thành hoặc đã hủy chỉ đọc.</Note>
          <div><Button variant="primary" onClick={() => navigate(BASE)}><Icon name="arrow-left" size={16} /> Về danh sách được giao</Button></div>
        </>
      )}
      <h3 className="m-0 text-sm font-semibold text-ink">Lịch sử yêu cầu</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs">
        {ir.history.map((h) => <li key={`${h.at}${h.text}`} className="flex gap-3"><span className="w-[84px] shrink-0 text-muted">{formatStamp(h.at)}</span><span>{h.actor} · {h.text}</span></li>)}
      </ul>
    </Card>
  )
}

function SummaryDialog({ ir, finished, onClose }: { ir: InternalView; finished: boolean; onClose: () => void }) {
  return (
    <Modal title={finished ? 'Yêu cầu đã kết thúc' : `${ir.code} đã hoàn thành`} width={640} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trạng thái / kết quả" id="sm-s"><input id="sm-s" readOnly className={inputCls} value={`${IR_STATUS_LABEL[ir.status]}${ir.outcome ? ` · ${OUTCOME_LABEL[ir.outcome]}` : ''}`} /></Field>
        <Field label="Người nhận / thời điểm" id="sm-w"><input id="sm-w" readOnly className={inputCls} value={`${ir.completedBy ?? ir.recipient} · ${formatStamp(ir.completedAt ?? ir.createdAt, true)}`} /></Field>
      </div>
      <Field label="Kết quả đã lưu" id="sm-r"><input id="sm-r" readOnly className={inputCls} value={ir.result ?? '—'} /></Field>
      <Note tone="info">Yêu cầu chỉ đọc. CS dùng kết quả đã làm sạch để trả lời Chủ trại; ticket vẫn giữ nguyên trạng thái.</Note>
      <ModalFooter className="!px-0 !pb-0"><ModalButton variant="primary" onClick={onClose}><Icon name="arrow-left" size={16} /> Về danh sách được giao</ModalButton></ModalFooter>
    </Modal>
  )
}
