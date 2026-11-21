import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import {
  buildSourceGraph,
  findStronglyConnectedComponents,
  parseImportEdges,
  routeLoaderViolations,
  routeTableViolations,
} from './support/importGraph'

const file = '/repo/frontend/src/features/example.ts'

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'beefcare-import-graph-'))
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, contents)
  }
  return root
}

function withFixture(files: Record<string, string>, run: (srcDir: string) => void): void {
  const root = fixture(files)
  try {
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('parses a single-quoted named value import and resolves its target under src', () => {
  assert.deepEqual(parseImportEdges(file, "import { formatDate } from './utils/date'"), [
    {
      source: 'features/example.ts',
      target: 'features/utils/date',
      specifier: './utils/date',
      kind: 'value',
    },
  ])
})

test('parses a double-quoted default import', () => {
  assert.deepEqual(parseImportEdges(file, 'import Client from "../shared/api/client"'), [
    {
      source: 'features/example.ts',
      target: 'shared/api/client',
      specifier: '../shared/api/client',
      kind: 'value',
    },
  ])
})

test('parses namespace imports as value edges', () => {
  assert.deepEqual(parseImportEdges(file, "import * as dates from './utils/date'"), [
    {
      source: 'features/example.ts',
      target: 'features/utils/date',
      specifier: './utils/date',
      kind: 'value',
    },
  ])
})

test('parses side-effect imports distinctly', () => {
  assert.deepEqual(parseImportEdges(file, "import './styles.css'"), [
    {
      source: 'features/example.ts',
      target: 'features/styles.css',
      specifier: './styles.css',
      kind: 'side-effect',
    },
  ])
})

test('parses type-only imports distinctly', () => {
  assert.deepEqual(parseImportEdges(file, "import type { User } from '../shared/types'"), [
    {
      source: 'features/example.ts',
      target: 'shared/types',
      specifier: '../shared/types',
      kind: 'type',
    },
  ])
})

test('parses pure named type imports distinctly', () => {
  assert.deepEqual(parseImportEdges(file, "import { type User } from '../shared/types'"), [
    {
      source: 'features/example.ts',
      target: 'shared/types',
      specifier: '../shared/types',
      kind: 'type',
    },
  ])
})

test('parses re-exports as value edges', () => {
  assert.deepEqual(parseImportEdges(file, "export { UserCard } from './components/UserCard'"), [
    {
      source: 'features/example.ts',
      target: 'features/components/UserCard',
      specifier: './components/UserCard',
      kind: 'value',
    },
  ])
})

test('parses pure named type re-exports distinctly', () => {
  assert.deepEqual(parseImportEdges(file, "export { type User } from '../shared/types'"), [
    {
      source: 'features/example.ts',
      target: 'shared/types',
      specifier: '../shared/types',
      kind: 'type',
    },
  ])
})

test('parses dynamic imports as dynamic edges', () => {
  assert.deepEqual(parseImportEdges(file, "const load = () => import('./pages/ExamplePage')"), [
    {
      source: 'features/example.ts',
      target: 'features/pages/ExamplePage',
      specifier: './pages/ExamplePage',
      kind: 'dynamic',
    },
  ])
})

test('accepts a formatted multiline zero-argument page loader', () => {
  assert.deepEqual(routeLoaderViolations('/repo/frontend/src/features/example/routes.ts', [
    'export const loadExamplePage = () =>',
    "  import('./pages/ExamplePage')",
  ].join('\n')), [])
})

test('rejects route loaders that dynamically import a component or API module', () => {
  assert.deepEqual(routeLoaderViolations('/repo/frontend/src/features/example/routes.ts', [
    "export const loadExampleComponent = () => import('./components/ExampleComponent')",
    "export const loadExampleApi = () => import('./api/exampleApi')",
  ].join('\n')), [
    'features/example/routes.ts: exported loader loadExampleComponent must return import(\'./pages/...\')',
    'features/example/routes.ts: exported loader loadExampleApi must return import(\'./pages/...\')',
  ])
})

test('rejects a static feature page import in the route table', () => {
  assert.deepEqual(routeTableViolations('/repo/frontend/src/app/routes/AppRoutes.tsx', [
    "import ExamplePage from '../../features/example/pages/ExamplePage'",
    'export const route = <ExamplePage />',
  ].join('\n')), [
    'app/routes/AppRoutes.tsx: feature screen import must target features/<feature>/routes.ts, not features/example/pages/ExamplePage',
  ])
})

test('rejects a static feature index import in the route table', () => {
  assert.deepEqual(routeTableViolations('/repo/frontend/src/app/routes/AppRoutes.tsx', [
    "import { ExamplePage } from '../../features/example'",
    'export const route = <ExamplePage />',
  ].join('\n')), [
    'app/routes/AppRoutes.tsx: static feature import must target features/<feature>/routes.ts, not features/example',
  ])
})

test('rejects a lazy loader re-exported through a feature index', () => {
  assert.deepEqual(routeTableViolations('/repo/frontend/src/app/routes/AppRoutes.tsx', [
    "import { loadExamplePage } from '../../features/example'",
    'const ExamplePage = lazy(loadExamplePage)',
  ].join('\n')), [
    'app/routes/AppRoutes.tsx: static feature import must target features/<feature>/routes.ts, not features/example',
    'app/routes/AppRoutes.tsx: lazy loader loadExamplePage must be imported from features/<feature>/routes.ts',
  ])
})

test('rejects lazy callbacks that dynamically import a feature page or API instead of using routes.ts', () => {
  assert.deepEqual(routeTableViolations('/repo/frontend/src/app/routes/AppRoutes.tsx', [
    "const ExamplePage = lazy(() => import('../../features/example/pages/ExamplePage'))",
    "const ExampleApi = lazy(() => import('../../features/example/api/exampleApi'))",
  ].join('\n')), [
    'app/routes/AppRoutes.tsx: direct dynamic feature import must use features/<feature>/routes.ts, not features/example/pages/ExamplePage',
    'app/routes/AppRoutes.tsx: direct dynamic feature import must use features/<feature>/routes.ts, not features/example/api/exampleApi',
  ])
})

test('boundary fixture detects a double-quoted forbidden shared-to-feature import', () => {
  const edges = parseImportEdges('/repo/frontend/src/shared/fixture.ts', 'import { page } from "../features/cattle/pages/CowList"')
  assert.deepEqual(edges.map(({ target, kind }) => ({ target, kind })), [
    { target: 'features/cattle/pages/CowList', kind: 'value' },
  ])
})

test('boundary fixtures detect namespace and dynamic demo imports', () => {
  const edges = parseImportEdges('/repo/frontend/src/features/fixture.ts', [
    'import * as demo from "../demo/demoModules"',
    'const load = () => import("../demo/demoModules")',
  ].join('\n'))
  assert.deepEqual(edges.map(({ target, kind }) => ({ target, kind })), [
    { target: 'demo/demoModules', kind: 'value' },
    { target: 'demo/demoModules', kind: 'dynamic' },
  ])
})

test('retains external specifiers as explicit targets', () => {
  assert.deepEqual(parseImportEdges(file, "import React from 'react'"), [
    {
      source: 'features/example.ts',
      target: 'react',
      specifier: 'react',
      kind: 'value',
    },
  ])
})

test('retains an unresolved relative target escaping src as explicit normalized metadata', () => {
  assert.deepEqual(parseImportEdges(file, "import missing from '../../outside'"), [
    {
      source: 'features/example.ts',
      target: '../outside',
      specifier: '../../outside',
      kind: 'value',
    },
  ])
})

test('builds a normalized graph with no cycle', () => {
  withFixture(
    {
      'a.ts': "import { b } from './b'\nexport const a = b",
      'b.ts': 'export const b = 1',
      'unused.ts': 'export const unused = true',
    },
    (srcDir) => {
      const graph = buildSourceGraph(srcDir)
      assert.deepEqual(graph.nodes, ['a.ts', 'b.ts', 'unused.ts'])
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: false }), [])
    },
  )
})

