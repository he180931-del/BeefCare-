import { useState } from 'react'
import { Button, Field, Foot, Select, Table, Td, Th } from '../../../shared/ui'
import { catalogueError } from '../api/catalogueError'
import { useCatalogueItemPage } from '../hooks/useCatalogueItemPage'
import { CatalogueList, SelectableRow } from '../components/CatalogueList'
import { DeactivateDialog, DeleteVaccineDialog } from '../components/ConfirmDialogs'
import { EditorEmpty, EditorFooter, EditorPanel, PairGrid } from '../components/EditorPanel'
import { AvailabilityBadge, StatusField, TextInput, UnitInput, fieldError } from '../components/fields'
import { AddButton, SavedNotice, SplitLayout } from '../components/PageParts'
import {
  CODE_HINT, ROUTE_LABELS, VACCINE_ROUTES, numberToText, parseNumber, vaccineDoseRoute, vaccineUsage, vaccineUsageLabel,
} from '../domain/catalogueRules'
import type { Route, Vaccine } from '../types'

interface VaccineDraft {
  code: string; name: string; diseasePrevented: string; manufacturer: string; dose: string; route: Route | ''
  boosterInterval: string; withdrawalDays: string; available: boolean
}
const newDraft = (): VaccineDraft => ({ code: '', name: '', diseasePrevented: '', manufacturer: '', dose: '', route: '', boosterInterval: '', withdrawalDays: '0', available: true })
const toDraft = (v: Vaccine): VaccineDraft => ({
  code: v.code, name: v.name, diseasePrevented: v.diseasePrevented, manufacturer: v.manufacturer, dose: v.dose, route: v.route,
  boosterInterval: numberToText(v.boosterInterval), withdrawalDays: numberToText(v.withdrawalDays), available: v.available,
})

