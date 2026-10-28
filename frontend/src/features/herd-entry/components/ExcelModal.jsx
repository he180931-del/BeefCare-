import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Button, Table, Td, Th, Note } from '../../../components/ui'
import { EXCEL_ROWS, TODAY, blankCow } from '../data/importsData'
import { kg } from '../../../data/format'

const TH = 'px-1! first:pl-3! last:pr-3!'

/** dob 'YYYY-MM' lùi 12 tháng so với ngày nhập (tuổi mặc định 12 tháng). */
const dobFromAge12 = (dateIso) => {
  const [y, m] = dateIso.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

/** Nhập nhiều con từ tệp Excel. Chỉ các dòng ok/warn được thêm; onAdd(cows[]) nhận danh sách con. */
export default function ExcelModal({ recordId, onAdd, onClose }) {
  const [rows] = useState(EXCEL_ROWS)
  const valid = rows.filter((r) => r.result.tone !== 'err')
  const bad = rows.length - valid.length
  const warn = rows.filter((r) => r.result.tone === 'warn').length

  const add = () => {
    const cows = valid.map((r) => ({
      ...blankCow(),
      tag: r.tag,
      breed: r.breed,
      sex: r.sex,
      dob: dobFromAge12(TODAY),
      dobAccuracy: 'Không rõ',
      stage: 'Bò tơ',
      weight: r.kg,
      estimated: false,
      // VN-0505 đặt sang A2 vì A1 đã đầy (theo Figma).
      barn: r.tag === 'VN-0505' ? 'A2' : r.barn,
      unitPrice: 85000,
    }))
    onAdd(cows)
  }

  return (
    <Modal top={80} width={760} title="Nhập danh sách bò từ Excel" sub={`Thêm nhiều con vào phiếu ${recordId} · chỉ dòng hợp lệ được thêm`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="m-0 text-[13px] font-semibold">1. Tải file mẫu</h3>
          <Button small>Tải mẫu .xlsx</Button>
          <span className="max-w-[380px] text-[11px] text-muted">Cột: Số thẻ tai · Giống · Giới tính · Ngày sinh · Độ chính xác · Cân · Cơ sở cân · Chuồng · Mục đích · Đơn giá</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold">2. Chọn tệp</h3>
        <div className="flex items-center gap-2.5 rounded-xl border border-field bg-page px-3 py-2.5">
          <Badge>XLSX</Badge>
          <span className="text-xs font-semibold">ds-bo-nhap-2210.xlsx · {rows.length} dòng dữ liệu</span>
          <span className="flex-1" />
          <button type="button" className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-brand">Đổi tệp</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold">3. Kết quả kiểm tra</h3>
        <Table stack={false}>
          <thead>
            <tr>
              <Th className={`${TH} w-[40px]`}>Dòng</Th>
              <Th className={`${TH} w-[70px]`}>Thẻ tai</Th>
              <Th className={`${TH} w-[130px]`}>Giống · giới tính</Th>
              <Th className={`${TH} w-[60px]`}>Cân</Th>
              <Th className={`${TH} w-[100px]`}>Chuồng</Th>
              <Th className={TH}>Kết quả</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 4).map((r) => (
              <tr key={r.line}>
                <Td className={TH}>{r.line}</Td>
                <Td className={TH}>{r.tag}</Td>
                <Td className={TH}>{`${r.breed} · ${r.sex}`}</Td>
                <Td className={`${TH} whitespace-nowrap`}>{kg(r.kg)}</Td>
                <Td className={`${TH} whitespace-nowrap`}>{IMPORT_BARN_NAME[r.barn]}</Td>
                <Td className={TH}><Badge tone={r.result.tone}>{r.result.text}</Badge></Td>
              </tr>
            ))}
            <tr>
              <Td colSpan={5} className={TH} />
              <Td className={TH}>{`${rows.length - 4} dòng hợp lệ khác`}</Td>
            </tr>
          </tbody>
        </Table>
      </div>

      <Note tone="info">
        {`${rows.length} dòng: ${valid.length} hợp lệ (${warn} cảnh báo) · ${bad} lỗi. Dòng lỗi không được thêm – sửa tệp rồi tải lại, hoặc thêm tay bằng "+ Thêm con". Tối đa 200 dòng.`}
      </Note>

      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!valid.length} onClick={add}>{`Thêm ${valid.length} con vào phiếu`}</ModalButton>
      </ModalFooter>
    </Modal>
  )
}

const IMPORT_BARN_NAME = { A1: 'A1 – Bò cái', A2: 'A2 – Bò cái', B1: 'B1 – Vỗ béo' }
