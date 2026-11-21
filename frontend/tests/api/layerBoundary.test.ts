import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { buildSourceGraph, routeLoaderViolations, routeTableViolations, type ImportEdge } from './support/importGraph'

// docs/frontend-refactor-guide.md §2: `shared` is neutral infrastructure, `app` composes features through their
// public `index.ts`. These checks keep the phase-1 layers from drifting back.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')

const sourceFiles = (dir: string): string[] =>
  readdirSync(join(srcDir, dir), { recursive: true })
    .filter((file): file is string => typeof file === 'string' && /\.(ts|tsx)$/.test(file))
    .map((file) => join(dir, file).split(sep).join('/'))

const sourceGraph = buildSourceGraph(srcDir)
const edgesFrom = (file: string): ImportEdge[] => sourceGraph.edges.filter((edge) => edge.source === file)
const targetPath = (target: string): string => target.replace(/\/index\.tsx?$/, '').replace(/\.tsx?$/, '')
const importTargets = (file: string): string[] => edgesFrom(file).map((edge) => targetPath(edge.target))

const LEGACY_ROOTS = ['api/', 'components/', 'hooks/', 'data/', 'pages/']

test('shared imports nothing from app, features or the legacy root folders', () => {
  const violations = sourceFiles('shared').flatMap((file) => importTargets(file)
    .filter((target) => target.startsWith('app/') || target.startsWith('features/') || target === 'types'
      || LEGACY_ROOTS.some((root) => target.startsWith(root)))
    .map((target) => `${file} -> ${target}`))
  assert.deepEqual(violations, [])
})

test('app reaches a feature only through its public index or its route loaders', () => {
  const violations = sourceFiles('app').flatMap((file) => importTargets(file)
    .filter((target) => /^features\/[^/]+\/(?!(index|routes)$).+/.test(target))
    .map((target) => `${file} -> ${target}`))
  assert.deepEqual(violations, [])
})

// Refactor phase 4c: the route table imports routes.ts, not index.ts. A routes.ts holds lazy page loaders only, so the
// entry chunk carries no feature screen or API and an index (the API other features use) loads with its users.
test('feature routes.ts files hold lazy page loaders only', () => {
  const offenders = sourceFiles('features').filter((file) => /^features\/[^/]+\/routes\.ts$/.test(file))
    .flatMap((file) => routeLoaderViolations(join(srcDir, file), readFileSync(join(srcDir, file), 'utf8')))
  assert.deepEqual(offenders, [])
  assert.deepEqual(
    routeTableViolations(
      join(srcDir, 'app/routes/AppRoutes.tsx'),
      readFileSync(join(srcDir, 'app/routes/AppRoutes.tsx'), 'utf8'),
      {
        // Authorization provides route policy, not a page. Authentication is the one temporary screen exception:
        // its routes.ts is introduced only by Task 9.0, so this exact compatibility import must not become a glob.
        allowedStaticFeatureImports: ['features/authorization', 'features/authentication'],
      },
    ),
    [],
  )
})

const ALLOWED_DEEP_IMPORTS = new Set<string>()

test('a feature reaches another feature only through its public index', () => {
  const violations = sourceFiles('features').flatMap((file) => {
    const owner = file.split('/')[1]
    return importTargets(file)
      .filter((target) => {
        const match = target.match(/^features\/([^/]+)\/(.+)$/)
        return match !== null && match[1] !== owner && match[2] !== 'index'
      })
      .map((target) => `${file} -> ${target}`)
      .filter((edge) => !ALLOWED_DEEP_IMPORTS.has(edge))
  })
  assert.deepEqual(violations, [])
})

test('herd-entry owns its entry-only contracts instead of importing the legacy root types', () => {
  const violations = sourceFiles('features/herd-entry')
    .flatMap((file) => importTargets(file)
      .filter((target) => target === 'types')
      .map((target) => `${file} -> ${target}`))
  assert.deepEqual(violations, [])
})

test('shared user-facing errors stay transport-generic', () => {
  const source = readFileSync(join(srcDir, 'shared/api/userFacingError.ts'), 'utf8')
  assert.doesNotMatch(source, /MSG-(?:FE|COM)-/)
})

