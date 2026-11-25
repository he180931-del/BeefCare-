import { DoseInput, Field, Foot, Note, Select, Table, Td, Textarea, Th } from '../../../shared/ui'
import { DOSE_FORMAT_MESSAGE, isStandardDose, joinDose, splitDose, type DoseUnit } from '../../../shared/lib/dose'
import { useCatalogueItemPage } from '../hooks/useCatalogueItemPage'
import { CatalogueList, SelectableRow } from '../components/CatalogueList'
import { DeactivateDialog } from '../components/ConfirmDialogs'
import { EditorEmpty, EditorFooter, EditorPanel, PairGrid } from '../components/EditorPanel'
import { AvailabilityBadge, StatusField, TextInput, UnitInput, fieldError } from '../components/fields'
import { AddButton, SavedNotice, SplitLayout } from '../components/PageParts'
import { CODE_HINT, FieldErrors, MEDICINE_ROUTES, ROUTE_LABELS, numberToText, parseNumber } from '../domain/catalogueRules'
import type { Medicine, Route } from '../types'

/**
 * D65: liều tham chiếu nhập số + đơn vị như khi ghi điều trị. Liều cũ không theo chuẩn (`legacyDose`) được giữ nguyên nếu
 * người dùng không nhập lại, để sửa các trường khác không làm mất dữ liệu.
 */
interface MedicineDraft { code: string; name: string; doseAmount: string; doseUnit: DoseUnit; legacyDose: string; route: Route | ''; withdrawalDays: string; description: string; available: boolean }
const newDraft = (): MedicineDraft => ({ code: '', name: '', doseAmount: '', doseUnit: 'ml', legacyDose: '', route: '', withdrawalDays: '', description: '', available: true })
const toDraft = (m: Medicine): MedicineDraft => {
  const dose = splitDose(m.dose)
  return {
    code: m.code, name: m.name, doseAmount: dose.amount, doseUnit: dose.unit, legacyDose: dose.legacy ? m.dose : '', route: m.route,
    withdrawalDays: numberToText(m.withdrawalDays), description: m.description, available: m.available,
  }
}
const doseOf = (d: MedicineDraft) => joinDose(d.doseAmount, d.doseUnit) || d.legacyDose

