import { Route, Routes } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'
import QueuePage from './QueuePage'
import TicketPage from './TicketPage'

export default function SupportDeskRoutes() {
  return (
    <Routes>
      <Route index element={<QueuePage />} />
      <Route path="duoc-giao" element={<QueuePage initialTab="mine" />} />
      <Route path="thong-bao" element={<NotificationsPage />} />
      <Route path=":id" element={<TicketPage />} />
    </Routes>
  )
}
