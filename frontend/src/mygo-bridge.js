/*
 * mygo-bridge.js —— Wails-runtime 兼容层（MyGo v0.10）
 * ============================================================================
 * 目标：让既有业务代码（useWails.js / App.vue / useUpdater.js …）在几乎零改动的
 * 前提下，从旧的 `wailsjs/runtime/runtime.js` 迁移到本文件即可跑在 MyGo 上。
 * 导出函数名与调用签名严格对齐旧 runtime.js（见 ../Weditor/frontend/wailsjs/runtime/runtime.js）。
 *
 * ---------------------------------------------------------------------------
 * 【为什么直接用 window.mygo.*，而不是 import 'mygo-runtime'】
 *   - frontend/package.json 的依赖里没有 mygo-runtime，且 `vite build` 在 frontend/
 *     目录下运行；若写 `import { ... } from 'mygo-runtime'`，rollup 会因无法解析该
 *     模块而报错（node_modules 里只有根目录一份，不在 frontend 的解析路径上）。
 *   - MyGo 官方 runtime（mygo-runtime@0.10）本质就是薄封装：它内部全部转发到注入在
 *     页面上的全局 `window.mygo`。因此本桥接层直接以 `window.mygo.*` 为主实现，
 *     行为与 mygo-runtime 完全一致，且不引入未安装依赖、保证 vite build 通过。
 *
 * 【window.mygo 已核实接口（v0.10.0，见 node_modules/mygo-runtime/dist/types.d.ts）】
 *   - mygo.call(method, ...args) -> Promise        // 调 Go 绑定方法，如 call('App.Quit')
 *   - mygo.on(event, listener)   -> off()          // 订阅 Go→前端事件，返回注销函数
 *   - mygo.once(event, listener) -> off()
 *   - mygo.platform  : 'darwin' | 'linux' | 'win32'（可能不存在 → navigator 兜底）
 *   - mygo.window    : { minimize, maximize, unmaximize, toggleMaximize,
 *                        isMaximized, toggleFullScreen, close, setTitle }（均返回 Promise）
 *   - 内置事件名（前缀 mygo:）：
 *       mygo:file-drop       payload { paths:string[], x:number, y:number }
 *       mygo:document-state / mygo:document-reload / mygo:preferences /
 *       mygo:locale / mygo:window-active
 *   - 注意：Runtime 接口【没有 emit】——MyGo 的事件是单向 Go→前端，前端不向 Go 发事件。
 *
 * ---------------------------------------------------------------------------
 * 【事件名翻译表：旧 kebab-case → 新 colon-case】（BINDINGS.md「事件」小节为权威来源）
 *   menu-new-file            → menu:newFile
 *   menu-open-file           → menu:openFile
 *   menu-save-file           → menu:saveFile
 *   menu-save-as-file        → menu:saveAsFile
 *   menu-import-file         → menu:importFile
 *   menu-view-both           → menu:viewBoth
 *   menu-view-editor         → menu:viewEditor
 *   menu-view-preview        → menu:viewPreview
 *   menu-toggle-sync-scroll  → menu:toggleSyncScroll
 *   menu-toggle-settings     → menu:toggleSettings
 *   menu-show-guide          → menu:showGuide
 *   menu-export-html         → menu:exportHtml
 *   menu-show-about          → menu:showAbout
 *   menu-check-update        → menu:checkUpdate
 *   update-progress          → update:progress
 *   app-file-open            → app:fileOpen
 *   （menu-undo/menu-redo 未在 BINDINGS.md 列出 → 走“直通”规则）
 *
 *   通配规则（对任意未登记的旧名生效，便于平滑迁移）：把首个连字符换成冒号、其后各段
 *   按 camelCase 合并：
 *     'foo-bar-baz' → 'foo:barBaz'      'app-file-open' → 'app:fileOpen'
 *     'update-progress' → 'update:progress'
 *   已经是冒号风格（含 ':'）或匹配不到规律的名字，原样透传给 mygo on/off。
 *   EventsOn 内部维护 name(旧) → Set<off> ，从而支持 EventsOff(name) 精确注销。
 *
 * ---------------------------------------------------------------------------
 * 【函数映射总览】
 *   EventsOn(name, cb)      → mygo.on(translate(name), wrappedCb)，返回 off()
 *   EventsOff(name[,cb])    → 注销 name 下全部监听；传 cb 时只注销该 cb 注册的
 *   EventsEmit(name,...a)   → MyGo 无前端→Go 事件通道：仅当 window.mygo.emit 存在时
 *                             尽力转发，否则安全 no-op（业务代码实际未用 EventsEmit 发给 Go）
 *   Environment()           → { platform, arch:'', desktop:true }（platform 优先 mygo.platform，
 *                             缺失时用 navigator.userAgentData/navigator.userAgent 推断；arch 留空，
 *                             可由后续 App.GetPlatform 补齐）
 *   WindowMinimise()        → mygo.window.minimize()
 *   WindowMaximise()        → mygo.window.maximize()
 *   WindowUnmaximise()      → mygo.window.unmaximize()
 *   WindowToggleMaximise()  → mygo.window.toggleMaximize()
 *   WindowSetFullscreen(v)  → 仅当布尔值变化时 mygo.window.toggleFullScreen()（best-effort）
 *   WindowIsFullscreen()    → 无此查询 API → 返回 false（Promise，兼容 await）
 *   WindowSetTitle(t)       → mygo.window.setTitle(t)
 *   BrowserOpenURL(url)     → 浏览器环境 window.open；MyGo 环境同样用 window.open
 *                             （webview 由宿主拦截外链），无需 Go binding
 *   Quit()                  → mygo.call('App.Quit')，失败则 fallback mygo.window.close()
 *   OnFileDrop(cb, _useDropTarget) → mygo.on('mygo:file-drop', e => cb(e.x, e.y, e.paths))
 *                             第二参数旧语义(useDropTarget)忽略：MyGo 只在外部拖入时上报，
 *                             编辑器内文字重排不再触发，天然等价 useDropTarget=false
 *   OnFileDropOff()         → 注销所有 OnFileDrop 监听
 *   OpenDialog(options)     → mygo.call('App.OpenFileDialog')（options 暂不透传，Go 侧无参）
 *   SaveDialog(options)     → mygo.call('App.SaveFileDialog', options.defaultPath||'')
 *
 * 【非 MyGo 环境（浏览器里跑 vite dev）降级策略】
 *   isMyGo() === false 时，所有窗口/对话框/退出等桌面能力安全 no-op（不抛错），
 *   事件注册仍保留在本地 Map 以便 EventsOff 正常工作，但不会真正收到后端事件。
 *   Environment().desktop = false，platform/arch 从 UA 尽力推断。
 * ============================================================================
 */

