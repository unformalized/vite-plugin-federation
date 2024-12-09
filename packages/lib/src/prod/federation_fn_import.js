import { satisfy } from '__federation_fn_satisfy'

const currentImports = {}

// eslint-disable-next-line no-undef
const moduleMap = __rf_var__moduleMap
const moduleCache = Object.create(null)
async function importShared(name, shareScope = 'default') {
  return moduleCache[name]
    ? new Promise((r) => r(moduleCache[name]))
    : (await getSharedFromRuntime(name, shareScope)) || getSharedFromLocal(name)
}
// eslint-disable-next-line
async function __federation_import(name) {
  currentImports[name] ??= import(name)
  return currentImports[name]
}
async function getSharedFromRuntime(name, shareScope) {
  let module = null
  if (globalThis?.__federation_shared__?.[shareScope]?.[name]) {
    const versionObj = globalThis.__federation_shared__[shareScope][name]
    const versionKey = Object.keys(versionObj)[0]
    const versionValue = Object.values(versionObj)[0]
    if (moduleMap[name]?.requiredVersion) {
      // judge version satisfy
      if (satisfy(versionKey, moduleMap[name].requiredVersion)) {
        module = await (await versionValue.get())()
      } else {
        console.log(
          `provider support ${name}(${versionKey}) is not satisfied requiredVersion(\${moduleMap[name].requiredVersion})`
        )
      }
    } else {
      module = await (await versionValue.get())()
    }
  }
  if (module) {
    return flattenModule(module, name)
  }
}
async function getSharedFromLocal(name) {
  if (moduleMap[name]?.import) {
    let module = await (await moduleMap[name].get())()
    return flattenModule(module, name)
  } else {
    console.error(
      `consumer config import=false,so cant use callback shared module`
    )
  }
}

// eslint-disable-next-line no-undef
const sharedEffectWrapDeps = __rf_var__SharedEffectWrapDeps
// eslint-disable-next-line no-undef
const sharedEffectWrapFnNamePrefix = __rf_var__sharedEffectWrapFnNamePrefix

export const formatDepName = (name) => {
  return name.replace('@', '__').replace('/', '___').replace('-', '_')
}

function flattenModule(module, name) {
  const sharedEffectWrapFnName = `${sharedEffectWrapFnNamePrefix}__${formatDepName(
    name
  )}`

  // use a shared module which export default a function will getting error 'TypeError: xxx is not a function'
  if (typeof module.default === 'function') {
    Object.keys(module).forEach((key) => {
      if (key !== 'default') {
        module.default[key] = module[key]
      }
    })
    moduleCache[name] = module.default
    if (
      sharedEffectWrapDeps.includes(name) &&
      typeof module[sharedEffectWrapFnName] === 'function'
    ) {
      Object.assign(module.default, module[sharedEffectWrapFnName]())
    }
    return module.default
  }
  if (module.default) module = Object.assign({}, module.default, module)
  if (
    sharedEffectWrapDeps.includes(name) &&
    typeof module[sharedEffectWrapFnName] === 'function'
  ) {
    module = Object.assign({}, module, module[sharedEffectWrapFnName]())
  }
  moduleCache[name] = module
  return module
}
export {
  importShared,
  getSharedFromRuntime as importSharedRuntime,
  getSharedFromLocal as importSharedLocal
}
