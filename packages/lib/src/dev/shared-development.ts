// *****************************************************************************
// Copyright (C) 2022 Origin.js and others.
//
// This program and the accompanying materials are licensed under Mulan PSL v2.
// You can use this software according to the terms and conditions of the Mulan PSL v2.
// You may obtain a copy of Mulan PSL v2 at:
//          http://license.coscl.org.cn/MulanPSL2
// THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
// EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
// MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
// See the Mulan PSL v2 for more details.
//
// SPDX-License-Identifier: MulanPSL-2.0
// *****************************************************************************

import type { PluginHooks } from '../../types/pluginHooks'
import { parseSharedOptions, resolvePkgPath, normalizePath } from '../utils'
import { parsedOptions, devEffectWrapSharedDeps } from '../public'
import type { VitePluginFederationOptions } from 'types'

export function devSharedPlugin(
  options: VitePluginFederationOptions
): PluginHooks {
  parsedOptions.devShared = parseSharedOptions(options)

  return {
    name: 'originjs:shared-development',
    config(options) {
      // 开发模式下添加 effectWrap 的依赖不能进行预编译，插件需要对依赖文件进行处理
      const effectWrapDeps = parsedOptions.devShared
        .filter((item) => item[1].effectWrap)
        .map((shareInfo) => shareInfo[0])

      devEffectWrapSharedDeps.push(
        ...parsedOptions.devShared.flatMap((item) => {
          if (item[1].effectWrap) {
            const path = resolvePkgPath(item[0])
            if (typeof item[1].effectWrap === 'boolean') {
              return [
                {
                  name: item[0],
                  id: path ? normalizePath(path) : path
                }
              ]
            } else {
              return [
                {
                  name: item[0],
                  id: path ? normalizePath(path) : path
                },
                ...(item[1].effectWrap.childDeps || []).map((childItem) => {
                  const path = resolvePkgPath(childItem, item[0])
                  return {
                    name: childItem,
                    id: path ? normalizePath(path) : path
                  }
                })
              ]
            }
          } else {
            return []
          }
        })
      )

      if (effectWrapDeps.length) {
        options.optimizeDeps = options.optimizeDeps || {}
        options.optimizeDeps.exclude = options.optimizeDeps.exclude || []
        options.optimizeDeps.exclude.push(...effectWrapDeps)
      }

      return options
    }
  }
}