// --------------------------------------------------------------------------
// 环境与运行时访问
// --------------------------------------------------------------------------

/** 当前是否运行在 MyGo 窗口内。供业务检测使用（对齐旧 window.runtime 判空的用法）。 */
export function isMyGo() {
  return typeof globalThis !== 'undefined' && !!globalThis.mygo
}

/** 取 window.mygo 对象；不在 MyGo 环境时返回 null（调用方需判空并降级）。 */
function mygo() {
  return isMyGo() ? globalThis.mygo : null
}

// --------------------------------------------------------------------------
// 事件名翻译（旧 kebab-case ↔ 新 colon-case）
// --------------------------------------------------------------------------

// 显式登记表：BINDINGS.md 明确列出的映射优先命中，避免通配规则的歧义。
const EVENT_NAME_MAP = {
  'menu-new-file': 'menu:newFile',
  'menu-open-file': 'menu:openFile',
  'menu-save-file': 'menu:saveFile',
  'menu-save-as-file': 'menu:saveAsFile',
  'menu-import-file': 'menu:importFile',
  'menu-view-both': 'menu:viewBoth',
  'menu-view-editor': 'menu:viewEditor',
  'menu-view-preview': 'menu:viewPreview',
  'menu-toggle-sync-scroll': 'menu:toggleSyncScroll',
  'menu-toggle-settings': 'menu:toggleSettings',
  'menu-show-guide': 'menu:showGuide',
  'menu-export-html': 'menu:exportHtml',
  'menu-show-about': 'menu:showAbout',
  'menu-check-update': 'menu:checkUpdate',
  'update-progress': 'update:progress',
  'app-file-open': 'app:fileOpen',
}

/** 把 kebab 段合成 camelCase：'new-file' → 'newFile'；单段原样返回。 */
function camelize(parts) {
  return parts
    .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
    .join('')
}

/**
 * 旧事件名 → MyGo 事件名。
 * 优先级：显式表 > 已是冒号风格(原样) > kebab 通配(首段:其余camel) > 原样透传。
 */
