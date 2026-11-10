import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BackendError } from '../../../api/backendClient'
import { pageLoader, writeCurrentFarmId } from '../../../api/currentFarm'
import { userFacingError } from '../../../api/userFacingError'
import { Button, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../components/ui'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import { FarmCard, farmAction, unavailableFarmMessage } from '../components/FarmCard'
import SetupLayout from '../components/SetupLayout'
import { farmWorkspaceError } from '../components/WorkspaceUi'
import type { FarmSummary } from '../types'

const NOT_ALLOWED = 'Bạn không có quyền thực hiện thao tác này.' // MSG-COM-01
const STORAGE_BLOCKED = 'Trình duyệt đang chặn lưu dữ liệu của trang nên chưa ghi nhớ được trại đã chọn. Cho phép lưu dữ liệu cho trang này rồi thử lại.'

/** Step 4 refused: E1 (membership or role changed, MSG-COM-01) or AF3 (service stopped, MSG-FE02-04) reload the list. */
function enterFailure(error: unknown): { message: string; reloadList: boolean } {
  if (error instanceof BackendError && error.status === 403) {
    if (error.code === 'MSG-FE02-04') {
      return { message: unavailableFarmMessage(String(error.params.farm ?? 'Trang trại'), String(error.params.status ?? '')), reloadList: true }
    }
    return { message: `${NOT_ALLOWED} Danh sách trang trại đã được tải lại.`, reloadList: true }
  }
  return { message: farmWorkspaceError(error, 'Chưa vào được trang trại. Vui lòng thử lại.'), reloadList: false }
}

/**
 * SCR-09 (UC-FE02-02). Entering a farm rechecks access, keeps the farm for this tab and reloads the page into it, so no
 * data or filter of the previous farm survives (R-02-12). After sign-in the only ACTIVE farm opens directly (AF4).
 * `?demo=empty` và `?demo=load-error` hiện hai trạng thái không có dữ liệu (mô phỏng).
 */
export default function FarmSelectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const demo = useDemoState()
  const query = useQuery(async () => {
    if (demo === 'load-error') throw new Error('Không tải được danh sách trang trại.')
    return demo === 'empty' ? [] : farmWorkspaceApi.listFarms()
  }, [demo])
  const farms = query.data ?? []
  const [entering, setEntering] = useState<number | null>(null)
  const [enterMessage, setEnterMessage] = useState('')
  const fromSignIn = (location.state as { fromSignIn?: boolean } | null)?.fromSignIn === true
  const autoOpened = useRef(false)

  async function open(farm: FarmSummary) {
    setEnterMessage('')
    setEntering(farm.id)
    try {
      const current = await farmWorkspaceApi.selectFarm(farm.id)
      const target = farmAction(current).to
      if (!target) {
        setEnterMessage(unavailableFarmMessage(current.name, current.serviceStatus))
        query.refetch()
        return
      }
      if (!writeCurrentFarmId(current.id)) {
        setEnterMessage(STORAGE_BLOCKED)
        return
      }
      pageLoader.load(target)
    } catch (error) {
      const failure = enterFailure(error)
      setEnterMessage(failure.message)
      if (failure.reloadList) query.refetch()
    } finally {
      setEntering(null)
    }
  }

  useEffect(() => {
    if (!fromSignIn || autoOpened.current || !query.data) return
    autoOpened.current = true
    const [only, ...others] = query.data
    // AF4 "only one available farm": one farm in the list and it can be entered; otherwise the user chooses on SCR-09.
    if (only && others.length === 0 && only.serviceStatus === 'ACTIVE') void open(only)
    // `open` is left out on purpose: the ref limits this to one attempt when the list first arrives.
  }, [fromSignIn, query.data])

  // SCR-09 "Register new farm": SCR-07 first when the Owner profile is not complete; SCR-10 also checks it (UC-FE02-01 E1).
  async function registerFarm() {
    const profile = await farmWorkspaceApi.getProfile().catch(() => null)
    navigate(profile && !profile.ownerRegistrationCompleted ? '/owner-registration' : '/dang-ky-trai')
  }

  return (
    <SetupLayout
      eyebrow="Chọn không gian" heading="Chọn đúng trại để bắt đầu"
      lines={['Mỗi trại có dữ liệu, thành viên và trạng thái dịch vụ riêng. Chọn một thẻ để tiếp tục.', 'Vai trò, quy mô đàn và dịch vụ hiện tại được ghi trên từng thẻ.']}
      badge={farms.length ? `${farms.length} trang trại bạn có quyền truy cập` : undefined}
    >
      <PageHeader title="Chọn trang trại">
        <Button onClick={() => void registerFarm()}>Đăng ký trại mới</Button>
      </PageHeader>
      {enterMessage && <Note tone="err">{enterMessage}</Note>}
      {query.loading && !query.data && <LoadingBlock />}
      {Boolean(query.error) && <ErrorBlock message={userFacingError(query.error, 'Không tải được danh sách trang trại. Kiểm tra kết nối rồi thử lại.')} onRetry={query.refetch} />}
      {!query.loading && !query.error && farms.length === 0 && (
        <EmptyBlock title="Tài khoản chưa liên kết với trang trại nào" sub="Đăng ký trang trại của bạn, hoặc mở lời mời đã gửi tới email." action={<Button variant="primary" onClick={() => void registerFarm()}>Đăng ký trang trại</Button>} />
      )}
      <div className="grid gap-4 xl:grid-cols-2">{farms.map((farm) => <FarmCard key={farm.id} farm={farm} busy={entering !== null} onOpen={(item) => void open(item)} />)}</div>
      <Foot>Chọn trại theo vai trò và trạng thái dịch vụ; dữ liệu giữa các trại được tách riêng.</Foot>
    </SetupLayout>
  )
}
