import { exports as resolveExports } from 'resolve.exports'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import { ResolvedConfig } from 'vite'

export const resolvePkgPath = (depName: string, parentDepName?: string) => {
  const require = createRequire(path.resolve(process.cwd(), 'node_modules'))

  const getPath = (pkgPath: string) => {
    while (!fs.existsSync(path.resolve(pkgPath, 'package.json'))) {
      pkgPath = path.resolve(pkgPath, '..')
    }

    const packageFile = JSON.parse(
      fs.readFileSync(path.resolve(pkgPath, 'package.json'), 'utf-8')
    )
    const entries = [
      ...(resolveExports(packageFile, '.', {
        unsafe: true,
        conditions: ['import']
      }) || []),
      packageFile.module,
      packageFile.main
    ].filter((item) => !!item)
    return entries.map((item) => path.resolve(pkgPath, item))[0]
  }

  try {
    let requirePkg: string | undefined = undefined
    if (parentDepName) {
      const parentPkgPath = require.resolve(parentDepName)
      const childRequire = createRequire(parentPkgPath)
      requirePkg = childRequire.resolve(depName)
    }
    requirePkg = requirePkg || require.resolve(depName)
    const pkgPath = path.dirname(requirePkg)
    return getPath(pkgPath)
  } catch (error) {
    return undefined
  }
}

export function joinUrlSegments(a: string, b: string): string {
  if (!a || !b) {
    return a || b || ''
  }
  if (a[a.length - 1] === '/') {
    a = a.substring(0, a.length - 1)
  }
  if (b[0] !== '/') {
    b = '/' + b
  }
  return a + b
}

export function toOutputFilePathWithoutRuntime(
  filename: string,
  type: 'asset' | 'public',
  hostId: string,
  hostType: 'js' | 'css' | 'html',
  config: ResolvedConfig,
  toRelative: (filename: string, hostId: string) => string
): string {
  const { renderBuiltUrl } = config.experimental
  let relative = config.base === '' || config.base === './'
  if (renderBuiltUrl) {
    const result = renderBuiltUrl(filename, {
      hostId,
      hostType,
      type,
      ssr: !!config.build.ssr
    })
    if (typeof result === 'object') {
      if (result.runtime) {
        throw new Error(
          `{ runtime: "${result.runtime}" } is not supported for assets in ${hostType} files: ${filename}`
        )
      }
      if (typeof result.relative === 'boolean') {
        relative = result.relative
      }
    } else if (result) {
      return result
    }
  }
  if (relative && !config.build.ssr) {
    return toRelative(filename, hostId)
  } else {
    return joinUrlSegments(config.base, filename)
  }
}
