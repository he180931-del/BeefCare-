import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { ErrorBlock, Foot, LoadingBlock, PageHeader } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization/sessionContext'
import { supportApi } from '../api/supportApi'
import { CategoryGuideCard } from '../components/CategoryGuideCard'
import { NewTicketForm } from '../components/NewTicketForm'
import { MESSAGES, SupportError } from '../domain/supportError'
import { TICKET_CATEGORIES } from '../domain/ticketRules'
import type { CreateTicketCommand, TicketCategory } from '../types'

const TITLE = 'Gửi yêu cầu hỗ trợ'

/** SCR-65. Từ ngữ cảnh (thanh toán, trại bị ngưng) mở bằng `?category=PAYMENT&farmId=1` để điền sẵn (AF1). */
export default function NewTicketPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const { data: farms, loading, error, refetch } = useQuery(() => supportApi.listOwnedFarms(), [])

  if (loading && !farms) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !farms) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách trang trại.')} onRetry={refetch} /></Layout>

  const categoryParam = params.get('category') as TicketCategory | null
  const farmParam = Number(params.get('farmId'))
  const initial = {
    category: categoryParam && TICKET_CATEGORIES.some((c) => c.value === categoryParam) ? categoryParam : ('' as const),
    farmId: (farms.find((f) => f.id === farmParam) ?? farms.find((f) => f.id === session?.farmId) ?? farms[0])?.id ?? null,
  }

  const submit = async (cmd: CreateTicketCommand) => {
    try {
      const ticket = await supportApi.createTicket(cmd)
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
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_376px]">
          <NewTicketForm farms={farms} initial={initial} onSubmit={submit} onCancel={() => navigate('/ho-tro')} />
          <CategoryGuideCard />
        </div>
        <Foot>Chọn danh mục và phạm vi, nhập tiêu đề tối đa 150 ký tự cùng mô tả tối đa 3.000 ký tự; mức ưu tiên do bộ phận hỗ trợ gán.</Foot>
      </div>
    </Layout>
  )
}
