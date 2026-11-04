import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CareAdminScreen, CARE_ADMIN_SCREEN_IDS, blueprintFor } from '../../../src/features/operations/pages/CareAdminScreens'

describe('dedicated care/admin screens', () => {
  it('covers all 70 audited SCRs with feature-owned blueprints', () => {
    expect(CARE_ADMIN_SCREEN_IDS).toHaveLength(70)
    expect(new Set(CARE_ADMIN_SCREEN_IDS).size).toBe(70)
    for (const id of CARE_ADMIN_SCREEN_IDS) {
      const blueprint = blueprintFor(id)
      expect(blueprint.id).toBe(id)
      expect(blueprint.fields.length).toBeGreaterThan(0)
      expect(blueprint.actions.length).toBeGreaterThan(0)
      expect(blueprint.dataMode).toBe('fixture')
    }
  })

  it('renders vaccination fields and hides manager actions from owner', () => {
    render(<CareAdminScreen screenId="SCR-48" role="owner" state="success" />)
    expect(screen.getByRole('heading', { name: 'Ghi nhận tiêm phòng' })).toBeInTheDocument()
    expect(screen.getByLabelText('Vaccine')).toBeInTheDocument()
    expect(screen.getByLabelText('Số lô')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi nhận tiêm' })).not.toBeInTheDocument()
  })

  it('renders feed receipt fields and explicit fixture disclosure', () => {
    render(<CareAdminScreen screenId="SCR-113" role="manager" state="success" />)
    expect(screen.getByLabelText('Nhà cung cấp')).toBeInTheDocument()
    expect(screen.getByLabelText('Số hóa đơn')).toBeInTheDocument()
    expect(screen.getByText('Dữ liệu minh họa · chưa lưu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu phiếu nhập' })).toBeInTheDocument()
  })
})
