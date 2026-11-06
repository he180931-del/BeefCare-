import type { CSSProperties } from 'react'

// SVG giữ nguyên bản xuất từ Figma tab 00 (Icons · Tabler). Dùng mask để icon nhận màu chữ hiện tại.
const urls = import.meta.glob('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const ICON_NAMES = [
  'adjustments', 'alarm', 'alert-triangle', 'arrow-left', 'arrows-exchange', 'baby-carriage', 'ban', 'bell',
  'building-community', 'building-warehouse', 'calendar-dollar', 'calendar-event', 'cash', 'chart-line', 'checks',
  'chevron-down', 'chevron-left', 'chevron-right', 'circle-check', 'circle-plus', 'circle-x', 'clipboard-list', 'clock',
  'credit-card', 'currency-dong', 'dna', 'download', 'droplet', 'edit', 'eye', 'fence', 'file-export', 'file-import',
  'file-invoice', 'filter-off', 'flame', 'flask', 'grain', 'heart', 'heartbeat', 'history', 'home', 'id', 'inbox',
  'layout-dashboard', 'lifebuoy', 'lock', 'logout', 'message-forward', 'pencil', 'pill', 'player-pause', 'plus', 'printer',
  'qrcode', 'receipt', 'refresh', 'report-analytics', 'ruler-measure', 'scale', 'scan', 'search', 'send', 'shield-lock',
  'speakerphone', 'stethoscope', 'table-export', 'tag', 'thermometer', 'ticket', 'timeline-event', 'upload', 'user-circle',
  'user-cog', 'user-plus', 'users', 'vaccine', 'x', 'zebu-silhouette',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/** `label` có giá trị khi icon đứng một mình và mang nghĩa; icon đi kèm chữ thì để trống. */
export function Icon({ name, size = 16, label, className = '', style }: { name: IconName; size?: number; label?: string; className?: string; style?: CSSProperties }) {
  const mask = `url("${urls[`../assets/icons/${name}.svg`]}") center / contain no-repeat`
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width: size, height: size, WebkitMask: mask, mask, ...style }}
    />
  )
}
