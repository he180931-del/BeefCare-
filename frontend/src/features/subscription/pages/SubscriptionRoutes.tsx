import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Note } from '../../../components/ui'
import { useSession } from '../../authorization'
import HistoryPage from './HistoryPage'
import RenewPage from './RenewPage'
import SubscriptionHomePage from './SubscriptionHomePage'
import TransferPage from './TransferPage'

export default function SubscriptionRoutes() {
  const session = useSession()
  // Chỉ Owner vào được các màn thanh toán (MSG-COM-01); router đã chặn, đây là lớp phòng thủ khi render riêng.
  if (session && session.role !== 'OWNER') {
    return <Layout title="Gói dịch vụ của trại"><Note tone="err">Bạn không có quyền thực hiện thao tác này.</Note></Layout>
  }
  return (
    <Routes>
      <Route index element={<SubscriptionHomePage />} />
      <Route path="gia-han" element={<RenewPage />} />
      <Route path="chuyen-khoan/:id" element={<TransferPage />} />
      <Route path="lich-su" element={<HistoryPage />} />
      <Route path="lich-su/:id" element={<HistoryPage />} />
      <Route path="*" element={<Navigate to="/goi-dich-vu" replace />} />
    </Routes>
  )
}
