import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { catalogueApi } from '../../../src/features/farm-catalogue/api/catalogueApi'
import { catalogueDemoStore } from '../../../src/features/farm-catalogue/data/catalogueDemoStore'
import CatalogueRoutes from '../../../src/features/farm-catalogue/pages/CatalogueRoutes'

const session: Session = { role: 'OWNER', fullName: 'An', email: 'an@example.test', farmId: 1, farmName: 'Trại thử', logout: async () => undefined }
function open(tab: string) {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[`/danh-muc/${tab}`]}>
    <Routes><Route path="/danh-muc/*" element={<CatalogueRoutes />} /></Routes>
  </MemoryRouter></SessionContext.Provider>)
}
beforeEach(async () => { await catalogueDemoStore.reset() })

it.each([
  ['giong', 'Sahiwal', 'Sửa giống: Sahiwal'],
  ['thuoc', 'Oxytetracycline 20% LA', 'Sửa thuốc: Oxytetracycline 20% LA'],
  ['muc-dich', 'BREED', 'Sửa mục đích: Sinh sản'],
])('D42: %s supports stopping and editing without a delete button', async (tab, name, title) => {
  const user = userEvent.setup()
  open(tab)
  await user.click(await screen.findByText(name))
  expect(await screen.findByText(title)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Ngừng dùng' })).toBeInTheDocument()
})

it('asks before stopping a breed that only historical records still reference', async () => {
  const user = userEvent.setup()
  const [breed] = await catalogueApi.listBreeds({ q: 'RED-SINDHI' })
  vi.spyOn(catalogueApi, 'listBreeds').mockResolvedValue([{ ...breed!, activeCattle: 0, referenced: true, referencedCount: 4 }])
  open('giong')
  await screen.findByText('Sửa giống: Red Sindhi')
  expect(screen.getByLabelText('Mã giống *')).toHaveAttribute('readonly')
  await user.click(screen.getByRole('radio', { name: 'Ngừng dùng' }))
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText(/đang được dùng bởi 4 bản ghi/)).toBeInTheDocument()
})

it('uses historical pen references to lock a purpose and confirm stopping it', async () => {
  const user = userEvent.setup()
  const [purpose] = await catalogueApi.listPurposes({ q: 'BREED' })
  vi.spyOn(catalogueApi, 'listPurposes').mockResolvedValue([{ ...purpose!, activeCattle: 0, receivingPens: [], referenced: true, referencedCount: 7 }])
  open('muc-dich')
  await screen.findByText('Sửa mục đích: Sinh sản')
  expect(screen.getByLabelText('Loại mục đích *')).toBeDisabled()
  await user.click(screen.getByRole('radio', { name: 'Ngừng dùng' }))
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText(/đang được dùng bởi 7 bản ghi/)).toBeInTheDocument()
})

it('defaults to active items and reactivates an inactive purpose using the same id', async () => {
  const user = userEvent.setup()
  const [before] = await catalogueApi.listPurposes({ q: 'SALE-Y' })
  open('muc-dich')
  await screen.findByText('Sửa mục đích: Sinh sản')
  expect(screen.getByLabelText('Lọc theo trạng thái')).toHaveValue('ACTIVE')
  expect(screen.queryByText('Nuôi bán giống')).not.toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'INACTIVE')
  await user.click(await screen.findByText('Nuôi bán giống'))
  await user.click(screen.getByRole('radio', { name: 'Đang dùng' }))
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await screen.findByText('Đã lưu Nuôi bán giống.')
  await waitFor(async () => expect((await catalogueApi.listPurposes({ q: 'SALE-Y' }))[0]).toMatchObject({ id: before!.id, available: true, version: before!.version + 1 }))
  await user.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'ACTIVE')
  expect(await screen.findByText('Nuôi bán giống')).toBeInTheDocument()
})
