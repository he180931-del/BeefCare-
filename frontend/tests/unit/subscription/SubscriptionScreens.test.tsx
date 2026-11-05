import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { SubscriptionScreen } from '../../../src/features/subscription/pages/SubscriptionScreens'

const pendingPayment = {
  id: 'intent-990',
  code: 'PAY-990',
  farmId: 'farm-ba-vi',
  farmName: 'Trại bò Ba Vì',
  termYears: 1,
  amount: 1_200_000,
  priceVersion: 'v3',
  status: 'PENDING',
  createdAt: '2026-11-03T08:00:00.000Z',
  expiresAt: '2099-11-04T08:00:00.000Z',
  sourceReturn: '/ui/scr-86',
  firstPayment: false,
  transferContent: 'BEEFCARE PAY-990',
  receivingBank: 'Vietcombank',
  receivingAccountNumber: '0123456789',
  receivingAccountName: 'BEEFCARE JSC',
}

describe('subscription screens', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('subscription.selectedFarmId', JSON.stringify('farm-ba-vi'))
    localStorage.setItem('subscription.paymentIntents', JSON.stringify([pendingPayment]))
  })

  it('paginates 100 payment-history rows and keeps generated rows view-only', () => {
    render(<MemoryRouter><SubscriptionScreen screen={screenById('SCR-89')!} role="owner" state="success" /></MemoryRouter>)

    expect(screen.getByLabelText('Phân trang bảng')).toHaveTextContent(/Hiển thị 1–\d+ \/ 100 dòng/)
    expect(screen.getAllByRole('button', { name: 'Mở lại' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Xem' }).length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Xem' })[0])
    expect(screen.getByRole('heading', { name: 'Chi tiết thanh toán' })).toBeInTheDocument()
    expect(screen.getAllByText('PAY-990-L0002')).toHaveLength(2)
    expect(localStorage.getItem('subscription.activePaymentId')).toBeNull()
  })
})
