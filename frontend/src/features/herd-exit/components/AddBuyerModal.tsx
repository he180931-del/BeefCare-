import { useRef, useState } from 'react'
import { Field, inputCls, Modal, ModalButton, ModalFooter, Note } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { BackendError } from '../../../shared/api/backendClient'
import type { ExitBuyer } from '../types'

export default function AddBuyerModal({ onClose, onSave }: { onClose: () => void; onSave: (input: { name: string; phone: string; area: string }, options?: { key?: string }) => Promise<ExitBuyer> }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [area, setArea] = useState('')
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false)
  const commandKey = useRef<string | undefined>(undefined)

  const submit = async () => {
    const cleanName = name.trim()
    if (!cleanName) {
      setNameError('Tên người mua là bắt buộc.')
      return
    }
    setSaving(true)
    setError('')
    setNameError('')
    try {
      commandKey.current ??= `beefcare-exit-buyer-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await onSave({ name: cleanName, phone: phone.trim(), area: area.trim() }, { key: commandKey.current })
    } catch (saveError) {
      if (saveError instanceof BackendError && saveError.code === 'MSG-FE06-25') setNameError('Tên đối tác đã có trong danh bạ của trại.')
      else setError(userFacingError(saveError, 'Không thể lưu người mua.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Thêm người mua" sub="Người mua được lưu trong danh bạ đối tác của trại" width={560} onClose={onClose}>
      <Field label="Tên người mua / thương lái *" id="exit-buyer-name">
        <input id="exit-buyer-name" maxLength={150} value={name} onChange={(event) => { setName(event.target.value); setError(''); setNameError('') }} className={inputCls} aria-invalid={Boolean(nameError)} />
        {nameError && <span className="text-[11px] text-err-fg">{nameError}</span>}
      </Field>
      <Field label="Số điện thoại" id="exit-buyer-phone">
        <input id="exit-buyer-phone" maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} />
      </Field>
      <Field label="Khu vực" id="exit-buyer-area">
        <input id="exit-buyer-area" maxLength={255} value={area} onChange={(event) => setArea(event.target.value)} className={inputCls} />
      </Field>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : 'Lưu người mua'}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
