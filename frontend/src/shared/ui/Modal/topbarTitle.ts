import { createContext, useContext, useEffect } from 'react'

/**
 * Modal đổi tiêu đề thanh trên (Figma: khi mở modal, tiêu đề topbar = tên modal).
 * Khung trang cung cấp hàm đặt tiêu đề qua context này, nên Modal không cần biết layout nào đang bọc nó.
 */
export const TopbarTitleContext = createContext<(title: string | null) => void>(() => undefined)

export const useTopbarTitle = (title?: string) => {
  const set = useContext(TopbarTitleContext)
  useEffect(() => {
    if (!title) return undefined
    set(title)
    return () => set(null)
  }, [title, set])
}
