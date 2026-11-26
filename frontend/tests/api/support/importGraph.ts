import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

import ts from 'typescript'

export interface ImportEdge {
  source: string
  target: string
  specifier: string
  kind: 'value' | 'type' | 'dynamic' | 'side-effect'
}

export interface SourceGraph {
  nodes: string[]
  edges: ImportEdge[]
}

function slashPath(value: string): string {
  return value.split(sep).join('/')
}

function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function sourceRoot(file: string): string {
  const normalized = slashPath(resolve(file))
  const marker = '/src/'
  const index = normalized.lastIndexOf(marker)
  return index >= 0 ? normalized.slice(0, index + marker.length - 1) : dirname(file)
}

function sourcePath(file: string, root: string): string {
  return slashPath(relative(root, resolve(file)))
}

function resolveTarget(file: string, specifier: string, root: string): string {
  if (!specifier.startsWith('.')) return specifier
  return slashPath(relative(root, resolve(dirname(file), specifier)))
}

export function parseImportEdges(file: string, sourceText: string): ImportEdge[] {
  const root = sourceRoot(file)
  const source = sourcePath(file, root)
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edges: ImportEdge[] = []

  const add = (specifier: string, kind: ImportEdge['kind']) => {
    edges.push({ source, target: resolveTarget(file, specifier, root), specifier, kind })
  }

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const namedBindings = node.importClause?.namedBindings
      const isPureTypeOnlyImport = namedBindings !== undefined
        && ts.isNamedImports(namedBindings)
        && namedBindings.elements.length > 0
        && namedBindings.elements.every((element) => element.isTypeOnly)
      const kind = node.importClause?.isTypeOnly || isPureTypeOnlyImport
        ? 'type'
        : node.importClause
          ? 'value'
          : 'side-effect'
      add(node.moduleSpecifier.text, kind)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const exportClause = node.exportClause
      const isPureTypeOnlyExport = exportClause !== undefined
        && ts.isNamedExports(exportClause)
        && exportClause.elements.length > 0
        && exportClause.elements.every((element) => element.isTypeOnly)
      add(node.moduleSpecifier.text, node.isTypeOnly || isPureTypeOnlyExport ? 'type' : 'value')
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, 'dynamic')
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return edges
}

function isPageLoader(expression: ts.Expression | undefined): boolean {
  if (!expression || !ts.isArrowFunction(expression) || expression.parameters.length !== 0) return false
  const body = expression.body
  return ts.isCallExpression(body)
    && body.expression.kind === ts.SyntaxKind.ImportKeyword
    && body.arguments.length === 1
    && ts.isStringLiteral(body.arguments[0])
    && body.arguments[0].text.startsWith('./pages/')
}

/** Returns semantic violations for the deliberately narrow feature route-loader module format. */
export function routeLoaderViolations(file: string, sourceText: string): string[] {
  const source = sourcePath(file, sourceRoot(file))
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations: string[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      violations.push(`${source}: routes.ts may contain only exported page loaders`)
      continue
    }
    for (const declaration of statement.declarationList.declarations) {
      const name = ts.isIdentifier(declaration.name) ? declaration.name.text : '<unnamed>'
      if (!/^load\w+$/.test(name) || !isPageLoader(declaration.initializer)) {
        violations.push(`${source}: exported loader ${name} must return import('./pages/...')`)
      }
    }
  }
  return violations
}

/** Returns violations when a route table enters a feature screen without its feature's route-loader module. */
export function routeTableViolations(
  file: string,
  sourceText: string,
  options: { allowedStaticFeatureImports?: readonly string[] } = {},
): string[] {
  const root = sourceRoot(file)
  const source = sourcePath(file, root)
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = new Map<string, string>()
  const violations: string[] = []
  const allowedStaticFeatureImports = new Set(options.allowedStaticFeatureImports ?? [])

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const target = resolveTarget(file, statement.moduleSpecifier.text, root)
    if (!target.startsWith('features/')) continue
    if (!/^features\/[^/]+\/routes$/.test(target) && !allowedStaticFeatureImports.has(target)) {
      const message = /^features\/[^/]+\/pages\//.test(target)
        ? 'feature screen import must target features/<feature>/routes.ts'
        : 'static feature import must target features/<feature>/routes.ts'
      violations.push(`${source}: ${message}, not ${target}`)
    }
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) imports.set(element.name.text, target)
    }
    if (statement.importClause?.name) imports.set(statement.importClause.name.text, target)
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolveTarget(file, node.arguments[0].text, root)
      if (target.startsWith('features/')) {
        violations.push(`${source}: direct dynamic feature import must use features/<feature>/routes.ts, not ${target}`)
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'lazy' && node.arguments.length > 0 && ts.isIdentifier(node.arguments[0])) {
      const loader = node.arguments[0].text
      const target = imports.get(loader)
      if (target?.startsWith('features/') && !/^features\/[^/]+\/routes$/.test(target)) {
        violations.push(`${source}: lazy loader ${loader} must be imported from features/<feature>/routes.ts`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}

function sourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...sourceFiles(path))
    else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) files.push(path)
  }
  return files
}

function graphPath(file: string, root: string): string {
  return slashPath(relative(root, resolve(file)))
}

function resolveGraphTarget(target: string, nodes: Set<string>): string {
  if (nodes.has(target)) return target
  for (const candidate of [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]) {
    if (nodes.has(candidate)) return candidate
  }
  return target
}

export function buildSourceGraph(srcDir: string): SourceGraph {
  const root = resolve(srcDir)
  const files = sourceFiles(root)
  const nodes = files.map((file) => graphPath(file, root)).sort(comparePath)
  const nodeSet = new Set(nodes)
  const edges = files
    .flatMap((file) => parseImportEdges(file, readFileSync(file, 'utf8')))
    .map((edge) => ({ ...edge, target: resolveGraphTarget(edge.target, nodeSet) }))
    .sort((a, b) =>
      comparePath(a.source, b.source) ||
      comparePath(a.target, b.target) ||
      comparePath(a.specifier, b.specifier) ||
      comparePath(a.kind, b.kind),
    )
  return { nodes, edges }
}

export function findStronglyConnectedComponents(
  graph: SourceGraph,
  options: { includeTypeEdges: boolean; typeOnlyOnly?: boolean },
): string[][] {
  const adjacency = new Map<string, string[]>()
  for (const node of graph.nodes) adjacency.set(node, [])
  for (const edge of graph.edges) {
    if (options.typeOnlyOnly && edge.kind !== 'type') continue
    if (edge.kind === 'type' && !options.includeTypeEdges) continue
    if (!adjacency.has(edge.target)) continue
    const targets = adjacency.get(edge.source)
    if (targets && !targets.includes(edge.target)) targets.push(edge.target)
  }
  for (const targets of adjacency.values()) targets.sort(comparePath)

  let index = 0
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []

  const visit = (node: string) => {
    indices.set(node, index)
    lowLinks.set(node, index)
    index += 1
    stack.push(node)
    onStack.add(node)

    for (const target of adjacency.get(node) ?? []) {
      if (!indices.has(target)) {
        visit(target)
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!))
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!))
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    component.sort(comparePath)
    if (component.length > 1 || adjacency.get(component[0])?.includes(component[0])) components.push(component)
  }

  for (const node of [...graph.nodes].sort()) if (!indices.has(node)) visit(node)
  return components.sort((a, b) => comparePath(a[0], b[0]))
}
