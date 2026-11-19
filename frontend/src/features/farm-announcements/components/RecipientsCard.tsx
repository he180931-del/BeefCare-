import { Badge, Card, Checkbox, Field, Select } from '../../../components/ui'
import { ROLE_LABEL } from '../domain/format'
import type { AudienceSelection, Member, MemberOptions, Viewer } from '../types'

export type EditorAudience = AudienceSelection & { namedOpen: boolean }

export default function RecipientsCard({ viewer, options, audience, resolved, error, onChange }: {
  viewer: Viewer
  options: MemberOptions
  audience: EditorAudience
  resolved: Member[]
  error: string
  onChange: (next: EditorAudience) => void
}) {
  const owner = viewer.role === 'OWNER'
  const named = audience.memberIds.length > 0 || audience.namedOpen
  const available = options.members.filter((m) => !audience.memberIds.includes(m.id))
  return (
    <Card title="Người nhận">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <Checkbox checked={audience.allManagers} disabled={!owner} onChange={(e) => onChange({ ...audience, allManagers: e.target.checked })}>
            {`Tất cả Quản lý (${options.managerCount}) · chỉ Chủ trại`}
          </Checkbox>
          <Checkbox checked={audience.allTechnicians} onChange={(e) => onChange({ ...audience, allTechnicians: e.target.checked })}>
            {`Tất cả Kỹ thuật viên (${options.technicianCount})`}
          </Checkbox>
          <Checkbox checked={named} onChange={(e) => onChange({ ...audience, namedOpen: e.target.checked, memberIds: e.target.checked ? audience.memberIds : [] })}>
            Chọn từng người
          </Checkbox>
        </div>
        {named && (
          <Field label="Chọn thành viên" id="member-picker">
            <Select id="member-picker" value="" onChange={(e) => e.target.value && onChange({ ...audience, memberIds: [...audience.memberIds, Number(e.target.value)] })}>
              <option value="">Chọn thành viên đang hoạt động…</option>
              {available.map((m) => <option key={m.id} value={m.id}>{`${m.name} · ${ROLE_LABEL[m.role]}`}</option>)}
            </Select>
          </Field>
        )}
        {error && <p role="alert" className="m-0 text-xs text-err-fg">{error}</p>}
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-[#212121]">{`Người nhận đã xác định (${resolved.length})`}</h3>
          {resolved.length === 0 && <p className="m-0 text-xs text-muted">Chưa có người nhận. Hãy chọn nhóm hoặc từng thành viên.</p>}
          {resolved.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-edge px-3 py-2">
              <div>
                <div className="text-[13px] font-semibold text-[#212121]">{m.name}</div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[m.role]}</div>
              </div>
              <Badge tone="ok" icon="circle-check">Đang hoạt động</Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
