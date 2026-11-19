// Node module hook for the plain-Node test suites: static assets that Vite would bundle load as an empty module.
export async function load(url, context, nextLoad) {
  if (/\.(png|jpe?g|gif|webp|svg|ico|css)(\?.*)?$/.test(url)) return { format: 'module', source: 'export default ""', shortCircuit: true }
  return nextLoad(url, context)
}
