import { useSearchParams } from 'react-router-dom'

/**
 * Modal mở bằng query `?m=<tên>` để test/chụp ảnh trực tiếp (vd /herd-entry/new?m=excel).
 *   const [m, openModal, closeModal] = useModalParam()
 *   {m === 'excel' && <Modal ...onClose={closeModal} />}
 * Các query khác (vd ?tab=) được giữ nguyên.
 */
export function useModalParam() {
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const openModal = (name: string) => {
    const next = new URLSearchParams(params)
    next.set('m', name)
    setParams(next)
  }
  const closeModal = () => {
    const next = new URLSearchParams(params)
    next.delete('m')
    setParams(next)
  }
  return [m, openModal, closeModal] as [string | null, (name: string) => void, () => void]
}
