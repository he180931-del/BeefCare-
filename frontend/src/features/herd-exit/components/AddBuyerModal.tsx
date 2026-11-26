import { PartnerQuickAddModal } from '../../../shared/ui'
import type { ExitBuyer } from '../types'

export default function AddBuyerModal({ onClose, onSave }: { onClose: () => void; onSave: (input: { name: string; phone: string; area: string }, options?: { key?: string }) => Promise<ExitBuyer> }) {
  return (
    <PartnerQuickAddModal
      idPrefix="exit-buyer"
      title="Thêm người mua"
      nameLabel="Tên người mua / thương lái"
      requiredMessage="Tên người mua là bắt buộc."
      saveLabel="Lưu người mua"
      failMessage="Không thể lưu người mua."
      onClose={onClose}
      onSave={onSave}
    />
  )
}
