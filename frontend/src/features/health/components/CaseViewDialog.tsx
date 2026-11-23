import { Badge, ErrorBlock, LoadingBlock, Modal, ModalButton, ModalFooter } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useHealthProfile } from '../hooks/useHealthProfile'
import { caseLabel, fmtDate, fmtDateTime, OUTCOME_LABEL } from '../domain/healthFormat'
import { latestWithdrawalEnd } from '../domain/healthRules'
import type { HealthCaseCard, HealthTimelineRow } from '../types'
import { TimelineRow } from './CaseCard'
import { Meta, SeverityBadge } from './healthUi'

/**
 * Popup "Xem ca" cho ca đã đóng: tóm tắt ca, thuốc đã dùng và toàn bộ diễn biến (chỉ xem). Danh sách hồ sơ không kèm
 * diễn biến của ca đã đóng, nên popup tải lại hồ sơ với {@code historyCaseId} của ca này. Ca mở lại được thì nút
 * "Mở lại ca" dẫn sang popup lý do (D62).
 */
export default function CaseViewDialog({ cattleCode, caseId, onClose, onReopen }: { cattleCode: string; caseId: number; onClose: () => void; onReopen?: () => void }) {
  const { data: profile, loading, error, refetch } = useHealthProfile(cattleCode, String(caseId))
  const card = profile?.previousCases.find((c) => c.id === caseId)
  const rows = profile ? profile.timeline.filter((r) => r.caseId === caseId) : []
  if (!card) {
    return (
      <Modal title="Xem ca" width={700} onClose={onClose}>
        {loading || !error ? <LoadingBlock /> : <ErrorBlock message={userFacingError(error, 'Không tải được ca sức khỏe.')} onRetry={refetch} />}
      </Modal>
    )
  }
  return <CaseView card={card} rows={rows} onClose={onClose} onReopen={onReopen} />
}

function CaseView({ card, rows, onClose, onReopen }: { card: HealthCaseCard; rows: HealthTimelineRow[]; onClose: () => void; onReopen?: () => void }) {
  const treatments = rows.filter((r) => r.type === 'TREATMENT' && r.status === 'VALID')
  const lost = card.outcome === 'DIED' || card.outcome === 'MISSING'
  return (
    <Modal title={`Ca ${card.caseCode} · ${caseLabel(card)}`} sub={`Mở ${fmtDate(card.openedDate)} · đóng ${fmtDate(card.closedAt?.slice(0, 10) ?? '')}`} width={700} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-page p-3 sm:grid-cols-3">
        <Meta label="Kết quả">{card.outcome ? <Badge tone={card.outcome === 'RECOVERED' ? 'ok' : lost ? 'err' : 'outline'}>{OUTCOME_LABEL[card.outcome]}</Badge> : '—'}</Meta>
        <Meta label="Mức độ"><SeverityBadge severity={card.severity} /></Meta>
        <Meta label="Người xác nhận đóng">{card.closedBy || '—'}</Meta>
        <Meta label="Số lần điều trị">{treatments.length}</Meta>
        <Meta label="Ngưng thịt đến">{fmtDate(latestWithdrawalEnd(rows))}</Meta>
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-ink">Thuốc đã dùng</h3>
        {treatments.length === 0 ? <p className="m-0 text-xs text-muted">Ca này không ghi điều trị.</p> : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {treatments.map((t) => <li key={t.id} className="text-[13px] text-ink"><span className="font-medium">{fmtDateTime(t.occurredAt)}</span> · {t.details}</li>)}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-ink">Diễn biến &amp; điều trị ({rows.length})</h3>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {rows.map((r, i) => <TimelineRow key={r.id} row={r} first={i === 0} canEdit={false} onEdit={() => undefined} />)}
        </ul>
      </section>
      <ModalFooter>
        <ModalButton onClick={onClose}>Đóng</ModalButton>
        {onReopen && <ModalButton variant="primary" onClick={onReopen}>Mở lại ca</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}
