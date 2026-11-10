import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Checkbox, KV, Table, Td, Th } from '../../../components/ui'
import { criteriaOf, criteriaRows, dmy, situationText } from '../domain/penRules'
import { Box, TH } from './parts'
import { penName } from './BarnTable'
import type { PenCattle, PenDetail } from '../api/penApi'
import type { Pen } from '../../../types'

/** Pen detail of SCR-17 (fields 10–15). Write actions are shown to Owner and Manager only (§2, TC-04-24). */
export default function BarnPanel({ barn, detail, loading = false, canManage = true, onEdit, onToggle, onMove, onViewAll }: { barn: Pen; detail?: PenDetail | null; loading?: boolean; canManage?: boolean; onEdit: () => void; onToggle: () => void; onMove: (cattle: PenCattle[]) => void; onViewAll?: () => void }) {
  const active = barn.status === 'ACTIVE'
  const shown = detail ?? barn
  const cattle = detail?.cattleInPen ?? []
  const [selected, setSelected] = useState<string[]>([])
  const rows = criteriaRows(criteriaOf(shown))
  const versionNo = shown.criteriaVersionNo
  const versionText = versionNo != null
    ? `v${versionNo}${shown.criteriaEffectiveFrom ? ` · hiệu lực từ ${dmy(shown.criteriaEffectiveFrom)}` : ''}`
    : typeof shown.version === 'string' && !shown.lockVersion ? shown.version : ''
  const toggle = (code: string, on: boolean) => setSelected((current) => (on ? [...current, code] : current.filter((c) => c !== code)))
  const chosen = cattle.filter((c) => selected.includes(c.code))

  return (
    <Box>
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-[#212121]">{barn.code} – {penName(barn)}</h3>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button onClick={onEdit}><Icon name="edit" size={14} />Sửa</Button>
            <Button onClick={onToggle}><Icon name={active ? 'player-pause' : 'refresh'} size={14} />{active ? 'Ngưng sử dụng' : 'Dùng lại'}</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <KV k="Sức chứa">{barn.capacity}</KV>
        <KV k="Số con">{barn.count}</KV>
        <KV k="Chỗ trống">{Math.max(0, barn.capacity - barn.count)}</KV>
        <KV k="Trạng thái">
          {active ? <Badge tone="ok" icon="circle-check" className="!border-0">Đang hoạt động</Badge> : <Badge>Ngừng hoạt động</Badge>}
        </KV>
      </div>

      {barn.desc?.trim() && (
        <div>
          <KV k="Mô tả">{barn.desc.trim()}</KV>
        </div>
      )}

      <div>
        <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Tiêu chí nhận bò{versionText ? ` · ${versionText}` : ''}</h4>
        {rows.length === 0 ? (
          <p className="mb-0 mt-2 text-sm text-muted">Không có tiêu chí: chuồng nhận mọi bò.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {rows.map(([label, value]) => <KV key={label} k={label}>{value}</KV>)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="m-0 text-[13px] font-semibold text-[#212121]">Bò trong chuồng</h4>
          {canManage && cattle.length > 0 && (
            <Button small disabled={chosen.length === 0} onClick={() => onMove(chosen)}>
              <Icon name="arrows-exchange" size={14} />Chuyển các con đã chọn{chosen.length ? ` (${chosen.length})` : ''}
            </Button>
          )}
        </div>
        <Table stack={false}>
          <thead>
            <tr>
              {canManage && <Th className={`${TH} w-[36px] bg-[#f0f0f0]`} />}
              <Th className={`${TH} w-[140px] bg-[#f0f0f0]`}>Bò</Th>
              <Th className={`${TH} bg-[#f0f0f0]`}>Tình trạng</Th>
            </tr>
          </thead>
          <tbody>
            {cattle.length === 0 && (
              <tr>
                <Td colSpan={canManage ? 3 : 2} className={`${TH} text-muted`}>{loading ? 'Đang tải…' : 'Chuồng chưa có bò'}</Td>
              </tr>
            )}
            {cattle.map((c) => (
              <tr key={c.code}>
                {canManage && (
                  <Td className={TH}>
                    <Checkbox aria-label={`Chọn ${c.code}`} checked={selected.includes(c.code)} onChange={(e) => toggle(c.code, e.target.checked)} />
                  </Td>
                )}
                <Td className={`${TH} font-medium`}>{c.code}</Td>
                <Td className={TH}>{c.situation || situationText(c.hints, c.exitPending)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {barn.count > 0 && onViewAll && (
          <Button variant="link" small className="self-start" onClick={onViewAll}>Xem tất cả {barn.count} con →</Button>
        )}
      </div>
    </Box>
  )
}
