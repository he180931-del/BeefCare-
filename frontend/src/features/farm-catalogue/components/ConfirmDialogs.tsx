import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Note } from '../../../components/ui'

/** MSG-FE18-03: ngừng dùng mục đã được tham chiếu. */
export function DeactivateDialog({ name, count, busy, onCancel, onConfirm }: { name: string; count: number; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={`Ngừng dùng ${name}?`} width={560} onClose={onCancel}>
      <p className="m-0 text-sm text-ink">
        {name} đang được dùng bởi {count} bản ghi. Mục này sẽ không còn được chọn cho bản ghi mới; các bản ghi hiện có giữ nguyên.
      </p>
      <ModalFooter>
        <ModalButton onClick={onCancel}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={onConfirm} disabled={busy}>Ngừng dùng</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** MSG-FE18-07 cho vắc-xin chưa từng dùng; MSG-FE18-04 (chỉ báo, không xóa) cho vắc-xin đã dùng. */
export function DeleteVaccineDialog({ name, used, busy, error, onCancel, onConfirm }: { name: string; used: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={used ? 'Không thể xóa vắc-xin' : `Xóa vắc-xin ${name}?`} width={560} onClose={onCancel}>
      {used ? (
        <Note tone="warn">Vắc-xin này đã được dùng nên không xóa được. Hãy ngừng dùng thay vì xóa.</Note>
      ) : (
        <p className="m-0 text-sm text-ink">Xóa vắc-xin {name}? Vắc-xin này chưa từng được dùng.</p>
      )}
      {error && <div className="mt-3"><Note tone="err"><span role="alert">{error}</span></Note></div>}
      <ModalFooter>
        {used ? (
          <ModalButton onClick={onCancel}>Đóng</ModalButton>
        ) : (
          <>
            <ModalButton onClick={onCancel}>Hủy</ModalButton>
            <ModalButton variant="danger" onClick={onConfirm} disabled={busy}>Xóa</ModalButton>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
