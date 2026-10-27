import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../components/Modal'
import { Field, KV, Note, Radio, Select, Table, Td, Th, inputCls } from '../../components/ui'
import { BREEDS, IMPORT_BARNS, PURPOSE_OPTIONS, STAGES, ageOf } from '../../data/importsData'
import { money } from '../../data/format'
import { RadioRow } from './parts'

const TH = 'px-1! first:pl-3! last:pr-3!'
const HIST_OPTIONS = ['Có', 'Không', 'Không rõ']
const ACCURACY = { 'Chính xác': 'Chính xác', 'Ước tính': 'Ước tính', 'Không rõ': 'Không rõ' }

/**
 * Sửa một con trong phiếu nhập. `others` là các con khác trong phiếu (để kiểm tra sức chứa chuồng).
 * onSave(cow) ghi lại con; onRemove() xóa con khỏi phiếu.
 */
export default function RowEditModal({ cow, index, recordId, dateIso, pricing, others, onSave, onRemove, onClose }) {
  const [c, setC] = useState(cow)
  const set = (p) => setC((x) => ({ ...x, ...p }))
  const [y, mo] = c.dob ? c.dob.split('-') : []
  const barn = IMPORT_BARNS.find((b) => b.code === c.barn)
  const sameBarn = others.filter((o) => o.barn === c.barn).length
  const full = barn && barn.count + sameBarn + 1 > barn.capacity
  const femaleOnly = (c.barn === 'A1' || c.barn === 'A2') && c.sex === 'Đực'
  const ok = !full && !femaleOnly
  const amount = pricing === 'kg' ? c.weight * c.unitPrice : c.unitPrice

  return (
    <Modal
      width={700}
      title={`Sửa con #${index + 1} trong phiếu ${recordId}`}
      sub={'Thông tin dùng để tạo hồ sơ bò khi lưu phiếu – chưa tạo hồ sơ cho đến khi bấm "Lưu & tạo hồ sơ".'}
      topTitle="Thêm / sửa con trong phiếu nhập"
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="Số thẻ tai phụ" hint="Để trống nếu gắn thẻ sau">
          <input className={inputCls} value={c.tag} onChange={(e) => set({ tag: e.target.value })} />
        </Field>
        <Field label="Tên gọi">
          <input className={inputCls} value={c.name} placeholder="Không bắt buộc" onChange={(e) => set({ name: e.target.value })} />
        </Field>

        <Field label="Giống *">
          <Select value={c.breed} onChange={(e) => set({ breed: e.target.value })}>
            <option value="">Chọn giống</option>
            {BREEDS.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink">Giới tính *</span>
          <RadioRow name="sex" value={c.sex} options={['Đực', 'Cái']} onChange={(sex) => set({ sex })} />
        </div>

        <Field label="Ngày sinh" hint={`Tuổi khi nhập ≈ ${ageOf(c.dob, dateIso)} tháng`}>
          <div className="relative">
            <div className={`${inputCls} flex items-center gap-1.5`}>
              <span className="flex-1">{y ? `${mo}/${y}` : 'MM/YYYY'}</span>
              <span className="text-[10px] text-muted">▾</span>
            </div>
            <input type="month" aria-label="Ngày sinh" value={c.dob} onChange={(e) => e.target.value && set({ dob: e.target.value })} className="absolute inset-0 size-full cursor-pointer opacity-0" />
          </div>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink">Độ chính xác ngày sinh</span>
          <RadioRow name="accuracy" value={c.dobAccuracy} options={Object.keys(ACCURACY)} onChange={(dobAccuracy) => set({ dobAccuracy })} />
        </div>

        <Field label="Giai đoạn sống *" hint="Đề xuất theo tuổi (12–24 tháng), sửa được">
          <Select value={c.stage} onChange={(e) => set({ stage: e.target.value })}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Mục đích nuôi *">
          <Select value={c.purpose} onChange={(e) => set({ purpose: e.target.value })}>
            {PURPOSE_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>

        <Field label="Cân nhập (kg) *">
          <input type="number" min="0" className={inputCls} value={c.weight} onChange={(e) => set({ weight: Number(e.target.value) || 0 })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink">Cơ sở cân</span>
          <RadioRow name="weigh" value={c.estimated ? 'Ước tính' : 'Cân thực tế'} options={['Cân thực tế', 'Ước tính']} onChange={(v) => set({ estimated: v === 'Ước tính' })} />
        </div>

        <div className="col-span-2 grid grid-cols-3 gap-4">
          <Field label="Chuồng nhận *">
            <Select value={c.barn} onChange={(e) => set({ barn: e.target.value })}>
              {IMPORT_BARNS.map((b) => <option key={b.code} value={b.code}>{`${b.name} · ${b.count}/${b.capacity}`}</option>)}
            </Select>
          </Field>
          <Field label={pricing === 'kg' ? 'Đơn giá (đ/kg)' : 'Giá/con (đ)'}>
            <input type="number" min="0" className={inputCls} value={c.unitPrice} onChange={(e) => set({ unitPrice: Number(e.target.value) || 0 })} />
          </Field>
          <KV k="Thành tiền">
            <span className="block rounded-xl border border-field bg-page px-2.5 py-3 text-sm text-muted">{money(amount)} đ</span>
          </KV>
        </div>

        <div className="col-span-2 flex flex-col gap-2">
          <h4 className="m-0 text-sm font-semibold">Lịch sử trước nhập đàn</h4>
          <Table stack={false}>
            <thead>
              <tr>
                <Th className={`${TH} w-[110px]`}>Mục</Th>
                <Th className={`${TH} w-[260px]`}>Khai báo</Th>
                <Th className={TH}>Chi tiết</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className={TH}>Tiêm phòng</Td>
                <Td className={TH}><RadioRow name="vaccine" value={c.hist.vaccine} options={HIST_OPTIONS} onChange={(v) => set({ hist: { ...c.hist, vaccine: v } })} /></Td>
                <Td className={TH}>{c.hist.vaccine === 'Có' ? c.hist.vaccineNote || '—' : '—'}</Td>
              </tr>
              <tr>
                <Td className={TH}>Bệnh đã biết</Td>
                <Td className={TH}><RadioRow name="disease" value={c.hist.disease} options={HIST_OPTIONS} onChange={(v) => set({ hist: { ...c.hist, disease: v } })} /></Td>
                <Td className={TH}>—</Td>
              </tr>
              <tr>
                <Td className={TH}>Sinh sản</Td>
                <Td className={TH}><RadioRow name="repro" value={c.hist.repro} options={HIST_OPTIONS} onChange={(v) => set({ hist: { ...c.hist, repro: v } })} /></Td>
                <Td className={TH}>—</Td>
              </tr>
            </tbody>
          </Table>
        </div>

        <div className="col-span-2">
          {ok ? (
            <Note tone="ok">
              {`Tiêu chí chuồng ${c.barn}: Đạt.`}
              {c.hist.vaccine === 'Có' && ' Tiêm phòng "Có" được lưu là bản ghi tiêm LỊCH SỬ, không tạo mũi trong lịch tiêm.'}
            </Note>
          ) : (
            <Note tone="err">
              {`Tiêu chí chuồng ${c.barn}: Không đạt – ${full ? 'hết chỗ' : `${c.barn} chỉ nhận bò cái`}.`}
            </Note>
          )}
        </div>
      </div>

      <ModalFooter>
        <ModalButton variant="link" onClick={onRemove}>Xóa con khỏi phiếu</ModalButton>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!ok} onClick={() => onSave(c)}>{`Lưu con #${index + 1}`}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
