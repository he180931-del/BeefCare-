import { NoticeList } from '../components/NoticeList'

/** SCR-47: thông báo đối soát của PM. */
export default function ReconciliationNoticePage() {
  return <NoticeList kind="RECON" title="Thông báo đối soát" sub="Chứng từ và thanh toán cần PM xem xét" foot="Thông báo đối soát của PM. Mỗi thông báo dẫn thẳng tới chứng từ hoặc yêu cầu cần xử lý; thông báo chưa đọc có nền xanh nhạt." />
}
