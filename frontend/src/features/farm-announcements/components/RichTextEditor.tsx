import { useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../../../components/Icon'
import { markdownToEditorFragment, safeAnnouncementHref, serializeRichText, type Format } from '../domain/richText'

const TOOLS: Array<{ format: Format; label: string; content: string }> = [
  { format: 'bold', label: 'In đậm', content: 'B' },
  { format: 'italic', label: 'In nghiêng', content: 'I' },
  { format: 'ul', label: 'Danh sách gạch đầu dòng', content: '•' },
  { format: 'ol', label: 'Danh sách số', content: '1.' },
]

export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const urlRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const lastValueRef = useRef(value)
  const mountedRef = useRef(false)
  const restoringSelectionRef = useRef(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('liên kết')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState('')

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (!mountedRef.current || value !== lastValueRef.current) {
      editor.replaceChildren(markdownToEditorFragment(value))
      lastValueRef.current = value
      mountedRef.current = true
    }
  }, [value])

  const rememberSelection = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    const common = range.commonAncestorContainer
    if (common === editor || editor.contains(common)) selectionRef.current = range.cloneRange()
  }

  const restoreSelection = () => {
    const editor = editorRef.current
    if (!editor) return null
    // Keep the saved range before focus: focusing after the URL input can fire onFocus
    // and expose the browser's stale pre-toolbar selection.
    let range = selectionRef.current?.cloneRange() ?? null
    restoringSelectionRef.current = true
    editor.focus()
    const selection = window.getSelection()
    if (!selection) { restoringSelectionRef.current = false; return null }
    if (!range || !(range.commonAncestorContainer === editor || editor.contains(range.commonAncestorContainer))) {
      range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(range)
    selectionRef.current = range.cloneRange()
    restoringSelectionRef.current = false
    return range
  }

  const emitValue = () => {
    const editor = editorRef.current
    if (!editor) return
    const next = serializeRichText(editor)
    lastValueRef.current = next
    onChange(next)
  }

  const applyFormat = (format: Format) => {
    restoreSelection()
    const command = format === 'bold' ? 'bold' : format === 'italic' ? 'italic' : format === 'ul' ? 'insertUnorderedList' : 'insertOrderedList'
    try { document.execCommand(command, false) } catch { /* Some embedded browsers omit execCommand. */ }
    rememberSelection()
    emitValue()
  }

  const openLink = () => {
    rememberSelection()
    const selected = selectionRef.current?.toString() ?? ''
    setLinkText(selected || 'liên kết')
    setLinkUrl('')
    setLinkError('')
    setLinkOpen(true)
    window.requestAnimationFrame(() => urlRef.current?.focus())
  }

  const closeLink = () => {
    setLinkOpen(false)
    setLinkError('')
    restoreSelection()
  }

  const applyLink = () => {
    const href = safeAnnouncementHref(linkUrl)
    let absolute: URL | null = null
    try { absolute = new URL(linkUrl.trim()) } catch { /* A complete URL is required for newly added links. */ }
    if (!href || !absolute || !['http:', 'https:'].includes(absolute.protocol)) {
      setLinkError('Nhập URL đầy đủ bắt đầu bằng http:// hoặc https://.')
      urlRef.current?.focus()
      return
    }

    const editor = editorRef.current
    if (!editor) return
    let range = restoreSelection()
    if (!range) return
    const linkAt = (node: Node) => {
      const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
      return element?.closest('a') ?? null
    }
    const startLink = linkAt(range.startContainer)
    const endLink = linkAt(range.endContainer)
    const sameExistingLink = startLink && startLink === endLink && editor.contains(startLink)
      && startLink.contains(range.commonAncestorContainer)
    let appliedLink: Element | null = sameExistingLink ? startLink : null

    if (sameExistingLink) {
      startLink.setAttribute('href', href)
    } else {
      const anchor = document.createElement('a')
      anchor.setAttribute('href', href)
      if (range.collapsed) {
        anchor.textContent = linkText.trim() || 'liên kết'
        range.insertNode(anchor)
        appliedLink = anchor
      } else {
        let appliedByBrowser = false
        try { appliedByBrowser = document.execCommand('createLink', false, href) } catch { /* Use the DOM range fallback below. */ }
        if (!appliedByBrowser) {
          const fragment = range.extractContents()
          fragment.querySelectorAll('a').forEach((existing) => {
            const parent = existing.parentNode
            while (existing.firstChild) parent?.insertBefore(existing.firstChild, existing)
            existing.remove()
          })
          anchor.appendChild(fragment)
          range.insertNode(anchor)
          appliedLink = anchor
        }
      }
    }
    const selection = window.getSelection()
    if (selection) {
      range = document.createRange()
      const currentLink = appliedLink ?? linkAt(selection.focusNode ?? editor)
      const selectedNode = currentLink && editor.contains(currentLink) ? currentLink : editor.lastChild ?? editor
      range.selectNodeContents(selectedNode)
      selection.removeAllRanges()
      selection.addRange(range)
      selectionRef.current = range.cloneRange()
    }
    setLinkOpen(false)
    setLinkUrl('')
    setLinkError('')
    emitValue()
  }

  const insertPlainText = (text: string) => {
    if (!text) return
    const range = restoreSelection()
    if (!range) return
    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    selectionRef.current = range.cloneRange()
    emitValue()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1 rounded-[5px] bg-[#f0f0f0] p-1" role="toolbar" aria-label="Định dạng nội dung">
        {TOOLS.map((tool) => (
          <button
            key={tool.format}
            type="button"
            aria-label={tool.label}
            title={tool.label}
            onMouseDown={(event) => { event.preventDefault(); rememberSelection() }}
            onClick={() => applyFormat(tool.format)}
            className="grid h-8 min-w-8 cursor-pointer place-items-center rounded bg-transparent px-2 text-sm font-semibold text-muted hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {tool.format === 'ul' ? <Icon name="clipboard-list" size={16} /> : tool.content}
          </button>
        ))}
        <button
          type="button"
          aria-label="Chèn liên kết"
          title="Chèn liên kết"
          onMouseDown={(event) => { event.preventDefault(); rememberSelection() }}
          onClick={openLink}
          className="grid h-8 cursor-pointer place-items-center rounded bg-transparent px-2 text-xs font-medium text-muted hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          Liên kết
        </button>
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded border border-field bg-page p-2" role="group" aria-label="Chèn liên kết">
          {(!selectionRef.current || selectionRef.current.collapsed) && (
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted">
              Chữ hiển thị
              <input className="rounded border border-field bg-white px-2 py-1.5 text-sm text-ink" value={linkText} onChange={(event) => setLinkText(event.target.value)} />
            </label>
          )}
          <label className="flex min-w-48 flex-[2] flex-col gap-1 text-xs text-muted">
            Địa chỉ liên kết
            <input
              ref={urlRef}
              type="url"
              inputMode="url"
              autoComplete="url"
              className="rounded border border-field bg-white px-2 py-1.5 text-sm text-ink"
              value={linkUrl}
              onChange={(event) => { setLinkUrl(event.target.value); setLinkError('') }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); applyLink() }
                if (event.key === 'Escape') closeLink()
              }}
              aria-invalid={Boolean(linkError)}
              aria-describedby={linkError ? `${id}-link-error` : undefined}
              placeholder="https://example.com"
            />
          </label>
          <button type="button" className="h-[34px] rounded border border-brand px-3 text-xs font-semibold text-brand" onClick={applyLink}>Thêm liên kết</button>
          <button type="button" className="h-[34px] rounded border border-field bg-white px-3 text-xs text-muted" onClick={closeLink}>Hủy</button>
          {linkError && <span id={`${id}-link-error`} role="alert" className="w-full text-xs text-err-fg">{linkError}</span>}
        </div>
      )}

      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        contentEditable
        suppressContentEditableWarning
        onInput={emitValue}
        onBlur={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={() => { if (!restoringSelectionRef.current) rememberSelection() }}
        onPaste={(event) => {
          event.preventDefault()
          insertPlainText(event.clipboardData.getData('text/plain'))
        }}
        onDrop={(event) => event.preventDefault()}
        className="min-h-[180px] whitespace-pre-wrap break-words rounded border border-field bg-white px-3 py-2.5 text-sm leading-6 text-[#212121] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 [&_a]:text-brand [&_a]:underline [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  )
}
