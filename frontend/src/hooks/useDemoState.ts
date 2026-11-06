import { useSearchParams } from 'react-router-dom'
import { backendMode } from '../api/backendTransport'

/**
 * Trạng thái minh họa qua `?demo=<tên>` (vd. `?demo=load-error`) để xem các frame lỗi/rỗng của Figma trong mock.
 * Luôn trả null khi đang dùng backend thật.
 */
export function useDemoState(): string | null {
  const [params] = useSearchParams()
  return backendMode === 'local' ? params.get('demo') : null
}
