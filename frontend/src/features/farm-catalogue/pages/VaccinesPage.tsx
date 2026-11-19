import { useState } from 'react'
import { Button, Field, Foot, Select, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { catalogueApi } from '../api/catalogueApi'
import { CatalogueList, SelectableRow } from '../components/CatalogueList'
import { DeactivateDialog, DeleteVaccineDialog } from '../components/ConfirmDialogs'
import { EditorEmpty, EditorFooter, EditorPanel, PairGrid } from '../components/EditorPanel'
import { AvailabilityBadge, StatusField, TextInput, UnitInput, fieldError } from '../components/fields'
import { AddButton, SavedNotice, SplitLayout } from '../components/PageParts'
import { useCanEdit } from '../components/useCanEdit'
import { useCatalogueEditor } from '../components/useCatalogueEditor'
import {
  CODE_HINT, ROUTE_LABELS, VACCINE_ROUTES, numberToText, parseNumber, vaccineDoseRoute, vaccineUsage, vaccineUsageLabel,
} from '../domain/catalogueRules'
import type { AvailabilityFilter, Route, Vaccine } from '../types'

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
  const canEdit = useCanEdit()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AvailabilityFilter>('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const list = useQuery(() => catalogueApi.listVaccines({ q, status }), [q, status])
  const ed = useCatalogueEditor<Vaccine, VaccineDraft>({
    items: list.data, canEdit, newDraft, toDraft, refetch: list.refetch, usage: vaccineUsage,
    save: (item, d) => catalogueApi.saveVaccine(item?.id ?? null, {
      ...d, boosterInterval: parseNumber(d.boosterInterval), withdrawalDays: parseNumber(d.withdrawalDays) ?? 0,
      ...(item ? { expectedVersion: item.version } : {}),
    }),
  })
  const { draft, item, errors } = ed
  const locked = !ed.isCreate && item !== null && vaccineUsage(item) > 0
  const readOnly = !canEdit

  async function removeVaccine() {
    if (!item) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await catalogueApi.deleteVaccine(item.id)
      ed.closeModal()
      ed.clear()
      list.refetch()
    } catch (error) {
      setDeleteError(userFacingError(error, 'Không xóa được vắc-xin. Vui lòng thử lại.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {canEdit && <AddButton label="Thêm vắc-xin" onClick={ed.startCreate} />}
      <SavedNotice text={ed.notice} />
      <SplitLayout>
        <CatalogueList q={q} onQ={setQ} status={status} onStatus={setStatus} rows={list.data} error={list.error} onRetry={list.refetch} errorText="Không tải được danh mục vắc-xin." emptyTitle="Không có vắc-xin nào phù hợp">
          <Table stack={false}>
            <thead><tr><Th className="w-[84px]">Mã</Th><Th>Tên vắc-xin</Th><Th>Phòng bệnh</Th><Th>Liều · đường</Th><Th className="w-[84px] whitespace-nowrap">Đang dùng</Th><Th>Trạng thái</Th></tr></thead>
            <tbody>
              {(list.data ?? []).map((v) => {
                const doseRoute = vaccineDoseRoute(v)
                return (
                  <SelectableRow key={v.id} selected={item?.id === v.id} muted={!v.available} onSelect={() => ed.select(v)}>
                    <Td className="font-medium">{v.code}</Td>
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
            title={ed.isCreate ? 'Thêm vắc-xin' : `${canEdit ? 'Sửa vắc-xin' : 'Vắc-xin'}: ${item!.name}`}
            sub="Các mũi đã tiêm giữ nguyên tên lúc tiêm"
            error={ed.formError}
            onSubmit={ed.submit}
            footer={canEdit && (
              <>
                <EditorFooter
                  onCancel={ed.cancel}
                  saving={ed.saving}
                  create={ed.isCreate}
                  left={!ed.isCreate && <Button type="button" className="mr-auto" onClick={() => { setDeleteError(null); ed.openModal('xoa') }}>Xóa</Button>}
                />
                {!ed.isCreate && <p className="m-0 basis-full text-[11px] text-muted">Chỉ xóa được vắc-xin chưa từng dùng; đã dùng thì chỉ ngừng dùng.</p>}
              </>
            )}
          >
            <PairGrid>
              <Field label="Mã *" id="vaccine-code" hint={fieldError(errors.code, locked ? 'Không sửa được khi đã dùng' : CODE_HINT)}>
                <TextInput id="vaccine-code" upper value={draft.code} readOnly={readOnly || locked} invalid={Boolean(errors.code)} onChange={(v) => ed.setField('code', v)} />
              </Field>
              <Field label="Nhà sản xuất" id="vaccine-manufacturer" hint={fieldError(errors.manufacturer)}>
                <TextInput id="vaccine-manufacturer" value={draft.manufacturer} readOnly={readOnly} onChange={(v) => ed.setField('manufacturer', v)} />
              </Field>
            </PairGrid>
            <Field label="Tên vắc-xin *" id="vaccine-name" hint={fieldError(errors.name)}>
              <TextInput id="vaccine-name" value={draft.name} readOnly={readOnly} invalid={Boolean(errors.name)} onChange={(v) => ed.setField('name', v)} />
            </Field>
            <Field label="Phòng bệnh *" id="vaccine-disease" hint={fieldError(errors.diseasePrevented)}>
              <TextInput id="vaccine-disease" value={draft.diseasePrevented} readOnly={readOnly} invalid={Boolean(errors.diseasePrevented)} onChange={(v) => ed.setField('diseasePrevented', v)} />
            </Field>
            <PairGrid>
              <Field label="Liều tham chiếu" id="vaccine-dose" hint={fieldError(errors.dose)}>
                <TextInput id="vaccine-dose" value={draft.dose} readOnly={readOnly} invalid={Boolean(errors.dose)} onChange={(v) => ed.setField('dose', v)} />
              </Field>
              <Field label="Đường tiêm" id="vaccine-route" hint={fieldError(errors.route)}>
                <Select id="vaccine-route" value={draft.route} disabled={readOnly} onChange={(e) => ed.setField('route', e.target.value as Route | '')}>
                  <option value="">Chưa chọn</option>
                  {VACCINE_ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABELS[r]}</option>)}
                </Select>
              </Field>
            </PairGrid>
            <PairGrid>
              <Field label="Nhắc lại sau" id="vaccine-booster" hint={fieldError(errors.boosterInterval, '0 – 730')}>
                <UnitInput id="vaccine-booster" unit="ngày" value={draft.boosterInterval} readOnly={readOnly} invalid={Boolean(errors.boosterInterval)} onChange={(v) => ed.setField('boosterInterval', v)} />
              </Field>
              <Field label="Ngưng sử dụng thịt" id="vaccine-withdrawal" hint={fieldError(errors.withdrawalDays, '0 – 365')}>
                <UnitInput id="vaccine-withdrawal" unit="ngày" value={draft.withdrawalDays} readOnly={readOnly} invalid={Boolean(errors.withdrawalDays)} onChange={(v) => ed.setField('withdrawalDays', v)} />
              </Field>
            </PairGrid>
            <StatusField label="Trạng thái" value={draft.available} readOnly={readOnly} onChange={(v) => ed.setField('available', v)} />
          </EditorPanel>
        )}
      </SplitLayout>
      <Foot>Danh mục vắc-xin của trại. "Đang dùng" cho biết số lịch hoặc mũi tiêm đang tham chiếu; "Chưa dùng" thì mới xóa được. Liều, đường tiêm và số ngày ngưng được điền sẵn khi ghi tiêm.</Foot>
      {ed.confirmOpen && item && (
        <DeactivateDialog name={item.name} count={vaccineUsage(item)} busy={ed.saving} onCancel={ed.closeModal} onConfirm={ed.confirmDeactivate} />
      )}
      {ed.modalName === 'xoa' && item && !ed.isCreate && canEdit && (
        <DeleteVaccineDialog name={item.name} used={vaccineUsage(item) > 0} busy={deleting} error={deleteError} onCancel={ed.closeModal} onConfirm={removeVaccine} />
      )}
    </>
  )
}
