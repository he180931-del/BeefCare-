import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Icon, inputCls, LoadingBlock, Modal, Note, PageHeader, Pagination, Segmented, smInputCls } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Avatar, StatusBadge, errText, useActor, useFlash } from '../components/common'
import { ReasonDialog } from '../components/ReasonDialog'
import { ClosedDialog, CloseDialog, CreateInternalDialog, HandOverDialog, ReassignDialog } from '../components/TicketDialogs'
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, SupportError, defaultInternalRequestRole, formatStamp, isAssignedTo, isClaimable, latestResolution, openIrOf } from '../domain/supportRules'
import type { InternalView, Ticket, TicketCategory, TicketMessage, TicketPriority } from '../types'
import { useSupportCommands, useSupportTicket } from '../hooks/usePlatformSupportUseCase'

type ConvTab = 'public' | 'internal' | 'history'
const HISTORY_PAGE_SIZE = 50

const chronologicalHistory = (history: NonNullable<Ticket['history']>) => history
  .map((event, index) => ({ event, index, time: Date.parse(event.at) }))
  .sort((a, b) => {
    if (Number.isNaN(a.time) || Number.isNaN(b.time)) return a.index - b.index
    return a.time - b.time || a.index - b.index
  })
  .map(({ event }) => event)

export default function TicketPage() {
  const { id = '' } = useParams()
  const me = useActor()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [m, , closeModal] = useModalParam()
  const [flash, showFlash] = useFlash()
  const location = useLocation()
  const [tab, setTab] = useState<ConvTab>('public')
  const [historyPage, setHistoryPage] = useState(1)
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replySending, setReplySending] = useState(false)
  const replySendingRef = useRef(false)
  const { data: t, loading, error, refetch, setData: setTicket } = useSupportTicket(me, id)
  const { claim: claimCommand, classify: classifyCommand, reply: replyCommand, getMessages } = useSupportCommands()
  const [loadedMessages, setLoadedMessages] = useState<TicketMessage[]>([])
  const [messagesBeforeId, setMessagesBeforeId] = useState<number | null>(null)
  const [messagesHasMore, setMessagesHasMore] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState('')
  const messagesViewport = useRef<HTMLDivElement>(null)

  const carried = (location.state as { flash?: string } | null)?.flash
  useEffect(() => { if (carried) showFlash(carried) }, [carried, showFlash])
  useEffect(() => {
    if (!t) return
    setLoadedMessages(t.messages)
    setMessagesBeforeId(t.messagesBeforeId ?? null)
    setMessagesHasMore(t.messagesHasMore === true)
    setMessagesError('')
    requestAnimationFrame(() => {
      if (messagesViewport.current) messagesViewport.current.scrollTop = messagesViewport.current.scrollHeight
    })
  }, [t?.id, t?.updatedAt, t?.messages, t?.messagesBeforeId, t?.messagesHasMore])

  const title = t ? `${t.code} · ${t.subject}` : 'Xử lý yêu cầu hỗ trợ'
  if (loading && !t) return <Layout title="Xử lý yêu cầu hỗ trợ"><LoadingBlock /></Layout>
  if (error || !t) {
    const msg = error instanceof Error ? error.message : 'Không tải được yêu cầu hỗ trợ.'
    const notFound = msg.includes('Không tìm thấy')
    return (
      <Layout title="Xử lý yêu cầu hỗ trợ">
        {notFound
          ? <EmptyBlock title={`Không tìm thấy yêu cầu ${id}`} sub="Mã yêu cầu không tồn tại hoặc đã bị xóa." action={<Button onClick={() => navigate('/nen-tang/ho-tro')}>Về hàng đợi</Button>} />
          : <ErrorBlock message={msg} onRetry={refetch} />}
      </Layout>
    )
  }

  const mine = isAssignedTo(t, me)
  const closed = t.status === 'CLOSED'
  const canEdit = mine && !closed
  const openIr = openIrOf(t)
  const canManageInternal = canEdit && !!openIr
  const irParam = params.get('ir')
  const targetIr = t.internalRequests.find((r) => r.code === irParam) ?? openIr
  const res = latestResolution(t)
  const unavailableOwner = t.assignedCsId !== null && !t.assignedAvailable
  const historyRows = t.history == null ? undefined : chronologicalHistory(t.history)
  const historyPageCount = Math.max(1, Math.ceil((historyRows?.length ?? 0) / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyPageCount)
  const visibleHistory = historyRows?.slice((safeHistoryPage - 1) * HISTORY_PAGE_SIZE, safeHistoryPage * HISTORY_PAGE_SIZE)

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
    try { await claimCommand(me, t.code, { expectedVersion: t.version }); await refetch(); showFlash(`Bạn đang phụ trách ${t.code}.`) } catch (e) { showFlash(errText(e), 'err'); void refetch() }
  }
  const classify = async (patch: { category?: TicketCategory; priority?: TicketPriority }) => {
    try { await classifyCommand(me, t.code, { ...patch, expectedVersion: t.version }); await refetch(); showFlash('Đã lưu thay đổi.') } catch (e) { showFlash(errText(e), 'err') }
  }
  const sendReply = async () => {
    if (replySendingRef.current) return
    if (!reply.trim()) return setReplyError('Nội dung trả lời là bắt buộc.')
    setReplyError(null)
    replySendingRef.current = true
    setReplySending(true)
    try {
      const updated = await replyCommand(me, t.code, { text: reply, expectedVersion: t.version })
      setTicket(updated)
      setReply('')
      showFlash('Đã gửi trả lời.')
    } catch (e) {
      setReplyError(errText(e))
      if (e instanceof SupportError && e.code === 'CONFLICT') {
        await refetch() // Giữ lỗi gửi hiện tại; ErrorBlock hiển thị nếu tải lại cũng thất bại.
      }
    } finally {
      replySendingRef.current = false
      setReplySending(false)
    }
  }

  const resolveBlocked = !!openIr
  const header = (
    <>
      {canEdit && <Button onClick={() => go('chuyen-giao')}>Chuyển giao</Button>}
      {canEdit && t.status !== 'RESOLVED' && <Button variant="primary" onClick={() => go('ghi-ket-qua')} disabled={resolveBlocked} title={resolveBlocked ? `Yêu cầu nội bộ ${openIr?.code} vẫn đang mở` : undefined}>Ghi kết quả giải quyết</Button>}
      {canEdit && t.status === 'RESOLVED' && <Button variant="primary" onClick={() => go('dong-ticket')}>Đóng yêu cầu</Button>}
      {!mine && isClaimable(t) && <Button variant="primary" onClick={() => void claim()}>{unavailableOwner ? 'Nhận lại' : 'Nhận'}</Button>}
    </>
  )

  const messages = loadedMessages.filter((x) => x.visibility === (tab === 'internal' ? 'INTERNAL' : 'PUBLIC'))
  const loadOlderMessages = async () => {
    if (messagesBeforeId == null || messagesLoading) return
    setMessagesLoading(true)
    setMessagesError('')
    const previousHeight = messagesViewport.current?.scrollHeight ?? 0
    try {
      const page = await getMessages(me, t.code, messagesBeforeId)
      setLoadedMessages((current) => {
        const existing = new Set(current.map((message) => message.id))
        return [...page.items.filter((message) => !existing.has(message.id)), ...current]
      })
      setMessagesBeforeId(page.nextBeforeId)
      setMessagesHasMore(page.hasMore)
      requestAnimationFrame(() => {
        if (messagesViewport.current) messagesViewport.current.scrollTop += messagesViewport.current.scrollHeight - previousHeight
      })
    } catch {
      setMessagesError('Không tải được các trao đổi trước. Vui lòng thử lại.')
    } finally {
      setMessagesLoading(false)
    }
  }
  const action = (label: string, onClick: () => void, enabled: boolean, icon?: 'circle-plus') => (
    <Button block onClick={onClick} disabled={!enabled}>{icon && <Icon name={icon} size={16} />} {label}</Button>
  )
  const selectConversationTab = (nextTab: ConvTab) => {
    setTab(nextTab)
    if (nextTab === 'history') setHistoryPage(1)
    else {
      requestAnimationFrame(() => {
        if (messagesViewport.current) messagesViewport.current.scrollTop = messagesViewport.current.scrollHeight
      })
    }
  }

  return (
    <Layout title={title}>
      <div className="flex flex-col gap-4">
        <PageHeader title={title} sub={`${t.requester} · ${t.farmName} · ${CATEGORY_LABEL[t.category]} · tạo ${formatStamp(t.createdAt, true)}`}>{header}</PageHeader>
        {closed && <Note tone="grey">Yêu cầu đã đóng và chỉ đọc. Hãy tạo yêu cầu mới nếu cần hỗ trợ thêm.</Note>}
        {!closed && !mine && (
          <Note tone="warn">Chỉ nhân viên hỗ trợ đang phụ trách mới được thay đổi yêu cầu này.{isClaimable(t) && <> <Button variant="link" size="sm" onClick={() => void claim()}>Nhận</Button></>}</Note>
        )}
        <div data-testid="cs-ticket-workspace" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
            <div className="flex min-h-0 flex-1 flex-col [&>section]:h-full [&>section]:min-h-0">
              <Card title="Trao đổi">
              <div><Segmented options={[{ value: 'public', label: 'Trao đổi công khai' }, { value: 'internal', label: 'Ghi chú nội bộ (nhân viên hỗ trợ)' }, { value: 'history', label: 'Lịch sử' }]} value={tab} onChange={(v) => selectConversationTab(v as ConvTab)} /></div>
              {tab === 'internal' && (
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[11px] text-muted">Chỉ nhân viên hỗ trợ và người nhận yêu cầu nội bộ được nêu tên thấy</p>
                  <div className="flex items-center gap-2"><Badge tone="warn">Chỉ nhân viên hỗ trợ</Badge>{canEdit && <Button size="sm" onClick={() => go('ghi-chu')}>Thêm ghi chú</Button>}</div>
                </div>
              )}
              {tab !== 'history' && messagesHasMore && messagesBeforeId != null && (
                <div className="flex justify-center">
                  <Button variant="link" size="sm" disabled={messagesLoading} onClick={() => void loadOlderMessages()}>
                    {messagesLoading ? 'Đang tải…' : 'Xem trao đổi trước'}
                  </Button>
                </div>
              )}
              {tab !== 'history' && messagesError && <p role="alert" className="m-0 text-xs text-err-fg">{messagesError}</p>}
              {tab !== 'history' && (
                <div ref={messagesViewport} role="log" aria-label="Danh sách trao đổi" className="min-h-0 h-[360px] overflow-y-auto pr-1 xl:h-[clamp(320px,calc(100vh-420px),480px)]">
                  <div className="flex flex-col gap-3">
                    {messages.length === 0 && <p className="m-0 text-xs text-muted">Chưa có nội dung.</p>}
                    {messages.map((x) => (
                      <div key={x.id} className="flex gap-3">
                        <Avatar name={x.author} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-ink">{x.author} · {x.authorRole === 'OWNER' ? 'Chủ trại' : 'Nhân viên hỗ trợ'}</span><span className="text-muted">{formatStamp(x.at)}</span></div>
                          <div className={`mt-1 rounded-md px-3 py-2.5 text-xs text-[#183528] ${x.visibility === 'INTERNAL' ? 'bg-warn-bg' : x.authorRole === 'CS' ? 'bg-[#eef4ef]' : 'bg-page'}`}>{x.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'history' && (
                visibleHistory == null ? <Note tone="grey">Lịch sử chưa được cung cấp từ máy chủ.</Note> : visibleHistory.length === 0 ? <Note tone="grey">Chưa có sự kiện lịch sử.</Note> : <ul aria-label="Lịch sử ticket" className="m-0 flex list-none flex-col gap-2 p-0 text-xs">
                  {visibleHistory.map((h) => <li key={`${h.at}${h.text}`} className="flex gap-3"><span className="w-[84px] shrink-0 text-muted">{formatStamp(h.at)}</span><span className="text-ink"><b className="font-semibold">{h.actor}</b> · {h.text}</span></li>)}
                </ul>
              )}
              {tab === 'history' && historyPageCount > 1 && <Pagination page={safeHistoryPage} pageCount={historyPageCount} onChange={setHistoryPage} summary={`Hiển thị ${visibleHistory?.length ?? 0} / ${historyRows?.length ?? 0} sự kiện`} />}
              {tab === 'public' && canEdit && (
                <div>
                  <div className="flex gap-3">
                    <input aria-label="Trả lời công khai" className={inputCls} placeholder="Trả lời công khai cho Chủ trại…" maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendReply() } }} />
                    <Button variant="primary" disabled={replySending} onClick={() => void sendReply()}><Icon name="send" size={16} /> {replySending ? 'Đang gửi…' : 'Gửi'}</Button>
                  </div>
                  {replyError && <p role="alert" className="m-0 mt-1 text-xs text-err-fg">{replyError}</p>}
                </div>
              )}
              </Card>
            </div>
            {res && (
              <Card title={`Kết quả giải quyết · phiên bản ${res.version}`} actions={res.acknowledged ? <Badge tone="ok">Chủ trại đã xác nhận {formatStamp(res.acknowledgedAt ?? '')}</Badge> : <Badge tone="outline">Chờ Chủ trại xác nhận</Badge>}>
                <p className="m-0 text-xs text-muted">{res.resolvedBy} · {formatStamp(res.resolvedAt)}</p>
                <p className="m-0 text-xs text-ink">{res.content}</p>
              </Card>
            )}
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
              {openIr && <div role="status" aria-label={openIr.status === 'WAITING_CS'
                ? `${openIr.code} đang chờ nhân viên hỗ trợ bổ sung thông tin`
                : `${openIr.code} đang mở, ${openIr.recipient} cần gửi kết quả`} className="rounded-md bg-warn-bg px-3 py-2.5 text-xs text-warn-fg">
                <b className="font-semibold">{openIr.code} · {openIr.status === 'WAITING_CS' ? 'Chờ CS bổ sung' : 'Đang mở'}</b>
                <span className="mt-1 block">{openIr.status === 'WAITING_CS'
                  ? `Bước tiếp theo: bạn bổ sung thông tin cho ${openIr.recipient}; sau đó yêu cầu sẽ mở lại cho người nhận xử lý.`
                  : `Bước tiếp theo: ${openIr.recipient} gửi kết quả trong phạm vi ${openIr.targetRole === 'PM' ? 'quản lý nền tảng' : 'quản trị hệ thống'}.`}</span>
                <span className="mt-1 block">Chưa thể ghi kết quả giải quyết hoặc đóng yêu cầu khi yêu cầu nội bộ này còn mở.</span>
              </div>}
            </Card>
            <Card title="Thao tác được phép">
              {action('Trả về hàng đợi', () => go('tra-ve'), canEdit)}
              {action('Đổi người nhận yêu cầu nội bộ', () => go('doi-nguoi-nhan'), canManageInternal)}
              {action('Hủy yêu cầu nội bộ', () => go('huy-yeu-cau'), canManageInternal)}
              {action('Tạo yêu cầu nội bộ', () => go('tao-yeu-cau-sa'), canEdit, 'circle-plus')}
            </Card>
            {t.internalRequests.length > 0 && (
              <Button className="w-full" onClick={() => go('xem-yeu-cau-noi-bo', { ir: (openIr ?? t.internalRequests.at(-1))!.code })}>
                Xem yêu cầu nội bộ
              </Button>
            )}
          </div>
        </div>
      </div>
      <TicketDialogsHost
        ticket={t} modal={m} targetIr={targetIr} me={me} closeModal={closeModal} act={act} reload={() => { void refetch(); closeModal() }}
        onPublic={() => { selectConversationTab('public'); closeModal() }} onViewExisting={() => { selectConversationTab('public'); closeModal() }}
      />
      {flash}
    </Layout>
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
  const commands = useSupportCommands()
  const lastNote = [...t.messages].reverse().find((x) => x.visibility === 'INTERNAL')
  switch (modal) {
    case 'chuyen-giao':
      return <HandOverDialog onClose={closeModal} onSubmit={(to, reason) => act(() => commands.handOver(me, t.code, { toCsId: to, reason, expectedVersion: v }), `${t.code} đã được chuyển giao.`)} />
    case 'yeu-cau-bo-sung':
      return <ReasonDialog title="Yêu cầu khách bổ sung thông tin" label="Nội dung gửi công khai *" max={3000} placeholder="Anh vui lòng gửi mã giao dịch và thời điểm ngân hàng ghi nhận." submitLabel="Gửi và chờ khách" submitIcon="send" note="Yêu cầu chuyển Đang xử lý → Chờ khách phản hồi và lưu câu hỏi công khai. Chủ trại phản hồi thì chuyển lại Đang xử lý." onClose={closeModal}
        onSubmit={(question) => act(() => commands.askCustomer(me, t.code, { question, expectedVersion: v }), `Yêu cầu ${t.code} hiện ở trạng thái Chờ khách phản hồi.`)} />
    case 'tra-ve':
      return <ReasonDialog title="Trả yêu cầu về hàng đợi" label="Lý do *" placeholder="Chưa có đủ thông tin chuyên môn, cần nhân viên hỗ trợ phù hợp nhận lại" submitLabel="Trả về hàng đợi" note="Yêu cầu được bỏ người phụ trách, giữ nguyên trạng thái và lịch sử. Các yêu cầu nội bộ giữ nguyên trạng thái/người nhận." onClose={closeModal}
        onSubmit={(reason) => act(() => commands.returnToQueue(me, t.code, { reason, expectedVersion: v }), `Yêu cầu ${t.code} đã trả về hàng đợi.`)} />
    case 'ghi-chu':
      return <ReasonDialog title="Ghi chú nội bộ của nhân viên hỗ trợ" label="Ghi chú mới *" max={3000} placeholder="Cần xác minh mã chính xác; không xác nhận thanh toán từ lời khách." submitLabel="Lưu ghi chú (chỉ nhân viên hỗ trợ thấy)" onClose={closeModal} secondary={{ label: 'Trao đổi công khai', onClick: onPublic }}
        note={<>{lastNote && <span className="mb-1 block">Lịch sử (chỉ nhân viên hỗ trợ thấy): {lastNote.author} · {formatStamp(lastNote.at)}.</span>}Chỉ nhân viên hỗ trợ được phép xem; ghi chú này không xuất hiện ở hội thoại Chủ trại hoặc phần nhận của quản lý/quản trị hệ thống.</>}
        onSubmit={(text) => act(() => commands.addNote(me, t.code, { text, expectedVersion: v }), 'Đã thêm ghi chú nội bộ (chỉ nhân viên hỗ trợ thấy).')} />
    case 'tao-yeu-cau':
    case 'tao-yeu-cau-sa':
      return <CreateInternalDialog ticket={t} initialRole={modal === 'tao-yeu-cau-sa' ? 'SA' : defaultInternalRequestRole(t.category)} onClose={closeModal} onViewExisting={onViewExisting}
        onSubmit={(cmd) => act(() => commands.createInternal(me, t.code, cmd), `Đã gửi yêu cầu nội bộ cho ${cmd.targetRole}.`)} />
    case 'doi-nguoi-nhan':
      return targetIr ? <ReassignDialog ir={targetIr} onClose={closeModal} onSubmit={(rid, reason) => act(() => commands.manageInternal(me, t.code, targetIr.code, { action: 'REASSIGN', recipientId: rid, reason }), `Yêu cầu ${targetIr.code} đã được chuyển người nhận.`)} /> : null
    case 'huy-yeu-cau':
      return targetIr ? (
        <ReasonDialog title={`Hủy yêu cầu nội bộ ${targetIr.code}`} label="Lý do hủy *" placeholder="Yêu cầu sai phạm vi; sẽ gửi lại đúng vai trò" submitLabel="Xác nhận hủy IR" onClose={closeModal}
          note="Chỉ nhân viên hỗ trợ hiện phụ trách được hủy yêu cầu nội bộ đang mở. Yêu cầu chuyển Đã hủy, giữ kết quả miền đã làm nếu có và toàn bộ lịch sử."
          onSubmit={(reason) => act(() => commands.manageInternal(me, t.code, targetIr.code, { action: 'CANCEL', reason }), `Yêu cầu ${targetIr.code} đã được hủy.`)} />
      ) : null
    case 'xem-yeu-cau-noi-bo':
      return targetIr ? <InternalRequestStatusDialog ir={targetIr} onClose={closeModal} /> : null
    case 'ghi-ket-qua': {
      const open = openIrOf(t)
      return (
        <ReasonDialog title="Ghi kết quả giải quyết công khai" label="Kết quả công khai *" max={3000} placeholder="Giao dịch BCF7K2Q9 đã được xác nhận. Kỳ mua từ 15/11/2026 đến 14/11/2027." submitLabel="Gửi kết quả và Đã giải quyết" submitIcon="send" onClose={closeModal}
          readOnly={{ label: 'Yêu cầu / điều kiện', value: `${t.code} · ${STATUS_LABEL[t.status]} · ${open ? `Còn ${open.code} Đang mở` : 'Không còn yêu cầu nội bộ đang mở'}` }}
          blocked={!!open} warn={open ? `Yêu cầu nội bộ ${open.code} vẫn đang mở. Yêu cầu chưa thể ghi kết quả hoặc đóng.` : undefined}
          note="Chỉ nhân viên hỗ trợ được giao mới ghi kết quả. Tạo kết quả mới, chuyển Đã giải quyết và chờ Chủ trại xác nhận; không tự đóng yêu cầu."
          onSubmit={(content) => act(() => commands.resolve(me, t.code, { content, expectedVersion: v }), `Đã ghi kết quả phiên bản ${t.resolutions.length + 1}. Chủ trại đã được thông báo.`)} />
      )
    }
    case 'dong-ticket':
      return <CloseDialog ticket={t} onClose={closeModal} onReload={reload}
        onSubmit={(reviewed, note) => act(() => commands.close(me, t.code, { reviewed, note, expectedVersion: v }), `Yêu cầu ${t.code} đã được đóng.`, 'da-dong')} />
    case 'da-dong':
      return t.status === 'CLOSED' ? <ClosedDialog ticket={t} onClose={closeModal} /> : null
    case 'nhan-lai':
      return (
        <ReasonDialog title="Nhận yêu cầu chưa có nhân viên hỗ trợ khả dụng" label="Lý do nhận *" placeholder="Tiếp nhận lại để xem xác nhận mới nhất của Chủ trại" submitLabel="Xác nhận nhận yêu cầu" onClose={closeModal}
          readOnly={{ label: 'Yêu cầu / trạng thái hiện tại', value: `${t.code} · ${STATUS_LABEL[t.status]} · người phụ trách cũ không khả dụng` }}
          note="Nhận chỉ thay người phụ trách, giữ nguyên trạng thái hiện tại. Không ghi đè một nhân viên hỗ trợ vẫn đang phụ trách hợp lệ."
          onSubmit={(reason) => act(() => commands.claim(me, t.code, { reason, expectedVersion: v }), `Bạn đang phụ trách ${t.code}.`)} />
      )
    default:
      return null
  }
}

function InternalRequestStatusDialog({ ir, onClose }: { ir: InternalView; onClose: () => void }) {
  const status = {
    OPEN: 'Đang mở',
    WAITING_CS: 'Chờ nhân viên hỗ trợ',
    DONE: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
  }[ir.status]
  return (
    <Modal title={`Yêu cầu nội bộ ${ir.code}`} sub="Trạng thái và thông tin xử lý" width={720} onClose={onClose}>
      <Facts items={[
        ['Trạng thái', status],
        ['Người nhận', ir.recipient],
        ['Vai trò nhận', ir.targetRole === 'PM' ? 'Quản lý nền tảng' : 'Quản trị hệ thống'],
        ['Thời gian tạo', formatStamp(ir.createdAt)],
      ]} />
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[11px] text-faint">Nội dung yêu cầu</p>
        <p className="m-0 whitespace-pre-wrap text-sm text-ink">{ir.requestText}</p>
      </div>
      {ir.resultNote && (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-[11px] text-faint">Kết quả xử lý</p>
          <p className="m-0 whitespace-pre-wrap text-sm text-ink">{ir.resultNote}</p>
          {ir.completedBy && <p className="m-0 text-xs text-muted">{ir.completedBy}{ir.completedAt ? ` · ${formatStamp(ir.completedAt)}` : ''}</p>}
        </div>
      )}
      <div className="flex justify-end"><Button onClick={onClose}>Đóng</Button></div>
    </Modal>
  )
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
