import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(outputDirectory, '../..')
const featuresRoot = join(projectRoot, 'frontend/src/features')

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const preferredSubpackageOrder = ['pages', 'components', 'api', 'domain', 'data', 'hooks', 'types']
const subpackageRank = new Map(preferredSubpackageOrder.map((name, index) => [name, index]))

function wrapWords(words, maxCharacters = 74) {
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} · ${word}` : word
    if (current && next.length > maxCharacters) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function representativeRootFiles(files) {
  const priority = (name) => {
    if (name === 'index.ts') return 0
    if (name === 'types.ts') return 1
    if (/validation/i.test(name)) return 2
    if (/Context|Provider|Gate|sessionContext/.test(name)) return 3
    return 4
  }
  const sorted = [...files].sort((a, b) => priority(a) - priority(b) || a.localeCompare(b))
  const shown = sorted.slice(0, 5)
  if (sorted.length > shown.length) shown.push(`+${sorted.length - shown.length} modules`)
  return shown
}

const features = readdirSync(featuresRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const children = readdirSync(join(featuresRoot, entry.name), { withFileTypes: true })
    const subpackages = children
      .filter((child) => child.isDirectory())
      .map((child) => child.name)
      .sort((a, b) => (subpackageRank.get(a) ?? 99) - (subpackageRank.get(b) ?? 99) || a.localeCompare(b))
    const rootFiles = children.filter((child) => child.isFile()).map((child) => child.name)
    return { name: entry.name, subpackages, rootFiles: representativeRootFiles(rootFiles) }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const canvasWidth = 2400
const canvasHeight = 1780
const outer = { x: 50, y: 50, width: 2300, height: 1510 }
const columns = 4
const rows = Math.ceil(features.length / columns)
const cardGapX = 18
const cardGapY = 18
const cardStartX = outer.x + 28
const cardStartY = outer.y + 72
const cardWidth = (outer.width - 56 - cardGapX * (columns - 1)) / columns
const cardHeight = (outer.height - 96 - cardGapY * (rows - 1)) / rows

function packagePath(x, y, width, height, tabWidth) {
  return `M ${x} ${y + height} L ${x} ${y} L ${x + tabWidth} ${y} L ${x + tabWidth} ${y + 28} L ${x + width} ${y + 28} L ${x + width} ${y + height} Z`
}

function featurePackage(feature, index) {
  const column = index % columns
  const row = Math.floor(index / columns)
  const x = cardStartX + column * (cardWidth + cardGapX)
  const y = cardStartY + row * (cardHeight + cardGapY)
  const tabWidth = Math.min(cardWidth * 0.66, Math.max(155, 52 + feature.name.length * 9))
  const cellColumns = 3
  const cellGapX = 10
  const cellGapY = 9
  const padX = 18
  const cellWidth = (cardWidth - padX * 2 - cellGapX * (cellColumns - 1)) / cellColumns
  const cellHeight = 34
  const cellsStartY = y + 48

  const subpackages = feature.subpackages.map((name, itemIndex) => {
    const cellColumn = itemIndex % cellColumns
    const cellRow = Math.floor(itemIndex / cellColumns)
    const cellX = x + padX + cellColumn * (cellWidth + cellGapX)
    const cellY = cellsStartY + cellRow * (cellHeight + cellGapY)
    const miniTab = Math.min(55, cellWidth * 0.4)
    return `
      <path d="M ${cellX} ${cellY + cellHeight} L ${cellX} ${cellY} L ${cellX + miniTab} ${cellY} L ${cellX + miniTab} ${cellY + 8} L ${cellX + cellWidth} ${cellY + 8} L ${cellX + cellWidth} ${cellY + cellHeight} Z" class="subpackage" />
      <text x="${cellX + cellWidth / 2}" y="${cellY + 23}" text-anchor="middle" class="subpackage-name">${escapeXml(name)}</text>`
  }).join('')

  const subpackageRows = Math.max(1, Math.ceil(feature.subpackages.length / cellColumns))
  const rootY = cellsStartY + subpackageRows * (cellHeight + cellGapY) + 2
  const rootLines = wrapWords(feature.rootFiles, 72).slice(0, 2)
  const rootText = rootLines.length
    ? rootLines.map((line, lineIndex) => `<text x="${x + padX}" y="${rootY + lineIndex * 14}" class="root-file">${lineIndex === 0 ? '«module» ' : ''}${escapeXml(line)}</text>`).join('')
    : `<text x="${x + padX}" y="${rootY}" class="root-file">No root artifact</text>`

  return `
    <g aria-label="Feature package ${escapeXml(feature.name)}">
      <path d="${packagePath(x, y, cardWidth, cardHeight, tabWidth)}" class="feature-package" />
      <text x="${x + tabWidth / 2}" y="${y + 20}" text-anchor="middle" class="feature-name">${escapeXml(feature.name)}</text>
      ${subpackages}
      ${rootText}
    </g>`
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-labelledby="title description">
  <title id="title">BeefCare frontend feature package detail</title>
  <desc id="description">UML package containment diagram generated from the current frontend source tree. Each feature package contains its real folder-level subpackages and representative root modules.</desc>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #111; }
    .outer-package { fill: #fff; stroke: #292929; stroke-width: 1.8; }
    .outer-title { font-size: 17px; font-weight: 700; }
    .feature-package { fill: #fff; stroke: #3e3e3e; stroke-width: 1.3; }
    .feature-name { font-size: 12px; font-weight: 700; }
    .subpackage { fill: #fff; stroke: #565656; stroke-width: 1.05; }
    .subpackage-name { font-size: 10.5px; }
    .root-file { font-size: 9.5px; font-style: italic; fill: #444; }
    .legend-text { font-size: 12px; }
    .caption { font-family: 'Times New Roman', Times, serif; font-size: 27px; font-style: italic; font-weight: 700; }
    .caption-detail { font-family: 'Times New Roman', Times, serif; font-size: 23px; font-style: italic; font-weight: 700; text-decoration: underline; }
  </style>
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#fff" />
  <path d="${packagePath(outer.x, outer.y, outer.width, outer.height, 190)}" class="outer-package" />
  <text x="${outer.x + 95}" y="${outer.y + 24}" text-anchor="middle" class="outer-title">features</text>
  ${features.map(featurePackage).join('\n')}
  <g aria-label="Legend" transform="translate(650 1590)">
    <path d="${packagePath(0, 0, 120, 38, 48)}" class="feature-package" />
    <text x="134" y="25" class="legend-text">feature package</text>
    <path d="M 360 36 L 360 4 L 390 4 L 390 12 L 470 12 L 470 36 Z" class="subpackage" />
    <text x="484" y="25" class="legend-text">real folder-level subpackage</text>
    <text x="790" y="25" class="root-file">«module» types.ts</text>
    <text x="910" y="25" class="legend-text">representative root artifact</text>
  </g>
  <text x="1200" y="1690" text-anchor="middle" class="caption">Figure: BeefCare Frontend Feature Package Diagram</text>
  <text x="1200" y="1728" text-anchor="middle" class="caption-detail">Current State — Expanded Package Containment</text>
</svg>`

writeFileSync(join(outputDirectory, 'frontend-feature-package-detail.svg'), svg)
