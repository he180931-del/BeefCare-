import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, Button, Card, Table, Td, Th } from '../../../components/ui'
import { formatFull, formatTime, ROLE_LABEL } from '../domain/format'
import type { AnnouncementView } from '../types'
import { RichText } from './shared'

export function AnnouncementDetail({ a, onHistory }: { a: AnnouncementView; onHistory: () => void }) {
  const navigate = useNavigate()
  const published = a.state === 'PUBLISHED'
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-semibold text-[#212121]">{a.title}</h2>
            <p className="m-0 mt-1 text-[11px] text-muted">
              {published
                ? `${a.authorName} · ${ROLE_LABEL[a.authorRole]} · đăng ${formatFull(a.publishedTime!)} · phiên bản ${a.version}`
                : `${a.authorName} · ${ROLE_LABEL[a.authorRole]} · bản nháp, chưa gửi cho ai`}
            </p>
          </div>
          {published ? <Badge tone="ok" icon="circle-check">Đã đăng</Badge> : <Badge tone="outline">Bản nháp</Badge>}
        </div>
        <RichText text={a.body} />
        <div className="flex flex-wrap items-center gap-2">
          {a.canCorrect && <Button onClick={() => navigate(`/thong-bao/${a.id}/dinh-chinh`)}><Icon name="pencil" size={16} /> Đính chính</Button>}
          {!published && a.isAuthor && <Button onClick={() => navigate(`/thong-bao/moi?nhap=${a.id}`)}><Icon name="pencil" size={16} /> Sửa bản nháp</Button>}
          {published && a.relatedLink && <Button onClick={() => navigate(a.relatedLink!.to)}>{a.relatedLink.label}</Button>}
          {published && <Button variant="link" size="sm" onClick={onHistory}><Icon name="history" size={16} /> Lịch sử phiên bản →</Button>}
        </div>
        {a.deliveries && (
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold text-[#212121]">Tình trạng nhận</h3>
            <Table stack={false}>
              <thead><tr><Th>Người nhận</Th><Th>Vai trò</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {a.deliveries.map((d) => (
                  <tr key={d.recipientId}>
                    <Td className="font-medium">{d.name}</Td>
                    <Td>{ROLE_LABEL[d.role]}</Td>
                    <Td>{d.status === 'READ' ? <Badge tone="ok">{`Đã đọc ${formatTime(d.readTime!)}`}</Badge> : <Badge tone="outline">Đã gửi</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  )
}

export function HistoryModal({ a, onClose }: { a: AnnouncementView; onClose: () => void }) {
  return (
    <Modal title="Lịch sử phiên bản" sub={a.title} width={640} onClose={onClose}>
      <Table stack={false}>
        <thead><tr><Th>Bản</Th><Th>Thời điểm</Th><Th>Người</Th><Th>Lý do đính chính</Th></tr></thead>
        <tbody>
          {[...a.versions].reverse().map((v) => (
            <tr key={v.id}>
              <Td className="font-medium">{`v${v.versionNo}`}</Td>
              <Td>{formatFull(v.publishedTime)}</Td>
              <Td>{a.authorName}</Td>
              <Td>{v.correctionReason ?? '—'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <ModalFooter><ModalButton onClick={onClose}>Đóng</ModalButton></ModalFooter>
    </Modal>
  )
}
