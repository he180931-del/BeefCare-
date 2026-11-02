import { Route, Routes } from 'react-router-dom'
import AccountsPage from './AccountsPage'

// `/nen-tang/tai-khoan` và `/nen-tang/tai-khoan/:id` dùng cùng một trang để giữ nguyên bộ lọc khi chọn dòng.
export default function UserAccountRoutes() {
  return (
    <Routes>
      <Route path="*" element={<AccountsPage />} />
    </Routes>
  )
}
