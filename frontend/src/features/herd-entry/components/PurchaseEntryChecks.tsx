import { Icon } from '../../../shared/ui'
import type { PurchaseEntryCheck } from '../domain/purchaseEntryChecks'

export default function PurchaseEntryChecks({ checks }: { checks: PurchaseEntryCheck[] }) {
  const icons = { ok: 'circle-check', warn: 'alert-triangle', error: 'circle-x' } as const
  const styles = { ok: 'text-ok-fg', warn: 'text-err-fg', error: 'text-err-fg', pending: 'text-muted' } as const
  return <div className="flex flex-col gap-2">{checks.map((check) => <div key={check.id} className={`flex items-start gap-2 text-xs ${check.status === 'warn' || check.status === 'error' ? 'text-err-fg' : ''}`}>
    {check.status === 'pending'
      ? <span aria-hidden="true" className="mt-[3px] ml-[3px] h-2 w-2 shrink-0 rounded-full bg-muted" />
      : <Icon name={icons[check.status]} size={14} className={`mt-px shrink-0 ${styles[check.status]}`} />}
    <span>{check.label}{check.detail ? ` · ${check.detail}` : ''}{check.status === 'pending' && !check.detail ? ' · Kiểm khi lưu' : ''}</span>
  </div>)}</div>
}