export default function MedicinesPage() {
  const page = useCatalogueItemPage<Medicine, MedicineDraft>((catalogueApi) => ({
    list: catalogueApi.listMedicines,
    newDraft,
    toDraft,
    usage: (m) => m.usageCount,
    save: async (item, d) => {
      const dose = doseOf(d)
      if (dose && dose !== d.legacyDose && !isStandardDose(dose)) throw new FieldErrors({ dose: DOSE_FORMAT_MESSAGE })
      const { doseAmount: _amount, doseUnit: _unit, legacyDose: _legacy, ...rest } = d
      return catalogueApi.saveMedicine(item?.id ?? null, {
        ...rest, dose, withdrawalDays: parseNumber(d.withdrawalDays), ...(item ? { expectedVersion: item.version } : {}),
      })
    },
  }))
  const { draft, item, errors } = page
  const locked = !page.isCreate && (item?.usageCount ?? 0) > 0
  const canEdit = page.canEdit
  const readOnly = !canEdit

  return (
    <>
      {canEdit && <AddButton label="Thêm thuốc" onClick={page.startCreate} />}
      <SavedNotice text={page.notice} />
      <SplitLayout>
        <CatalogueList q={page.q} onQ={page.setQ} status={page.status} onStatus={page.setStatus} rows={page.data} error={page.error} onRetry={page.refetch} errorText="Không tải được danh mục thuốc." emptyTitle="Không có thuốc nào phù hợp">
          <Table stack={false}>
            <thead><tr><Th>Mã</Th><Th>Tên thuốc</Th><Th>Liều tham chiếu</Th><Th>Đường dùng</Th><Th>Ngưng thịt</Th><Th>Trạng thái</Th></tr></thead>
            <tbody>
              {(page.data ?? []).map((m) => (
                <SelectableRow key={m.id} selected={item?.id === m.id} muted={!m.available} onSelect={() => page.select(m)}>
                  <Td className="whitespace-nowrap font-medium">{m.code}</Td>
                  <Td>{m.name}</Td>
                  <Td>{m.dose || '—'}</Td>
                  <Td>{m.route ? ROUTE_LABELS[m.route] : '—'}</Td>
                  <Td>{m.withdrawalDays} ngày</Td>
                  <Td><AvailabilityBadge available={m.available} /></Td>
                </SelectableRow>
              ))}
            </tbody>
          </Table>
        </CatalogueList>

        {!draft ? (
          <EditorEmpty text="Chọn một loại thuốc trong danh sách để xem." />
        ) : (
          <EditorPanel
            title={page.isCreate ? 'Thêm thuốc' : `${canEdit ? 'Sửa thuốc' : 'Thuốc'}: ${item!.name}`}
            sub="Thông tin tham chiếu, không phải kê đơn"
            error={page.formError}
            onSubmit={page.submit}
            footer={canEdit && <EditorFooter onCancel={page.cancel} saving={page.saving} create={page.isCreate} />}
          >
            <Field label="Mã *" id="medicine-code" hint={fieldError(errors.code, locked ? 'Không sửa được khi đã dùng' : CODE_HINT)}>
              <TextInput id="medicine-code" upper value={draft.code} readOnly={readOnly || locked} invalid={Boolean(errors.code)} onChange={(v) => page.setField('code', v)} />
            </Field>
            <Field label="Tên thuốc *" id="medicine-name" hint={fieldError(errors.name, 'Thuốc có nhiều dạng (tiêm / uống) nên tạo mỗi dạng một mục, vì liều và ngày ngưng thịt khác nhau')}>
              <TextInput id="medicine-name" value={draft.name} readOnly={readOnly} invalid={Boolean(errors.name)} onChange={(v) => page.setField('name', v)} />
            </Field>
            <PairGrid>
              <Field label="Liều tham chiếu" id="medicine-dose" hint={fieldError(errors.dose, draft.legacyDose && !draft.doseAmount ? `Đang lưu: "${draft.legacyDose}" – nhập lại theo số và đơn vị` : 'Mỗi lần dùng theo đường dùng bên cạnh; liều theo thể trọng ghi ở Ghi chú')}>
                <DoseInput id="medicine-dose" amount={draft.doseAmount} unit={draft.doseUnit} readOnly={readOnly} invalid={Boolean(errors.dose)} onAmount={(v) => page.setField('doseAmount', v)} onUnit={(v) => page.setField('doseUnit', v)} />
              </Field>
              <Field label="Đường dùng" id="medicine-route" hint={fieldError(errors.route)}>
                <Select id="medicine-route" value={draft.route} disabled={readOnly} onChange={(e) => page.setField('route', e.target.value as Route | '')}>
                  <option value="">Chưa chọn</option>
                  {MEDICINE_ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABELS[r]}</option>)}
                </Select>
              </Field>
            </PairGrid>
            <Field label="Ngưng sử dụng thịt *" id="medicine-withdrawal" hint={fieldError(errors.withdrawalDays, '0 – 365 · điền sẵn khi ghi điều trị')}>
              <UnitInput id="medicine-withdrawal" unit="ngày" value={draft.withdrawalDays} readOnly={readOnly} invalid={Boolean(errors.withdrawalDays)} onChange={(v) => page.setField('withdrawalDays', v)} />
            </Field>
            <Field label="Ghi chú" id="medicine-notes" hint={fieldError(errors.description, 'Tối đa 500 ký tự')}>
              <Textarea id="medicine-notes" rows={2} value={draft.description} readOnly={readOnly} onChange={(e) => page.setField('description', e.target.value)} />
            </Field>
            <StatusField label="Trạng thái" value={draft.available} readOnly={readOnly} onChange={(v) => page.setField('available', v)} />
            <Note tone="info">Không quản lý tồn kho thuốc. Mỗi lần điều trị vẫn ghi liều, đường dùng và ngày ngưng riêng.</Note>
          </EditorPanel>
        )}
      </SplitLayout>
      <Foot>Danh mục thuốc tham chiếu của trại. Dùng để điền sẵn khi ghi điều trị và tính ngày hết ngưng sử dụng thịt; không phải đơn thuốc và không theo dõi tồn kho.</Foot>
      {page.confirmOpen && item && (
        <DeactivateDialog name={item.name} count={item.usageCount} busy={page.saving} onCancel={page.closeModal} onConfirm={page.confirmDeactivate} />
      )}
    </>
  )
}
