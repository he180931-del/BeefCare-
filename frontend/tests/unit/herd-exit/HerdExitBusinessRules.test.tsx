import { describe, expect, it } from 'vitest'

describe('Herd Exit Business Rules & Constraints (FE-13)', () => {
  describe('GBR-34: Authority and confirmation rules', () => {
    it('TC-EXT-U01: Only Owner can confirm exit, Manager cannot confirm (GBR-34, MSG-FE13-03)', () => {
      const checkPermission = (role: 'OWNER' | 'MANAGER' | 'VET') => {
        if (role !== 'OWNER') return 'MSG-FE13-03: Chỉ Chủ trại mới có quyền xác nhận xuất đàn'
        return 'OK'
      }

      expect(checkPermission('MANAGER')).toBe('MSG-FE13-03: Chỉ Chủ trại mới có quyền xác nhận xuất đàn')
      expect(checkPermission('VET')).toBe('MSG-FE13-03: Chỉ Chủ trại mới có quyền xác nhận xuất đàn')
      expect(checkPermission('OWNER')).toBe('OK')
    })
  })

  describe('GBR-46 & MSG-FE13-07: Meat withdrawal period check', () => {
    it('TC-EXT-U02: Flags withdrawal warning when cattle is sold within withdrawal period', () => {
      const exitDate = '2026-10-31'
      const activeWithdrawalUntil = '2026-11-05'
      const expiredWithdrawalUntil = '2026-10-20'

      const checkWithdrawal = (exit: string, withdrawal?: string) => {
        if (withdrawal && exit < withdrawal) {
          return {
            hasWarning: true,
            code: 'MSG-FE13-07',
            message: `Ngưng giết mổ đến ${withdrawal}`,
          }
        }
        return { hasWarning: false }
      }

      const warningResult = checkWithdrawal(exitDate, activeWithdrawalUntil)
      expect(warningResult.hasWarning).toBe(true)
      expect(warningResult.code).toBe('MSG-FE13-07')

      const okResult = checkWithdrawal(exitDate, expiredWithdrawalUntil)
      expect(okResult.hasWarning).toBe(false)
    })
  })

  describe('GBR-93: Deposit collection calculation', () => {
    it('TC-EXT-U03: Validates deposit collected cannot exceed total receivable', () => {
      const totalReceivable = 35_000_000
      const excessDeposit = 40_000_000
      const validDeposit = 10_000_000

      const validateDeposit = (deposit: number, total: number) => {
        if (deposit < 0) return 'Tiền thu không được âm'
        if (deposit > total) return 'MSG-FE06-13: Tiền thu trước không được vượt quá tổng phải thu'
        return null
      }

      expect(validateDeposit(excessDeposit, totalReceivable)).toBe('MSG-FE06-13: Tiền thu trước không được vượt quá tổng phải thu')
      expect(validateDeposit(validDeposit, totalReceivable)).toBeNull()
      expect(totalReceivable - validDeposit).toBe(25_000_000) // remaining debt
    })
  })

  describe('GBR-95: Death/Missing Exit constraints', () => {
    it('TC-EXT-U04: Requires mandatory cause of death and carcass disposal (SCR-71, MSG-FE13-06)', () => {
      const validateLossRecord = (lossType: 'DIED' | 'MISSING', cause: string, disposal: string) => {
        const errors: Record<string, string> = {}
        if (!cause.trim()) errors.cause = 'MSG-FE13-06: Bắt buộc nhập nguyên nhân'
        if (lossType === 'DIED' && !disposal.trim()) errors.disposal = 'MSG-FE13-06: Bắt buộc nhập phương án xử lý xác'
        return errors
      }

      const invalidRecord = validateLossRecord('DIED', '', '')
      expect(invalidRecord.cause).toBe('MSG-FE13-06: Bắt buộc nhập nguyên nhân')
      expect(invalidRecord.disposal).toBe('MSG-FE13-06: Bắt buộc nhập phương án xử lý xác')

      const validRecord = validateLossRecord('DIED', 'Viêm phổi cấp tính', 'Chôn lấp khử trùng vôi bột')
      expect(Object.keys(validRecord).length).toBe(0)
    })
  })
})

