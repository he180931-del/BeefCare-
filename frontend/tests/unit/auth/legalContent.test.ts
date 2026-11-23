import { describe, expect, it } from 'vitest'
import { LEGAL_DOCUMENTS } from '../../../src/features/authentication/domain/legalContent'

describe('legal content contract', () => {
  it('covers the terms groups with substantial long-form text', () => {
    expect(LEGAL_DOCUMENTS.terms.sections.map((section) => section.id)).toEqual([
      'account', 'authentication', 'session', 'authorization', 'status', 'history',
    ])
    expect(LEGAL_DOCUMENTS.terms.sections.every((section) => section.paragraphs.length >= 2)).toBe(true)
    expect(LEGAL_DOCUMENTS.terms.sections.every((section) => section.paragraphs.join(' ').length >= 300)).toBe(true)
  })

  it('covers the data-policy groups with substantial long-form text', () => {
    expect(LEGAL_DOCUMENTS.policy.sections.map((section) => section.id)).toEqual([
      'account-data', 'farm-data', 'cattle-data', 'service-data', 'purposes', 'protection', 'integrations', 'correction',
    ])
    expect(LEGAL_DOCUMENTS.policy.sections.every((section) => section.paragraphs.length >= 2)).toBe(true)
    expect(LEGAL_DOCUMENTS.policy.sections.every((section) => section.paragraphs.join(' ').length >= 300)).toBe(true)
  })
})
