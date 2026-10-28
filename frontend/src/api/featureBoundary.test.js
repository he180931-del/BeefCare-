import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('herd entry and exit own their pages, data, and API modules', () => {
  const required = [
    'features/herd-entry/api/index.js',
    'features/herd-entry/data/importsData.js',
    'features/herd-entry/pages/ImportList.jsx',
    'features/herd-entry/pages/ImportNew.jsx',
    'features/herd-entry/pages/ImportDetail.jsx',
    'features/herd-exit/api/index.js',
    'features/herd-exit/data/exportsData.js',
    'features/herd-exit/pages/ExportList.jsx',
    'features/herd-exit/pages/ExportNew.jsx',
    'features/herd-exit/pages/ExportDetail.jsx',
  ]

  for (const relativePath of required) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `missing feature module: ${relativePath}`)
  }

  for (const legacyPath of ['pages/ImportList.jsx', 'pages/ImportNew.jsx', 'pages/ImportDetail.jsx', 'pages/ExportList.jsx', 'pages/ExportNew.jsx', 'pages/ExportDetail.jsx', 'data/importsData.js', 'data/exportsData.js']) {
    assert.equal(existsSync(resolve(root, legacyPath)), false, `legacy feature module remains: ${legacyPath}`)
  }
})
