import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../../src')
const tsFiles = readdirSync(srcDir, { recursive: true }).filter((file): file is string => typeof file === 'string' && /\.(ts|tsx)$/.test(file))

function findAnyType(node: ts.Node): ts.Node | undefined {
  return node.kind === ts.SyntaxKind.AnyKeyword ? node : ts.forEachChild(node, findAnyType)
}

test('strict TypeScript migration boundary has no JavaScript or suppression escapes', () => {
  assert.equal(readdirSync(srcDir, { recursive: true }).some((file) => typeof file === 'string' && /\.(js|jsx)$/.test(file)), false)
  for (const file of tsFiles) {
    const source = readFileSync(join(srcDir, file), 'utf8')
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest)
    const anyType = findAnyType(syntax)
    if (anyType) {
      const { line } = syntax.getLineAndCharacterOfPosition(anyType.getStart(syntax))
      assert.fail(`${file}:${line + 1} uses the TypeScript any type`)
    }

    assert.ok(!/^\s*(?:\/\/|\/\*+|\*)\s*@ts-(?:nocheck|no-check|ignore)\b/m.test(source), `${file} suppresses TypeScript checks`)
    const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    assert.ok(!/as\s+unknown\s+as/.test(sourceWithoutComments), `${file} uses a double assertion through unknown`)
  }
  const packageJson = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(typeof packageJson.scripts?.typecheck, 'string')
  const tsconfig = JSON.parse(readFileSync(join(srcDir, '..', 'tsconfig.json'), 'utf8')) as { exclude?: string[]; include?: string[] }
  assert.equal(Boolean(tsconfig.exclude?.some((entry) => entry.includes('test'))), false)
  assert.ok(tsconfig.include?.includes('src'))
})
