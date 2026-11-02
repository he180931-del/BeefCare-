import { Navigate, Route, Routes } from 'react-router-dom'
import NewTicketPage from './NewTicketPage'
import TicketDetailPage from './TicketDetailPage'
import TicketListPage from './TicketListPage'

/** /ho-tro, /ho-tro/moi, /ho-tro/:id (Chủ trại: SCR-64, SCR-65, SCR-66). */
export default function SupportRoutes() {
  return (
    <Routes>
      <Route index element={<TicketListPage />} />
      <Route path="moi" element={<NewTicketPage />} />
      <Route path=":id" element={<TicketDetailPage />} />
      <Route path="*" element={<Navigate to="/ho-tro" replace />} />
    </Routes>
  )
}