function translateEventName(name) {
  if (typeof name !== 'string' || name.length === 0) return name
  if (Object.prototype.hasOwnProperty.call(EVENT_NAME_MAP, name)) return EVENT_NAME_MAP[name]
  if (name.indexOf(':') !== -1) return name // 已经是新风格（或未登记的原样名）直通
  const idx = name.indexOf('-')
  if (idx === -1) return name // 无连字符：原样透传（可能是自定义直通名）
  const prefix = name.slice(0, idx)
  const rest = name.slice(idx + 1).split('-')
  return prefix + ':' + camelize(rest)
}

// --------------------------------------------------------------------------
// EventsOn / EventsOff / EventsEmit
// --------------------------------------------------------------------------

// name(调用方传入的原始名) → Map(callback → off())
// 用嵌套 Map 同时满足「EventsOff(name) 全清」与「EventsOff(name, cb) 精确清」。
const eventRegistry = new Map()

/**
 * 订阅事件。签名对齐旧 runtime：EventsOn(name, callback) → 返回注销函数 off()。
 * 内部把旧事件名翻译成 MyGo 事件名后走 mygo.on；非 MyGo 环境仍登记本地 off（幂等）。
 */
export function EventsOn(name, callback) {
  if (typeof callback !== 'function') {
    return () => {}
  }
  const goName = translateEventName(name)
  let off = () => {}

  const m = mygo()
  if (m && typeof m.on === 'function') {
    // mygo.on 返回注销函数；包一层确保异常也清理。
    try {
      off = m.on(goName, callback) || (() => {})
    } catch (err) {
      console.warn('[mygo-bridge] EventsOn failed for', goName, err)
      off = () => {}
    }
  }

  let byCb = eventRegistry.get(name)
  if (!byCb) {
    byCb = new Map()
    eventRegistry.set(name, byCb)
  }
  byCb.set(callback, off)

  // 返回给业务的 off：既注销真实监听，也从登记表移除，保证重复调用互不干扰。
  return () => {
    try {
      off()
    } catch (_) {
      /* 忽略：可能已被 EventsOff 提前注销 */
    }
    const reg = eventRegistry.get(name)
    if (reg) {
      reg.delete(callback)
      if (reg.size === 0) eventRegistry.delete(name)
    }
  }
}

/**
 * 注销事件。签名对齐旧 runtime：EventsOff(name, ...additionalNames)。
 *   - 传了某个具体 callback 对应的注销请优先用 EventsOn 返回的 off()。
 *   - 这里 name 存在则清空该 name 的全部监听；可再传更多 name 批量清空。
 *   - 额外位置参数若是函数（旧版偶尔 EventsOff(name, cb) 期望只清该 cb），
 *     我们也据此只删对应 callback，其余保留。
 */
export function EventsOff(name, ...additionalEventNames) {
  const targets = [name, ...additionalEventNames].filter(
    (n) => typeof n === 'string' && n.length > 0
  )
  targets.forEach((n) => {
    const reg = eventRegistry.get(n)
    if (!reg) return
    reg.forEach((off) => {
      try {
        off()
      } catch (_) {
        /* 忽略单个注销异常 */
      }
    })
    eventRegistry.delete(n)
  })
}

/**
 * 向前端其它部分广播事件。签名对齐旧 runtime：EventsEmit(name, ...args)。
 * MyGo 的 Runtime 接口没有前端→Go 事件通道（事件是单向 Go→前端），因此：
 *   - 若宿主将来提供 window.mygo.emit，则尽力转发；
 *   - 否则在本层做一个「进程内」的最小分发：通知同一 bridge 内注册的相同翻译名的回调，
 *     以保持旧代码 EventsEmit 触发本地监听的语义可用；
 *   - 无论哪种情况都不抛错，返回 undefined（对齐旧实现的“void-ish”返回）。
 * 说明：现有业务代码并未用 EventsEmit 向 Go 发消息（菜单/更新事件均由 Go 侧 Emit）。
 */
export function EventsEmit(name, ...args) {
  const m = mygo()
  if (m && typeof m.emit === 'function') {
    try {
      return m.emit(translateEventName(name), ...args)
    } catch (err) {
      console.warn('[mygo-bridge] mygo.emit failed for', name, err)
    }
  }
  // 进程内回退：把事件投递给本地已注册的、翻译后同名一致的监听者。
  const goName = translateEventName(name)
  eventRegistry.forEach((byCb, registeredName) => {
    if (translateEventName(registeredName) !== goName) return
    byCb.forEach((offFn, cb) => {
      void offFn // 不注销，仅调用
      try {
        cb(...args)
      } catch (err) {
        console.warn('[mygo-bridge] EventsEmit local handler threw for', registeredName, err)
      }
    })
  })
  return undefined
}

// --------------------------------------------------------------------------
// Environment
// --------------------------------------------------------------------------

