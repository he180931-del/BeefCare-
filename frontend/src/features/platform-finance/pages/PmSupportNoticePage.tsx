import { NoticeList } from '../components/NoticeList'

/** SCR-46 (phần PM): yêu cầu nội bộ CS giao đích danh. */
export default function PmSupportNoticePage() {
  return <NoticeList kind="SUPPORT" title="Thông báo hỗ trợ" sub="Chỉ yêu cầu nội bộ được CS giao đích danh cho bạn · mở thông báo sẽ kiểm tra lại quyền" foot="Thông báo hỗ trợ của PM: chỉ gồm yêu cầu nội bộ CS giao đích danh. Nhắc việc hiện khi yêu cầu chưa có kết quả sau 4 giờ." />
}
