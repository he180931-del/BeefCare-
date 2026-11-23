import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectory = dirname(fileURLToPath(import.meta.url))

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

function packageBox({ name, x, y, width, height, columns, items, tabWidth }) {
  const tab = tabWidth ?? Math.max(105, Math.min(210, 54 + name.length * 8))
  const gapX = 16
  const gapY = 14
  const padX = 30
  const startY = y + 64
  const cellWidth = (width - padX * 2 - gapX * (columns - 1)) / columns
  const rows = Math.ceil(items.length / columns)
  const availableHeight = height - 88
  const cellHeight = Math.min(48, (availableHeight - gapY * Math.max(0, rows - 1)) / rows)

  const cells = items.map((rawItem, index) => {
    const item = typeof rawItem === 'string' ? { name: rawItem } : rawItem
    const column = index % columns
    const row = Math.floor(index / columns)
    const cellX = x + padX + column * (cellWidth + gapX)
    const cellY = startY + row * (cellHeight + gapY)
    const fontSize = item.name.length > 20 ? 9 : item.name.length > 15 ? 10 : 11
    if (item.kind === 'package') {
      const miniTab = Math.min(74, cellWidth * 0.46)
      return `
        <path d="M ${cellX} ${cellY + cellHeight} L ${cellX} ${cellY} L ${cellX + miniTab} ${cellY} L ${cellX + miniTab} ${cellY + 10} L ${cellX + cellWidth} ${cellY + 10} L ${cellX + cellWidth} ${cellY + cellHeight} Z" class="member package-member" />
        <text x="${cellX + cellWidth / 2}" y="${cellY + cellHeight / 2 + 8}" text-anchor="middle" font-size="${fontSize}">${escapeXml(item.name)}</text>`
    }
    return `
      <rect x="${cellX}" y="${cellY}" width="${cellWidth}" height="${cellHeight}" class="member" />
      <text x="${cellX + cellWidth / 2}" y="${cellY + cellHeight / 2 - 4}" text-anchor="middle" class="stereotype">«${escapeXml(item.stereotype ?? 'module')}»</text>
      <text x="${cellX + cellWidth / 2}" y="${cellY + cellHeight / 2 + 12}" text-anchor="middle" font-size="${fontSize}">${escapeXml(item.name)}</text>`
  }).join('')

  return `
    <g class="package" aria-label="Package ${escapeXml(name)}">
      <path d="M ${x} ${y + height} L ${x} ${y} L ${x + tab} ${y} L ${x + tab} ${y + 34} L ${x + width} ${y + 34} L ${x + width} ${y + height} Z" class="package-outline" />
      <text x="${x + tab / 2}" y="${y + 23}" text-anchor="middle" class="package-title">${escapeXml(name)}</text>
      ${cells}
    </g>`
}

const edgeLabels = []
function useEdge(path, labelX, labelY) {
  edgeLabels.push(`<text x="${labelX}" y="${labelY}" text-anchor="middle" class="edge-label">«use»</text>`)
  return `<path d="${path}" class="dependency" marker-end="url(#open-arrow)" />`
}

const packages = [
  {
    name: 'types', x: 90, y: 60, width: 520, height: 250, columns: 3,
    items: ['Cattle', 'Pen', 'CattleEvent', 'HerdEntry', 'HerdExit', 'Payment', 'EntryDraft', 'ExitDraft', 'StatusChip'].map((name) => ({ name, stereotype: 'interface' })),
  },
  {
    name: 'components', x: 690, y: 60, width: 520, height: 250, columns: 3,
    items: ['Layout', 'TechnicianLayout', 'Modal', 'Icon', 'QrCamera', 'ScreenStub'].map((name) => ({ name, stereotype: 'component' })).concat([
      { name: 'interactiveTableRow', stereotype: 'module' }, { name: 'ui.tsx', stereotype: 'module' }, { name: '...', stereotype: 'component' },
    ]),
  },
  {
    name: 'assets', x: 1335, y: 95, width: 475, height: 215, columns: 3,
    items: ['icons/', 'logo.png', 'farm.png', 'wave.png', 'zebu-silhouette', '...'].map((name) => ({ name, stereotype: 'artifact' })),
  },
  {
    name: 'hooks', x: 90, y: 430, width: 520, height: 220, columns: 2,
    items: ['useApi', 'useDemoState'].map((name) => ({ name, stereotype: 'hook' })),
  },
  {
    name: 'app', x: 690, y: 410, width: 520, height: 255, columns: 3,
    items: [
      { name: 'main.tsx', stereotype: 'module' }, { name: 'App.tsx', stereotype: 'router' }, { name: 'LegalPage', stereotype: 'page' },
      { name: 'farm routes', stereotype: 'route group' }, { name: 'herd routes', stereotype: 'route group' }, { name: 'care routes', stereotype: 'route group' },
      { name: 'feed routes', stereotype: 'route group' }, { name: 'platform routes', stereotype: 'route group' }, { name: 'Placeholder', stereotype: 'page' },
    ],
  },
  {
    name: 'api', x: 1335, y: 410, width: 475, height: 255, columns: 3,
    items: [
      { name: 'backendClient', stereotype: 'service' }, { name: 'backendTransport', stereotype: 'adapter' }, { name: 'client', stereotype: 'local adapter' },
      { name: 'cattleApi', stereotype: 'service' }, { name: 'penApi', stereotype: 'service' }, { name: 'herdDomainApi', stereotype: 'facade' },
      { name: 'currentFarm', stereotype: 'module' }, { name: 'sessionLifecycle', stereotype: 'module' }, { name: 'collectionSchemas', stereotype: 'schema module' },
    ],
  },
  {
    name: 'data', x: 90, y: 820, width: 360, height: 215, columns: 2,
    items: ['cattleData', 'cowsData', 'penData', 'pensData', 'format', '...'].map((name) => ({ name, stereotype: 'data module' })),
  },
  {
    name: 'pages', x: 90, y: 1090, width: 360, height: 150, columns: 1,
    items: [{ name: 'Placeholder.tsx', stereotype: 'page' }],
  },
  {
    name: 'features', x: 540, y: 790, width: 1270, height: 450, columns: 4,
    items: [
      'authentication', 'authorization', 'account', 'farm-workspace',
      'cattle', 'pen-management', 'herd-entry', 'herd-exit',
      'growth', 'vaccination', 'health', 'reproduction',
      'farm-overview', 'farm-announcements', 'farm-catalogue', 'feed-stock',
      'notifications', 'subscription', 'support', 'platform-admin',
      'platform-service', 'platform-finance', 'platform-support', '...',
    ].map((name) => ({ name, kind: 'package' })),
  },
]

