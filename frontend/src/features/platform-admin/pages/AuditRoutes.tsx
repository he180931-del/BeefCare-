import { Route, Routes } from 'react-router-dom'
import AuditPage from './AuditPage'

// `/nen-tang/audit` và `/nen-tang/audit/:id` dùng cùng một trang để giữ nguyên bộ lọc khi chọn dòng.
export default function AuditRoutes() {
  return (
    <Routes>
      <Route path="*" element={<AuditPage />} />
    </Routes>
  )
}
