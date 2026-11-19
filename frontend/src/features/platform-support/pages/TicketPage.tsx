import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Segmented, Table, Td, Th, inputCls, smInputCls } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { supportApi } from '../api/supportApi'
import { Avatar, StatusBadge, errText, useActor, useFlash } from '../components/common'
import { ReasonDialog } from '../components/ReasonDialog'
import { ClosedDialog, CloseDialog, CreateInternalDialog, HandOverDialog, ReassignDialog } from '../components/TicketDialogs'
import { CATEGORY_LABEL, IR_STATUS_LABEL, OUTCOME_LABEL, PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL, formatStamp, isAssignedTo, isClaimable, latestResolution, openIrOf } from '../domain/supportRules'
import type { InternalView, TargetRole, Ticket, TicketCategory, TicketPriority } from '../types'

type ConvTab = 'public' | 'internal' | 'history'

export default function TicketPage() {
  const { id = '' } = useParams()
  const me = useActor()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [m, , closeModal] = useModalParam()
  const [flash, showFlash] = useFlash()
  const location = useLocation()
  const [tab, setTab] = useState<ConvTab>('public')
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const { data: t, loading, error, refetch } = useQuery(() => supportApi.getTicket(me, id), [id, me])

  const carried = (location.state as { flash?: string } | null)?.flash
  useEffect(() => { if (carried) showFlash(carried) }, [carried, showFlash])

  const title = t ? `${t.code} · ${t.subject}` : 'Xử lý ticket'
  if (loading && !t) return <Layout title="Xử lý ticket"><LoadingBlock /></Layout>
  if (error || !t) {
    const msg = error instanceof Error ? error.message : 'Không tải được ticket.'
    const notFound = msg.includes('Không tìm thấy')
    return (
      <Layout title="Xử lý ticket">
        {notFound
          ? <EmptyBlock title={`Không tìm thấy ticket ${id}`} sub="Mã ticket không tồn tại hoặc đã bị xóa." action={<Button onClick={() => navigate('/nen-tang/ho-tro')}>Về hàng đợi</Button>} />
          : <ErrorBlock message={msg} onRetry={refetch} />}
      </Layout>
    )
  }

  const mine = isAssignedTo(t, me)
  const closed = t.status === 'CLOSED'
  const canEdit = mine && !closed
  const openIr = openIrOf(t)
  const irParam = params.get('ir')
  const targetIr = t.internalRequests.find((r) => r.code === irParam && r.status === 'OPEN') ?? openIr
  const res = latestResolution(t)
  const unavailableOwner = t.assignedCsId !== null && !t.assignedAvailable

  const go = (name: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(params)
    next.set('m', name)
    Object.entries(extra).forEach(([k, v]) => next.set(k, v))
    setParams(next)
  }
  /** Chạy lệnh, tải lại ticket rồi đóng hộp thoại; lỗi được ném lại để hộp thoại hiện nội tuyến. */
  const act = async (fn: () => Promise<unknown>, okMessage: string, next?: string) => {
    await fn()
    await refetch()
    showFlash(okMessage)
    if (next) go(next)
    else closeModal()
  }
  const claim = async () => {
    if (unavailableOwner) return go('nhan-lai')
    try { await supportApi.claim(me, t.code, { expectedVersion: t.version }); await refetch(); showFlash(`Bạn đang phụ trách ${t.code}.`) } catch (e) { showFlash(errText(e), 'err'); void refetch() }
  }
  const classify = async (patch: { category?: TicketCategory; priority?: TicketPriority }) => {
    try { await supportApi.classify(me, t.code, { ...patch, expectedVersion: t.version }); await refetch(); showFlash('Đã lưu thay đổi.') } catch (e) { showFlash(errText(e), 'err') }
  }
  const sendReply = async () => {
    if (!reply.trim()) return setReplyError('Nội dung trả lời là bắt buộc.')
    setReplyError(null)
    try { await supportApi.reply(me, t.code, { text: reply, expectedVersion: t.version }); setReply(''); await refetch(); showFlash('Đã gửi trả lời.') } catch (e) { setReplyError(errText(e)) }
  }

  const resolveBlocked = !!openIr
  const header = (
    <>
      {canEdit && <Button onClick={() => go('chuyen-giao')}>Chuyển giao</Button>}
      {canEdit && t.status !== 'RESOLVED' && <Button variant="primary" onClick={() => go('ghi-ket-qua')} disabled={resolveBlocked} title={resolveBlocked ? `Yêu cầu nội bộ ${openIr?.code} vẫn đang mở` : undefined}>Ghi kết quả giải quyết</Button>}
      {canEdit && t.status === 'RESOLVED' && <Button variant="primary" onClick={() => go('dong-ticket')}>Đóng ticket</Button>}
      {!mine && isClaimable(t) && <Button variant="primary" onClick={() => void claim()}>{unavailableOwner ? 'Nhận lại' : 'Nhận'}</Button>}
    </>
  )

  const messages = t.messages.filter((x) => x.visibility === (tab === 'internal' ? 'INTERNAL' : 'PUBLIC'))
  const action = (label: string, onClick: () => void, enabled: boolean, icon?: 'circle-plus') => (
    <Button block onClick={onClick} disabled={!enabled}>{icon && <Icon name={icon} size={16} />} {label}</Button>
  )

  return (
    <Layout title={title}>
      <div className="flex flex-col gap-4">
        <PageHeader title={title} sub={`${t.requester} · ${t.farmName} · ${CATEGORY_LABEL[t.category]} · tạo ${formatStamp(t.createdAt, true)}`}>{header}</PageHeader>
        {closed && <Note tone="grey">Ticket đã đóng và chỉ đọc. Hãy tạo ticket mới nếu cần hỗ trợ thêm.</Note>}
        {!closed && !mine && (
          <Note tone="warn">Chỉ CS đang phụ trách mới được thay đổi ticket này.{isClaimable(t) && <> <Button variant="link" size="sm" onClick={() => void claim()}>Nhận</Button></>}</Note>
        )}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Trao đổi">
              <div><Segmented options={[{ value: 'public', label: 'Trao đổi công khai' }, { value: 'internal', label: 'Ghi chú nội bộ (CS)' }, { value: 'history', label: 'Lịch sử' }]} value={tab} onChange={(v) => setTab(v as ConvTab)} /></div>
              {tab === 'internal' && (
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[11px] text-muted">Chỉ CS và người nhận yêu cầu nội bộ được nêu tên thấy</p>
                  <div className="flex items-center gap-2"><Badge tone="warn">Chỉ CS</Badge>{canEdit && <Button size="sm" onClick={() => go('ghi-chu')}>Thêm ghi chú</Button>}</div>
                </div>
              )}
              {tab !== 'history' && messages.length === 0 && <p className="m-0 text-xs text-muted">Chưa có nội dung.</p>}
              {tab !== 'history' && messages.map((x) => (
                <div key={x.id} className="flex gap-3">
                  <Avatar name={x.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-ink">{x.author} · {x.authorRole === 'OWNER' ? 'Chủ trại' : 'CS'}</span><span className="text-muted">{formatStamp(x.at)}</span></div>
                    <div className={`mt-1 rounded-md px-3 py-2.5 text-xs text-[#183528] ${x.visibility === 'INTERNAL' ? 'bg-warn-bg' : x.authorRole === 'CS' ? 'bg-[#eef4ef]' : 'bg-page'}`}>{x.text}</div>
                  </div>
                </div>
              ))}
              {tab === 'history' && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-xs">
                  {[...t.history].reverse().map((h) => <li key={`${h.at}${h.text}`} className="flex gap-3"><span className="w-[84px] shrink-0 text-muted">{formatStamp(h.at)}</span><span className="text-ink"><b className="font-semibold">{h.actor}</b> · {h.text}</span></li>)}
                </ul>
              )}
              {tab === 'public' && canEdit && (
                <div>
                  <div className="flex gap-3">
                    <input aria-label="Trả lời công khai" className={inputCls} placeholder="Trả lời công khai cho Chủ trại…" maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void sendReply()} />
                    <Button variant="primary" onClick={() => void sendReply()}><Icon name="send" size={16} /> Gửi</Button>
                  </div>
                  {replyError && <p role="alert" className="m-0 mt-1 text-xs text-err-fg">{replyError}</p>}
                </div>
              )}
            </Card>
            {res && (
              <Card title={`Kết quả giải quyết · phiên bản ${res.version}`} actions={res.acknowledged ? <Badge tone="ok">Chủ trại đã xác nhận {formatStamp(res.acknowledgedAt ?? '')}</Badge> : <Badge tone="outline">Chờ Chủ trại xác nhận</Badge>}>
                <p className="m-0 text-xs text-muted">{res.resolvedBy} · {formatStamp(res.resolvedAt)}</p>
                <p className="m-0 text-xs text-ink">{res.content}</p>
              </Card>
            )}
            <InternalRequestsCard ticket={t} canEdit={canEdit} onCreate={() => go('tao-yeu-cau')} onReassign={(r) => go('doi-nguoi-nhan', { ir: r.code })} onCancel={(r) => go('huy-yeu-cau', { ir: r.code })} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Xử lý">
              <Facts items={[
                ['Trạng thái', <StatusBadge key="s" status={t.status} />],
                ['Ưu tiên', canEdit
                  ? <select key="p" aria-label="Ưu tiên" className={smInputCls} value={t.priority} onChange={(e) => void classify({ priority: e.target.value as TicketPriority })}>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select>
                  : PRIORITY_LABEL[t.priority]],
                ['Danh mục', canEdit
                  ? <select key="c" aria-label="Danh mục" className={smInputCls} value={t.category} onChange={(e) => void classify({ category: e.target.value as TicketCategory })}>{(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
                  : CATEGORY_LABEL[t.category]],
                ['Phụ trách', t.assignedCs ? `${t.assignedCs}${t.assignedCsId === me.id ? ' (bạn)' : ''}${unavailableOwner ? ' · không khả dụng' : ''}` : 'Chưa nhận', unavailableOwner],
              ]} />
              {openIr && <Note tone="warn">{openIr.code} còn mở: chưa thể ghi kết quả giải quyết hoặc đóng ticket.</Note>}
            </Card>
            <Card title="Thao tác được phép">
              {action('Yêu cầu khách bổ sung', () => go('yeu-cau-bo-sung'), canEdit && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'))}
              {action('Trả về hàng đợi', () => go('tra-ve'), canEdit)}
              {action('Đổi người nhận yêu cầu nội bộ', () => go('doi-nguoi-nhan'), canEdit && !!openIr)}
              {action('Hủy yêu cầu nội bộ', () => go('huy-yeu-cau'), canEdit && !!openIr)}
              {action('Tạo yêu cầu cho SA', () => go('tao-yeu-cau-sa'), canEdit, 'circle-plus')}
              <Foot>Trạng thái chỉ đổi qua thao tác riêng; không đặt trực tiếp Đã giải quyết hay Đã đóng. PM/SA chỉ gửi kết quả cho yêu cầu nội bộ.</Foot>
            </Card>
          </div>
        </div>
        <Foot>Xử lý ticket (CS đang phụ trách). Tab Trao đổi công khai là nội dung Chủ trại thấy; Ghi chú nội bộ chỉ CS thấy. Khi còn yêu cầu nội bộ đang mở, nút "Ghi kết quả giải quyết" bị khóa và có lời giải thích ở khung Xử lý.</Foot>
      </div>
      <TicketDialogsHost
        ticket={t} modal={m} targetIr={targetIr} me={me} closeModal={closeModal} act={act} reload={() => { void refetch(); closeModal() }}
        onPublic={() => { setTab('public'); closeModal() }} onViewExisting={() => { setTab('public'); closeModal() }}
      />
      {flash}
    </Layout>
  )
}

function InternalRequestsCard({ ticket, canEdit, onCreate, onReassign, onCancel }: { ticket: Ticket; canEdit: boolean; onCreate: () => void; onReassign: (r: InternalView) => void; onCancel: (r: InternalView) => void }) {
  const open = ticket.internalRequests.filter((r) => r.status === 'OPEN').length
  return (
    <Card title="Yêu cầu nội bộ" sub={open ? `${open} yêu cầu đang mở` : 'Không có yêu cầu đang mở'} actions={canEdit ? <Button size="sm" onClick={onCreate}><Icon name="circle-plus" size={16} /> Tạo yêu cầu</Button> : undefined}>
      {ticket.internalRequests.length === 0 ? <p className="m-0 text-xs text-muted">Chưa có yêu cầu nội bộ.</p> : (
        <Table stack={false}>
          <thead><tr><Th>Mã</Th><Th>Gửi tới</Th><Th>Nội dung</Th><Th>Trạng thái</Th>{canEdit && <Th><span className="sr-only">Thao tác</span></Th>}</tr></thead>
          <tbody>
            {ticket.internalRequests.map((r) => (
              <tr key={r.code}>
                <Td className="font-medium">{r.code}</Td>
                <Td><div className="font-medium">{r.recipient}</div><div className="text-[11px] text-muted">{ROLE_LABEL[r.targetRole as TargetRole]}</div></Td>
                <Td>
                  <div>{r.title}</div>
                  {r.status === 'DONE' && <div className="mt-1 text-[11px] text-muted">{r.outcome ? OUTCOME_LABEL[r.outcome] : ''}: {r.result}</div>}
                </Td>
                <Td><Badge tone={r.status === 'OPEN' ? 'info' : r.status === 'DONE' ? 'ok' : 'outline'} icon={r.status === 'OPEN' ? 'clock' : undefined}>{IR_STATUS_LABEL[r.status]}</Badge></Td>
                {canEdit && <Td>{r.status === 'OPEN' && <div className="flex gap-1"><Button variant="link" size="sm" onClick={() => onReassign(r)}>Đổi người nhận</Button><Button variant="link" size="sm" onClick={() => onCancel(r)}>Hủy</Button></div>}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

function TicketDialogsHost({ ticket: t, modal, targetIr, me, closeModal, act, reload, onPublic, onViewExisting }: {
  ticket: Ticket
  modal: string | null
  targetIr: InternalView | undefined
  me: ReturnType<typeof useActor>
  closeModal: () => void
  act: (fn: () => Promise<unknown>, ok: string, next?: string) => Promise<void>
  reload: () => void
  onPublic: () => void
  onViewExisting: () => void
}) {
  const v = t.version
  const lastNote = [...t.messages].reverse().find((x) => x.visibility === 'INTERNAL')
  switch (modal) {
    case 'chuyen-giao':
      return <HandOverDialog onClose={closeModal} onSubmit={(to, reason) => act(() => supportApi.handOver(me, t.code, { toCsId: to, reason, expectedVersion: v }), `${t.code} đã được chuyển giao.`)} />
    case 'yeu-cau-bo-sung':
      return <ReasonDialog title="Yêu cầu khách bổ sung thông tin" label="Nội dung gửi công khai *" max={3000} placeholder="Anh vui lòng gửi mã giao dịch và thời điểm ngân hàng ghi nhận." submitLabel="Gửi và chờ khách" submitIcon="send" note="Ticket chuyển Đang xử lý → Chờ khách phản hồi và lưu câu hỏi công khai. Chủ trại phản hồi thì chuyển lại Đang xử lý." onClose={closeModal}
        onSubmit={(question) => act(() => supportApi.askCustomer(me, t.code, { question, expectedVersion: v }), `Ticket ${t.code} hiện ở trạng thái Chờ khách phản hồi.`)} />
    case 'tra-ve':
      return <ReasonDialog title="Trả ticket về hàng đợi" label="Lý do *" placeholder="Chưa có đủ thông tin chuyên môn, cần CS phù hợp nhận lại" submitLabel="Trả về hàng đợi" note="Ticket được bỏ CS phụ trách, giữ nguyên trạng thái và lịch sử. Các yêu cầu nội bộ giữ nguyên trạng thái/người nhận." onClose={closeModal}
        onSubmit={(reason) => act(() => supportApi.returnToQueue(me, t.code, { reason, expectedVersion: v }), `Ticket ${t.code} đã trả về hàng đợi.`)} />
    case 'ghi-chu':
      return <ReasonDialog title="Ghi chú nội bộ của CS" label="Ghi chú mới *" max={3000} placeholder="Cần xác minh mã chính xác; không xác nhận thanh toán từ lời khách." submitLabel="Lưu ghi chú (chỉ CS thấy)" onClose={closeModal} secondary={{ label: 'Trao đổi công khai', onClick: onPublic }}
        note={<>{lastNote && <span className="mb-1 block">Lịch sử (chỉ CS thấy): {lastNote.author} · {formatStamp(lastNote.at)}.</span>}Chỉ CS được phép xem; ghi chú này không xuất hiện ở hội thoại Chủ trại hoặc phần nhận của PM/SA.</>}
        onSubmit={(text) => act(() => supportApi.addNote(me, t.code, { text, expectedVersion: v }), 'Đã thêm ghi chú nội bộ (chỉ CS thấy).')} />
    case 'tao-yeu-cau':
    case 'tao-yeu-cau-sa':
      return <CreateInternalDialog ticket={t} initialRole={modal === 'tao-yeu-cau-sa' ? 'SA' : 'PM'} onClose={closeModal} onViewExisting={onViewExisting}
        onSubmit={(cmd) => act(() => supportApi.createInternal(me, t.code, cmd), `Đã gửi yêu cầu nội bộ cho ${cmd.targetRole}.`)} />
    case 'doi-nguoi-nhan':
      return targetIr ? <ReassignDialog ir={targetIr} onClose={closeModal} onSubmit={(rid, reason) => act(() => supportApi.manageInternal(me, t.code, targetIr.code, { action: 'REASSIGN', recipientId: rid, reason }), `Yêu cầu ${targetIr.code} đã được chuyển người nhận.`)} /> : null
    case 'huy-yeu-cau':
      return targetIr ? (
        <ReasonDialog title={`Hủy yêu cầu nội bộ ${targetIr.code}`} label="Lý do hủy *" placeholder="Yêu cầu sai phạm vi; sẽ gửi lại đúng vai trò" submitLabel="Xác nhận hủy IR" onClose={closeModal}
          note="Chỉ CS hiện phụ trách được hủy IR Đang mở. Yêu cầu chuyển Đã hủy, giữ kết quả miền đã làm nếu có và toàn bộ lịch sử."
          onSubmit={(reason) => act(() => supportApi.manageInternal(me, t.code, targetIr.code, { action: 'CANCEL', reason }), `Yêu cầu ${targetIr.code} đã được hủy.`)} />
      ) : null
    case 'ghi-ket-qua': {
      const open = openIrOf(t)
      return (
        <ReasonDialog title="Ghi kết quả giải quyết công khai" label="Kết quả công khai *" max={3000} placeholder="Giao dịch BCF7K2Q9 đã được xác nhận. Kỳ mua từ 15/11/2026 đến 14/11/2027." submitLabel="Gửi kết quả và Đã giải quyết" submitIcon="send" onClose={closeModal}
          readOnly={{ label: 'Ticket / điều kiện', value: `${t.code} · ${STATUS_LABEL[t.status]} · ${open ? `Còn ${open.code} Đang mở` : 'Không còn IR Đang mở'}` }}
          blocked={!!open} warn={open ? `Yêu cầu nội bộ ${open.code} vẫn đang mở. Ticket chưa thể ghi kết quả hoặc đóng.` : undefined}
          note="Chỉ CS được giao ghi kết quả. Tạo kết quả mới, chuyển Đã giải quyết và chờ Chủ trại xác nhận; không tự đóng ticket."
          onSubmit={(content) => act(() => supportApi.resolve(me, t.code, { content, expectedVersion: v }), `Đã ghi kết quả phiên bản ${t.resolutions.length + 1}. Chủ trại đã được thông báo.`)} />
      )
    }
    case 'dong-ticket':
      return <CloseDialog ticket={t} onClose={closeModal} onReload={reload}
        onSubmit={(reviewed, note) => act(() => supportApi.close(me, t.code, { reviewed, note, expectedVersion: v }), `Ticket ${t.code} đã được đóng.`, 'da-dong')} />
    case 'da-dong':
      return t.status === 'CLOSED' ? <ClosedDialog ticket={t} onClose={closeModal} /> : null
    case 'nhan-lai':
      return (
        <ReasonDialog title="Nhận ticket chưa có CS khả dụng" label="Lý do nhận *" placeholder="Tiếp nhận lại để xem xác nhận mới nhất của Chủ trại" submitLabel="Xác nhận nhận ticket" onClose={closeModal}
          readOnly={{ label: 'Ticket / trạng thái hiện tại', value: `${t.code} · ${STATUS_LABEL[t.status]} · CS cũ không khả dụng` }}
          note="Nhận chỉ thay người phụ trách, giữ nguyên trạng thái hiện tại. Không ghi đè một CS vẫn đang phụ trách hợp lệ."
          onSubmit={(reason) => act(() => supportApi.claim(me, t.code, { reason, expectedVersion: v }), `Bạn đang phụ trách ${t.code}.`)} />
      )
    default:
      return null
  }
}


/** Như Info nhưng giá trị có thể là phần tử (badge, ô chọn). */
function Facts({ items }: { items: Array<[string, ReactNode, boolean?]> }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(([k, v, warn]) => (
        <div key={k} className="min-w-0">
          <dt className="mb-[3px] text-[11px] text-faint">{k}</dt>
          <dd className={`m-0 text-[13px] ${warn ? 'font-semibold text-warn-fg' : 'font-medium'}`}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
