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

import type {
  SharedParsedConfig,
  ExposesParsedConfig,
  RemotesParsedConfig
} from 'types'
import type { ResolvedConfig } from 'vite'
import { Remote } from './utils'
// for generateBundle Hook replace
export const EXPOSES_MAP = new Map()
export const EXPOSES_KEY_MAP = new Map()
export const SHARED = 'shared'
export const DYNAMIC_LOADING_CSS = 'dynamicLoadingCss'
export const DYNAMIC_LOADING_CSS_PREFIX = '__v__css__'
export const DEFAULT_ENTRY_FILENAME = 'remoteEntry.js'
// 真正的函数名为 __rf__effectWrapFn__${depName} 避免导出冲突
export const DEP_EFFECT_WRAP_FN_PREFIX = '__rf__effectWrapFn'
export const EXTERNALS: string[] = []
export const ROLLUP = 'rollup'
export const VITE = 'vite'
export const builderInfo = {
  builder: 'rollup',
  version: '',
  assetsDir: '',
  isHost: false,
  isRemote: false,
  isShared: false
}
export const parsedOptions = {
  prodExpose: [] as [string, ExposesParsedConfig][],
  prodRemote: [] as [string, RemotesParsedConfig][],
  prodShared: [] as [string, SharedParsedConfig][],
  devShared: [] as [string, SharedParsedConfig][],
  devExpose: [] as [string, ExposesParsedConfig][],
  devRemote: [] as [string, RemotesParsedConfig][]
}
export const devEffectWrapSharedDeps: {
  name: string
  id?: string
}[] = []
export const prodEffectWrapSharedDeps: {
  name: string
  id?: string
}[] = []
export const devRemotes: {
  id: string
  regexp: RegExp
  config: RemotesParsedConfig
}[] = []
export const prodRemotes: Remote[] = []
export const viteConfigResolved: { config: ResolvedConfig | undefined } = {
  config: undefined
}
