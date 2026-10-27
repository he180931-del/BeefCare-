import { Button, Foot, Table } from '../../components/ui'
import { Chip, Fields, Panel, Td, Th } from './parts'

const ageFull = (cow) => cow.ageLong.replace('tuổi', 'năm')

export default function OverviewTab({ cow, onOpenModal }) {
  const cur = cow.qrHistory.find((q) => q.status === 'ACTIVE') || cow.qrHistory[0]
  return (
    <>
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1.725fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Panel title="Định danh" gap="gap-3.5">
            <Fields
              cols="grid-cols-2 sm:grid-cols-4"
              items={[
                ['Mã nội bộ', cow.internalId],
                ['Mã hiển thị', cow.code],
                ['Số tai phụ', cow.tag],
                ['Thẻ QR hiện hành', `${cow.qr} · ${cur.status}`],
              ]}
            />
          </Panel>
          <Panel
            title="Thông tin cá thể"
            gap="gap-3.5"
            action={cow.importRecord && <Button variant="link" small className="leading-[normal]" onClick={() => onOpenModal('record-edit')}>Sửa / hủy bản ghi nhập đàn</Button>}
          >
            <Fields
              cols="grid-cols-2 sm:grid-cols-4"
              items={[
                ['Giới tính', cow.sex],
                ['Giống', cow.breed],
                ['Ngày sinh', cow.birth],
                ['Tuổi', ageFull(cow)],
                ['Nguồn nhập đàn', cow.source],
                ['Mục đích nuôi', `${cow.purpose} · từ ${cow.purposeSince}`],
                ['Giai đoạn', cow.stage],
                ['Chuồng hiện tại', `${cow.barn} · từ ${cow.barnSince}`],
                ['Mẹ', cow.mother],
                ['Bố', cow.father],
                ['Tên gọi', cow.name],
                ['Mô tả', cow.description],
              ]}
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Panel title="Tóm tắt chăm sóc" gap="gap-3.5">
            <Fields
              cols="grid-cols-2"
              items={[
                ['Cân gần nhất', cow.care.last],
                ['ADG 90 ngày', cow.care.adg],
                ['BCS', cow.care.bcs],
                ['Sức khỏe', cow.care.healthCase],
                ['Sinh sản', cow.care.repro],
                ['Tiêm phòng', <Chip key="v" tone={cow.care.vaccine.tone}>{cow.care.vaccine.label}</Chip>],
              ]}
            />
          </Panel>
          <Panel title="Nhắc việc liên quan" gap="gap-2.5">
            <Table stack={false}>
              <thead>
                <tr>
                  <Th className="w-[190px]">Nhắc việc</Th>
                  <Th className="w-[130px]">Hạn</Th>
                </tr>
              </thead>
              <tbody>
                {cow.care.reminders.map((r) => (
                  <tr key={r.title}>
                    <Td className="font-medium">{r.title}</Td>
                    <Td>{r.due.tone ? <Chip tone={r.due.tone}>{r.due.label}</Chip> : r.due.label}</Td>
                  </tr>
                ))}
                {cow.care.reminders.length === 0 && (
                  <tr>
                    <Td colSpan={2} className="!py-3 !text-[12px] text-muted">Không có nhắc việc.</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Panel>
        </div>
      </div>
      <Foot>
        Hồ sơ cá thể là nguồn duy nhất cho mọi tab chăm sóc; mã nội bộ không đổi, mã hiển thị dùng để tra cứu và in thẻ.
      </Foot>
    </>
  )
}
