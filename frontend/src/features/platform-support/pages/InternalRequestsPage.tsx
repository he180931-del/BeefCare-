import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Field, Icon, Info, inputCls, LoadingBlock, Modal, ModalButton, ModalFooter, Note, PageHeader, Pagination, Segmented } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { useDemoState } from '../../../demo/demoModules'
import { errText, useActor, useFlash } from '../components/common'
import { ResultForm } from '../components/ResultForm'
import { CATEGORY_LABEL, IR_STATUS_LABEL, OUTCOME_LABEL, PLATFORM_ROLE_LABEL, ROLE_LABEL, formatStamp } from '../domain/supportRules'
import type { CompleteCommand, HistoryEvent, InternalStatus, RecipientInternalView } from '../types'
import { useSupportAssigned, useSupportCommands } from '../hooks/usePlatformSupportUseCase'

const TITLE = 'Yêu cầu nội bộ được giao'
const BASE = '/nen-tang/yeu-cau'
const PAGE_SIZE = 50
const irTone = (s: InternalStatus) => (s === 'OPEN' ? 'info' : s === 'WAITING_CS' ? 'warn' : s === 'DONE' ? 'ok' : 'outline')

const chronologicalHistory = (history: HistoryEvent[]) => history
  .map((event, index) => ({ event, index, time: Date.parse(event.at) }))
  .sort((a, b) => {
    if (Number.isNaN(a.time) || Number.isNaN(b.time)) return a.index - b.index
    return a.time - b.time || a.index - b.index
  })
  .map(({ event }) => event)

function InternalHistory({ history }: { history?: HistoryEvent[] }) {
  if (history == null) return <Note tone="grey">Lịch sử chưa được cung cấp từ máy chủ.</Note>
  const rows = chronologicalHistory(history)
  if (!rows.length) return <Note tone="grey">Chưa có sự kiện lịch sử.</Note>
  return (
    <div>
      <h3 className="m-0 text-sm font-semibold text-ink">Lịch sử yêu cầu</h3>
      <ul aria-label="Lịch sử yêu cầu" className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs">
        {rows.map((h, index) => <li key={`${h.at}${h.actor}${h.text}${index}`}>{h.actor} · {h.text}</li>)}
      </ul>
    </div>
  )
}

