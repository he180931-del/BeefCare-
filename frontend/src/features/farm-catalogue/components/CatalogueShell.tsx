import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { PageHeader, Segmented } from '../../../components/ui'

export const TABS = [
  { value: 'giong', label: 'Giống bò' },
  { value: 'vac-xin', label: 'Vắc-xin' },
  { value: 'thuoc', label: 'Thuốc tham chiếu' },
  { value: 'muc-dich', label: 'Mục đích nuôi' },
  { value: 'tham-so', label: 'Tham số trạng thái & nhắc việc' },
]

const SlotContext = createContext<HTMLElement | null>(null)

/** Nút theo từng tab (Thêm giống, Lưu phiên bản mới…) được đưa lên đúng chỗ trong tiêu đề trang. */
export function HeaderActions({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext)
  return slot ? createPortal(children, slot) : null
}

/** Khung chung của năm tab: Layout, tiêu đề, thanh chuyển tab. Layout giữ nguyên khi đổi tab. */
export default function CatalogueShell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = TABS.find((t) => pathname.split('/')[2] === t.value)?.value ?? 'giong'
  return (
    <Layout title="Danh mục & Tham số trại">
      <div className="flex flex-col gap-4">
        <PageHeader title="Danh mục & Tham số trại" sub="Danh mục riêng của trại · mục đã được dùng chỉ ngừng dùng, không xóa">
          <div ref={setSlot} className="flex flex-wrap items-center gap-2" />
        </PageHeader>
        <div className="max-w-full overflow-x-auto">
          <div className="w-fit">
            <Segmented options={TABS} value={tab} onChange={(value) => navigate(`/danh-muc/${value}`)} />
          </div>
        </div>
        <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>
      </div>
    </Layout>
  )
}
