import { Navigate, useParams } from 'react-router-dom'
import { restPathId } from '../components/common'

/**
 * D33 / FE-03 Q5: không còn trang "Quyền nhân sự nền tảng"; quyền nền tảng là popup của SCR-16 (SRS dòng 1514, 3179).
 * Link cũ `/nen-tang/quyen/{id}` mở popup trên tài khoản đó, `/nen-tang/quyen` về danh sách tài khoản.
 */
export default function StaffAccessRoutes() {
  const id = restPathId(useParams()['*'])
  return <Navigate replace to={id ? `/nen-tang/tai-khoan/${id}?m=access` : '/nen-tang/tai-khoan'} />
}
