import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Button, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { supportApi } from '../api/supportApi'
import { ConversationCard } from '../components/ConversationCard'
import { ReopenDialog, ReopenedDialog, ResolutionVersionDialog } from '../components/ReopenDialogs'
import { ReplyCard } from '../components/ReplyCard'
import { ResolutionCard } from '../components/ResolutionCard'
import { ClosedDialog, ConfirmedDialog, ResultChangedDialog } from '../components/ResultDialogs'
import { StatusHistoryCard, TicketInfoCard } from '../components/TicketSidebar'
import { TicketStatusBadge } from '../components/TicketStatusBadge'
import { useTicketActions } from '../components/useTicketActions'
import { formatDate } from '../domain/format'
import { SupportError } from '../domain/supportError'
import { categoryLabel, latestResolution } from '../domain/ticketRules'

const TITLE = 'Chi tiết yêu cầu hỗ trợ'

/**
 * SCR-66. Hộp thoại qua `?m=`: mo-lai, da-mo-lai, da-xac-nhan, da-dong, ket-qua-thay-doi, ket-qua-v<phiên bản>.
 * Trên điện thoại hai cột xếp dọc theo thứ tự: trao đổi, kết quả, phản hồi, thông tin, lịch sử.
 */
export default function TicketDetailPage() {
  const { id } = useParams()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const [m, openModal, closeModal] = useModalParam()
  const { data: ticket, loading, error, refetch } = useQuery(() => supportApi.getTicket(ticketId), [ticketId])
  const actions = useTicketActions(ticket, { refetch, openModal })

  if (loading && !ticket) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !ticket) {
    return (
      <Layout title={TITLE}>
        <div className="flex flex-col items-start gap-4">
          <ErrorBlock message={error instanceof SupportError ? error.message : userFacingError(error, 'Không tải được yêu cầu hỗ trợ.')} onRetry={refetch} />
          <Button onClick={() => navigate('/ho-tro')}>Về danh sách yêu cầu</Button>
        </div>
      </Layout>
    )
  }

  const latest = latestResolution(ticket)
  const viewVersion = /^ket-qua-v(\d+)$/.exec(m ?? '')?.[1]
  const reload = () => {
    actions.clearNotice()
    refetch()
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={`${ticket.code} · ${ticket.subject}`}
          sub={`${categoryLabel(ticket.category)} · ${ticket.farmName ?? 'Không gắn trang trại'} · tạo ${formatDate(ticket.createdAt)}`}
        >
          <TicketStatusBadge ticket={ticket} />
        </PageHeader>
        {actions.notice && (
          <Note tone="err">
            {actions.notice}{' '}
            <Button variant="link" size="sm" onClick={reload}>
              Tải lại yêu cầu
            </Button>
          </Note>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_376px]">
          <div className="flex min-w-0 flex-col gap-4">
            <ConversationCard ticket={ticket} onLoadOlder={(beforeId) => supportApi.getMessages(ticket.id, beforeId)} />
            <ResolutionCard
              ticket={ticket}
              busy={actions.busy}
              onConfirm={() => latest && actions.confirm(latest.version)}
              onReopen={() => openModal('mo-lai')}
              onViewVersion={(v) => openModal(`ket-qua-v${v}`)}
            />
            <ReplyCard ticket={ticket} onSend={actions.reply} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <TicketInfoCard ticket={ticket} />
            <StatusHistoryCard ticket={ticket} />
          </div>
        </div>
        <Foot>Xem trao đổi công khai, thông tin phiếu, lịch sử trạng thái và kết quả xử lý; phản hồi tối đa 3.000 ký tự, phiếu đã đóng không nhận phản hồi.</Foot>
      </div>

      {m === 'mo-lai' && latest && ticket.status === 'RESOLVED' && <ReopenDialog ticket={ticket} resolution={latest} onSubmit={actions.reopen} onClose={closeModal} />}
      {m === 'da-mo-lai' && <ReopenedDialog ticket={ticket} onViewPrevious={(v) => openModal(`ket-qua-v${v}`)} onClose={closeModal} />}
      {viewVersion && <ResolutionVersionDialog ticket={ticket} version={Number(viewVersion)} onClose={closeModal} />}
      {m === 'da-xac-nhan' && <ConfirmedDialog ticket={ticket} onReopen={() => openModal('mo-lai')} onBack={closeModal} onClose={closeModal} />}
      {m === 'da-dong' && <ClosedDialog ticket={ticket} onList={() => navigate('/ho-tro')} onNew={() => navigate('/ho-tro/moi')} onClose={closeModal} />}
      {m === 'ket-qua-thay-doi' && (
        <ResultChangedDialog
          ticket={ticket}
          onReload={() => {
            refetch()
            closeModal()
          }}
          onClose={closeModal}
        />
      )}
    </Layout>
  )
}
