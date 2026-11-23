import { Button, Modal, ModalButton, ModalFooter } from '../../../shared/ui'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { herdEntryError } from '../api/herdEntryError'
import type { HerdEntry } from '../types'

type DraftSnapshot = Pick<HerdEntry, 'id' | 'version' | 'backendId' | 'status'>

type DiscardEntryDraftDialogProps = {
  draft: DraftSnapshot
  saving: boolean
  error: unknown
  onConfirm: (snapshot: DraftSnapshot) => Promise<void>
  onReload: () => Promise<void>
  onClose: () => void
}

export default function DiscardEntryDraftDialog({ draft, saving, error, onConfirm, onReload, onClose }: DiscardEntryDraftDialogProps) {
  return (
    <Modal title={`Xóa phiếu nháp ${draft.id}?`} width={460} onClose={onClose}>
      <p className="m-0 text-sm text-ink">Phiếu nháp và các con trong phiếu sẽ bị xóa, không tạo hồ sơ bò.</p>
      <VoucherCommandError error={error} formatError={herdEntryError} onReload={onReload} />
      <ModalFooter>
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => { void onConfirm(draft) }}>
          {saving ? 'Đang xóa…' : 'Xóa phiếu nháp'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
