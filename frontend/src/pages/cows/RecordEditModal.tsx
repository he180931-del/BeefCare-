import { useState } from 'react'
import { Field, Note, Table, Textarea } from '../../components/ui'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { MANAGER } from '../../data/cowsData'
import { editImportRecord, voidImportRecord } from '../../api/cattleApi'
import { useMutation } from '../../hooks/useApi'
import { Td, Th, fieldCls } from './parts'
import type { CowSeed } from '../../data/cowsData'
import type { ImportRecord } from '../../types'

const REASON_MAX = 500

export default function RecordEditModal({ cow, record, onClose, onSaved }: { cow: CowSeed; record: ImportRecord; onClose: () => void; onSaved: () => void }) {
  const edit = useMutation((payload: { values: Record<string, string>; reason: string }) => editImportRecord(cow.code, payload))
  const voidRecord = useMutation((payload: { reason: string }) => voidImportRecord(cow.code, payload))
  const [action, setAction] = useState('edit')
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(record.fields.map(([key, , , next]) => [key, next])))
  const [editingPrior, setEditingPrior] = useState(false)
  const [reason, setReason] = useState('Cân lại tại trại, cân nhập ghi nhầm 4 kg')
  const voiding = action === 'void'

  const setDraft = (key: string, value: string) => setDrafts((d) => ({ ...d, [key]: value }))
  const changed = record.fields.filter(([key, , current]) => {
    const v = drafts[key]
    return v && v !== '—' && v !== current
  })
  const canSave = reason.trim() !== '' && (voiding || changed.length > 0)

  const save = async () => {
    if (voiding) await voidRecord.mutate({ reason: reason.trim() })
    else await edit.mutate({ values: drafts, reason: reason.trim() })
    onSaved()
  }

  return (
    <Modal
      title={`Sửa / hủy bản ghi nhập đàn – ${cow.code}`}
      sub={`Phiếu ${record.plan} · nhập ${record.date} · ghi bởi ${record.by}`}
      width={720}
      top={70}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink">Hành động *</span>
        <div className="flex flex-wrap gap-[18px]">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink">
            <input type="radio" name="record-action" className="sr-only" checked={action === 'edit'} onChange={() => setAction('edit')} />
            <span className={`size-4 shrink-0 rounded-full border ${action === 'edit' ? 'border-brand bg-brand' : 'border-edge bg-white'}`} />
            Sửa bản ghi
          </label>
          <label className={`inline-flex items-center gap-2 text-[13px] text-ink ${record.onlyImportEvents ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input
              type="radio"
              name="record-action"
              className="sr-only"
              disabled={!record.onlyImportEvents}
              checked={voiding}
              onChange={() => setAction('void')}
            />
            <span className={`size-4 shrink-0 rounded-full border ${voiding ? 'border-brand bg-brand' : 'border-edge bg-white'}`} />
            Hủy bản ghi
          </label>
        </div>
      </div>

      <div className={voiding ? 'pointer-events-none opacity-50' : ''}>
        <Table stack={false}>
          <thead>
            <tr>
              <Th className="w-[190px]">Trường</Th>
              <Th className="w-[200px]">Giá trị hiện tại</Th>
              <Th className="w-[220px]">Giá trị mới</Th>
            </tr>
          </thead>
          <tbody>
            {record.fields.map(([key, label, current, next]) => (
              <tr key={key}>
                <Td className="font-medium">{label}</Td>
                <Td>{current}</Td>
                <Td>
                  {next === 'LINK' && !editingPrior ? (
                    <button type="button" onClick={() => setEditingPrior(true)} className="cursor-pointer p-1 text-[12px] font-semibold text-brand">
                      Sửa →
                    </button>
                  ) : (
                    <input
                      value={next === 'LINK' ? drafts[key] ?? current : drafts[key]}
                      onChange={(e) => setDraft(key, e.target.value)}
                      className="w-full bg-transparent text-[12px] outline-none focus:underline"
                      aria-label={label}
                    />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="m-0 mt-2 text-[11px] text-muted">Chỉ lưu các dòng có thay đổi; tổng tiền phiếu được tính lại.</p>
      </div>

      <Field label="Lý do *" hint={`Tối đa ${REASON_MAX} ký tự`}>
        <Textarea
          className="!h-14 !leading-[normal]"
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <Note tone="grey">
        “Hủy bản ghi” chỉ hiện khi bò chưa có sự kiện nào khác ngoài nhập đàn và xếp chuồng; hồ sơ chuyển VOIDED và thẻ QR bị thu hồi (GBR-33).
      </Note>

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!canSave} onClick={save}>Lưu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
