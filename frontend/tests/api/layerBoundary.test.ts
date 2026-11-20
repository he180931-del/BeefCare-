import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// docs/frontend-refactor-guide.md §2: `shared` is neutral infrastructure, `app` composes features through their
// public `index.ts`. These checks keep the phase-1 layers from drifting back.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')

const sourceFiles = (dir: string): string[] =>
  readdirSync(join(srcDir, dir), { recursive: true })
    .filter((file): file is string => typeof file === 'string' && /\.(ts|tsx)$/.test(file))
    .map((file) => join(dir, file).split(sep).join('/'))

/** Relative import targets of one source file, resolved to a path under `src/` (no extension). */
const importTargets = (file: string): string[] => {
  const source = readFileSync(join(srcDir, file), 'utf8')
  const specifiers = [...source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)'(\.[^']*)'/g)].map((match) => match[1])
  return specifiers.map((specifier) => relative(srcDir, resolve(join(srcDir, dirname(file)), specifier)).split(sep).join('/'))
}

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
  const offenders = sourceFiles('features').filter((file) => /^features\/[^/]+\/routes\.ts$/.test(file)).flatMap((file) => {
    const code = readFileSync(join(srcDir, file), 'utf8').split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('//'))
    return code.filter((line) => !/^export const load\w+ = \(\) => import\('\.\/pages\/[^']+'\)$/.test(line)).map((line) => `${file}: ${line}`)
  })
  assert.deepEqual(offenders, [])
  const routeTable = readFileSync(join(srcDir, 'app/routes/AppRoutes.tsx'), 'utf8')
  assert.doesNotMatch(routeTable, /import \{ load\w+[^}]*\} from '\.\.\/\.\.\/features\/[^/']+'/, 'page loaders come from routes.ts')
})

const ALLOWED_DEEP_IMPORTS = new Set([
  // Rule modules (also run by the Node suites) need only the status table; the farm-workspace index loads its screens,
  // whose Icon uses the Vite-only import.meta.glob (25 Node tests fail through the index, checked 20/11/2026).
  'features/platform-service/domain/reconciliation.ts -> features/farm-workspace/domain/statusViews',
  'features/platform-service/domain/servicePeriods.ts -> features/farm-workspace/domain/statusViews',
])

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
const LEGACY_ALLOWED: Record<string, string> = {
  'api/client.ts': 'local collections (phase 3)',
  'api/collectionSchemas.ts': 'local collections (phase 3)',
  'api/demoCattlePhotos.ts': 'demo data (phase 3)',
  'api/herdDomainApi.ts': 'local Cattle-Pen-Entry-Exit aggregate (phase 3)',
  'api/penApi.ts': 'local pen adapter (phase 3)',
  'api/storageMigrations.ts': 'local storage migration (phase 3)',
  'api/testUtils.ts': 'local test support (phase 3)',
  'components/ui.tsx': 'StatusBadge, Docs, Dropzone, PaymentTable: owner not decided (guide §13 item 2)',
  'data/cattleData.ts': 'demo data (phase 3)',
  'data/cowsData.ts': 'demo data (phase 3)',
  'data/penData.ts': 'demo data (phase 3)',
  'data/pensData.ts': 'demo data (phase 3)',
}

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

/** Value (not type-only) named imports and re-exports of one file, with their resolved target under `src/`. */
const valueImports = (file: string): Array<{ names: string[]; target: string }> => {
  const source = readFileSync(join(srcDir, file), 'utf8')
  return [...source.matchAll(/^(?:import|export)\s+(?!type\b)(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*'(\.[^']*)'/gm)].map((match) => ({
    names: [match[1], ...(match[2] ?? '').split(',').map((name) => name.trim()).filter((name) => name && !name.startsWith('type '))]
      .filter((name): name is string => Boolean(name)),
    target: relative(srcDir, resolve(join(srcDir, dirname(file)), match[3])).split(sep).join('/'),
  })).filter((entry) => entry.names.length > 0)
}

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
