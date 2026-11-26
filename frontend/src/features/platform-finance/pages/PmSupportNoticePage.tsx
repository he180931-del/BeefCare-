import { NoticeList } from '../components/NoticeList'

/** SCR-46 (phần PM): yêu cầu nội bộ CS giao đích danh. */
export default function PmSupportNoticePage() {
  return <NoticeList kind="SUPPORT" title="Thông báo hỗ trợ" sub="Yêu cầu nội bộ được giao đích danh cho bạn" />
}
