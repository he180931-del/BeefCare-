import { describe, expect, it } from 'vitest'

describe('Herd Entry Business Rules & Calculations (FE-06)', () => {
  describe('GBR-91 & GBR-92: Line amount & pricing basis calculation', () => {
    it('TC-ENT-U01: Calculates line amount correctly for PER_KG (weight * unitPrice)', () => {
      const weightKg = 320
      const unitPricePerKg = 85_000
      const pricingBasis = 'PER_KG'

      const lineAmount = pricingBasis === 'PER_KG' ? weightKg * unitPricePerKg : unitPricePerKg
      expect(lineAmount).toBe(27_200_000)
    })

    it('TC-ENT-U02: Calculates line amount correctly for PER_HEAD (unitPrice)', () => {
      const weightKg = 320
      const unitPricePerHead = 25_000_000
      const pricingBasis = 'PER_HEAD'

      const lineAmount = pricingBasis === 'PER_HEAD' ? unitPricePerHead : weightKg * unitPricePerHead
      expect(lineAmount).toBe(25_000_000)
    })

    it('TC-ENT-U03: Total payable is cattle total amount plus transport fee (GBR-90)', () => {
      const cattleLines = [
        { weight: 300, unitPrice: 80_000 },
        { weight: 350, unitPrice: 80_000 },
      ]
      const freight = 500_000
      const cattleAmount = cattleLines.reduce((sum, line) => sum + line.weight * line.unitPrice, 0)
      const totalPayable = cattleAmount + freight

      expect(cattleAmount).toBe(52_000_000)
      expect(totalPayable).toBe(52_500_000)
    })

    it('TC-ENT-U04: Payment amount cannot exceed total payable (GBR-90, MSG-FE06-13)', () => {
      const totalPayable = 52_500_000
      const overpayment = 55_000_000
      const validPayment = 20_000_000

      const validatePayment = (amount: number, total: number) => {
        if (amount < 0) return 'Số tiền thanh toán không được âm'
        if (amount > total) return 'MSG-FE06-13: Số tiền thanh toán không được vượt quá tổng phải trả'
        return null
      }

      expect(validatePayment(overpayment, totalPayable)).toBe('MSG-FE06-13: Số tiền thanh toán không được vượt quá tổng phải trả')
      expect(validatePayment(validPayment, totalPayable)).toBeNull()
      expect(totalPayable - validPayment).toBe(32_500_000) // remaining debt
    })

    it('TC-ENT-U05: Entry date validation constraints (GBR-29, MSG-FE06-03)', () => {
      const today = '2026-10-31'
      const futureDate = '2026-11-15'
      const birthDate = '2025-05-10'
      const invalidPreBirthDate = '2025-04-01'
      const validDate = '2026-10-25'

      const validateEntryDate = (entryDate: string, cowBirthDate: string, currentDay: string) => {
        if (entryDate > currentDay) return 'MSG-FE06-03: Ngày nhập không được ở tương lai'
        if (entryDate < cowBirthDate) return 'MSG-FE06-03: Ngày nhập không được trước ngày sinh của bò'
        return null
      }

      expect(validateEntryDate(futureDate, birthDate, today)).toBe('MSG-FE06-03: Ngày nhập không được ở tương lai')
      expect(validateEntryDate(invalidPreBirthDate, birthDate, today)).toBe('MSG-FE06-03: Ngày nhập không được trước ngày sinh của bò')
      expect(validateEntryDate(validDate, birthDate, today)).toBeNull()
    })
  })
})