// Refactor phase 4b: the session (who is signed in, the tab's farm, sign-out and expiry) belongs to the app. Features
// use the app only through its layouts and these session modules; the provider, routes and the rest are the app's own.
const FEATURE_APP_IMPORTS = new Set([
  'app/layouts/FarmPlatformLayout', 'app/layouts/TechnicianLayout',
  'app/session/currentFarm', 'app/session/sessionContext', 'app/session/sessionLifecycle',
])

test('features reach the app only through its layouts and the public session modules', () => {
  const violations = sourceFiles('features').flatMap((file) => importTargets(file)
    .filter((target) => target.startsWith('app/') && !FEATURE_APP_IMPORTS.has(target))
    .map((target) => `${file} -> ${target}`))
  assert.deepEqual(violations, [])
})

test('authentication, authorization and farm-workspace meet through the session, not through each other', () => {
  const edges = (from: string, to: string) => sourceFiles(`features/${from}`).flatMap((file) => importTargets(file)
    .filter((target) => target === `features/${to}` || target.startsWith(`features/${to}/`))
    .map((target) => `${file} -> ${target}`))
  // Sign-in knows nothing of roles or farms; role policy knows nothing of the farm workspace.
  assert.deepEqual([...edges('authentication', 'authorization'), ...edges('authentication', 'farm-workspace'), ...edges('authorization', 'farm-workspace')], [])
  assert.equal(existsSync(join(srcDir, 'app/session/selectedFarm.ts')), false, 'the farm is kept per tab in app/session/currentFarm')
})

test('the entry stays thin and the route table, providers and layouts live in app', () => {
  assert.equal(readFileSync(join(srcDir, 'main.tsx'), 'utf8').trim(), "import './app/bootstrap'")
  for (const path of ['app/bootstrap.tsx', 'app/routes/AppRoutes.tsx', 'app/providers/AppProviders.tsx', 'app/layouts/FarmPlatformLayout.tsx', 'app/layouts/TechnicianLayout.tsx', 'app/session/currentFarm.ts', 'app/session/sessionContext.ts', 'app/session/SessionProvider.tsx', 'app/session/sessionLifecycle.ts', 'app/styles/index.css']) {
    assert.equal(existsSync(join(srcDir, path)), true, `missing ${path}`)
  }
  assert.equal(existsSync(join(srcDir, 'pages')), false, 'feature screens belong to features/<feature>/pages')
})

// What is still allowed in the legacy root folders after refactor phase 2, and why. New shared code goes to `shared/` or
// `app/`; feature code goes to its feature. Removing an entry is fine, adding one needs a reason here.
type LegacyRuntime = 'demo-only' | 'production-compatibility' | 'mixed-legacy' | 'dead-until-removal'
const APPROVED_REMOVAL_TASKS = new Set(['Task 2.5A', 'Task 3.8'])

type LegacyAllowance = {
  owner: string
  allowedConsumers: readonly string[]
  runtime: LegacyRuntime
  reason: string
  removalTask: string
}

