import { exports as resolveExports } from 'resolve.exports'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'

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