export default function InternalRequestsPage() {
  const { code } = useParams()
  const me = useActor()
  const navigate = useNavigate()
  const demo = useDemoState()
  const [m, openModal, closeModal] = useModalParam()
  const [flash, showFlash] = useFlash()
  const [tabState, setTab] = useState<InternalStatus>('OPEN')
  const [listPage, setListPage] = useState(1)
  const [pending, setPending] = useState<CompleteCommand | null>(null)
  const { requests, access: accessQuery } = useSupportAssigned(me, code)
  const { data: all, loading, error, refetch } = requests
  const { data: access } = accessQuery
  const { completeInternal } = useSupportCommands()

  if (loading && !all) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !all) return <Layout title={TITLE}><ErrorBlock message={errText(error, 'Không tải được danh sách yêu cầu.')} onRetry={refetch} /></Layout>

  const selectedFromUrl = code ? all.find((r) => r.code === code) : undefined
  const tab = selectedFromUrl ? selectedFromUrl.status : tabState
  const items = all.filter((r) => r.status === tab)
  const selected = selectedFromUrl
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safeListPage = Math.min(listPage, pageCount)
  const pageItems = items.slice((safeListPage - 1) * PAGE_SIZE, safeListPage * PAGE_SIZE)
  const visibleItems = selectedFromUrl && !pageItems.some((r) => r.code === selectedFromUrl.code) ? [selectedFromUrl, ...pageItems] : pageItems
  const count = (s: InternalStatus) => all.filter((r) => r.status === s).length
  const back = () => { closeModal(); navigate(BASE) }
  const goTo = (r: RecipientInternalView) => navigate(`${BASE}/${r.code}`)

  const done = async (updated: RecipientInternalView) => {
    await refetch()
    showFlash(`Kết quả ${updated.code} đã được gửi cho ${updated.from}.`)
    setPending(null)
    navigate(`${BASE}/${updated.code}?m=${updated.status === 'WAITING_CS' ? 'cho-cs' : 'hoan-thanh'}`)
  }
  const saveFailed = (cmd: CompleteCommand) => { setPending(cmd); openModal('thu-lai') }
  const retry = async () => {
    if (!selected || !pending) return
    done(await completeInternal(me, selected.code, { ...pending, simulateSaveFailure: false }))
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} sub={`Yêu cầu do nhân viên hỗ trợ gửi đích danh cho bạn – chỉ xử lý trong phạm vi ${PLATFORM_ROLE_LABEL[me.role as keyof typeof PLATFORM_ROLE_LABEL] ?? me.role}, không giải quyết hay đóng yêu cầu`} />
        <div>
          <Segmented value={tab} onChange={(v) => { setTab(v as InternalStatus); setListPage(1); if (code) navigate(BASE) }} options={[
            { value: 'OPEN', label: `Đang mở ${count('OPEN')}` }, { value: 'WAITING_CS', label: `Chờ CS bổ sung ${count('WAITING_CS')}` }, { value: 'DONE', label: `Hoàn thành ${count('DONE')}` }, { value: 'CANCELLED', label: `Đã hủy ${count('CANCELLED')}` },
          ]} />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(280px,400px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {items.length === 0 && <EmptyBlock title="Không có yêu cầu" sub="Chưa có yêu cầu nào ở tab này." />}
            {visibleItems.map((r) => (
              <button key={r.code} type="button" onClick={() => goTo(r)} aria-current={selected?.code === r.code} className={`flex flex-col gap-1 rounded-md border p-4 text-left ${selected?.code === r.code ? 'border-brand bg-[#eef4ef]' : 'border-edge bg-white'}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-brand">{r.code}</span><Badge tone={irTone(r.status)} icon={r.status === 'OPEN' ? 'clock' : undefined}>{IR_STATUS_LABEL[r.status]}</Badge></span>
                <span className="text-[13px] font-semibold text-ink">{r.title}</span>
                <span className="text-[11px] text-muted">{r.ticketCode} · {r.farmName}</span>
                <span className="text-[11px] text-muted">Từ nhân viên hỗ trợ {r.from} · {formatStamp(r.createdAt)}</span>
              </button>
            ))}
            {pageCount > 1 && <Pagination page={safeListPage} pageCount={pageCount} onChange={setListPage} summary={`Hiển thị ${pageItems.length} / ${items.length} yêu cầu`} />}
          </div>
          {code && !selected && access === 'NOT_FOUND' ? (
            <EmptyBlock title={`Không tìm thấy yêu cầu ${code}`} sub="Mã yêu cầu không tồn tại. Hãy chọn một yêu cầu trong danh sách." action={<Button onClick={() => navigate(BASE)}>Về danh sách được giao</Button>} />
          ) : selected ? (
            <Detail ir={selected} simulateFailure={demo === 'luu-loi'} onDone={done} onSaveFailed={saveFailed} />
          ) : (
            !code && <EmptyBlock title="Chưa chọn yêu cầu" sub="Chọn một yêu cầu bên trái để xem chi tiết." />
          )}
        </div>
      </div>

      {code && access === 'FORBIDDEN' && (
        <Modal title="Yêu cầu không còn được giao cho bạn" width={640} onClose={back}>
          <Note tone="warn">Người nhận hoặc quyền truy cập đã thay đổi. Không thể xem chi tiết hay gửi kết quả cho yêu cầu này.</Note>
          <ModalFooter><ModalButton variant="primary" onClick={back}><Icon name="arrow-left" size={16} /> Về danh sách được giao</ModalButton></ModalFooter>
        </Modal>
      )}
      {selected && (m === 'hoan-thanh' || m === 'ket-thuc' || m === 'cho-cs') && <SummaryDialog ir={selected} finished={m === 'ket-thuc'} onClose={back} />}
      {selected && (m === 'gui-ket-qua' || m === 'khong-the') && (
        <Modal title={m === 'khong-the' ? 'Không thể thực hiện / Ngoài phạm vi' : `Gửi kết quả xử lý ${selected.code}`} width={640} onClose={closeModal}>
          <ResultForm ir={selected} me={me} simulateFailure={demo === 'luu-loi'} onlyReasons={m === 'khong-the'} initialOutcome={m === 'khong-the' ? 'NOT_CONFIRMED' : undefined} onDone={done} onSaveFailed={saveFailed} />
        </Modal>
      )}
      {selected && m === 'thu-lai' && (
        <Modal title="Kết quả miền đã lưu, chưa lưu Hoàn thành" width={640} onClose={closeModal}>
          <Field label="IR hiện tại" id="rt-ir"><input id="rt-ir" readOnly className={inputCls} value={`${selected.code} · ${IR_STATUS_LABEL[selected.status]} · người nhận ${selected.recipient}`} /></Field>
          <Note tone="info">Chỉ thử lại bước lưu kết quả IR với tham chiếu cũ. Không thực hiện Chấp nhận, gia hạn hoặc thao tác tài khoản lần nữa.</Note>
          <ModalFooter>
            <ModalButton onClick={closeModal}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
            <ModalButton variant="primary" disabled={!pending} onClick={() => void retry()}><Icon name="refresh" size={16} /> Thử lại lưu Hoàn thành</ModalButton>
          </ModalFooter>
        </Modal>
      )}
      {flash}
    </Layout>
  )
}

function Detail({ ir, simulateFailure, onDone, onSaveFailed }: { ir: RecipientInternalView; simulateFailure: boolean; onDone: (r: RecipientInternalView) => void; onSaveFailed: (c: CompleteCommand) => void }) {
  const me = useActor()
  const navigate = useNavigate()
  const [historyPage, setHistoryPage] = useState(1)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil((ir.history?.length ?? 0) / pageSize))
  const safePage = Math.min(historyPage, pageCount)
  const historyRows = ir.history == null ? undefined : chronologicalHistory(ir.history).slice((safePage - 1) * pageSize, safePage * pageSize)
  const requestText = ir.requestText || 'Chưa có nội dung yêu cầu từ máy chủ.'
  const resultNote = ir.resultNote
  return (
    <Card title={`${ir.code} · [${CATEGORY_LABEL[ir.ticketCategory]}] · ${ir.title}`} actions={<Badge tone={irTone(ir.status)} icon={ir.status === 'OPEN' ? 'clock' : undefined}>{IR_STATUS_LABEL[ir.status]}</Badge>}>
      <Info cols={2} items={[
        ['Người dùng và trang trại', [ir.ticketRequester, ir.farmName].filter(Boolean).join(' · ')],
        ['Người gửi', `Nhân viên hỗ trợ ${ir.from}`],
        ['Người nhận', `${ir.recipient} (${ROLE_LABEL[ir.targetRole]})`],
      ]} />
      <div className="rounded-md bg-page px-3 py-2.5 text-xs text-[#183528]"><b className="mb-1 block font-semibold">Nội dung yêu cầu từ nhân viên hỗ trợ</b>{requestText}</div>
      <h3 className="m-0 text-sm font-semibold text-ink">Kết quả nội bộ</h3>
      {ir.status === 'OPEN' ? (
        <>
          <div role="status" aria-label={`Đang mở. Người tiếp theo: ${ir.recipient}. Hành động: gửi kết quả`} className="rounded-md bg-[#e8f2fa] px-3 py-2.5 text-xs text-[#296194]">
            <b className="font-semibold">Đang mở · chờ {ir.recipient}</b>
            <span className="mt-1 block">Bước tiếp theo: gửi kết quả xử lý trong phạm vi {ROLE_LABEL[ir.targetRole] ?? 'vai trò được giao'}.</span>
          </div>
          <ResultForm ir={ir} me={me} simulateFailure={simulateFailure} onDone={onDone} onSaveFailed={onSaveFailed} />
        </>
      ) : ir.status === 'WAITING_CS' ? (
        <>
          <Info cols={2} items={[
            ['Kết quả', ir.outcome ? OUTCOME_LABEL[ir.outcome] : IR_STATUS_LABEL[ir.status]],
            ['Đã gửi', resultNote ? `${ir.from} · ${formatStamp(ir.createdAt, true)}` : '—'],
          ]} />
          {resultNote && <div className="rounded-md bg-warn-bg px-3 py-2.5 text-xs text-ink">{resultNote}</div>}
          <div role="status" aria-label={`Chờ nhân viên hỗ trợ bổ sung thông tin. Người tiếp theo: ${ir.from}`} className="rounded-md bg-warn-bg px-3 py-2.5 text-xs text-warn-fg">
            <b className="font-semibold">Chờ CS bổ sung · chưa thể gửi kết quả mới</b>
            <span className="mt-1 block">Bước tiếp theo: {ir.from} bổ sung thông tin; sau đó yêu cầu sẽ trở lại tab Đang mở cho {ir.recipient} xử lý tiếp.</span>
          </div>
          <div><Button variant="primary" onClick={() => navigate(BASE)}><Icon name="arrow-left" size={16} /> Về danh sách được giao</Button></div>
        </>
      ) : (
        <>
          <Info cols={2} items={[
            ['Kết quả', ir.outcome ? OUTCOME_LABEL[ir.outcome] : IR_STATUS_LABEL[ir.status]],
            ['Người hoàn thành', ir.completedBy ?? '—'],
          ]} />
          {resultNote && <div className="rounded-md bg-page px-3 py-2.5 text-xs text-[#183528]">{resultNote}</div>}
          <Note tone="grey">Chỉ nhân viên hỗ trợ và bạn thấy kết quả này – không gửi trực tiếp cho Chủ trại. Yêu cầu đã hoàn thành hoặc đã hủy chỉ đọc.</Note>
          <div><Button variant="primary" onClick={() => navigate(BASE)}><Icon name="arrow-left" size={16} /> Về danh sách được giao</Button></div>
        </>
      )}
      <InternalHistory history={historyRows} />
      {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} onChange={setHistoryPage} summary={`Hiển thị ${historyRows?.length ?? 0} / ${ir.history?.length ?? 0} sự kiện`} />}
    </Card>
  )
}

function SummaryDialog({ ir, finished, onClose }: { ir: RecipientInternalView; finished: boolean; onClose: () => void }) {
  const waiting = ir.status === 'WAITING_CS'
  const resultNote = ir.resultNote
  return (
    <Modal title={waiting ? `${ir.code} đã chờ CS bổ sung` : finished ? 'Yêu cầu đã kết thúc' : `${ir.code} đã hoàn thành`} width={640} onClose={onClose}>
      <Field label="Ghi chú kết quả đã lưu" id="sm-r"><input id="sm-r" readOnly className={inputCls} value={resultNote ?? '—'} /></Field>
      <InternalHistory history={ir.history} />
      <ModalFooter><ModalButton variant="primary" onClick={onClose}><Icon name="arrow-left" size={16} /> Về danh sách được giao</ModalButton></ModalFooter>
    </Modal>
  )
}
