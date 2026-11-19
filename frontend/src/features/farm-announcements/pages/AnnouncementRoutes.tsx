import { Navigate, Route, Routes } from 'react-router-dom'
import AnnouncementCorrectionPage from './AnnouncementCorrectionPage'
import AnnouncementEditorPage from './AnnouncementEditorPage'
import AnnouncementListPage from './AnnouncementListPage'

/** /thong-bao, /thong-bao/moi, /thong-bao/:id/dinh-chinh */
export default function AnnouncementRoutes() {
  return (
    <Routes>
      <Route index element={<AnnouncementListPage />} />
      <Route path="moi" element={<AnnouncementEditorPage />} />
      <Route path=":id/dinh-chinh" element={<AnnouncementCorrectionPage />} />
      <Route path="*" element={<Navigate to="/thong-bao" replace />} />
    </Routes>
  )
}
