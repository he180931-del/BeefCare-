import type { ReactNode } from 'react'
import { Button, Field, Info, Modal, ModalButton, ModalFooter, Note, Select, Table, Td, Textarea, Th, inputCls } from '../../../shared/ui'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'
import { dmy, kg, money } from '../../../shared/lib/format'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { useEntryLineCorrection } from '../hooks/useEntryLineCorrection'
import { herdEntryError } from '../api/herdEntryError'
import type { EntryCattleDetail, EntryLineCommandResult, HerdEntry } from '../types'
import type { EntryLineForm } from '../domain/entryLineCorrection'
import { entryEventLabel } from '../domain/entryEventLabel'

function ChangeRow({ label, current, children }: { label: string; current?: ReactNode; children: ReactNode }) {
  return <tr><Td>{label}</Td><Td>{current || '—'}</Td><Td>{children}</Td></tr>
}
export default function EntryLineModal({ record, line, onSuccess, onClose, onReload, onVoidVoucher }: {
  record: HerdEntry; line: EntryCattleDetail; onSuccess: (result: EntryLineCommandResult) => Promise<void>; onClose: () => void; onReload: () => Promise<void>; onVoidVoucher: () => void
}) {
  const s = useEntryLineCorrection(record, line, onSuccess)
  const r = s.record, c = s.line
  const readOnly = <span className="text-muted">Lấy từ lần đẻ</span>
  const input = (key: keyof EntryLineForm, label: string, type = 'text', extra: { max?: string | number; min?: number; step?: string; maxLength?: number } = {}) =>
    <input className={inputCls} type={type} aria-label={label} value={s.form[key]} onChange={e => s.update(key, e.target.value)} placeholder="Giữ nguyên" disabled={s.saving} {...extra} />
  const select = (key: keyof EntryLineForm, label: string, options: Array<{ value: string; label: string }>) =>
    <Select aria-label={label} value={s.form[key]} onChange={e => s.update(key, e.target.value)} disabled={s.saving}><option value="">Giữ nguyên</option>{options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
  const basis = [{ value: 'MEASURED', label: 'Đã cân' }, { value: 'ESTIMATED', label: 'Ước tính' }]
  const accuracy = [{ value: 'EXACT', label: 'Chính xác' }, { value: 'ESTIMATED', label: 'Ước tính' }, { value: 'UNKNOWN', label: 'Không rõ' }]
  const errorValue = s.error as { code?: string; params?: { action?: string } } | null
  const wholeVoucher = s.lastValid || errorValue?.code === 'MSG-FE06-20' && errorValue.params?.action === 'VOID_VOUCHER'
  return <Modal width={840} title="Sửa / Hủy bản ghi nhập" onClose={() => { if (!s.saving) onClose() }}>
    <Info items={[[ 'Bò', c.code ], ['Mã phiếu', r.id], ['Ngày nhập', dmy(r.date)], ['Người ghi', r.detail?.by || '—']]} />
    {s.loading && <Note>Đang kiểm tra…</Note>}
    {Boolean(s.loadError) && <><Note tone="err">{herdEntryError(s.loadError)}</Note><Button onClick={() => { void s.retry() }}>Thử lại</Button></>}
    {s.data && <>
      {s.data.check.eventsAfterEntry.length > 0 && <Note>Không thể hủy vì {c.code} đã có sự kiện: {s.data.check.eventsAfterEntry.map(entryEventLabel).join(', ')}.</Note>}
      {!s.data.check.canVoid && !s.data.check.eventsAfterEntry.length && <Note>Không thể hủy bản ghi ở trạng thái hiện tại.</Note>}
    </>}
    {wholeVoucher && <Note>{s.lastValid ? 'Đây là con cuối cùng còn hiệu lực. Dùng Hủy phiếu để hủy cả phiếu.' : 'Bạn có thể chuyển sang hủy cả phiếu.'} <Button disabled={s.saving} onClick={onVoidVoucher}>Hủy cả phiếu</Button></Note>}
    {!s.confirming && <fieldset disabled={s.saving} className="m-0 flex flex-wrap gap-4 border-0 p-0"><legend className="mb-2 text-xs font-medium">Hành động</legend>
      <label className="flex items-center gap-2 text-sm"><input type="radio" name="entry-line-action" checked={s.action === 'correct'} onChange={() => s.setAction('correct')} />Sửa bản ghi</label>
      {s.canVoid && <label className="flex items-center gap-2 text-sm"><input type="radio" name="entry-line-action" checked={s.action === 'void'} onChange={() => s.setAction('void')} />Hủy bản ghi</label>}
    </fieldset>}
    {s.confirming ? <Note tone="warn">Hủy bản ghi nhập của {c.code} trên {r.id}? Bò sẽ bị bỏ khỏi danh sách đang nuôi và tiền của bò bị trừ khỏi tổng phiếu.</Note> : s.action === 'correct' && <>
      <Note>Chỉ nhập giá trị mới ở trường cần sửa. Để trống = giữ nguyên. Ngày nhập của phiếu mua áp cho mọi bò của phiếu.</Note>
      <Table scroll stack={false}><thead><tr><Th>Trường</Th><Th>Hiện tại</Th><Th>Mới</Th></tr></thead><tbody>
        <ChangeRow label="Ngày nhập" current={dmy(r.date)}>{s.purchase ? input('entryDate', 'Ngày nhập mới', 'date', { max: businessDate() }) : readOnly}</ChangeRow>
        <ChangeRow label="Người bán" current={r.detail?.sourceName || r.source}>{s.purchase ? select('sellerId', 'Người bán mới', (s.data?.sellers ?? []).map(item => ({ value: String(item.id), label: item.name }))) : readOnly}</ChangeRow>
        <ChangeRow label="Số giấy kiểm dịch" current={r.detail?.quarantine}>{s.purchase ? input('quarantineCertNo', 'Số giấy kiểm dịch mới', 'text', { maxLength: 50 }) : readOnly}</ChangeRow>
        <ChangeRow label="Biển số xe" current={r.detail?.plate}>{s.purchase ? input('vehiclePlate', 'Biển số xe mới', 'text', { maxLength: 20 }) : readOnly}</ChangeRow>
        <ChangeRow label="Cân nhập" current={kg(c.weight)}>{input('entryWeightKg', 'Cân nhập mới (kg)', 'number', { min: 1, max: 1500, step: '0.01' })}</ChangeRow>
        <ChangeRow label="Cơ sở cân" current={basis.find(item => item.value === c.weightBasis)?.label}>{select('weightBasis', 'Cơ sở cân mới', basis)}</ChangeRow>
        <ChangeRow label={`Đơn giá (${r.pricingBasis === 'PER_HEAD' || r.pricing === 'con' ? 'đ/con' : 'đ/kg'})`} current={s.purchase ? money(c.unitPrice) : 'Không áp dụng'}>{s.purchase ? input('unitPrice', 'Đơn giá mới', 'number', { min: 0, step: '1' }) : readOnly}</ChangeRow>
        <ChangeRow label="Giống" current={c.breed?.split(' · ')[0]}>{s.purchase ? select('breedId', 'Giống mới', (s.data?.breeds ?? []).map(item => ({ value: String(item.id), label: item.name }))) : readOnly}</ChangeRow>
        <ChangeRow label="Giới tính" current={c.sexCode === 'MALE' ? 'Đực' : c.sexCode === 'FEMALE' ? 'Cái' : '—'}>{s.purchase ? select('sex', 'Giới tính mới', [{ value: 'MALE', label: 'Đực' }, { value: 'FEMALE', label: 'Cái' }]) : readOnly}</ChangeRow>
        <ChangeRow label="Ngày sinh" current={dmy(c.birthDate)}>{s.purchase ? input('birthDate', 'Ngày sinh mới', 'date', { max: s.form.entryDate || r.date }) : readOnly}</ChangeRow>
        <ChangeRow label="Độ chính xác ngày sinh" current={accuracy.find(item => item.value === c.birthDateAccuracy)?.label}>{s.purchase ? select('birthDateAccuracy', 'Độ chính xác ngày sinh mới', accuracy) : readOnly}</ChangeRow>
        {!s.purchase && <><ChangeRow label="Bò mẹ" current={c.damCode}>{readOnly}</ChangeRow><ChangeRow label="Bò bố" current={c.sireCode}>{readOnly}</ChangeRow></>}
        <ChangeRow label="Khai báo lịch sử" current="Giữ nguyên khai báo đã ghi"><span className="text-muted">Sửa khai báo lịch sử sẽ có ở bản sau</span></ChangeRow>
      </tbody></Table>
      {s.validationError && <Note tone="err">{s.validationError}</Note>}
    </>}
    <Field label={<span>Lý do <span aria-hidden="true">*</span></span>} id="entry-line-reason" hint="Tối đa 500 ký tự"><Textarea id="entry-line-reason" aria-label="Lý do" value={s.reason} onChange={e => s.setReason(e.target.value)} maxLength={500} required disabled={s.saving} /></Field>
    <VoucherCommandError error={s.error} onReload={onReload} formatError={herdEntryError} />
    <ModalFooter>
      {s.confirming ? <><ModalButton disabled={s.saving} onClick={s.back}>Quay lại</ModalButton><ModalButton variant="danger" disabled={!s.canSave} onClick={() => { void s.submit() }}>Xác nhận hủy</ModalButton></> : <>
        <ModalButton disabled={s.saving} onClick={onClose}>Đóng</ModalButton><ModalButton variant="primary" disabled={!s.canSave} onClick={() => { void s.submit() }}>{s.saving ? 'Đang lưu…' : 'Lưu'}</ModalButton>
      </>}
    </ModalFooter>
  </Modal>
}