const LEGACY_ALLOWED: Record<string, LegacyAllowance> = {
  'api/client.ts': {
    owner: 'local-demo-adapters',
    allowedConsumers: [
      'api/collectionSchemas.ts', 'api/herdDomainApi.ts', 'api/penApi.ts',
      'features/cattle/data/cattleLocalStore.ts', 'features/feed-stock/data/feedRationDemoStore.ts',
      'features/feed-stock/data/feedReceiptDemoStore.ts', 'features/herd-entry/api/herdEntryLocalApi.ts',
      'features/herd-exit/api/herdExitLocalApi.ts', 'features/pen-management/data/penLocalStore.ts',
    ],
    runtime: 'demo-only',
    reason: 'Local collection storage used by dev:mock adapters; no production backend boundary.',
    removalTask: 'Task 3.8',
  },
  'api/collectionSchemas.ts': {
    owner: 'local-demo-adapters',
    allowedConsumers: [
      'api/herdDomainApi.ts', 'api/penApi.ts', 'features/cattle/data/cattleLocalStore.ts',
      'features/herd-entry/api/herdEntryLocalApi.ts', 'features/herd-exit/api/herdExitLocalApi.ts',
      'features/pen-management/data/penLocalStore.ts',
    ],
    runtime: 'demo-only',
    reason: 'Collection schemas support the legacy local adapters only.',
    removalTask: 'Task 3.8',
  },
  'api/demoCattlePhotos.ts': {
    owner: 'cattle-demo-adapter',
    allowedConsumers: ['features/cattle/data/cattleLocalStore.ts'],
    runtime: 'demo-only',
    reason: 'Seeded cattle photos are used only by the Cattle local demo store.',
    removalTask: 'Task 2.5A',
  },
  'api/herdDomainApi.ts': {
    owner: 'local-demo-adapters',
    allowedConsumers: [
      'features/cattle/data/cattleLocalStore.ts', 'features/herd-entry/api/herdEntryLocalApi.ts',
      'features/herd-entry/data/entryLocalAdapter.ts', 'features/herd-exit/api/herdExitLocalApi.ts',
      'features/herd-exit/data/exitLocalAdapter.ts', 'features/pen-management/data/penLocalStore.ts',
    ],
    runtime: 'demo-only',
    reason: 'Aggregate local/demo adapter joining Cattle, Pen, Entry and Exit.',
    removalTask: 'Task 3.8',
  },
  'api/penApi.ts': {
    owner: 'pen-management',
    allowedConsumers: [],
    runtime: 'dead-until-removal',
    reason: 'Legacy pen adapter has no inbound source consumer at this checkpoint.',
    removalTask: 'Task 3.8',
  },
  'api/storageMigrations.ts': {
    owner: 'local-demo-adapters',
    allowedConsumers: ['api/herdDomainApi.ts', 'api/penApi.ts', 'features/pen-management/data/penLocalStore.ts'],
    runtime: 'demo-only',
    reason: 'Storage migration helpers are reachable only from legacy local persistence.',
    removalTask: 'Task 3.8',
  },
  'api/testUtils.ts': {
    owner: 'test-support',
    allowedConsumers: [],
    runtime: 'dead-until-removal',
    reason: 'Legacy source-side test helper has no inbound source consumer.',
    removalTask: 'Task 3.8',
  },
  'components/ui.tsx': {
    owner: 'herd-entry-exit-compatibility',
    allowedConsumers: [
      'features/feed-stock/components/FeedReceiptDialogs.tsx', 'features/feed-stock/pages/FeedReceiptFormPage.tsx',
      'features/feed-stock/pages/FeedStockAdjustmentFormPage.tsx', 'features/herd-entry/pages/ImportDetail.tsx',
      'features/herd-entry/pages/ImportNew.tsx', 'features/herd-exit/components/DeathView.tsx',
      'features/herd-exit/pages/ExportDetail.tsx', 'features/herd-exit/pages/ExportNew.tsx',
    ],
    runtime: 'production-compatibility',
    reason: 'Legacy UI still owns Entry/Exit business props and also has the documented Feed Stock consumers.',
    removalTask: 'Task 3.8',
  },
  'data/cattleData.ts': {
    owner: 'legacy-local-aggregate',
    allowedConsumers: ['api/herdDomainApi.ts'],
    runtime: 'demo-only',
    reason: 'Seeded cattle records remain reachable only through the legacy aggregate local adapter.',
    removalTask: 'Task 3.8',
  },
  'data/cowsData.ts': {
    owner: 'cattle-demo-adapter',
    allowedConsumers: ['features/cattle/data/cattleLocalStore.ts'],
    runtime: 'demo-only',
    reason: 'Seeded records remain behind the Cattle local demo adapter; production Cattle types now belong to the feature.',
    removalTask: 'Task 2.5A',
  },
  'data/penData.ts': {
    owner: 'pen-management',
    allowedConsumers: [],
    runtime: 'dead-until-removal',
    reason: 'Legacy pen seed module has no inbound source consumer at this checkpoint.',
    removalTask: 'Task 3.8',
  },
  'data/pensData.ts': {
    owner: 'legacy-local-aggregate',
    allowedConsumers: [
      'api/herdDomainApi.ts', 'api/penApi.ts', 'api/storageMigrations.ts', 'data/cowsData.ts',
      'data/penData.ts', 'features/herd-exit/data/exitData.ts', 'features/pen-management/data/penLocalStore.ts',
    ],
    runtime: 'demo-only',
    reason: 'Seeded pen records remain in the legacy local/demo adapter graph.',
    removalTask: 'Task 3.8',
  },
  'types.ts': {
    owner: 'herd-entry-exit-compatibility',
    allowedConsumers: [
      'api/collectionSchemas.ts', 'api/herdDomainApi.ts', 'api/penApi.ts', 'components/ui.tsx',
      'data/cattleData.ts', 'data/pensData.ts',
    ],
    runtime: 'production-compatibility',
    reason: 'Herd Exit and a small legacy aggregate still share an unresolved root type owner (PR-05/PR-08).',
    removalTask: 'Task 3.8',
  },
}

