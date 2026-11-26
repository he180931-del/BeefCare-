import { describe, expect, it } from 'vitest'
import { entryImportIssueText } from '../../../src/features/herd-entry/domain/entryImportIssue'

describe('entryImportIssueText', () => {
  it('names the template column in Vietnamese whatever the server language', () => {
    expect(entryImportIssueText({ code: 'MSG-COM-08', field: 'breed', message: 'The selected item is no longer available. Please choose another one.' })).toBe('Giống không có trong danh mục của trại')
    expect(entryImportIssueText({ code: 'MSG-COM-06', field: 'penId', message: 'receivingPen is required.' })).toBe('Thiếu Chuồng')
    expect(entryImportIssueText({ code: 'MSG-COM-10', field: 'birthDate' })).toBe('Ngày sinh không hợp lệ')
    expect(entryImportIssueText({ code: 'MSG-FE04-05', field: 'penId', params: { pen_code: 'QA-B', free: 0 } })).toBe('Chuồng QA-B không nhận thêm được: ngừng sử dụng hoặc chỉ còn 0 chỗ')
  })

  it('explains the warnings that carry only a check code', () => {
    expect(entryImportIssueText({ code: 'CHK-ESTIMATED-WEIGHT', field: 'entryWeightKg', message: 'CHK-ESTIMATED-WEIGHT' })).toBe('Cân ước tính (UT)')
    expect(entryImportIssueText({ code: 'CHK-PURPOSE-DEFAULTED', field: 'purposeId' })).toBe('Chưa ghi mục đích, lấy mục đích mặc định')
  })

  it('keeps the server message of other codes and never shows a bare code', () => {
    expect(entryImportIssueText({ code: 'MSG-FE06-02', message: 'Bê này đã được đăng ký với mã BC-9.' })).toBe('Bê này đã được đăng ký với mã BC-9.')
    expect(entryImportIssueText({ code: 'CHK-OTHER', field: 'unitPrice', message: 'CHK-OTHER' })).toBe('Vui lòng kiểm tra cột Đơn giá.')
  })
})
