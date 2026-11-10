import { useState } from 'react'
import { Field, Foot, Note, Select, Table, Td, Textarea, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useCatalogueApi } from '../api/useCatalogueApi'
import { CatalogueList, SelectableRow } from '../components/CatalogueList'
import { DeactivateDialog } from '../components/ConfirmDialogs'
import { EditorEmpty, EditorFooter, EditorPanel } from '../components/EditorPanel'
import { AvailabilityBadge, StatusField, TextInput, fieldError } from '../components/fields'
import { AddButton, SavedNotice, SplitLayout } from '../components/PageParts'
import { useCanEdit } from '../components/useCanEdit'
import { useCatalogueEditor } from '../components/useCatalogueEditor'
import { CODE_HINT, PURPOSE_TYPES, PURPOSE_TYPE_LABELS, purposeUsage } from '../domain/catalogueRules'
import type { AvailabilityFilter, Purpose, PurposeType } from '../types'

interface PurposeDraft { code: string; name: string; purposeType: PurposeType; description: string; available: boolean }
const newDraft = (): PurposeDraft => ({ code: '', name: '', purposeType: 'UNDECIDED', description: '', available: true })
const toDraft = (p: Purpose): PurposeDraft => ({ code: p.code, name: p.name, purposeType: p.purposeType, description: p.description, available: p.available })

export default function PurposesPage() {
  const catalogueApi = useCatalogueApi()
  const canEdit = useCanEdit()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AvailabilityFilter>('')
  const list = useQuery(() => catalogueApi.listPurposes({ q, status }), [q, status])
  const ed = useCatalogueEditor<Purpose, PurposeDraft>({
    items: list.data, canEdit, newDraft, toDraft, refetch: list.refetch, usage: purposeUsage,
    save: (item, d) => catalogueApi.savePurpose(item?.id ?? null, { ...d, ...(item ? { expectedVersion: item.version } : {}) }),
  })
  const { draft, item, errors } = ed
  const locked = !ed.isCreate && Boolean(item?.referenced)
  const readOnly = !canEdit

  return (
    <>
      {canEdit && <AddButton label="Thêm mục đích" onClick={ed.startCreate} />}
      <SavedNotice text={ed.notice} />
      <SplitLayout>
        <CatalogueList q={q} onQ={setQ} status={status} onStatus={setStatus} rows={list.data} error={list.error} onRetry={list.refetch} errorText="Không tải được danh mục mục đích nuôi." emptyTitle="Không có mục đích nào phù hợp">
          <Table stack={false}>
            <thead><tr><Th>Mã</Th><Th>Tên mục đích</Th><Th>Loại</Th><Th>Đang nuôi</Th><Th>Chuồng tiếp nhận</Th><Th>Trạng thái</Th></tr></thead>
            <tbody>
              {(list.data ?? []).map((p) => (
                <SelectableRow key={p.id} selected={item?.id === p.id} muted={!p.available} onSelect={() => ed.select(p)}>
                  <Td className="font-medium">{p.code}</Td>
                  <Td>{p.name}</Td>
                  <Td>{PURPOSE_TYPE_LABELS[p.purposeType]}</Td>
                  <Td>{p.activeCattle}</Td>
                  <Td>{p.receivingPens.length ? p.receivingPens.map((pen) => pen.code).join(', ') : '—'}</Td>
                  <Td><AvailabilityBadge available={p.available} /></Td>
                </SelectableRow>
              ))}
            </tbody>
          </Table>
        </CatalogueList>

        {!draft ? (
          <EditorEmpty text="Chọn một mục đích trong danh sách để xem." />
        ) : (
          <EditorPanel
            title={ed.isCreate ? 'Thêm mục đích' : `${canEdit ? 'Sửa mục đích' : 'Mục đích'}: ${item!.name}`}
            sub="Loại mục đích quyết định nhóm đàn và việc theo dõi sinh sản"
            error={ed.formError}
            onSubmit={ed.submit}
            footer={canEdit && <EditorFooter onCancel={ed.cancel} saving={ed.saving} create={ed.isCreate} />}
          >
            <Field label="Mã *" id="purpose-code" hint={fieldError(errors.code, locked ? 'Không sửa được khi đã có bò dùng' : CODE_HINT)}>
              <TextInput id="purpose-code" upper value={draft.code} readOnly={readOnly || locked} invalid={Boolean(errors.code)} onChange={(v) => ed.setField('code', v)} />
            </Field>
            <Field label="Tên mục đích *" id="purpose-name" hint={fieldError(errors.name)}>
              <TextInput id="purpose-name" value={draft.name} readOnly={readOnly} invalid={Boolean(errors.name)} onChange={(v) => ed.setField('name', v)} />
            </Field>
            <Field label="Loại mục đích *" id="purpose-type" hint={fieldError(errors.purposeType, locked ? 'Không đổi được khi đã có bò dùng' : undefined)}>
              <Select id="purpose-type" value={draft.purposeType} disabled={readOnly || locked} onChange={(e) => ed.setField('purposeType', e.target.value as PurposeType)}>
                {PURPOSE_TYPES.map((t) => <option key={t} value={t}>{PURPOSE_TYPE_LABELS[t]}</option>)}
              </Select>
            </Field>
            <Field label="Mô tả" id="purpose-description" hint={fieldError(errors.description, 'Tối đa 500 ký tự')}>
              <Textarea id="purpose-description" rows={2} value={draft.description} readOnly={readOnly} onChange={(e) => ed.setField('description', e.target.value)} />
            </Field>
            <StatusField label="Trạng thái" value={draft.available} readOnly={readOnly} onChange={(v) => ed.setField('available', v)} />
            {!ed.isCreate && item && item.activeCattle > 0 && (
              <Note tone="info">
                Ngừng dùng chỉ chặn chọn mới; {item.activeCattle} con hiện có giữ nguyên mục đích. Đổi mục đích từng con do Chủ trại làm ở "Cập nhật hồ sơ bò".
              </Note>
            )}
          </EditorPanel>
        )}
      </SplitLayout>
      <Foot>Danh mục mục đích nuôi. Loại mục đích (Sinh sản, Vỗ béo, Đực giống, Chưa xác định) quyết định nhóm đàn và bò cái nào vào danh sách theo dõi sinh sản. "Chuồng tiếp nhận" là các chuồng có tiêu chí nhận loại này.</Foot>
      {ed.confirmOpen && item && (
        <DeactivateDialog name={item.name} count={purposeUsage(item)} busy={ed.saving} onCancel={ed.closeModal} onConfirm={ed.confirmDeactivate} />
      )}
    </>
  )
}
