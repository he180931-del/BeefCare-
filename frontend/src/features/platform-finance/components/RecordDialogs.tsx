import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter, useModalParam } from '../../../components/Modal'
import { Field, Note, Textarea, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { financeApi } from '../api/financeApi'
import { formatDate, formatDateTime, formatVnd, TYPE_LABEL } from '../domain/financeRules'
import type { FinanceRecord } from '../types'
import { FINANCE_BASE, RoField } from './common'

const scopeText = (r: FinanceRecord) => (r.scope === 'GENERAL' ? 'Chung nền tảng' : r.farmName)
const summaryText = (r: FinanceRecord) => `${TYPE_LABEL[r.type]} · ${r.category} · ${formatVnd(r.amountVnd)} VND`
const sourceText = (r: FinanceRecord) => `${r.documentNumber || 'Không có số chứng từ'} · ${r.sourceType === 'BANK' ? 'Nguồn ngân hàng' : 'Nguồn thủ công'}`

/**
 * Các hộp thoại của một khoản thu chi (ghi sổ, hủy bỏ, thay thế, bỏ nháp, xem chỉ đọc).
 * Dùng chung cho danh sách (SCR-71) và biểu mẫu (SCR-72); mã khoản do trang truyền vào.
 */
export function RecordDialogs({ code, onChanged }: { code: string | null; onChanged: () => void }) {
  const [m, open, close] = useModalParam()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const active = Boolean(code && m && ['xem', 'huy', 'thay-the', 'ghi-so', 'bo-nhap'].includes(m))
  const { data, refetch } = useQuery(async () => (active && code ? financeApi.getRecord(code) : null), [code, m])
  const r = data?.record
  if (!active || !r) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(userFacingError(e, 'Không lưu được dữ liệu. Vui lòng thử lại.')) } finally { setBusy(false) }
  }
  const back = () => { setError(null); close(); navigate(FINANCE_BASE) }
  const goOpen = (name: string) => { setError(null); open(name) }

  if (m === 'xem' && r.state === 'DRAFT') return null

  if (m === 'xem') {
    const voided = r.state === 'VOID'
    return (
      <Modal title={`Khoản ${r.recordCode} ${voided ? 'đã hủy bỏ' : 'đã ghi sổ'}`} width={640} onClose={close}>
        <div className="flex flex-col gap-3">
          <RoField label="Trạng thái" value={voided ? 'Hủy bỏ · Chỉ đọc' : 'Đã ghi sổ · Chỉ đọc'} />
          {voided ? (
            <>
              <RoField label="Thông tin gốc" value={`${TYPE_LABEL[r.type]} · ${formatVnd(r.amountVnd)} VND · ${formatDate(r.occurredOn)} · ${scopeText(r)}`} />
              <RoField label="Lý do" value={r.voidReason ?? ''} />
              <RoField label="Người / thời điểm Hủy bỏ" value={`${r.voidedBy} · ${formatDateTime(r.voidedAt ?? '')}`} />
              <RoField label="Lịch sử" value={r.history.map((h) => `${h.action} ${h.changedAt.slice(8, 10)}/${h.changedAt.slice(5, 7)}`).join(' → ')} />
              <Note tone="info">Không khôi phục Hủy bỏ. Có thể tạo nháp thay thế và liên kết khoản gốc nếu phù hợp; báo cáo đang xem giữ bản chốt cũ tới khi làm mới.</Note>
            </>
          ) : (
            <>
              <RoField label="Loại / danh mục / số tiền" value={summaryText(r)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <RoField label="Phát sinh / phạm vi" value={`${formatDate(r.occurredOn)} · ${scopeText(r)}`} />
                <RoField label="Ghi sổ bởi / lúc" value={`${r.postedBy} · ${formatDateTime(r.postedAt ?? '')}`} />
              </div>
              <RoField label="Chứng từ / nguồn" value={sourceText(r)} />
              <Note tone="info">Không sửa hoặc xóa khoản đã ghi sổ. Sửa sai bằng Hủy bỏ có lý do, giữ nguyên thông tin và lịch sử.</Note>
            </>
          )}
        </div>
        <ModalFooter>
          <ModalButton onClick={back}><Icon name="arrow-left" size={16} /> Về danh sách</ModalButton>
          {voided ? <ModalButton variant="primary" onClick={() => goOpen('thay-the')}><Icon name="circle-plus" size={16} /> Tạo nháp thay thế</ModalButton> : <ModalButton variant="primary" onClick={() => goOpen('huy')}>Hủy bỏ khoản đã ghi sổ</ModalButton>}
        </ModalFooter>
      </Modal>
    )
  }

  if (m === 'huy') {
    const submit = () => run(async () => {
      await financeApi.voidRecord(r.recordCode, r.version, reason)
      setReason('')
      onChanged(); refetch()
      navigate(`${FINANCE_BASE}/${r.recordCode}?m=xem`, { state: { flash: { tone: 'ok', text: `Khoản thu chi ${r.recordCode} đã được hủy bỏ.` } } })
    })
    return (
      <Modal title={`Hủy bỏ khoản ${r.recordCode}`} width={640} onClose={close}>
        <div className="flex flex-col gap-3">
          <RoField label="Khoản gốc" value={`Đã ghi sổ · ${TYPE_LABEL[r.type]} · ${formatVnd(r.amountVnd)} VND`} />
          <Field label="Lý do Hủy bỏ *" id="void-reason">
            <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do hủy bỏ" />
          </Field>
          {error && <Note tone="err">{error}</Note>}
          <Note tone="info">Khoản gốc được giữ, loại khỏi tổng ở bản chốt mới sau làm mới. Không Hủy bỏ biên nhận đăng ký gói.</Note>
        </div>
        <ModalFooter>
          <ModalButton onClick={() => goOpen('xem')}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={busy}>Xác nhận Hủy bỏ</ModalButton>
        </ModalFooter>
      </Modal>
    )
  }

  if (m === 'thay-the') {
    const amountValue = amount === '' ? r.amountVnd : Number(amount.replace(/\D/g, ''))
    const submit = () => run(async () => {
      const next = await financeApi.createReplacement(r.recordCode, r.version, { amountVnd: amountValue, description: description || `Thay ${r.recordCode}` })
      setAmount(''); setDescription('')
      navigate(`${FINANCE_BASE}/${next.recordCode}`, { state: { flash: { tone: 'ok', text: `Khoản thu chi ${next.recordCode} đã được lưu ở trạng thái nháp.` } } })
    })
    return (
      <Modal title={`Nháp thay thế ${r.recordCode}`} width={640} onClose={close}>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <RoField label="Liên kết khoản gốc" value={`${r.recordCode} · Hủy bỏ · Chỉ đọc`} />
            <RoField label="Loại / danh mục" value={`${TYPE_LABEL[r.type]} · ${r.category}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số tiền mới (VND) *" id="rep-amount"><input id="rep-amount" className={inputCls} inputMode="numeric" value={amount === '' ? formatVnd(r.amountVnd) : formatVnd(amountValue)} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '') || '0')} /></Field>
            <RoField label="Phát sinh / trại" value={`${formatDate(r.occurredOn)} · ${scopeText(r)}`} />
          </div>
          <Field label="Diễn giải *" id="rep-desc"><input id="rep-desc" className={inputCls} value={description} placeholder={`Thay ${r.recordCode}`} onChange={(e) => setDescription(e.target.value)} /></Field>
          {error && <Note tone="err">{error}</Note>}
          <Note tone="info">Nháp mới chưa được tính vào báo cáo; kiểm tra và ghi sổ riêng. Không tạo thủ công Thu thay thế tiền đăng ký gói.</Note>
        </div>
        <ModalFooter>
          <ModalButton onClick={() => goOpen('xem')}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={busy}>Lưu nháp thay thế</ModalButton>
        </ModalFooter>
      </Modal>
    )
  }

  if (m === 'ghi-so') {
    const submit = () => run(async () => {
      await financeApi.post(r.recordCode, r.version)
      onChanged()
      navigate(`${FINANCE_BASE}/${r.recordCode}?m=xem&ma=${r.recordCode}`, { state: { flash: { tone: 'ok', text: `Khoản thu chi ${r.recordCode} đã được ghi sổ.` } } })
    })
    return (
      <Modal title="Xem lại trước khi ghi sổ" width={640} onClose={close}>
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-ink">Ghi sổ khoản {r.recordCode}? Khoản đã ghi sổ không sửa được; muốn sửa phải hủy bỏ.</p>
          <RoField label="Hồ sơ" value={`${r.recordCode} · Nháp`} />
          <RoField label="Loại / danh mục / số tiền" value={summaryText(r)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <RoField label="Phát sinh / phạm vi" value={`${formatDate(r.occurredOn)} · ${r.scope === 'GENERAL' ? 'Chung nền tảng' : `FARM · ${r.farmName}`}`} />
            <RoField label="Chứng từ / diễn giải" value={[r.documentNumber, r.description].filter(Boolean).join(' · ') || '—'} />
          </div>
          {error && <Note tone="err">{error}</Note>}
          <Note tone="info">Ghi sổ biến khoản thành Đã ghi sổ bất biến và tính một lần vào báo cáo theo ngày phát sinh. Kiểm tra nguồn, phạm vi và phiên bản lại trước khi lưu.</Note>
        </div>
        <ModalFooter>
          <ModalButton onClick={close}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={busy}>Xác nhận ghi sổ</ModalButton>
        </ModalFooter>
      </Modal>
    )
  }

  // bo-nhap
  const discard = () => run(async () => {
    await financeApi.discard(r.recordCode, r.version)
    navigate(FINANCE_BASE, { state: { flash: { tone: 'ok', text: `Nháp ${r.recordCode} đã được bỏ.` } } })
  })
  return (
    <Modal title={`Bỏ khoản nháp ${r.recordCode}?`} width={640} onClose={close}>
      <div className="flex flex-col gap-3">
        {error && <Note tone="err">{error}</Note>}
        <Note tone="info">Nháp chưa được tính vào báo cáo. Xác nhận để bỏ nháp; quay lại để tiếp tục chỉnh sửa.</Note>
      </div>
      <ModalFooter>
        <ModalButton onClick={close}>Giữ nháp</ModalButton>
        <ModalButton variant="primary" onClick={discard} disabled={busy}>Xác nhận bỏ nháp</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
