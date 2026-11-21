import { Field, Foot, Note, Table, Td, Textarea, Th } from '../../../shared/ui'
import { useCatalogueItemPage } from '../hooks/useCatalogueItemPage'
import { CatalogueList, SelectableRow } from '../components/CatalogueList'
import { DeactivateDialog } from '../components/ConfirmDialogs'
import { EditorEmpty, EditorFooter, EditorPanel } from '../components/EditorPanel'
import { AvailabilityBadge, StatusField, TextInput, fieldError } from '../components/fields'
import { AddButton, SavedNotice, SplitLayout, SubLine } from '../components/PageParts'
import { CODE_HINT } from '../domain/catalogueRules'
import type { Breed } from '../types'

interface BreedDraft { code: string; name: string; group: string; description: string; available: boolean }
const newDraft = (): BreedDraft => ({ code: '', name: '', group: '', description: '', available: true })
const toDraft = (b: Breed): BreedDraft => ({ code: b.code, name: b.name, group: b.group, description: b.description, available: b.available })

export default function BreedsPage() {
  const page = useCatalogueItemPage<Breed, BreedDraft>((catalogueApi) => ({
    list: catalogueApi.listBreeds,
    newDraft,
    toDraft,
    usage: (b) => b.activeCattle,
    save: (item, d) => catalogueApi.saveBreed(item?.id ?? null, { ...d, ...(item ? { expectedVersion: item.version } : {}) }),
  }))
  const { draft, item, errors } = page
  const locked = !page.isCreate && Boolean(item?.referenced)
  const canEdit = page.canEdit
  const readOnly = !canEdit

  return (
    <>
      {canEdit && <AddButton label="Thêm giống" onClick={page.startCreate} />}
      <SavedNotice text={page.notice} />
      <SplitLayout>
        <CatalogueList q={page.q} onQ={page.setQ} status={page.status} onStatus={page.setStatus} rows={page.data} error={page.error} onRetry={page.refetch} errorText="Không tải được danh mục giống bò." emptyTitle="Không có giống nào phù hợp">
          <Table stack={false}>
            <thead><tr><Th className="w-[118px]">Mã</Th><Th>Tên giống</Th><Th className="w-[84px]">Nhóm</Th><Th className="w-[74px]">Đang nuôi</Th><Th className="w-[104px]">Trạng thái</Th></tr></thead>
            <tbody>
              {(page.data ?? []).map((b) => (
                <SelectableRow key={b.id} selected={item?.id === b.id} muted={!b.available} onSelect={() => page.select(b)}>
                  <Td className="font-medium">{b.code}</Td>
                  <Td><div className="font-medium">{b.name}</div>{b.description && <SubLine>{b.description}</SubLine>}</Td>
                  <Td>{b.group}</Td>
                  <Td>{b.activeCattle}</Td>
                  <Td><AvailabilityBadge available={b.available} /></Td>
                </SelectableRow>
              ))}
            </tbody>
          </Table>
        </CatalogueList>

        {!draft ? (
          <EditorEmpty text="Chọn một giống trong danh sách để xem." />
        ) : (
          <EditorPanel
            title={page.isCreate ? 'Thêm giống' : `${canEdit ? 'Sửa giống' : 'Giống'}: ${item!.name}`}
            sub={page.isCreate ? 'Mã giống không sửa được sau khi đã có bò dùng' : 'Sửa không ghi đè các sự kiện đã ghi trước đây'}
            error={page.formError}
            onSubmit={page.submit}
            footer={canEdit && <EditorFooter onCancel={page.cancel} saving={page.saving} create={page.isCreate} />}
          >
            <Field label="Mã giống *" id="breed-code" hint={fieldError(errors.code, locked ? 'Không sửa được khi đã có bò dùng giống này' : CODE_HINT)}>
              <TextInput id="breed-code" upper value={draft.code} readOnly={readOnly || locked} invalid={Boolean(errors.code)} onChange={(v) => page.setField('code', v)} />
            </Field>
            <Field label="Tên giống *" id="breed-name" hint={fieldError(errors.name)}>
              <TextInput id="breed-name" value={draft.name} readOnly={readOnly} invalid={Boolean(errors.name)} onChange={(v) => page.setField('name', v)} />
            </Field>
            <Field label="Nhóm" id="breed-group" hint={fieldError(errors.group, 'Ví dụ: Zebu, Lai, Nội')}>
              <TextInput id="breed-group" value={draft.group} readOnly={readOnly} invalid={Boolean(errors.group)} onChange={(v) => page.setField('group', v)} />
            </Field>
            <Field label="Mô tả" id="breed-description" hint={fieldError(errors.description, 'Tối đa 500 ký tự')}>
              <Textarea id="breed-description" rows={3} value={draft.description} readOnly={readOnly} onChange={(e) => page.setField('description', e.target.value)} />
            </Field>
            <StatusField value={draft.available} readOnly={readOnly} onChange={(v) => page.setField('available', v)} />
            {locked && item && (
              <Note tone="warn">
                {item.activeCattle > 0
                  ? `${item.activeCattle} con đang dùng giống này: chỉ có thể ngừng dùng cho bản ghi mới.`
                  : 'Giống này đã có bản ghi sử dụng: chỉ có thể ngừng dùng, không xóa.'}
              </Note>
            )}
          </EditorPanel>
        )}
      </SplitLayout>
      <Foot>Danh mục giống bò của trại. Mọi thành viên xem được; Chủ trại và Quản lý thêm, sửa, ngừng dùng. Mã 2–20 ký tự in hoa, số và "-", không trùng trong trại. "Đang nuôi" đếm bò đang hoạt động của giống.</Foot>
      {page.confirmOpen && item && (
        <DeactivateDialog name={item.name} count={item.activeCattle} busy={page.saving} onCancel={page.closeModal} onConfirm={page.confirmDeactivate} />
      )}
    </>
  )
}
