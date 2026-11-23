import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Table, Td, Th } from '../../../src/shared/ui'

/**
 * 23/11: at 390 px the "Trạng thái" column of /pens, /danh-muc/giong and /danh-muc/vac-xin was cut off because
 * non-stacking tables sat in an overflow-hidden frame. They now scroll sideways instead, focusable while they scroll.
 */
const sample = (props: Parameters<typeof Table>[0] extends infer P ? Omit<P, 'children'> : never) => (
  <Table {...props}>
    <thead><tr><Th>Mã</Th><Th>Tên giống</Th><Th>Trạng thái</Th></tr></thead>
    <tbody><tr><Td>BRA</Td><Td>Brahman</Td><Td>Đang dùng</Td></tr></tbody>
  </Table>
)

let widths = { scroll: 0, client: 0 }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => widths.scroll)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => widths.client)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Table frame when the table is wider than its box', () => {
  it('a non-stacking table scrolls sideways instead of hiding its last columns', () => {
    const { container } = render(sample({ stack: false }))
    expect(container.firstElementChild).toHaveClass('overflow-x-auto')
    expect(container.firstElementChild).not.toHaveClass('overflow-hidden')
  })

  it('a stacking table keeps its frame: narrow boxes turn rows into cards instead', () => {
    const { container } = render(sample({}))
    expect(container.firstElementChild).toHaveClass('overflow-hidden')
    expect(container.firstElementChild).not.toHaveAttribute('tabindex')
    // It cannot scroll, so its cells may still break anywhere rather than overflow the frame.
    expect(container.querySelector('table')).not.toHaveClass('[&_td]:[overflow-wrap:break-word]')
  })

  it('a table that scrolls wraps cells between words, not inside a word ("huy|ết" on phones)', () => {
    for (const props of [{ stack: false }, { scroll: true }, { wide: true }]) {
      const { container, unmount } = render(sample(props))
      expect(container.querySelector('table')).toHaveClass('[&_td]:[overflow-wrap:break-word]')
      unmount()
    }
  })

  it('the frame can be focused to scroll with the keyboard only while it actually scrolls', () => {
    widths = { scroll: 392, client: 322 }
    const wide = render(sample({ stack: false }))
    expect(wide.container.firstElementChild).toHaveAttribute('tabindex', '0')
    wide.unmount()

    widths = { scroll: 322, client: 322 }
    const fits = render(sample({ stack: false }))
    expect(fits.container.firstElementChild).not.toHaveAttribute('tabindex')
  })
})