const LEGACY_FILES = [...sourceFiles('api'), ...sourceFiles('components'), ...sourceFiles('data'), 'types.ts']

const inboundConsumers = (graph: { edges: ImportEdge[] }, target: string): string[] => [...new Set(
  graph.edges.filter((edge) => edge.target === target).map((edge) => edge.source),
)].sort()

const legacyAllowanceViolations = (
  graph: { nodes: string[]; edges: ImportEdge[] },
  allowances: Record<string, LegacyAllowance>,
): string[] => {
  const violations: string[] = []
  const present = LEGACY_FILES.filter((file) => graph.nodes.includes(file))
  for (const file of present) {
    const allowance = allowances[file]
    if (!allowance) {
      violations.push(`${file}: missing legacy allowance`)
      continue
    }
    if (!allowance.owner || !allowance.reason || !allowance.removalTask) {
      violations.push(`${file}: allowance requires owner, reason, and removalTask`)
    }
    if (!APPROVED_REMOVAL_TASKS.has(allowance.removalTask)) {
      violations.push(`${file}: removalTask must be an approved Task ID`)
    }
    if (allowance.allowedConsumers.some((consumer) => /[*?]/.test(consumer))) {
      violations.push(`${file}: allowedConsumers must contain exact source paths, not globs`)
    }
    const actual = inboundConsumers(graph, file)
    const allowed = [...new Set(allowance.allowedConsumers)].sort()
    if (actual.join('\n') !== allowed.join('\n')) {
      const unexpected = actual.filter((consumer) => !allowed.includes(consumer))
      const missing = allowed.filter((consumer) => !actual.includes(consumer))
      if (unexpected.length > 0) violations.push(`${file}: unexpected inbound consumers: ${unexpected.join(', ')}`)
      if (missing.length > 0) violations.push(`${file}: allowance names non-consumers: ${missing.join(', ')}`)
    }
    if (actual.length === 0 && allowance.runtime !== 'dead-until-removal') {
      violations.push(`${file}: no inbound consumer requires runtime=dead-until-removal`)
    }
    if (actual.length > 0 && allowance.runtime === 'dead-until-removal') {
      violations.push(`${file}: dead-until-removal allowance has inbound consumers: ${actual.join(', ')}`)
    }
  }

  for (const edge of graph.edges) {
    if (!edge.source.startsWith('features/') || !edge.target.startsWith('data/')) continue
    const allowance = allowances[edge.target]
    if (!allowance?.allowedConsumers.includes(edge.source)) {
      violations.push(`feature production import from root data: ${edge.source} -> ${edge.target} (${edge.kind})`)
    }
  }
  return violations
}

const assertLegacyAllowances = (
  graph: { nodes: string[]; edges: ImportEdge[] },
  allowances: Record<string, LegacyAllowance>,
): void => {
  const violations = legacyAllowanceViolations(graph, allowances)
  if (violations.length > 0) throw new Error(`legacy allowance violation:\n${violations.join('\n')}`)
}