export default function VaccinesPage() {
  const page = useCatalogueItemPage<Vaccine, VaccineDraft>((catalogueApi) => ({
    list: catalogueApi.listVaccines,
    newDraft,
    toDraft,
    usage: vaccineUsage,
    save: (item, d) => catalogueApi.saveVaccine(item?.id ?? null, {
      ...d, boosterInterval: parseNumber(d.boosterInterval), withdrawalDays: parseNumber(d.withdrawalDays) ?? 0,
      ...(item ? { expectedVersion: item.version } : {}),
    }),
    remove: (item) => catalogueApi.deleteVaccine(item),
  }))
  const { draft, item, errors } = page
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const locked = !page.isCreate && item !== null && vaccineUsage(item) > 0
  const canEdit = page.canEdit
  const readOnly = !canEdit

  async function removeVaccine() {
    if (!item) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (!page.remove) return
      await page.remove(item)
      page.closeModal()
      page.clear()
      page.refetch()
    } catch (error) {
      setDeleteError(catalogueError(error, 'Không xóa được vắc-xin. Vui lòng thử lại.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {canEdit && <AddButton label="Thêm vắc-xin" onClick={page.startCreate} />}
      <SavedNotice text={page.notice} />
      <SplitLayout>
        <CatalogueList q={page.q} onQ={page.setQ} status={page.status} onStatus={page.setStatus} rows={page.data} error={page.error} onRetry={page.refetch} errorText="Không tải được danh mục vắc-xin." emptyTitle="Không có vắc-xin nào phù hợp">
          <Table stack={false}>
            <thead><tr><Th className="w-[84px]">Mã</Th><Th>Tên vắc-xin</Th><Th>Phòng bệnh</Th><Th>Liều · đường</Th><Th className="w-[84px] whitespace-nowrap">Đang dùng</Th><Th>Trạng thái</Th></tr></thead>
            <tbody>
              {(page.data ?? []).map((v) => {
                const doseRoute = vaccineDoseRoute(v)
                return (
                  <SelectableRow key={v.id} selected={item?.id === v.id} muted={!v.available} onSelect={() => page.select(v)}>
                    <Td className="whitespace-nowrap font-medium">{v.code}</Td>
                    <Td>{v.name}</Td>
                    <Td>{v.diseasePrevented}</Td>
                    <Td><span className={doseRoute.needsLabel ? 'text-[#b26b00]' : undefined}>{doseRoute.text}</span></Td>
                    <Td className="whitespace-nowrap">{vaccineUsageLabel(v)}</Td>
                    <Td><AvailabilityBadge available={v.available} /></Td>
                  </SelectableRow>
                )
              })}
            </tbody>
          </Table>
        </CatalogueList>

        {!draft ? (
          <EditorEmpty text="Chọn một vắc-xin trong danh sách để xem." />
        ) : (
          <EditorPanel
            title={page.isCreate ? 'Thêm vắc-xin' : `${canEdit ? 'Sửa vắc-xin' : 'Vắc-xin'}: ${item!.name}`}
            sub="Các mũi đã tiêm giữ nguyên tên lúc tiêm"
            error={page.formError}
            onSubmit={page.submit}
            footer={canEdit && (
              <>
                <EditorFooter
                  onCancel={page.cancel}
                  saving={page.saving}
                  create={page.isCreate}
                  left={!page.isCreate && <Button type="button" className="mr-auto" onClick={() => { setDeleteError(null); page.openModal('xoa') }}>Xóa</Button>}
                />
                {!page.isCreate && <p className="m-0 basis-full text-[11px] text-muted">Chỉ xóa được vắc-xin chưa từng dùng; đã dùng thì chỉ ngừng dùng.</p>}
              </>
            )}
          >
            <PairGrid>
              <Field label="Mã *" id="vaccine-code" hint={fieldError(errors.code, locked ? 'Không sửa được khi đã dùng' : CODE_HINT)}>
              <TextInput id="vaccine-code" upper value={draft.code} readOnly={readOnly || locked} invalid={Boolean(errors.code)} onChange={(v) => page.setField('code', v)} />
              </Field>
              <Field label="Nhà sản xuất" id="vaccine-manufacturer" hint={fieldError(errors.manufacturer)}>
                <TextInput id="vaccine-manufacturer" value={draft.manufacturer} readOnly={readOnly} onChange={(v) => page.setField('manufacturer', v)} />
              </Field>
            </PairGrid>
            <Field label="Tên vắc-xin *" id="vaccine-name" hint={fieldError(errors.name)}>
              <TextInput id="vaccine-name" value={draft.name} readOnly={readOnly} invalid={Boolean(errors.name)} onChange={(v) => page.setField('name', v)} />
            </Field>
            <Field label="Phòng bệnh *" id="vaccine-disease" hint={fieldError(errors.diseasePrevented)}>
              <TextInput id="vaccine-disease" value={draft.diseasePrevented} readOnly={readOnly} invalid={Boolean(errors.diseasePrevented)} onChange={(v) => page.setField('diseasePrevented', v)} />
            </Field>
            <PairGrid>
              <Field label="Liều tham chiếu" id="vaccine-dose" hint={fieldError(errors.dose)}>
                <TextInput id="vaccine-dose" value={draft.dose} readOnly={readOnly} invalid={Boolean(errors.dose)} onChange={(v) => page.setField('dose', v)} />
              </Field>
              <Field label="Đường tiêm" id="vaccine-route" hint={fieldError(errors.route)}>
                <Select id="vaccine-route" value={draft.route} disabled={readOnly} onChange={(e) => page.setField('route', e.target.value as Route | '')}>
                  <option value="">Chưa chọn</option>
                  {VACCINE_ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABELS[r]}</option>)}
                </Select>
              </Field>
            </PairGrid>
            <PairGrid>
              <Field label="Nhắc lại sau" id="vaccine-booster" hint={fieldError(errors.boosterInterval, '0 – 730')}>
                <UnitInput id="vaccine-booster" unit="ngày" value={draft.boosterInterval} readOnly={readOnly} invalid={Boolean(errors.boosterInterval)} onChange={(v) => page.setField('boosterInterval', v)} />
              </Field>
              <Field label="Ngưng sử dụng thịt" id="vaccine-withdrawal" hint={fieldError(errors.withdrawalDays, '0 – 365')}>
                <UnitInput id="vaccine-withdrawal" unit="ngày" value={draft.withdrawalDays} readOnly={readOnly} invalid={Boolean(errors.withdrawalDays)} onChange={(v) => page.setField('withdrawalDays', v)} />
              </Field>
            </PairGrid>
            <StatusField label="Trạng thái" value={draft.available} readOnly={readOnly} onChange={(v) => page.setField('available', v)} />
          </EditorPanel>
        )}
      </SplitLayout>
      <Foot>Danh mục vắc-xin của trại. "Đang dùng" cho biết số lịch hoặc mũi tiêm đang tham chiếu; "Chưa dùng" thì mới xóa được. Liều, đường tiêm và số ngày ngưng được điền sẵn khi ghi tiêm.</Foot>
      {page.confirmOpen && item && (
        <DeactivateDialog name={item.name} count={vaccineUsage(item)} busy={page.saving} onCancel={page.closeModal} onConfirm={page.confirmDeactivate} />
      )}
      {page.modalName === 'xoa' && item && !page.isCreate && canEdit && (
        <DeleteVaccineDialog name={item.name} used={vaccineUsage(item) > 0} busy={deleting} error={deleteError} onCancel={page.closeModal} onConfirm={removeVaccine} />
      )}
    </>
  )
}
