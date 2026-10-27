import { Button, Foot, Table } from '../../components/ui'
import { Chip, Fields, Panel, Td, Th } from './parts'

const QR_TONE = { ACTIVE: 'ok', REPLACED: 'grey', REVOKED: 'err' }

export default function QrTab({ cow, onOpenModal }) {
  const cur = cow.qrHistory.find((q) => q.status === 'ACTIVE') || cow.qrHistory[0]
  return (
    <>
      <Panel
        title="Thẻ hiện hành"
        gap="gap-4"
        action={cow.status === 'ACTIVE' && <Button className="leading-[normal]" onClick={() => onOpenModal('qr-reissue')}>Cấp lại QR</Button>}
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="size-[120px] shrink-0 rounded-md border border-edge bg-[#eef4ef]" aria-hidden="true" />
          <Fields
            className="w-full max-w-[600px]"
            cols="grid-cols-1 sm:grid-cols-2"
            items={[
              ['Mã thẻ', cur.code],
              ['Trạng thái', <Chip key="s" tone="ok">ACTIVE</Chip>],
              ['Mã hiển thị in trên thẻ', cow.code],
              ['Cấp lúc', `${cur.from} · ${cur.by}`],
            ]}
          />
        </div>
      </Panel>
      <Panel title="Lịch sử thẻ" gap="gap-3">
        <Table>
          <thead>
            <tr>
              <Th className="w-[180px]">Mã thẻ</Th>
              <Th className="w-[130px]">Trạng thái</Th>
              <Th className="w-[140px]">Cấp lúc</Th>
              <Th className="w-[140px]">Kết thúc</Th>
              <Th className="w-[260px]">Lý do</Th>
              <Th className="w-[160px]">Người thực hiện</Th>
            </tr>
          </thead>
          <tbody>
            {cow.qrHistory.map((q) => (
              <tr key={q.code + q.status}>
                <Td className="font-medium">{q.code}</Td>
                <Td><Chip tone={QR_TONE[q.status]}>{q.status}</Chip></Td>
                <Td>{q.from}</Td>
                <Td>{q.to}</Td>
                <Td>{q.reason}</Td>
                <Td>{q.by}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Foot>Mỗi bò chỉ có một thẻ ACTIVE. Quét thẻ chỉ mở được hồ sơ khi người quét là thành viên của trại.</Foot>
    </>
  )
}
