import { Route, Routes, useParams } from 'react-router-dom'
import RecordFormPage from './RecordFormPage'
import RecordListPage from './RecordListPage'

// key theo mã khoản để biểu mẫu dựng lại sạch khi chuyển từ "mới" sang khoản vừa lưu.
function KeyedForm() {
  const { code } = useParams()
  return <RecordFormPage key={code ?? 'moi'} />
}

export default function ManualFinanceRoutes() {
  return (
    <Routes>
      <Route index element={<RecordListPage />} />
      <Route path="moi" element={<KeyedForm />} />
      <Route path=":code" element={<KeyedForm />} />
    </Routes>
  )
}