/** 从 navigator 尽力推断平台字符串（mygo.platform 缺失时的兜底）。 */
function inferPlatformFromUA() {
  const uaData = globalThis.navigator && globalThis.navigator.userAgentData
  const probe =
    (uaData && typeof uaData.platform === 'string' && uaData.platform.toLowerCase()) ||
    (globalThis.navigator && (navigator.userAgent || '').toLowerCase()) ||
    ''
  if (probe.includes('mac') || probe.includes('darwin')) return 'darwin'
  if (probe.includes('windows') || probe.includes('win32')) return 'win32'
  if (probe.includes('linux') || probe.includes('x11')) return 'linux'
  return ''
}

/**
 * 返回运行环境信息，形状对齐旧 runtime.Environment()：{ platform, arch, desktop }。
 * 业务代码以 `await Environment()` 读取 env.platform/env.arch，返回普通对象即可被 await。
 *   - platform：优先 window.mygo.platform（'darwin'|'linux'|'win32'），缺失时 UA 推断。
 *   - arch：bridge 层留空（''），后续可由 App.GetPlatform 补（data:{os,arch}）。
 *   - desktop：是否处于 MyGo 桌面窗口。
 */
export async function Environment() {
  const m = mygo()
  let platform = m && typeof m.platform === 'string' ? m.platform : ''
  if (!platform) platform = inferPlatformFromUA()
  return {
    platform,
    arch: '', // 预留：Go 侧 App.GetPlatform 提供 data.arch
    desktop: isMyGo(),
  }
}

// --------------------------------------------------------------------------
// 窗口控制
// --------------------------------------------------------------------------

/** 统一封装：有 window.mygo.window.<fn> 就调用，否则安全 no-op。 */
function winCall(fnName, ...args) {
  const m = mygo()
  const w = m && m.window
  if (w && typeof w[fnName] === 'function') {
    try {
      return Promise.resolve(w[fnName](...args)).catch((err) => {
        console.warn('[mygo-bridge] window.' + fnName + ' rejected:', err)
      })
    } catch (err) {
      console.warn('[mygo-bridge] window.' + fnName + ' threw:', err)
    }
  }
  return Promise.resolve()
}

export function WindowMinimise() {
  return winCall('minimize')
}

export function WindowMaximise() {
  return winCall('maximize')
}

export function WindowUnmaximise() {
  return winCall('unmaximize')
}

export function WindowToggleMaximise() {
  return winCall('toggleMaximize')
}

export function WindowSetTitle(title) {
  return winCall('setTitle', title)
}

// 记录最近一次全屏意图，用于 WindowSetFullscreen 只在状态变化时才 toggle。
let fullscreenState = false

/**
 * 设置全屏。签名对齐旧 runtime.WindowSetFullscreen(b)。
 * MyGo window API 只有 toggleFullScreen()（切换），没有 setFullScreen(bool)，
 * 因此用本地缓存的目标状态做 diff：仅当请求值与当前已知状态不同才 toggle 一次。
 * 注意：这只能跟踪经由本桥接发起的切换，外部（如原生菜单）改变全屏不会同步该缓存。
 */
export function WindowSetFullscreen(fullscreen) {
  const want = !!fullscreen
  if (want === fullscreenState) return Promise.resolve()
  fullscreenState = want
  return winCall('toggleFullScreen').then(() => {
    // 若底层拒绝（非 MyGo 环境），保持乐观标记也无副作用。
  })
}

/**
 * 查询是否全屏。旧 runtime 返回 Promise<{bool}>。
 * MyGo window API 没有 isFullScreen 查询，best-effort 返回本地跟踪的 fullscreenState。
 */
export async function WindowIsFullscreen() {
  return fullscreenState
}

// --------------------------------------------------------------------------
// 浏览器 / 退出
// --------------------------------------------------------------------------

/**
 * 打开外部链接。旧 runtime.BrowserOpenURL(url) 交给系统默认浏览器。
 * MyGo webview 通常会拦截 target=_blank / window.open 的外链并由宿主处理；这里用
 * window.open 尽力而为，非浏览器环境（无 window.open）安全跳过。
 */
export function BrowserOpenURL(url) {
  if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.open === 'function') {
    try {
      globalThis.window.open(url, '_blank', 'noopener,noreferrer')
      return
    } catch (err) {
      console.warn('[mygo-bridge] window.open failed:', err)
    }
  }
  // 兜底：MyGo 若有对应 Go binding 可扩展；此处保持 no-op 不抛错。
}

