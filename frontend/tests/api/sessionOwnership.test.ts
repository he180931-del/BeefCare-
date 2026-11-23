import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildSourceGraph } from './support/importGraph'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')

test('session fact types are owned by app/session and app/session does not import authorization', () => {
  const typePath = resolve(srcDir, 'app/session/sessionTypes.ts')
  assert.equal(existsSync(typePath), true, 'app/session/sessionTypes.ts owns the session fact types')
  const facts = readFileSync(typePath, 'utf8')
  for (const name of ['FarmRole', 'PlatformRole', 'AppRole', 'SessionUser', 'Session']) {
    assert.match(facts, new RegExp(`export (?:type |interface )?${name}\\b`), `${name} is exported by app/session/sessionTypes`)
  }

  const graph = buildSourceGraph(srcDir)
  const sessionToAuthorization = graph.edges
    .filter((edge) => edge.source.startsWith('app/session/') && edge.target.startsWith('features/authorization'))
    .map((edge) => `${edge.source} -> ${edge.target}`)
  assert.deepEqual(sessionToAuthorization, [])

  const authorizationFactImports = graph.edges
    .filter((edge) => edge.source === 'features/authorization/roles.ts' && edge.target === 'app/session/sessionContext.ts')
  assert.ok(authorizationFactImports.some((edge) => edge.kind === 'type'), 'authorization imports session facts as types')
})

test('session profile normalization is independent of tab storage and authorization policy', () => {
  const profilePath = resolve(srcDir, 'app/session/sessionProfile.ts')
  assert.equal(existsSync(profilePath), true, 'app/session/sessionProfile.ts owns profile normalization')

  const graph = buildSourceGraph(srcDir)
  const forbiddenImports = graph.edges
    .filter((edge) => edge.source === 'app/session/sessionProfile.ts')
    .filter((edge) => edge.target === 'app/session/currentFarm.ts' || edge.target.startsWith('features/authorization'))
    .map((edge) => `${edge.source} -> ${edge.target}`)
  assert.deepEqual(forbiddenImports, [])
})
