// Nội dung thông báo lưu dạng văn bản có đánh dấu: **đậm**, _nghiêng_, "- " danh sách, "1. " danh sách số, [chữ](liên kết).
export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic'; children: Inline[] }
  | { type: 'link'; href: string; text: string }
export type Block = { type: 'p'; inline: Inline[] } | { type: 'ul' | 'ol'; items: Inline[][] }

const INLINE = /\*\*(.+?)\*\*|_(.+?)_|\[([^\]]+)\]\(([^)\s]+)\)/g
const SAFE_HREF = /^(https?:\/\/|\/)/i

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of src.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'bold', children: parseInline(m[1]) })
    else if (m[2] !== undefined) out.push({ type: 'italic', children: parseInline(m[2]) })
    else if (SAFE_HREF.test(m[4])) out.push({ type: 'link', text: m[3], href: m[4] })
    else out.push({ type: 'text', text: m[0] })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ type: 'text', text: src.slice(last) })
  return out
}

export function parseRichText(src: string): Block[] {
  const blocks: Block[] = []
  for (const line of src.split('\n')) {
    if (!line.trim()) continue
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

export type Format = 'bold' | 'italic' | 'ul' | 'ol' | 'link'
export interface Edit { value: string; start: number; end: number }

/** Áp định dạng của thanh công cụ lên vùng đang chọn. */
export function applyFormat({ value, start, end }: Edit, format: Format): Edit {
  const selected = value.slice(start, end)
  if (format === 'bold' || format === 'italic') {
    const mark = format === 'bold' ? '**' : '_'
    const text = selected || (format === 'bold' ? 'in đậm' : 'in nghiêng')
    const next = `${value.slice(0, start)}${mark}${text}${mark}${value.slice(end)}`
    return { value: next, start: start + mark.length, end: start + mark.length + text.length }
  }
  if (format === 'link') {
    const text = selected || 'liên kết'
    const insert = `[${text}](https://)`
    return { value: `${value.slice(0, start)}${insert}${value.slice(end)}`, start: start + text.length + 3, end: start + insert.length - 1 }
  }
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = end === start ? (value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end)) : end
  const lines = value.slice(lineStart, lineEnd).split('\n').map((line, i) => `${format === 'ul' ? '- ' : `${i + 1}. `}${line}`)
  const replaced = lines.join('\n')
  return { value: `${value.slice(0, lineStart)}${replaced}${value.slice(lineEnd)}`, start: lineStart, end: lineStart + replaced.length }
}
