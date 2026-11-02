import { Navigate, Route, Routes } from 'react-router-dom'
import HistoryPage from './HistoryPage'
import ManageSchedulePage from './ManageSchedulePage'
import RecordPage from './RecordPage'
import SchedulePage from './SchedulePage'

export default function VaccinationRoutes() {
  return (
    <Routes>
      <Route index element={<SchedulePage />} />
      <Route path="quan-ly" element={<ManageSchedulePage />} />
      <Route path="ghi-nhan" element={<RecordPage />} />
      <Route path="lich-su" element={<HistoryPage />} />
      <Route path="*" element={<Navigate to="/tiem-phong" replace />} />
    </Routes>
  )
}
