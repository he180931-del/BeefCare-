import { Button, Foot, Icon, Table } from '../../../shared/ui'
import { Chip, Fields, Panel, Td, Th } from './parts'
import type { CattleViewModel as CowSeed } from '../types'
import type { Tone } from '../types'
import QrTagLabel from './QrTagLabel'
import { QR_STATUS_LABELS } from '../domain/profileRules'

const QR_TONE: Record<string, Tone> = { ACTIVE: 'ok', REPLACED: 'grey', RETIRED: 'err' }
const statusLabel = (status: string) => QR_STATUS_LABELS[status] ?? status

export default function QrTab({ cow, canWrite, onOpenModal }: { cow: CowSeed; canWrite: boolean; onOpenModal: (name: string) => void }) {
  const active = cow.qrHistory.find((q) => q.status === 'ACTIVE')
  return (
    <>
      <Panel
        tone="ok"
        title="Thẻ hiện hành"
        gap="gap-4"
        action={canWrite && <Button className="gap-1.5 leading-[normal]" onClick={() => onOpenModal('qr-reissue')}><Icon name="qrcode" />{active ? 'Thay thẻ' : 'Cấp thẻ'}</Button>}
      >
        <div className="flex flex-wrap items-center gap-6">
          {active ? <QrTagLabel cowCode={cow.code} tagCode={active.code} canExport={canWrite} /> : <p className="m-0 text-sm text-muted">Bò chưa có thẻ hiện hành.</p>}
          <Fields
            className="w-full max-w-[600px]"
            cols="grid-cols-1 sm:grid-cols-2"
            items={[
              ['Mã thẻ', active?.code ?? '—'],
              ['Trạng thái', active ? <Chip key="s" tone="ok" icon="circle-check">{statusLabel('ACTIVE')}</Chip> : '—'],
              ['Mã hiển thị in trên thẻ', cow.code],
              ['Cấp lúc', active ? `${active.from} · ${active.by}` : '—'],
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
              <Th>Ghi chú</Th>
            </tr>
          </thead>
          <tbody>
            {cow.qrHistory.map((q) => (
              <tr key={q.code + q.status}>
                <Td className="font-medium">{q.code}</Td>
                <Td><Chip tone={QR_TONE[q.status] ?? 'grey'}>{statusLabel(q.status)}</Chip></Td>
                <Td>{q.from}</Td>
                <Td>{q.to}</Td>
                <Td>{q.reason}</Td>
                <Td>{q.by}</Td>
                <Td>{q.note || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
      <Foot>Mỗi bò chỉ có một thẻ đang dùng. Quét thẻ chỉ mở được hồ sơ khi người quét là thành viên của trại.</Foot>
    </>
  )
}
