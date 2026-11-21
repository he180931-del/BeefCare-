import { useFarmSelect } from '../hooks/useFarmSelect'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader } from '../../../shared/ui'
import { FarmCard } from '../components/FarmCard'
import SetupLayout from '../components/SetupLayout'

/**
 * SCR-09 (UC-FE02-02). Entering a farm rechecks access, keeps the farm for this tab and reloads the page into it, so no
 * data or filter of the previous farm survives (R-02-12). After sign-in the only ACTIVE farm opens directly (AF4); a farm
 * screen opened without a farm (new tab, bookmark) is loaded again once its farm is entered.
 * `?demo=empty` và `?demo=load-error` hiện hai trạng thái không có dữ liệu (mô phỏng).
 */
export default function FarmSelectPage() {
  const { query, farms, entering, enterMessage, open, registerFarm } = useFarmSelect()

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
