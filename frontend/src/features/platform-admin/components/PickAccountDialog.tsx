import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { ErrorBlock, Field, LoadingBlock, Select } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { userFacingError } from '../../../api/userFacingError'
import { platformAdminApi } from '../api/platformAdminApi'

/** Bước chọn tài khoản chưa có vai trò nền tảng trước khi mở hộp thoại cấp quyền. */
export default function PickAccountDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(() => platformAdminApi.listAccounts({ platformRole: 'NONE', size: 100 }), [])
  const [id, setId] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const next = () => {
    if (!id) { setFieldError('Tài khoản là bắt buộc.'); return }
    navigate(`/nen-tang/quyen/${id}?m=access`)
  }

  return (
    <Modal title="Cấp quyền nền tảng" sub="Chỉ cấp cho người dùng đã đăng nhập Google ít nhất một lần. Mỗi người tối đa một vai trò đang hoạt động." width={560} onClose={onClose}>
      {loading && !data && <LoadingBlock />}
      {error != null && <ErrorBlock message={userFacingError(error, 'Không tải được danh sách tài khoản.')} onRetry={refetch} />}
      {data && (
        <Field label="Tài khoản *" id="pick-account">
          <Select id="pick-account" value={id} onChange={(e) => { setId(e.target.value); setFieldError(null) }}>
            <option value="">Chọn tài khoản…</option>
            {data.content.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.emailVerified}>
                {a.fullName} · {a.email}{a.emailVerified ? '' : ' (chưa xác minh email)'}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {fieldError && <p role="alert" className="m-0 -mt-2 text-xs text-err-fg">{fieldError}</p>}
      <ModalFooter className="!px-0 !pb-0">
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={next} disabled={!data}>Tiếp tục</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