test('legacy allowance rejects a components/ui allowance that omits Feed Stock consumers', () => {
  const allowance: LegacyAllowance = {
    ...LEGACY_ALLOWED['components/ui.tsx'],
    allowedConsumers: [
      'features/herd-entry/pages/ImportDetail.tsx', 'features/herd-entry/pages/ImportNew.tsx',
      'features/herd-exit/components/DeathView.tsx', 'features/herd-exit/pages/ExportDetail.tsx',
      'features/herd-exit/pages/ExportNew.tsx',
    ],
  }
  assert.throws(
    () => assertLegacyAllowances(sourceGraph, { 'components/ui.tsx': allowance }),
    /components\/ui\.tsx: unexpected inbound consumers: .*features\/feed-stock/,
  )
})

test('legacy allowance requires an explicit dead-until-removal state for an unreferenced file', () => {
  const graph = { nodes: ['data/penData.ts'], edges: [] as ImportEdge[] }
  const allowance: LegacyAllowance = {
    ...LEGACY_ALLOWED['data/penData.ts'],
    runtime: 'demo-only',
  }
  assert.throws(
    () => assertLegacyAllowances(graph, { 'data/penData.ts': allowance }),
    /data\/penData\.ts: no inbound consumer requires runtime=dead-until-removal/,
  )
})

test('legacy allowance rejects a feature type-only import from root data', () => {
  const graph = {
    nodes: ['features/cattle/types.ts', 'data/cowsData.ts'],
    edges: [{
      source: 'features/cattle/types.ts', target: 'data/cowsData.ts', specifier: '../../../data/cowsData', kind: 'type' as const,
    }],
  }
  const allowance: LegacyAllowance = { ...LEGACY_ALLOWED['data/cowsData.ts'], allowedConsumers: [] }
  assert.throws(
    () => assertLegacyAllowances(graph, { 'data/cowsData.ts': allowance }),
    /feature production import from root data: features\/cattle\/types\.ts -> data\/cowsData\.ts \(type\)/,
  )
})

test('legacy allowance rejects stale or non-exact removal task metadata', () => {
  const graph = { nodes: ['data/penData.ts'], edges: [] as ImportEdge[] }
  const allowance: LegacyAllowance = {
    ...LEGACY_ALLOWED['data/penData.ts'],
    removalTask: 'WBS 2.5 remove dead Pen compatibility data',
  }
  assert.throws(
    () => assertLegacyAllowances(graph, { 'data/penData.ts': allowance }),
    /data\/penData\.ts: removalTask must be an approved Task ID/,
  )
})

test('legacy allowances match exact inbound consumers and preserve current debt as explicit exceptions', () => {
  assert.doesNotThrow(() => assertLegacyAllowances(sourceGraph, LEGACY_ALLOWED))
})

test('the legacy root folders only hold the documented leftovers', () => {
  assert.equal(existsSync(join(srcDir, 'hooks')), false, 'shared hooks belong to shared/hooks, feature hooks to the feature')
  const present = ['api', 'components', 'data'].flatMap((dir) => sourceFiles(dir))
  assert.deepEqual(present.filter((file) => !(file in LEGACY_ALLOWED)), [])
  assert.deepEqual(readdirSync(srcDir).filter((name) => /\.(ts|tsx)$/.test(name)).sort(), ['main.tsx', 'types.ts', 'vite-env.d.ts'])
})

test('app providers keep the order Router > Auth > AuthGate > Session', () => {
  const providers = readFileSync(join(srcDir, 'app/providers/AppProviders.tsx'), 'utf8')
  const order = [...providers.matchAll(/<(BrowserRouter|AuthProvider|AuthGate|SessionProvider)\b/g)].map((match) => match[1])
  assert.deepEqual(order, ['BrowserRouter', 'AuthProvider', 'AuthGate', 'SessionProvider'])
})

// Refactor phase 3a: screens and rules never pick the data source. The feature API says what its adapter offers (a flag
// or a value) and owns every demo default, so the demo stores can leave the production bundle in phase 3b.
const UI_LAYER = /^(app\/|features\/[^/]+\/(components|pages|hooks|domain|validation|constants)\/)/
const UI_MODE_ALLOWED: Record<string, string> = {}

