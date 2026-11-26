import { useRef, useState } from 'react'
import { Field, inputCls } from '../Form/Form'
import Modal, { ModalButton, ModalFooter } from '../Modal/Modal'
import { Note } from '../Feedback/Feedback'
import { userFacingError } from '../../api/userFacingError'
import { BackendError } from '../../api/backendClient'

export type PartnerQuickAddInput = { name: string; phone: string; area: string }

/**
 * Quick-add a trading partner (name, phone, area) without leaving a voucher.
 * Used by FE-06 "+ Thêm nguồn mới" (seller) and FE-13 "+ Thêm người mua" (buyer).
 * The Idempotency-Key is kept across retries of the same dialog.
 */
export default function PartnerQuickAddModal<T>({ idPrefix, title, nameLabel, requiredMessage, saveLabel, failMessage, onClose, onSave }: {
  idPrefix: string
  title: string
  nameLabel: string
  requiredMessage: string
  saveLabel: string
  failMessage: string
  onClose: () => void
  onSave: (input: PartnerQuickAddInput, options: { key: string }) => Promise<T>
}) {
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
      setNameError(requiredMessage)
      return
    }
    setSaving(true)
    setError('')
    setNameError('')
    try {
      commandKey.current ??= `beefcare-${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await onSave({ name: cleanName, phone: phone.trim(), area: area.trim() }, { key: commandKey.current })
    } catch (saveError) {
      if (saveError instanceof BackendError && saveError.code === 'MSG-FE06-25') setNameError('Tên đối tác đã có trong danh bạ của trại.')
      else setError(userFacingError(saveError, failMessage))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} sub="Đối tác được lưu trong danh bạ đối tác của trại" width={560} onClose={onClose}>
      <Field label={`${nameLabel} *`} id={`${idPrefix}-name`}>
        <input id={`${idPrefix}-name`} maxLength={150} value={name} onChange={(event) => { setName(event.target.value); setError(''); setNameError('') }} className={inputCls} aria-invalid={Boolean(nameError)} />
        {nameError && <span className="text-[11px] text-err-fg">{nameError}</span>}
      </Field>
      <Field label="Số điện thoại" id={`${idPrefix}-phone`}>
        <input id={`${idPrefix}-phone`} maxLength={50} value={phone} onChange={(event) => setPhone(event.target.value)} className={inputCls} />
      </Field>
      <Field label="Khu vực" id={`${idPrefix}-area`}>
        <input id={`${idPrefix}-area`} maxLength={255} value={area} onChange={(event) => setArea(event.target.value)} className={inputCls} />
      </Field>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        <ModalButton disabled={saving} onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'Đang lưu…' : saveLabel}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
