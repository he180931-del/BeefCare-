import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('herd entry and exit own their pages, data, and API modules', () => {
  const required = [
    'features/herd-entry/api/index.ts',
    'features/herd-entry/data/importsData.ts',
    'features/herd-entry/data/entryData.ts',
    'features/herd-entry/pages/ImportList.tsx',
    'features/herd-entry/pages/ImportNew.tsx',
    'features/herd-entry/pages/ImportDetail.tsx',
    'features/herd-entry/components/CancelModal.tsx',
    'features/herd-entry/components/ExcelModal.tsx',
    'features/herd-entry/components/PayModal.tsx',
    'features/herd-entry/components/RowEditModal.tsx',
    'features/herd-entry/components/parts.tsx',
    'features/herd-exit/api/index.ts',
    'features/herd-exit/data/exportsData.ts',
    'features/herd-exit/data/exitData.ts',
    'data/cattleData.ts',
    'features/herd-exit/pages/ExportList.tsx',
    'features/herd-exit/pages/ExportNew.tsx',
    'features/herd-exit/pages/ExportDetail.tsx',
    'features/herd-exit/components/CancelModal.tsx',
    'features/herd-exit/components/CollectModal.tsx',
    'features/herd-exit/components/DeathView.tsx',
    'features/herd-exit/components/PickModal.tsx',
    'features/herd-exit/components/RejectModal.tsx',
    'features/herd-exit/components/parts.tsx',
  ]

  for (const relativePath of required) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `missing feature module: ${relativePath}`)
  }

  for (const legacyPath of ['pages/ImportList.tsx', 'pages/ImportNew.tsx', 'pages/ImportDetail.tsx', 'pages/ExportList.tsx', 'pages/ExportNew.tsx', 'pages/ExportDetail.tsx', 'data/importsData.ts', 'data/exportsData.ts', 'data/mock.ts']) {
    assert.equal(existsSync(resolve(root, legacyPath)), false, `legacy feature module remains: ${legacyPath}`)
  }
})

test('list pages normalize the initial null query data before filtering', () => {
  const entryList = readFileSync(resolve(root, 'features/herd-entry/pages/ImportList.tsx'), 'utf8')
  const exitList = readFileSync(resolve(root, 'features/herd-exit/pages/ExportList.tsx'), 'utf8')

  assert.match(entryList, /const \{ data, loading, error \} = useQuery/)
  assert.match(entryList, /const imports = data \?\? \[\]/)
  assert.match(exitList, /const \{ data, loading, error \} = useQuery/)
  assert.match(exitList, /const exports = data \?\? \[\]/)
})

test('draft actions preserve the selected voucher id and new pages only restore explicit drafts', () => {
  const entryList = readFileSync(resolve(root, 'features/herd-entry/pages/ImportList.tsx'), 'utf8')
  const entryNew = readFileSync(resolve(root, 'features/herd-entry/pages/ImportNew.tsx'), 'utf8')
  const exitList = readFileSync(resolve(root, 'features/herd-exit/pages/ExportList.tsx'), 'utf8')
  const exitNew = readFileSync(resolve(root, 'features/herd-exit/pages/ExportNew.tsx'), 'utf8')

  assert.match(entryList, /herd-entry\/new\?id=\$\{encodeURIComponent\(r\.id\)\}/)
  assert.match(exitList, /herd-exit\/new\?id=\$\{encodeURIComponent\(r\.id\)\}/)
  assert.match(entryNew, /useSearchParams\(\)/)
  assert.match(entryNew, /getEntryDraftState\(imports, draftId\)/)
  assert.match(exitNew, /useSearchParams\(\)/)
  assert.match(exitNew, /getExitDraftState\(exports, draftId\)/)
})

test('rich entry and exit pages wire feature-owned modal and helper components', () => {
  const entryNew = readFileSync(resolve(root, 'features/herd-entry/pages/ImportNew.tsx'), 'utf8')
  const entryDetail = readFileSync(resolve(root, 'features/herd-entry/pages/ImportDetail.tsx'), 'utf8')
  const exitNew = readFileSync(resolve(root, 'features/herd-exit/pages/ExportNew.tsx'), 'utf8')
  const exitDetail = readFileSync(resolve(root, 'features/herd-exit/pages/ExportDetail.tsx'), 'utf8')

  assert.match(entryNew, /RowEditModal/)
  assert.match(entryNew, /ExcelModal/)
  assert.match(entryDetail, /PayModal/)
  assert.match(entryDetail, /CancelModal/)
  assert.match(exitNew, /PickModal/)
  assert.match(exitDetail, /CollectModal/)
  assert.match(exitDetail, /CancelModal/)
  assert.match(exitDetail, /DeathView|RejectModal/)
})

test('rich lifecycle pages use feature API mutations instead of the legacy store facade', () => {
  const entryNew = readFileSync(resolve(root, 'features/herd-entry/pages/ImportNew.tsx'), 'utf8')
  const entryDetail = readFileSync(resolve(root, 'features/herd-entry/pages/ImportDetail.tsx'), 'utf8')
  const exitNew = readFileSync(resolve(root, 'features/herd-exit/pages/ExportNew.tsx'), 'utf8')
  const exitDetail = readFileSync(resolve(root, 'features/herd-exit/pages/ExportDetail.tsx'), 'utf8')
  for (const source of [entryNew, entryDetail, exitNew, exitDetail]) {
    assert.doesNotMatch(source, /useStore|addImport|addExport|updateImport|updateExport/)
  }
  assert.match(entryNew, /useMutation\(saveHerdEntry\)/)
  assert.match(exitNew, /useMutation\(saveHerdExit\)/)
  assert.match(entryDetail, /voidHerdEntry/)
  assert.match(exitDetail, /cancelHerdExit|CollectModal/)
})

test('entry editor receives canonical pen rows instead of the legacy static barn list', () => {
  const entryNew = readFileSync(resolve(root, 'features/herd-entry/pages/ImportNew.tsx'), 'utf8')
  const rowEdit = readFileSync(resolve(root, 'features/herd-entry/components/RowEditModal.tsx'), 'utf8')
  assert.match(entryNew, /useQuery\(\(\) => pens\.list\(\)/)
  assert.match(entryNew, /canonicalPens/)
  assert.match(entryNew, /pens=\{importBarns\}/)
  assert.doesNotMatch(rowEdit, /IMPORT_BARNS\.map/)
})

test('exit cancellation copy is derived from canonical pens', () => {
  const cancelModal = readFileSync(resolve(root, 'features/herd-exit/components/CancelModal.tsx'), 'utf8')
  assert.match(cancelModal, /useQuery\(\(\) => pens\.list\(\)/)
  assert.match(cancelModal, /occupancyText/)
  assert.doesNotMatch(cancelModal, /43\/50|47\/50/)
})

test('exit occupancy normalizes compact and legacy barn labels to one pen code', async () => {
  const { penCode, restoreCounts } = await import(`../features/herd-exit/data/occupancy.ts?occupancy=${Date.now()}`)
  assert.equal(penCode('B1'), 'B1')
  assert.equal(penCode('B1 – Vỗ béo'), 'B1')
  assert.equal(penCode('B1 Vỗ béo'), 'B1')
  assert.deepEqual(restoreCounts([{ barn: 'B1' }, { barn: 'B1 – Vỗ béo' }, { barn: 'B1 Vỗ béo' }]), { B1: 3 })
})