test('finds a value cycle and sorts its members by normalized source path', () => {
  withFixture(
    {
      'z.ts': "import './a'",
      'a.ts': "import './z'",
    },
    (srcDir) => {
      const graph = buildSourceGraph(srcDir)
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: false }), [['a.ts', 'z.ts']])
    },
  )
})

test('excludes type-only cycles unless requested', () => {
  withFixture(
    {
      'a.ts': "import type { B } from './b'\nexport type A = B",
      'b.ts': "import type { A } from './a'\nexport type B = A",
    },
    (srcDir) => {
      const graph = buildSourceGraph(srcDir)
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: false }), [])
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: true }), [['a.ts', 'b.ts']])
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: true, typeOnlyOnly: true }), [['a.ts', 'b.ts']])
    },
  )
})

test('supports an explicit type-only-only SCC analysis', () => {
  withFixture(
    {
      'a.ts': "import type { B } from './b'\nimport './value'",
      'b.ts': "import type { A } from './a'",
      'value.ts': "import './other'",
      'other.ts': 'export const other = true',
    },
    (srcDir) => {
      const graph = buildSourceGraph(srcDir)
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: true, typeOnlyOnly: true }), [['a.ts', 'b.ts']])
    },
  )
})

test('retains self-import, unresolved, and external edges without creating false SCCs', () => {
  withFixture(
    {
      'self.ts': "import './self'\nimport '../missing'\nimport React from 'react'",
    },
    (srcDir) => {
      const graph = buildSourceGraph(srcDir)
      assert.deepEqual(graph.edges, [
        { source: 'self.ts', target: '../missing', specifier: '../missing', kind: 'side-effect' },
        { source: 'self.ts', target: 'react', specifier: 'react', kind: 'value' },
        { source: 'self.ts', target: 'self.ts', specifier: './self', kind: 'side-effect' },
      ])
      assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: false }), [['self.ts']])
    },
  )
})

test('snapshots current source value and documented type-only SCCs', () => {
  const graph = buildSourceGraph(resolve('src'))
  assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: false }), [])
  assert.deepEqual(findStronglyConnectedComponents(graph, { includeTypeEdges: true, typeOnlyOnly: true }), [
    ['features/herd-entry/types.ts', 'features/herd-exit/types.ts', 'types.ts'],
  ])
})
