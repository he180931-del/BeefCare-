import Layout from './Layout'
import TechnicianLayout from './TechnicianLayout'

export const SCREEN_STUB_TEXT = 'Màn hình này đang được phát triển.'

export const ScreenStubBody = () => (
  <div className="rounded-md border border-edge bg-white p-8 text-center text-muted">{SCREEN_STUB_TEXT}</div>
)

/** Giữ chỗ cho route đã khai báo trong App.tsx trong lúc feature đang được xây. */
export function ScreenStub({ title, technician = false }: { title: string; technician?: boolean }) {
  if (technician) return <TechnicianLayout title={title}><ScreenStubBody /></TechnicianLayout>
  return (
    <Layout title={title}>
      <h1 className="m-0 text-[22px] font-bold">{title}</h1>
      <ScreenStubBody />
    </Layout>
  )
}
