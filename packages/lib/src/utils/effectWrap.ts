import generate from 'escodegen'
import { walk } from 'estree-walker'
import type { AcornNode } from 'rollup'
import {
  devEffectWrapSharedDeps,
  prodEffectWrapSharedDeps,
  DEP_EFFECT_WRAP_FN_PREFIX,
  parsedOptions
} from '../public'

export const formatDepName = (name: string) => {
  return name.replace('@', '__').replace('/', '___').replace('-', '_')
}

/**
 * 将有副作用的依赖代码包裹到一个函数内部，远程模块引用时，执行函数，获取到模块内容。
 * @param depName 模块名称，组成导出函数名称
 * @param code 代码
 * @param parse
 * @param isDev 由于在 dev 环境下无法将模块内容引入方式改成顶层 await importShared() 引入，只能通过 import export 方式，所以只能改成两种导出同时存在，远程模块执行函数进行覆盖
 */
export const handleEffectWrapCode = (
  depName: string,
  code: string,
  parse: (code: string) => AcornNode,
  isDev = false
): string => {
  try {
    const ast = parse(code)
    const functionBody: any[] = []
    const exportNode: any[] = []

    const effectWrapDeps = isDev
      ? devEffectWrapSharedDeps
      : prodEffectWrapSharedDeps

    const newAst: any = walk(ast as any, {
      // 只访问 Program 的第一层子节点, 该节点在 dev 下直接跳过不访问深层节点，prod 下直接删除
      enter(node) {
        if (node.type === 'ImportDeclaration') {
          this.skip()
        } else if (
          node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportDefaultDeclaration' ||
          node.type === 'ExportAllDeclaration'
        ) {
          exportNode.push(node as any)
          if (!isDev) {
            this.remove()
          } else {
            this.skip()
          }
        } else if (node.type !== 'Program') {
          functionBody.push(node as any)
          if (!isDev) {
            this.remove()
          } else {
            this.skip()
          }
        }
      }
    })

    if (newAst && newAst.type === 'Program') {
      const returnNode: any = {
        type: 'ReturnStatement',
        argument: {
          type: 'ObjectExpression',
          properties: []
        }
      }

      // 将导出语句转换为对象形式，在 __rf__effectWrapFn__${depName} 中返回
      // 需要考虑引入的是否为含副作用的依赖，如果是则需要添加引入
      exportNode.forEach((node) => {
        let isEffectWrapDepExport = false
        const effectWrapDepName = effectWrapDeps.map((item) => item.name)

        if (node.type === 'ExportDefaultDeclaration') {
          returnNode.argument.properties.push({
            type: 'Property',
            key: {
              type: 'Identifier',
              name: 'default'
            },
            value:
              node.declaration.type === 'ClassDeclaration'
                ? {
                    type: 'ClassExpression',
                    id: null,
                    body: node.declaration.body,
                    superClass: null
                  }
                : node.declaration.type === 'FunctionDeclaration'
                ? {
                    type: 'FunctionExpression',
                    id: null,
                    body: node.declaration.body,
                    generator: false,
                    async: false,
                    params: []
                  }
                : node.declaration,
            kind: 'init',
            method: false,
            shorthand: false,
            computed: false
          })
        } else if (node.type === 'ExportNamedDeclaration') {
          // 如果是从外部导入的，在 prod 下直接添加到 body 中，dev 不需要重复添加
          if (node.source) {
            isEffectWrapDepExport = effectWrapDepName.includes(
              node.source.value
            )
            !isDev && newAst.body.push(node)
          } else {
            if (node.specifiers.length) {
              node.specifiers.forEach((specifier) => {
                if (specifier.type === 'ExportSpecifier') {
                  returnNode.argument.properties.push({
                    type: 'Property',
                    key: specifier.exported,
                    value: specifier.local,
                    kind: 'init',
                    method: false,
                    shorthand: false,
                    computed: false
                  })
                }
              })
            } else if (node.declaration) {
              if (node.declaration.type === 'ClassDeclaration') {
                returnNode.argument.properties.push({
                  type: 'Property',
                  key: node.declaration.id,
                  value: {
                    type: 'ClassExpression',
                    id: null,
                    body: node.declaration.body,
                    superClass: node.declaration.superClass
                  },
                  kind: 'init',
                  method: false,
                  shorthand: false,
                  computed: false
                })
              } else if (node.declaration.type === 'FunctionDeclaration') {
                returnNode.argument.properties.push({
                  type: 'Property',
                  key: node.declaration.id,
                  value: {
                    type: 'FunctionExpression',
                    id: null,
                    body: node.declaration.body,
                    generator: node.declaration.generator,
                    async: node.declaration.async,
                    params: node.declaration.params
                  },
                  kind: 'init',
                  method: false,
                  shorthand: false,
                  computed: false
                })
              } else if (node.declaration.type === 'VariableDeclaration') {
                // 先将变量声明语句添加到 body 中
                functionBody.push(node.declaration)
                node.declaration.declarations.forEach((item) => {
                  if (item.id.type === 'Identifier') {
                    returnNode.argument.properties.push({
                      type: 'Property',
                      key: item.id,
                      value: item.id,
                      kind: 'init',
                      method: false,
                      shorthand: false,
                      computed: false
                    })
                  }
                })
              }
            }
          }
        } else if (node.type === 'ExportAllDeclaration') {
          if (node.source) {
            isEffectWrapDepExport = effectWrapDepName.includes(
              node.source.value
            )
            // 在 prod 下直接添加到 body 中，dev 不需要重复添加
            if (!isDev) {
              newAst.body.push(node)
            }
          }
        }

        // 如果引入的是含副作用的依赖则需要添加一个引入该依赖的 __rf__effectWrapFn__ 语句
        if (isEffectWrapDepExport) {
          const otherEffectWrapFnMarkerId = {
            type: 'Identifier',
            name: `${DEP_EFFECT_WRAP_FN_PREFIX}__${formatDepName(
              node.source.value
            )}`
          }
          const otherEffectWrapFnMarkerResId = {
            type: 'Identifier',
            name: `${DEP_EFFECT_WRAP_FN_PREFIX}__${formatDepName(
              node.source.value
            )}__Res`
          }
          newAst.body.unshift({
            type: 'ImportDeclaration',
            specifiers: [
              {
                type: 'ImportSpecifier',
                imported: otherEffectWrapFnMarkerId,
                local: otherEffectWrapFnMarkerId
              }
            ],
            source: node.source
          })
          // functionBody 中执行依赖 __rf__effectWrapFn__ 得到结果
          functionBody.push({
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: otherEffectWrapFnMarkerResId,
                init: {
                  type: 'CallExpression',
                  callee: otherEffectWrapFnMarkerId,
                  arguments: [],
                  optional: false
                }
              }
            ],
            kind: 'const'
          })
          // 在 returnNode 中添加一个该值的解构
          returnNode.argument.properties.push({
            type: 'SpreadElement',
            argument: otherEffectWrapFnMarkerResId
          })
        }
      })

      const effectWrapFnId = {
        type: 'Identifier',
        name: `${DEP_EFFECT_WRAP_FN_PREFIX}__${formatDepName(depName)}`
      }

      const effectWrapFnNode = {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: effectWrapFnId,
            init: {
              type: 'ArrowFunctionExpression',
              generator: false,
              expression: false,
              async: false,
              params: [],
              body: {
                type: 'BlockStatement',
                body: [...functionBody, returnNode]
              }
            }
          }
        ]
      }

      newAst.body.push({
        type: 'ExportNamedDeclaration',
        declaration: effectWrapFnNode,
        specifiers: [],
        source: null
      })

      // 保留原有共享依赖的兼容性，执行 __rf__effectWrapFn__${depName} 得到所有导出，并默认导出
      // 这里会有个问题？如果从其他模块导出时有默认导出，这里再添加一个默认导出会有问题，根据配置来决定
      // 子依赖不需要添加默认导出
      let isChild = false
      const depConfig = (
        (isDev ? parsedOptions.devShared : parsedOptions.prodShared) || []
      ).find((item) => {
        const innerIsChild =
          typeof item[1].effectWrap === 'object' &&
          !!item[1].effectWrap.childDeps?.includes(depName)
        const res = item[0] === depName || innerIsChild
        if (res) {
          isChild = innerIsChild
        }
        return res
      })

      if (
        !isDev &&
        !isChild &&
        depConfig &&
        typeof depConfig[1].effectWrap !== 'boolean' &&
        depConfig[1].effectWrap?.compatOldShared
      ) {
        newAst.body.push({
          type: 'ExportDefaultDeclaration',
          declaration: {
            type: 'CallExpression',
            callee: effectWrapFnId,
            arguments: [],
            optional: false
          }
        })
      }
    }

    return generate.generate(newAst) as string
  } catch (err) {
    console.error('handleEffectWrapCode err: \n', err)
    return ''
  }
}
