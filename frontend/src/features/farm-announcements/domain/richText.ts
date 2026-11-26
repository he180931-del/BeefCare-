// Announcement bodies use a small Markdown subset as their existing API/storage contract.
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'link'; href: string; text: string; children: Inline[] }
export type Block = { type: 'p'; inline: Inline[] } | { type: 'ul' | 'ol'; items: Inline[][] }
export type Format = 'bold' | 'italic' | 'ul' | 'ol'

const ESCAPABLE = new Set(['\\', '*', '_', '[', ']', '(', ')'])

/** Permit web links and root-relative app links; reject executable and protocol-relative URLs. */
export function safeAnnouncementHref(value: string | null | undefined): string | null {
  const href = value?.trim() ?? ''
  if (!href || /[\s\\]/.test(href)) return null
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? href : null
  } catch {
    return null
  }
}

function findUnescaped(source: string, token: string, from: number) {
  for (let at = from; at <= source.length - token.length; at += 1) {
    if (source[at] === '\\') { at += 1; continue }
    if (source.startsWith(token, at)) return at
  }
  return -1
}

function appendText(out: Inline[], text: string) {
  if (!text) return
  const last = out[out.length - 1]
  if (last?.type === 'text') last.text += text
  else out.push({ type: 'text', text })
}

function plainText(inline: Inline[]): string {
  return inline.map((item) => item.type === 'text' ? item.text : item.type === 'link' ? item.text : plainText(item.children)).join('')
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let plain = ''
  const flush = () => { appendText(out, plain); plain = '' }

  for (let index = 0; index < src.length;) {
    const char = src[index]
    if (char === '\\' && index + 1 < src.length && ESCAPABLE.has(src[index + 1])) {
      plain += src[index + 1]
      index += 2
      continue
    }

    const delimiter = src.startsWith('**', index) ? '**' : char === '_' ? '_' : ''
    if (delimiter) {
      const end = findUnescaped(src, delimiter, index + delimiter.length)
      if (end > index + delimiter.length) {
        flush()
        const contents = src.slice(index + delimiter.length, end)
        out.push(delimiter === '**' ? { type: 'bold', children: parseInline(contents) } : { type: 'italic', children: parseInline(contents) })
        index = end + delimiter.length
        continue
      }
    }

    if (char === '[') {
      const labelEnd = findUnescaped(src, '](', index + 1)
      const targetEnd = labelEnd < 0 ? -1 : findUnescaped(src, ')', labelEnd + 2)
      if (labelEnd > index + 1 && targetEnd > labelEnd + 2) {
        const target = src.slice(labelEnd + 2, targetEnd).replace(/\\([()\\])/g, '$1')
        const href = safeAnnouncementHref(target)
        if (href) {
          flush()
          const children = parseInline(src.slice(index + 1, labelEnd))
          out.push({ type: 'link', href, text: plainText(children), children })
          index = targetEnd + 1
          continue
        }
      }
    }

    plain += char
    index += 1
  }
  flush()
  return out
}

export function parseRichText(src: string): Block[] {
  if (!src) return []
  const blocks: Block[] = []
  for (const line of src.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) { blocks.push({ type: 'p', inline: [] }); continue }
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const kind = bullet ? 'ul' : numbered ? 'ol' : null
    if (kind) {
      const prev = blocks[blocks.length - 1]
      const item = parseInline((bullet ?? numbered)![1])
      if (prev && prev.type === kind) prev.items.push(item)
      else blocks.push({ type: kind, items: [item] })
    } else blocks.push({ type: 'p', inline: parseInline(line) })
  }
  return blocks
}

function escapeMarkdownText(value: string) {
  return value.replace(/[\\*_\[\]]/g, '\\$&')
}

function serializeInlineNodes(nodes: ArrayLike<Node>): string {
  return Array.from(nodes).map((node) => {
    if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const element = node as HTMLElement
    const content = serializeInlineNodes(element.childNodes)
    switch (element.tagName) {
      case 'B':
      case 'STRONG': return content ? `**${content}**` : ''
      case 'I':
      case 'EM': return content ? `_${content}_` : ''
      case 'BR': return '\n'
      case 'A': {
        const href = safeAnnouncementHref(element.getAttribute('href'))
        return href && element.textContent ? `[${content}](${href.replace(/[\s)]/g, (c) => encodeURIComponent(c))})` : content
      }
      // Never preserve markup or attributes outside the editor's format whitelist.
      default: return content
    }
  }).join('')
}

function isBlock(element: Element) {
  return element.tagName === 'P' || element.tagName === 'DIV' || element.tagName === 'UL' || element.tagName === 'OL'
}

/** Serialize only text plus the supported semantic tags. Unknown or pasted HTML is unwrapped. */
export function serializeRichText(root: HTMLElement): string {
  const lines: string[] = []
  let inline: ChildNode[] = []
  const flushInline = () => {
    if (inline.length) lines.push(serializeInlineNodes(inline))
    inline = []
  }
  const walk = (nodes: NodeListOf<ChildNode> | ChildNode[]) => {
    for (const node of Array.from(nodes)) {
      if (node.nodeType === Node.ELEMENT_NODE && isBlock(node as Element)) {
        const element = node as HTMLElement
        flushInline()
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          const items = Array.from(element.children).filter((child) => child.tagName === 'LI') as HTMLElement[]
          items.forEach((item, index) => {
            const content = serializeInlineNodes(item.childNodes)
            lines.push(element.tagName === 'UL' ? `- ${content}` : `${index + 1}. ${content}`)
          })
        } else if (Array.from(element.children).some((child) => isBlock(child))) {
          walk(element.childNodes)
        } else {
          const onlyPlaceholderBreak = element.childNodes.length === 1
            && element.firstChild?.nodeType === Node.ELEMENT_NODE
            && (element.firstChild as Element).tagName === 'BR'
          const content = onlyPlaceholderBreak ? '' : serializeInlineNodes(element.childNodes)
          lines.push(content)
        }
      } else inline.push(node)
    }
  }
  walk(root.childNodes)
  flushInline()
  return lines.join('\n').replace(/\u00a0/g, ' ')
}

function appendInline(parent: Node, inline: Inline[]) {
  for (const item of inline) {
    if (item.type === 'text') parent.appendChild(document.createTextNode(item.text))
    else if (item.type === 'link') {
      const href = safeAnnouncementHref(item.href)
      if (!href) { parent.appendChild(document.createTextNode(item.text)); continue }
      const link = document.createElement('a')
      link.setAttribute('href', href)
      appendInline(link, item.children)
      parent.appendChild(link)
    } else {
      const el = document.createElement(item.type === 'bold' ? 'strong' : 'em')
      appendInline(el, item.children)
      parent.appendChild(el)
    }
  }
}

/** Build editor DOM with DOM APIs and text nodes; stored HTML is never interpreted. */
export function markdownToEditorFragment(markdown: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  for (const block of parseRichText(markdown)) {
    if (block.type === 'p') {
      const paragraph = document.createElement('p')
      appendInline(paragraph, block.inline)
      if (block.inline.length === 0) paragraph.appendChild(document.createElement('br'))
      fragment.appendChild(paragraph)
      continue
    }
    const list = document.createElement(block.type)
    for (const item of block.items) {
      const li = document.createElement('li')
      appendInline(li, item)
      list.appendChild(li)
    }
    fragment.appendChild(list)
  }
  return fragment
}
