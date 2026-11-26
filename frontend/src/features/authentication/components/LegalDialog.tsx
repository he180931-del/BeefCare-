import { useEffect, useRef, useState, type RefObject } from 'react'
import { Modal, ModalButton, ModalFooter } from '../../../shared/ui'
import { LEGAL_DOCUMENTS, type LegalKind } from '../domain/legalContent'
import { LegalDocument } from './LegalDocument'

export interface LegalDialogProps {
  initialKind: LegalKind
  onClose: () => void
  onConfirm?: () => void | Promise<void>
  confirming?: boolean
  error?: string
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function LegalDialog({ initialKind, onClose, onConfirm, confirming = false, error, returnFocusRef }: LegalDialogProps) {
  const [kind, setKind] = useState<LegalKind>(initialKind)
  const [accepted, setAccepted] = useState(false)
  const returnTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnTo.current = returnFocusRef?.current ?? null
    return () => returnTo.current?.focus()
  }, [returnFocusRef])

  const confirm = () => {
    if (onConfirm) void onConfirm()
    else onClose()
  }

  return <Modal
    title="Điều khoản và chính sách"
    sub="Những thông tin áp dụng khi sử dụng BeefCare"
    width={820}
    maxHeight="min(760px, calc(100vh - 2rem))"
    onClose={onClose}
    bodyClassName="!overflow-hidden"
  >
    <div role="tablist" aria-label="Tài liệu pháp lý" className="flex shrink-0 gap-2 border-b border-field pb-3">
      {(['terms', 'policy'] as const).map((tab) => <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={kind === tab}
        aria-controls={`legal-panel-${tab}`}
        onClick={() => setKind(tab)}
        className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${kind === tab ? 'bg-brand-dark text-white' : 'bg-[#edf4ef] text-brand-dark hover:bg-[#dfece3]'}`}
      >{LEGAL_DOCUMENTS[tab].title}</button>)}
    </div>
    <div
      id={`legal-panel-${kind}`}
      role="tabpanel"
      data-testid="legal-scroll-region"
      className="max-h-[min(410px,calc(100vh-23rem))] min-h-0 overflow-y-auto pr-1"
    >
      <p className="m-0 mb-5 text-sm leading-6 text-subtle">{LEGAL_DOCUMENTS[kind].summary}</p>
      <LegalDocument kind={kind} />
    </div>
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-page px-4 py-3 text-sm leading-6 text-ink">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(event) => setAccepted(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-brand"
      />
      <span>Tôi đã đọc và đồng ý với Điều khoản sử dụng và Chính sách dữ liệu của BeefCare.</span>
    </label>
    {error ? <p role="alert" className="m-0 text-sm text-err-fg">{error}</p> : null}
    <ModalFooter className="border-t border-field pt-4 sm:justify-end">
      <ModalButton
        variant="primary"
        disabled={!accepted || confirming}
        onClick={confirm}
      >{confirming ? 'Đang xác nhận…' : 'Đồng ý và xác nhận'}</ModalButton>
    </ModalFooter>
  </Modal>
}
