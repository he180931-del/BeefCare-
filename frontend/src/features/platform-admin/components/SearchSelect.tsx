import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../../components/Icon'

/** `hint` is shown under the label; `keywords` (e.g. a code) are searched but never shown. */
export interface SearchOption { value: string; label: string; hint?: string; keywords?: string }

/** Case-, accent- and underscore-insensitive: "tam ngung", "Tạm ngưng" and "ACCOUNT_SUSPENDED" all match their option. */
export const searchKey = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
  .replace(/_/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim()

interface Props {
  id?: string
  options: SearchOption[]
  /** '' = no filter ("Tất cả"). */
  value: string
  onChange: (value: string) => void
  allLabel?: string
  placeholder?: string
  emptyText?: string
  /** Accessible name of the × button that resets to "Tất cả". */
  clearLabel?: string
  'aria-label'?: string
  className?: string
}

/**
 * Filter picker you can type into: the list narrows to options whose label, hint or keywords contain the typed words,
 * ↑ / ↓ move, Enter picks, Esc or leaving the field restores the current choice. Free text never becomes a filter.
 * Tabbing through does not open the list (it would cover the table); a click, typing or ↓ does.
 */
export default function SearchSelect({ id, options, value, onChange, allLabel = 'Tất cả', placeholder = 'Gõ để tìm…', emptyText = 'Không có mục phù hợp', clearLabel = 'Bỏ lọc', className, ...aria }: Props) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selected = options.find((o) => o.value === value) ?? null
  const [query, setQuery] = useState<string | null>(null) // null = not typing: the field shows the current choice
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const items = useMemo(() => {
    const words = query == null ? [] : searchKey(query).split(' ').filter(Boolean)
    const matches = words.length === 0 ? options
      : options.filter((o) => { const key = searchKey(`${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`); return words.every((w) => key.includes(w)) })
    return words.length === 0 ? [{ value: '', label: allLabel }, ...matches] : matches
  }, [options, query, allLabel])

  const close = () => { setOpen(false); setQuery(null) }
  const pick = (next: string) => { onChange(next); close() }
  const openList = () => {
    setOpen(true)
    setActive(Math.max(0, items.findIndex((o) => o.value === value)))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return openList()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (items.length === 0 ? 0 : (i + step + items.length) % items.length))
    } else if (e.key === 'Enter') {
      if (open && items[active]) { e.preventDefault(); pick(items[active].value) }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close() }
    }
  }
  const activeId = open && items[active] ? `${listId}-${active}` : undefined
  // Keep the keyboard-highlighted option visible inside the scrolling list.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active])

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        {...aria}
        value={query ?? selected?.label ?? ''}
        placeholder={selected ? selected.label : `${allLabel} · ${placeholder}`}
        onClick={() => { if (!open) openList() }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={onKeyDown}
        onBlur={close}
        className="h-[46px] w-full rounded-xl border border-field bg-white pl-3 pr-14 text-sm text-ink outline-none placeholder:text-muted focus:border-brand"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-[#66756b]">
        {value && (
          <button type="button" aria-label={clearLabel} className="grid h-7 w-7 place-items-center rounded-md hover:bg-chip"
            onMouseDown={(e) => e.preventDefault()} onClick={() => { pick(''); input.current?.blur() }}>
            <Icon name="x" size={14} />
          </button>
        )}
        <Icon name="chevron-down" className="pointer-events-none" />
      </div>
      {open && (
        <ul ref={list} id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-edge bg-white py-1 shadow-lg">
          {items.length === 0 && <li className="px-3 py-2 text-xs text-muted">{emptyText}</li>}
          {items.map((o, i) => (
            <li
              key={o.value || '__all'}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              // mousedown keeps focus in the field, so the blur that closes the list does not cancel the click.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
              className={`flex cursor-pointer flex-col px-3 py-1.5 text-sm ${i === active ? 'bg-[#eef4ef]' : ''} ${o.value === value ? 'font-semibold text-brand' : 'text-ink'}`}
            >
              <span>{o.label}</span>
              {o.hint && <span className="font-mono text-[10px] font-normal text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
