import { useRef, useState } from 'react'
import { Field, inputCls, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import type { ExitBuyer } from '../types'

export default function AddBuyerModal({ onClose, onSave }: { onClose: () => void; onSave: (input: { name: string; phone: string; area: string }, options?: { key?: string }) => Promise<ExitBuyer> }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [area, setArea] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef<string | undefined>(undefined)

  const submit = async () => {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('Tên người mua là bắt buộc.')
      return
    }
    setSaving(true)
    setError('')
    try {
      commandKey.current ??= `beefcare-exit-buyer-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await onSave({ name: cleanName, phone: phone.trim(), area: area.trim() }, { key: commandKey.current })
    } catch (saveError) {
      const code = typeof saveError === 'object' && saveError !== null && 'code' in saveError ? String((saveError as { code?: unknown }).code ?? '') : ''
      setError(code === 'PARTNER_DUPLICATE' || String(saveError).includes('PARTNER_DUPLICATE')
        ? 'Tên đối tác đã có trong danh bạ của trại.'
        : userFacingError(saveError, 'Không thể lưu người mua.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Thêm người mua" sub="Người mua được lưu trong danh bạ đối tác của trại" width={560} onClose={onClose}>
      <Field label="Tên người mua / thương lái *" id="exit-buyer-name">
        <input id="exit-buyer-name" maxLength={150} value={name} onChange={(event) => { setName(event.target.value); setError('') }} className={inputCls} />
      </Field>
      <Field label="Số điện thoại" id="exit-buyer-phone">
        <input id="exit-buyer-phone" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} />
      </Field>
      <Field label="Khu vực" id="exit-buyer-area">
        <input id="exit-buyer-area" maxLength={150} value={area} onChange={(event) => setArea(event.target.value)} className={inputCls} />
      </Field>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu người mua'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
