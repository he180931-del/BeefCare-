import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const srcRoot = path.resolve(import.meta.dirname, '..')

test('frontend source is fully TypeScript and exposes a typecheck script', () => {
  const sourceFiles: string[] = []
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else sourceFiles.push(entryPath)
    }
  }
  visit(srcRoot)

  assert.deepEqual(
    sourceFiles.filter((file) => /\.(?:js|jsx)$/.test(file)),
    [],
    'src must not contain JavaScript source files',
  )

  const packageJson = JSON.parse(fs.readFileSync(path.resolve(srcRoot, '../package.json'), 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(typeof packageJson.scripts?.typecheck, 'string')
})
