/**
 * @file src/composables/useAppSkin.js
 * @description 界面皮肤（UI Skin）管理 —— 模块级单例状态。
 *
 * 两套完整可切换皮肤（配色 token + 布局结构一起换）：
 *   native     Apple HIG / Xcode vibrancy 材质（默认，浅色）
 *   workbench  Raycast 创作者工作台（深蓝黑 + violet，多平台分发语境）
 *
 * 对外 API（供 task-9 设置页调用）：
 *   skin              Ref<'native'|'workbench'>   当前皮肤（只读约定：用 setSkin 改）
 *   followSystemDark  Ref<boolean>                是否跟随系统明暗自动映射
 *   SKINS             [{ id, name, desc }]        皮肤清单（设置页卡片数据源）
 *   isWorkbench       ComputedRef<boolean>
 *   setSkin(id)                                   切换皮肤并持久化
 *   setFollowSystemDark(bool)                     开关"跟随系统明暗"；dark→workbench / light→native
 *   applySkin()                                   把当前 skin 写到 <html>/<#app> data-skin（幂等）
 *   init()                                        应用启动时调用一次：注册 matchMedia 监听 + 同步 DOM
 *
 * 持久化：localStorage key 'weditor-ui-skin' = 'native'|'workbench'
 *         localStorage key 'weditor-ui-skin-follow-system' = '1'|'0'
 * FOUC：core/theme/theme-loader.js 里有同名同步函数 readStoredSkin()，
 *       在 Vue 挂载前给 <html> 预写 data-skin；本模块的初始值与其一致。
 */

import { ref, computed } from 'vue'

export const SKIN_STORAGE_KEY = 'weditor-ui-skin'
export const SKIN_FOLLOW_STORAGE_KEY = 'weditor-ui-skin-follow-system'

export const SKINS = [
  { id: 'native', name: '原生血统', desc: 'Apple HIG · Xcode vibrancy 材质 · 系统蓝强调' },
  { id: 'workbench', name: '创作者工作台', desc: 'Raycast 深色 · 图标导航 · 三平台分发' }
]

const VALID_SKINS = new Set(SKINS.map((s) => s.id))

// ==========================================
// 模块级单例状态（全应用共享一份）
// ==========================================
const skin = ref('native')
const followSystemDark = ref(false)

function persistSkin(value) {
  try { localStorage.setItem(SKIN_STORAGE_KEY, value) } catch (_) { /* 存储不可用时静默降级 */ }
}

function persistFollow(value) {
  try { localStorage.setItem(SKIN_FOLLOW_STORAGE_KEY, value ? '1' : '0') } catch (_) {}
}

/**
 * 读取持久化皮肤（非法值回落 native）。与 theme-loader 的规则保持一致。
 * @returns {'native'|'workbench'}
 */
export function readStoredSkin() {
  try {
    const v = localStorage.getItem(SKIN_STORAGE_KEY)
    return VALID_SKINS.has(v) ? v : 'native'
  } catch (_) {
    return 'native'
  }
}

export function readStoredFollowSystemDark() {
  try {
    return localStorage.getItem(SKIN_FOLLOW_STORAGE_KEY) === '1'
  } catch (_) {
    return false
  }
}

/**
 * 把当前 skin 同步到 DOM：
 * - <html data-skin>：CSS token 层选择器（FOUC 关键路径）
 * - <div#app data-skin>：组件级分支样式
 * 幂等，可反复调用。
 */
export function applySkin() {
  try {
    document.documentElement.setAttribute('data-skin', skin.value)
    const appEl = document.getElementById('app')
    if (appEl) appEl.setAttribute('data-skin', skin.value)
  } catch (_) {}
}

/** 切换皮肤（非法 id 忽略），立即生效并持久化。 */
export function setSkin(id) {
  if (!VALID_SKINS.has(id)) return
  if (skin.value === id) { applySkin(); return }
  skin.value = id
  persistSkin(id)
  applySkin()
}

/**
 * 跟随系统明暗：开启后 dark→workbench / light→native 自动映射，
 * 并在 prefers-color-scheme change 时实时切换。
 */
export function setFollowSystemDark(on) {
  followSystemDark.value = !!on
  persistFollow(followSystemDark.value)
  if (followSystemDark.value && typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSkin(mq.matches ? 'workbench' : 'native')
  }
}

// matchMedia 监听只注册一次（init 调用方可能多个）
let _mediaListenerBound = false
function bindSystemDarkWatcher() {
  if (_mediaListenerBound) return
  if (typeof window === 'undefined' || !window.matchMedia) return
  _mediaListenerBound = true
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e) => {
    // 仅在开关打开时做自动映射；关闭时用户手动选的皮肤不受系统影响
    if (followSystemDark.value) setSkin(e.matches ? 'workbench' : 'native')
  }
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', handler)
  else if (typeof mq.addListener === 'function') mq.addListener(handler) // 老 Safari 兜底
}

/**
 * 初始化（main/App 启动时调用一次）：
 * 从 localStorage 恢复皮肤与跟随开关、注册系统明暗监听、同步 DOM。
 */
export function init() {
  skin.value = readStoredSkin()
  followSystemDark.value = readStoredFollowSystemDark()
  bindSystemDarkWatcher()
  if (followSystemDark.value && typeof window !== 'undefined' && window.matchMedia) {
    // 以系统当前明暗为准做一次对齐（避免上次持久化与系统状态漂移）
    const mapped = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'workbench' : 'native'
    if (skin.value !== mapped) { skin.value = mapped; persistSkin(mapped) }
  }
  applySkin()
}

export function useAppSkin() {
  return {
    skin,
    followSystemDark,
    SKINS,
    isWorkbench: computed(() => skin.value === 'workbench'),
    setSkin,
    setFollowSystemDark,
    applySkin,
    init
  }
}
