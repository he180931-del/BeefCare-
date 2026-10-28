import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsFiles = readdirSync(srcDir, { recursive: true }).filter((file): file is string => typeof file === 'string' && /\.(ts|tsx)$/.test(file))
const source = tsFiles.map((file) => readFileSync(join(srcDir, file), 'utf8')).join('\n')

test('strict TypeScript migration boundary has no JavaScript or suppression escapes', () => {
  assert.equal(readdirSync(srcDir, { recursive: true }).some((file) => typeof file === 'string' && /\.(js|jsx)$/.test(file)), false)
  assert.doesNotMatch(source, /@ts-(?:no-check|ignore)|\bany\b/)
  assert.doesNotMatch(source, /as\s+unknown\s+as/)
  const packageJson = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(typeof packageJson.scripts?.typecheck, 'string')
  const tsconfig = JSON.parse(readFileSync(join(srcDir, '..', 'tsconfig.json'), 'utf8')) as { exclude?: string[]; include?: string[] }
  assert.equal(Boolean(tsconfig.exclude?.some((entry) => entry.includes('test'))), false)
  assert.ok(tsconfig.include?.includes('src'))
})