const edges = [
  // Local, short dependencies are kept straight; longer ones are routed in the
  // whitespace between packages so the package contents stay legible.
  useEdge('M 690 185 L 610 185', 650, 170),
  useEdge('M 1335 185 L 1210 185', 1273, 170),
  useEdge('M 950 410 L 950 310', 980, 366),
  useEdge('M 950 665 L 950 790', 985, 735),
  useEdge('M 690 610 L 650 610 L 650 760 L 475 760 L 475 1165 L 450 1165', 560, 746),
  useEdge('M 750 790 L 750 710 L 625 710 L 625 325 L 720 325 L 720 310', 675, 314),
  useEdge('M 540 900 L 500 900 L 500 700 L 350 700 L 350 650', 425, 686),
  useEdge('M 1500 790 L 1500 665', 1535, 735),
  useEdge('M 540 950 L 450 950', 495, 935),
  useEdge('M 600 790 L 45 790 L 45 185 L 90 185', 175, 774),
  useEdge('M 1450 410 L 1450 350 L 590 350 L 590 310', 1110, 340),
  useEdge('M 610 500 L 640 500 L 640 375 L 1310 375 L 1310 500 L 1335 500', 975, 365),
]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1900" height="1450" viewBox="0 0 1900 1450" role="img" aria-labelledby="title description">
  <title id="title">BeefCare frontend package diagram — current state</title>
  <desc id="description">UML package diagram showing current source packages, representative UML elements, and dashed use dependencies.</desc>
  <defs>
    <marker id="open-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#555" stroke-width="1.2" />
    </marker>
    <style>
      text { font-family: Arial, Helvetica, sans-serif; fill: #111; }
      .package-outline { fill: #fff; stroke: #303030; stroke-width: 1.5; }
      .package-title { font-size: 14px; font-weight: 700; }
      .member { fill: #fff; stroke: #4f4f4f; stroke-width: 1.15; }
      .package-member { stroke-width: 1.25; }
      .stereotype { font-size: 9px; font-style: italic; fill: #333; }
      .dependency { fill: none; stroke: #606060; stroke-width: 1.3; stroke-dasharray: 6 4; }
      .edge-label { font-size: 10px; font-weight: 600; fill: #444; paint-order: stroke; stroke: #fff; stroke-width: 4px; }
      .caption { font-family: 'Times New Roman', Times, serif; font-size: 25px; font-style: italic; font-weight: 700; }
      .caption-detail { font-family: 'Times New Roman', Times, serif; font-size: 23px; font-style: italic; font-weight: 700; text-decoration: underline; }
    </style>
  </defs>
  <rect width="1900" height="1450" fill="#fff" />
  <g aria-label="Use dependencies">${edges.join('\n')}</g>
  <g aria-label="Packages">${packages.map(packageBox).join('\n')}</g>
  <g aria-label="Dependency labels">${edgeLabels.join('\n')}</g>
  <g aria-label="UML notation legend" transform="translate(510 1265)">
    <path d="M 0 28 L 0 0 L 24 0 L 24 8 L 64 8 L 64 28 Z" class="package-outline" />
    <text x="78" y="19" font-size="12">package</text>
    <rect x="190" y="0" width="128" height="32" class="member" />
    <text x="254" y="12" text-anchor="middle" class="stereotype">«interface»</text>
    <text x="254" y="26" text-anchor="middle" font-size="10">Cattle</text>
    <text x="332" y="19" font-size="12">typed UML element</text>
    <path d="M 535 16 L 650 16" class="dependency" marker-end="url(#open-arrow)" />
    <text x="592" y="9" text-anchor="middle" class="edge-label">«use»</text>
    <text x="666" y="19" font-size="12">dependency</text>
  </g>
  <text x="950" y="1355" text-anchor="middle" class="caption">Figure: BeefCare Frontend Package Diagram</text>
  <text x="950" y="1390" text-anchor="middle" class="caption-detail">Current State — UML Package Detail</text>
</svg>`

writeFileSync(join(outputDirectory, 'frontend-package-diagram-current.svg'), svg)
