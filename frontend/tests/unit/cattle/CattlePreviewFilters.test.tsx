import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCREEN_MANIFEST } from '../../../src/app/screenManifest'
import { CattlePreviewScreen } from '../../../src/features/cattle/pages/CattlePreviewScreens'

const cattleScreen = SCREEN_MANIFEST.find((screen) => screen.id === 'SCR-26')!

describe('cattle preview filters', () => {
  beforeEach(() => {
    window.localStorage.setItem('beefcare-ui-demo', JSON.stringify({ account: { 'cattle-filter': { query: 'khong-co-ma-bo-nay', status: 'ACTIVE' } } }))
  })

  afterEach(() => window.localStorage.clear())

  it('explains a saved filter mismatch and clears it in place', async () => {
    render(<MemoryRouter><CattlePreviewScreen screen={cattleScreen} role="owner" /></MemoryRouter>)

    expect(await screen.findByText('Không có bò phù hợp')).toBeInTheDocument()
    expect(screen.getByText(/Đang có .* bò trong đàn, nhưng không dòng nào khớp bộ lọc hiện tại/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    await waitFor(() => expect(screen.queryByText('Không có bò phù hợp')).not.toBeInTheDocument())
    expect(await screen.findAllByRole('button', { name: 'Mở hồ sơ' })).not.toHaveLength(0)
  })
})