const valueImportNames = (file: string, specifier: string): string[] => {
  const source = ts.createSourceFile(join(srcDir, file), readFileSync(join(srcDir, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names: string[] = []
  const addNamedBindings = (bindings: ts.NamedImports | ts.NamedExports) => {
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue
      names.push((element.propertyName ?? element.name).text)
    }
  }

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === specifier) {
      const clause = statement.importClause
      if (!clause || clause.isTypeOnly) continue
      if (clause.name) names.push(clause.name.text)
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name.text)
        else addNamedBindings(clause.namedBindings)
      }
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === specifier && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      addNamedBindings(statement.exportClause)
    }
  }
  return names
}

const valueImports = (file: string): Array<{ names: string[]; target: string }> => edgesFrom(file)
  .filter((edge) => edge.kind === 'value')
  .map((edge) => ({ names: valueImportNames(file, edge.specifier), target: targetPath(edge.target) }))

test('boundary value-import queries preserve named bindings for guard checks', () => {
  assert.deepEqual(valueImports('features/cattle/api/cattleApi.ts').find(({ target }) => target === 'shared/config/runtime'), {
    names: ['backendMode'],
    target: 'shared/config/runtime',
  })
})

test('screens and rules neither read the data source nor import demo data', () => {
  const files = [...sourceFiles('app'), ...sourceFiles('features')].filter((file) => UI_LAYER.test(file) && !(file in UI_MODE_ALLOWED))
  const violations = files.flatMap((file) => valueImports(file)
    .filter(({ names, target }) => names.includes('backendMode') || target.startsWith('data/') || /^features\/[^/]+\/data\//.test(target))
    .map(({ names, target }) => `${file} -> ${target} {${names.join(', ')}}`))
  assert.deepEqual(violations, [])
})

test('the dev transfer simulator only renders under the Vite dev server', () => {
  const read = (file: string) => readFileSync(join(srcDir, file), 'utf8')
  const users = sourceFiles('features').filter((file) => !file.endsWith('/DevTransferSimulator.tsx') && /\bDevTransferSimulator\b/.test(read(file)))
  assert.deepEqual(users, ['features/subscription/pages/TransferPage.tsx'])
  const page = read('features/subscription/pages/TransferPage.tsx')
  assert.equal([...page.matchAll(/<DevTransferSimulator\b/g)].length, 1)
  assert.match(page, /\{import\.meta\.env\.DEV && [^{}]*<DevTransferSimulator\b/)
  const devApiUsers = sourceFiles('features').filter((file) => !file.endsWith('/devTransferApi.ts') && /\bdevTransferApi\b/.test(read(file)))
  assert.deepEqual(devApiUsers, ['features/subscription/components/DevTransferSimulator.tsx'])
})

// Refactor phase 3b: demo data reaches the app only through src/demo/demoModules.ts, which `vite build` swaps for
// src/demo/noDemo.ts (vite.config.js). Demo modules may import each other; nothing else imports them directly.
const DEMO_MODULE = /^(demo\/|features\/[^/]+\/data\/|data\/|api\/(client|herdDomainApi|collectionSchemas|storageMigrations|demoCattlePhotos|penApi|testUtils)$|features\/[^/]+\/api\/\w+LocalApi$)/

test('production code reaches demo modules only through the demo door', () => {
  const production = [...sourceFiles('app'), ...sourceFiles('features'), ...sourceFiles('shared'), ...sourceFiles('api'), 'main.tsx']
    .filter((file) => !DEMO_MODULE.test(file.replace(/\.tsx?$/, '')))
  const violations = production.flatMap((file) => valueImports(file)
    .filter(({ target }) => DEMO_MODULE.test(target) && target !== 'demo/demoModules')
    .map(({ names, target }) => `${file} -> ${target} {${names.join(', ')}}`))
  assert.deepEqual(violations, [])
  const noDemo = readFileSync(join(srcDir, 'demo/noDemo.ts'), 'utf8')
  assert.doesNotMatch(noDemo, /^import (?!type )/m, 'noDemo.ts must not load demo modules')
})

type CycleException = {
  path: readonly string[]
  reason: string
  expiry: string
}

const TYPE_CYCLE_EXCEPTIONS: readonly CycleException[] = [
]

const cycleKey = (path: readonly string[]): string => {
  const nodes = path.slice(0, -1)
  const rotations = nodes.map((_, offset) => {
    const rotation = [...nodes.slice(offset), ...nodes.slice(0, offset)]
    return [...rotation, rotation[0]].join(' -> ')
  })
  return rotations.sort((a, b) => a < b ? -1 : a > b ? 1 : 0)[0]
}

const compareCyclePaths = (a: readonly string[], b: readonly string[]): number => {
  const left = a.join(' -> ')
  const right = b.join(' -> ')
  return left < right ? -1 : left > right ? 1 : 0
}

const completeCyclePaths = (
  graph: { nodes: string[]; edges: ImportEdge[] },
  kind: Extract<ImportEdge['kind'], 'value' | 'type'>,
): string[][] => {
  const nodes = [...graph.nodes].sort()
  const adjacency = new Map(nodes.map((node) => [node, new Set<string>()]))
  for (const edge of graph.edges) {
    const isCycleEdge = kind === 'type' ? edge.kind === 'type' : edge.kind !== 'type'
    if (!isCycleEdge || !adjacency.has(edge.source) || !adjacency.has(edge.target)) continue
    adjacency.get(edge.source)!.add(edge.target)
  }

  const cycles: string[][] = []
  for (const start of nodes) {
    const path = [start]
    const visited = new Set(path)
    const visit = (node: string) => {
      for (const target of [...(adjacency.get(node) ?? [])].sort()) {
        if (target === start) {
          cycles.push([...path, start])
        } else if (!visited.has(target) && target >= start) {
          visited.add(target)
          path.push(target)
          visit(target)
          path.pop()
          visited.delete(target)
        }
      }
    }
    visit(start)
  }
  return [...new Map(cycles.map((path) => [cycleKey(path), path])).values()]
    .sort(compareCyclePaths)
}

const cycleGuardError = (
  graph: { nodes: string[]; edges: ImportEdge[] },
  kind: Extract<ImportEdge['kind'], 'value' | 'type'>,
  exceptions: readonly CycleException[],
): Error | undefined => {
  const actual = completeCyclePaths(graph, kind)
  const allowed = new Set(exceptions.map(({ path }) => cycleKey(path)))
  const unexpected = actual.filter((path) => !allowed.has(cycleKey(path)))
  const actualKeys = new Set(actual.map(cycleKey))
  const missing = exceptions.filter(({ path }) => !actualKeys.has(cycleKey(path)))
  if (unexpected.length === 0 && missing.length === 0) return undefined

  const details = [
    ...unexpected.map((path) => `forbidden ${kind} cycle: ${path.join(' -> ')}`),
    ...missing.map(({ path, reason, expiry }) => `missing temporary ${kind} cycle: ${path.join(' -> ')} (${reason}; expires ${expiry})`),
  ]
  return new Error(`${kind} cycle guard violation:\n${details.join('\n')}`)
}

function assertCycleAllowlist(
  graph: { nodes: string[]; edges: ImportEdge[] },
  kind: Extract<ImportEdge['kind'], 'value' | 'type'>,
  exceptions: readonly CycleException[],
): void {
  const error = cycleGuardError(graph, kind, exceptions)
  if (error) throw error
}

test('value-cycle guard rejects a forbidden complete path', () => {
  const fixture = {
    nodes: ['a.ts', 'b.ts'],
    edges: [
      { source: 'a.ts', target: 'b.ts', specifier: './b', kind: 'value' as const },
      { source: 'b.ts', target: 'a.ts', specifier: './a', kind: 'value' as const },
    ],
  }
  assert.throws(() => assertCycleAllowlist(fixture, 'value', []), /a\.ts -> b\.ts -> a\.ts/)
})

test('type-cycle guard rejects a non-allowlisted complete path', () => {
  const fixture = {
    nodes: ['a.ts', 'b.ts', 'c.ts'],
    edges: [
      { source: 'a.ts', target: 'b.ts', specifier: './b', kind: 'type' as const },
      { source: 'b.ts', target: 'c.ts', specifier: './c', kind: 'type' as const },
      { source: 'c.ts', target: 'a.ts', specifier: './a', kind: 'type' as const },
    ],
  }
  assert.throws(() => assertCycleAllowlist(fixture, 'type', []), /a\.ts -> b\.ts -> c\.ts -> a\.ts/)
})

test('type-cycle allowlist accepts every rotation of an exact directed path', () => {
  const fixture = {
    nodes: ['a.ts', 'b.ts', 'c.ts'],
    edges: [
      { source: 'b.ts', target: 'c.ts', specifier: './c', kind: 'type' as const },
      { source: 'c.ts', target: 'a.ts', specifier: './a', kind: 'type' as const },
      { source: 'a.ts', target: 'b.ts', specifier: './b', kind: 'type' as const },
    ],
  }
  assert.doesNotThrow(() => assertCycleAllowlist(fixture, 'type', [{
    // Deliberately rotate the exception relative to the canonical fixture order. An order-sensitive
    // matcher would reject this even though it describes the same directed cycle.
    path: ['b.ts', 'c.ts', 'a.ts', 'b.ts'],
    reason: 'test migration exception',
    expiry: 'test checkpoint',
  }]))
})

test('type-cycle allowlist rejects reversed, missing, and extra paths with complete diagnostics', () => {
  const directedCycle = {
    nodes: ['a.ts', 'b.ts', 'c.ts'],
    edges: [
      { source: 'a.ts', target: 'b.ts', specifier: './b', kind: 'type' as const },
      { source: 'b.ts', target: 'c.ts', specifier: './c', kind: 'type' as const },
      { source: 'c.ts', target: 'a.ts', specifier: './a', kind: 'type' as const },
    ],
  }
  assert.throws(
    () => assertCycleAllowlist(directedCycle, 'type', [{
      path: ['a.ts', 'c.ts', 'b.ts', 'a.ts'],
      reason: 'reversed test exception',
      expiry: 'test checkpoint',
    }]),
    (error: unknown) => error instanceof Error
      && error.message.includes('forbidden type cycle: a.ts -> b.ts -> c.ts -> a.ts')
      && error.message.includes('missing temporary type cycle: a.ts -> c.ts -> b.ts -> a.ts'),
  )

  assert.throws(
    () => assertCycleAllowlist(directedCycle, 'type', [{
      path: ['a.ts', 'b.ts', 'c.ts', 'a.ts'],
      reason: 'missing test exception',
      expiry: 'test checkpoint',
    }, {
      path: ['x.ts', 'y.ts', 'x.ts'],
      reason: 'extra test exception',
      expiry: 'test checkpoint',
    }]),
    /missing temporary type cycle: x\.ts -> y\.ts -> x\.ts/,
  )

  const extraCycle = {
    nodes: ['a.ts', 'b.ts', 'c.ts', 'x.ts', 'y.ts'],
    edges: [
      ...directedCycle.edges,
      { source: 'x.ts', target: 'y.ts', specifier: './y', kind: 'type' as const },
      { source: 'y.ts', target: 'x.ts', specifier: './x', kind: 'type' as const },
    ],
  }
  assert.throws(
    () => assertCycleAllowlist(extraCycle, 'type', [{
      path: ['a.ts', 'b.ts', 'c.ts', 'a.ts'],
      reason: 'allowed test exception',
      expiry: 'test checkpoint',
    }]),
    /forbidden type cycle: x\.ts -> y\.ts -> x\.ts/,
  )
})

test('source graph has no value cycles', () => {
  assertCycleAllowlist(sourceGraph, 'value', [])
})

test('source graph has only the temporary PR-08 type cycles', () => {
  assertCycleAllowlist(sourceGraph, 'type', TYPE_CYCLE_EXCEPTIONS)
})
