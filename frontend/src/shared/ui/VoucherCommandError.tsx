import { useState } from 'react'
import { isVersionConflict } from '../api/snapshotVersion'
import { userFacingError } from '../api/userFacingError'
import { Button, Note } from './index'

/** Reporting a conflict never fetches data or retries the command. */
export function VoucherCommandError({ error, onReload, formatError = userFacingError }: {
  error: unknown
  onReload: () => Promise<unknown>
  formatError?: (error: unknown) => string
}) {
  const [dismissed, setDismissed] = useState<unknown>(null)
  const [reloading, setReloading] = useState(false)
  const [reloadError, setReloadError] = useState<unknown>(null)
  if (!error) return null
  if (!isVersionConflict(error)) return <Note tone="err">{formatError(error)}</Note>
  if (dismissed === error) return null
  const reload = async () => {
    setReloading(true)
    setReloadError(null)
    try { await onReload(); setDismissed(error) }
    catch (nextError) { setReloadError(nextError) }
    finally { setReloading(false) }
  }
  return <div role="alert" className="flex flex-col gap-2">
    <Note tone="warn">Phiếu đã được người khác thay đổi. Dữ liệu bạn đang nhập được giữ nguyên. Tải bản mới nhất sẽ bỏ các thay đổi chưa lưu, lý do và tệp đang chọn.</Note>
    <div className="flex flex-wrap gap-2">
      <Button disabled={reloading} onClick={() => { void reload() }}>{reloading ? 'Đang tải…' : 'Tải bản mới nhất'}</Button>
      <Button disabled={reloading} onClick={() => setDismissed(error)}>Ở lại</Button>
    </div>
    {Boolean(reloadError) && <Note tone="err">{formatError(reloadError)}</Note>}
  </div>
}
