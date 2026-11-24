import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { ErrorBlock, Foot, PageHeader } from '../../../shared/ui'
import { useSession } from '../../../app/session/sessionContext'
import { NewTicketForm } from '../components/NewTicketForm'
import { MESSAGES, SupportError } from '../domain/supportError'
import { TICKET_CATEGORIES } from '../domain/ticketRules'
import type { CreateTicketCommand, TicketCategory } from '../types'
import { useSupportCommands } from '../hooks/useSupportUseCase'

const TITLE = 'Gửi yêu cầu hỗ trợ'

/** Form tạo ticket Owner: ticket luôn gắn ngầm với trại đang mở trong phiên. */
export default function NewTicketPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const { createTicket } = useSupportCommands()

  if (session?.farmId == null) return <Layout title={TITLE}><ErrorBlock variant="panel" message="Hãy mở một trang trại trước khi gửi yêu cầu hỗ trợ." /></Layout>

  const categoryParam = params.get('category') as TicketCategory | null
  const initialCategory = categoryParam && TICKET_CATEGORIES.some((c) => c.value === categoryParam) ? categoryParam : ('' as const)

  const submit = async (cmd: CreateTicketCommand) => {
    try {
      const ticket = await createTicket(cmd)
      navigate(`/ho-tro?m=da-gui&ticket=${ticket.id}`)
      return null
    } catch (e) {
      return e instanceof SupportError && e.code === 'VALIDATION' ? e.fields : { _form: MESSAGES.saveFailed }
    }
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} />
        <div className="@container min-w-0">
          <NewTicketForm activeFarmId={session.farmId} initialCategory={initialCategory} onSubmit={submit} onCancel={() => navigate('/ho-tro')} />
        </div>
        <Foot>Chọn danh mục, nhập tiêu đề tối đa 150 ký tự cùng mô tả tối đa 3.000 ký tự. Ticket tự gắn với trại đang mở; mức ưu tiên do bộ phận hỗ trợ gán.</Foot>
      </div>
    </Layout>
  )
}
