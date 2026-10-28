import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('herd entry and exit own their pages, data, and API modules', () => {
  const required = [
    'features/herd-entry/api/index.js',
    'features/herd-entry/data/importsData.js',
    'features/herd-entry/data/entryData.js',
    'features/herd-entry/pages/ImportList.jsx',
    'features/herd-entry/pages/ImportNew.jsx',
    'features/herd-entry/pages/ImportDetail.jsx',
    'features/herd-exit/api/index.js',
    'features/herd-exit/data/exportsData.js',
    'features/herd-exit/data/exitData.js',
    'features/herd-exit/pages/ExportList.jsx',
    'features/herd-exit/pages/ExportNew.jsx',
    'features/herd-exit/pages/ExportDetail.jsx',
  ]

  for (const relativePath of required) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `missing feature module: ${relativePath}`)
  }

  for (const legacyPath of ['pages/ImportList.jsx', 'pages/ImportNew.jsx', 'pages/ImportDetail.jsx', 'pages/ExportList.jsx', 'pages/ExportNew.jsx', 'pages/ExportDetail.jsx', 'data/importsData.js', 'data/exportsData.js', 'data/mock.js']) {
    assert.equal(existsSync(resolve(root, legacyPath)), false, `legacy feature module remains: ${legacyPath}`)
  }
})

test('list pages normalize the initial null query data before filtering', () => {
  const entryList = readFileSync(resolve(root, 'features/herd-entry/pages/ImportList.jsx'), 'utf8')
  const exitList = readFileSync(resolve(root, 'features/herd-exit/pages/ExportList.jsx'), 'utf8')

  assert.match(entryList, /const \{ data, loading, error \} = useQuery/)
  assert.match(entryList, /const imports = data \?\? \[\]/)
  assert.match(exitList, /const \{ data, loading, error \} = useQuery/)
  assert.match(exitList, /const exports = data \?\? \[\]/)
})

test('draft actions preserve the selected voucher id and new pages only restore explicit drafts', () => {
  const entryList = readFileSync(resolve(root, 'features/herd-entry/pages/ImportList.jsx'), 'utf8')
  const entryNew = readFileSync(resolve(root, 'features/herd-entry/pages/ImportNew.jsx'), 'utf8')
  const exitList = readFileSync(resolve(root, 'features/herd-exit/pages/ExportList.jsx'), 'utf8')
  const exitNew = readFileSync(resolve(root, 'features/herd-exit/pages/ExportNew.jsx'), 'utf8')

  assert.match(entryList, /herd-entry\/new\?id=\$\{encodeURIComponent\(r\.id\)\}/)
  assert.match(exitList, /herd-exit\/new\?id=\$\{encodeURIComponent\(r\.id\)\}/)
  assert.match(entryNew, /useSearchParams\(\)/)
  assert.match(entryNew, /getEntryDraftState\(imports, draftId\)/)
  assert.match(exitNew, /useSearchParams\(\)/)
  assert.match(exitNew, /getExitDraftState\(exports, draftId\)/)
})
