import { useLocation } from 'react-router-dom'
import Layout, { pageName } from '../components/Layout'

export default function Placeholder() {
  const { pathname } = useLocation()
  const name = pageName(pathname) || 'Trang'
  return (
    <Layout title={name}>
      <h1 className="m-0 text-[22px] font-bold">{name}</h1>
      <div className="rounded-md border border-edge bg-white p-8 text-center text-muted">
        Màn hình này đang được phát triển.
      </div>
    </Layout>
  )
}
