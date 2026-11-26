import { PartnerQuickAddModal, type PartnerQuickAddInput } from '../../../shared/ui'
import type { EntrySeller } from '../api'

/** FE-06 field 4: "+ Thêm nguồn mới" (tên, SĐT, khu vực) saves a SELLER partner and selects it. */
export default function AddSellerModal({ onClose, onSave }: { onClose: () => void; onSave: (input: PartnerQuickAddInput, options: { key: string }) => Promise<EntrySeller> }) {
  return (
    <PartnerQuickAddModal
      idPrefix="entry-seller"
      title="Thêm nguồn mới"
      nameLabel="Tên người bán / chủ bò cũ"
      requiredMessage="Tên người bán là bắt buộc."
      saveLabel="Lưu nguồn"
      failMessage="Không thể lưu người bán."
      onClose={onClose}
      onSave={onSave}
    />
  )
}