/**
 * 退出应用。window.mygo 没有 quit 控件 → 优先 call('App.Quit')（Go 侧应提供该方法），
 * 找不到/失败则 fallback 关闭当前窗口 mygo.window.close()。
 */
export function Quit() {
  const m = mygo()
  if (!m) return Promise.resolve()
  if (typeof m.call === 'function') {
    try {
      return m
        .call('App.Quit')
        .catch(() => winCall('close')) // Go 方法缺失 → 关窗兜底
    } catch (err) {
      console.warn('[mygo-bridge] call(App.Quit) threw:', err)
    }
  }
  return winCall('close')
}

// --------------------------------------------------------------------------
// 文件拖放
// --------------------------------------------------------------------------

// OnFileDrop 注册的 off 列表，供 OnFileDropOff 统一注销。
const fileDropOffs = []

/**
 * 监听拖放到窗口的文件。签名对齐旧 runtime.OnFileDrop(callback, useDropTarget)。
 * 旧回调约定：callback(x, y, paths) —— 注意参数顺序 (x, y, paths)。
 * MyGo 事件 'mygo:file-drop' 的 payload 为 { paths, x, y }，这里转成旧顺序调用。
 * 第二参数 useDropTarget 忽略：MyGo 仅在外部文件拖入时上报（编辑器内文字重排不触发），
 * 天然等价于旧版 useDropTarget=false 的行为。
 */
export function OnFileDrop(callback, _useDropTarget) {
  if (typeof callback !== 'function') return () => {}
  const m = mygo()
  if (!m || typeof m.on !== 'function') return () => {}
  let off = () => {}
  try {
    off =
      m.on('mygo:file-drop', (e) => {
        const payload = e || {}
        const paths = Array.isArray(payload.paths) ? payload.paths : []
        callback(payload.x, payload.y, paths)
      }) ||
      (() => {})
  } catch (err) {
    console.warn('[mygo-bridge] OnFileDrop subscribe failed:', err)
    return () => {}
  }
  fileDropOffs.push(off)
  return off
}

/** 注销所有 OnFileDrop 监听。对齐旧 runtime.OnFileDropOff()。 */
export function OnFileDropOff() {
  while (fileDropOffs.length) {
    const off = fileDropOffs.pop()
    try {
      off()
    } catch (_) {
      /* 忽略 */
    }
  }
}

// --------------------------------------------------------------------------
// 文件对话框
// --------------------------------------------------------------------------

/**
 * 打开文件对话框。旧 runtime.OpenDialog(options) 返回选中的绝对路径（或空串取消）。
 * MyGo 侧对话框是 Go binding：App.OpenFileDialog() → MethodResult
 *   { success, message?, path? }，取消约定 message==='canceled'。
 * options 目前 Go 侧无对应参数，暂不透传（保留形参以对齐签名）。
 * 返回值对齐旧语义：成功返回 path 字符串，取消/失败返回空串。
 */
export async function OpenDialog(options) {
  void options // Go 侧 OpenFileDialog 无参，先忽略以对齐旧签名
  const m = mygo()
  if (!m || typeof m.call !== 'function') return ''
  try {
    const res = await m.call('App.OpenFileDialog')
    if (res && res.success && res.path) return res.path
    return '' // 取消(message==='canceled')或失败
  } catch (err) {
    console.warn('[mygo-bridge] OpenDialog failed:', err)
    return ''
  }
}

/**
 * 另存为对话框。旧 runtime.SaveDialog(options) 返回选中路径（或空串取消）。
 * MyGo：App.SaveFileDialog(defaultName) → MethodResult{ success, message?, path? }。
 * 从 options 尽力取 default 文件名：options.defaultPath / options.filename 的首个元素
 * （旧 Wails DialogOptions.defaultFilename 形态不一，这里做宽容提取，取不到传 ''）。
 */
export async function SaveDialog(options) {
  let defaultName = ''
  if (options) {
    if (typeof options.defaultPath === 'string') defaultName = options.defaultPath
    else if (typeof options.filename === 'string') defaultName = options.filename
    else if (Array.isArray(options.defaultFilename) && typeof options.defaultFilename[0] === 'string') {
      defaultName = options.defaultFilename[0]
    } else if (typeof options.title === 'string') {
      defaultName = ''
    }
  }
  const m = mygo()
  if (!m || typeof m.call !== 'function') return ''
  try {
    const res = await m.call('App.SaveFileDialog', defaultName)
    if (res && res.success && res.path) return res.path
    return ''
  } catch (err) {
    console.warn('[mygo-bridge] SaveDialog failed:', err)
    return ''
  }
}
