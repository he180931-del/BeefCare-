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

test('app reaches a feature only through its public index', () => {
  const violations = sourceFiles('app').flatMap((file) => importTargets(file)
    .filter((target) => /^features\/[^/]+\/(?!index$).+/.test(target))
    .map((target) => `${file} -> ${target}`))
  assert.deepEqual(violations, [])
})

test('the entry stays thin and the route table, providers and layouts live in app', () => {
  assert.equal(readFileSync(join(srcDir, 'main.tsx'), 'utf8').trim(), "import './app/bootstrap'")
  for (const path of ['app/bootstrap.tsx', 'app/routes/AppRoutes.tsx', 'app/providers/AppProviders.tsx', 'app/layouts/FarmPlatformLayout.tsx', 'app/layouts/TechnicianLayout.tsx', 'app/session/currentFarm.ts', 'app/session/sessionLifecycle.ts', 'app/styles/index.css']) {
    assert.equal(existsSync(join(srcDir, path)), true, `missing ${path}`)
  }
  assert.equal(existsSync(join(srcDir, 'pages')), false, 'feature screens belong to features/<feature>/pages')
})

test('app providers keep the order Router > Auth > AuthGate > Session', () => {
  const providers = readFileSync(join(srcDir, 'app/providers/AppProviders.tsx'), 'utf8')
  const order = [...providers.matchAll(/<(BrowserRouter|AuthProvider|AuthGate|SessionProvider)\b/g)].map((match) => match[1])
  assert.deepEqual(order, ['BrowserRouter', 'AuthProvider', 'AuthGate', 'SessionProvider'])
})
