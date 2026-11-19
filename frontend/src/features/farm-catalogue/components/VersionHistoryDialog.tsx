import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, LoadingBlock, Table, Td, Th } from '../../../components/ui'
import { formatDate } from '../domain/catalogueRules'
import type { ParameterVersion } from '../types'

function VersionLabel({ version }: { version: ParameterVersion }) {
  if (version.status === 'CURRENT') return <Badge tone="ok">{`v${version.versionNo} · hiện tại`}</Badge>
  if (version.status === 'SCHEDULED') return <Badge tone="info">{`v${version.versionNo} · theo lịch`}</Badge>
  return <span className="font-medium">{`v${version.versionNo}`}</span>
}

/** Lịch sử phiên bản tham số: chỉ xem (AF2). */
export function VersionHistoryDialog({ versions, onClose }: { versions: ParameterVersion[] | null | undefined; onClose: () => void }) {
  return (
    <Modal title="Lịch sử phiên bản" sub={`Tham số trạng thái & nhắc việc · ${versions?.length ?? 0} phiên bản`} width={760} onClose={onClose}>
      {!versions ? (
        <LoadingBlock />
      ) : (
        <Table>
          <thead><tr><Th>Phiên bản</Th><Th>Áp dụng từ</Th><Th>Thay đổi</Th><Th>Người lưu</Th><Th>Nguồn</Th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <Td><VersionLabel version={v} /></Td>
                <Td>{formatDate(v.effectiveFrom)}</Td>
                <Td>{v.changes}</Td>
                <Td>{v.savedBy}</Td>
                <Td>{v.sourceNote}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <ModalFooter>
        <ModalButton onClick={onClose}>Đóng</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
