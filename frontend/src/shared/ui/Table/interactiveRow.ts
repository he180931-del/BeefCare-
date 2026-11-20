import type { KeyboardEvent, MouseEvent } from 'react'

const interactiveChild = 'a, button, input, select, textarea, [role="button"]'

const startedFromControl = (target: EventTarget | null) =>
  target instanceof Element && target.closest(interactiveChild) !== null

export const interactiveRowClass = 'cursor-pointer transition-colors hover:bg-[#f4f8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand'

export function activateTableRow(event: MouseEvent<HTMLElement>, action: () => void) {
  if (!startedFromControl(event.target)) action()
}

export function activateTableRowByKey(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (startedFromControl(event.target) || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  action()
}
