# WEditor-mygo 前端 ↔ Go 绑定契约（v1，2026-11-18）

`mygo generate` 会把下面 App 的导出方法生成到 `frontend/src/mygo.ts`。
统一返回结构（JSON snake_case 之外全部 camelCase，与旧版一致）：

```ts
interface MethodResult {
  success: boolean
  message?: string   // 失败原因；取消时约定 message === "canceled"
  path?: string
  content?: string
  data?: unknown     // 各方法的结构化载荷，见下
}
declare const App: {
  openFileDialog(): Promise<MethodResult>
  saveFileDialog(defaultName: string): Promise<MethodResult>
  saveFile(filePath: string, content: string): Promise<MethodResult>
  readFile(filePath: string): Promise<MethodResult>
  getRecentFiles(): Promise<MethodResult>      // data: Array<{path,name,openedAt}>
  clearRecentFiles(): Promise<MethodResult>
  exportHTML(htmlContent: string, defaultName: string): Promise<MethodResult> // data:{filePath}
  getAppVersion(): Promise<MethodResult>       // data:{version,buildTime}
  getPlatform(): Promise<MethodResult>         // data:{os,arch}
}
```

## 事件（Go → 前端），在 mygo.ts 的 `events` 命名空间里：

| 事件名 | 载荷 | 替代旧 Wails 事件 |
|---|---|---|
| `app:fileOpen` | string 路径 | `app-file-open`（Finder 双击/已运行实例） |
| `menu:newFile` 等 | — | `menu-*` 全系列：newFile/openFile/saveFile/saveAsFile/importFile/viewBoth/viewEditor/viewPreview/toggleSyncScroll/toggleSettings/showGuide/exportHtml/showAbout/checkUpdate |
| `update:progress` | object | `update-progress` |

## 前端直接调用的内置 window API（无需 generate）

`window.mygo.window.*`：`minimize() / maximize() / unmaximize() / toggleMaximize() / toggleFullScreen() / setTitle(s) / close()`

- 旧 `WindowSetTitle("WEditor - x.md")` → `mygo.window.setTitle(...)`
- 旧 useWindowDrag.js 三层兜底整体删除：拖拽条 CSS 用 `--app-region: drag`（MyGo bridge 原生处理），双击全屏 = 页面 dblclick → `mygo.window.toggleFullScreen()`。
- 文件拖放：用 MyGo 的文件 drop 上报（bridge → `onFileDrop`，只在外部拖入时触发，编辑器内文字重排不再被打断）。

## 关键语义约定（lead 补充，Go/前端共同遵守）

- **取消**：`openFileDialog` / `saveFileDialog` 用户取消时返回 `{success:false, message:"canceled"}`（前端据此走"取消=null"旧语义）。
- **事件名**：必须精确使用上表 colon 名（bridge 翻译表按此硬对齐；大小写敏感）。
- **载荷形状**：`getAppVersion.data = {version,...}`；`getRecentFiles.data = Array<{path,name,openedAt}>`；`exportHTML` 成功时 `path` 或 `data.filePath` 至少其一。
- **窗口双击全屏**：MyGo bridge 对 drag 区第一击即 `preventDefault()`，页面原生 dblclick 不会派发；框架改为向 Go 上报 `t:"dblclick"` → `TitleBarDoubleClicked()` → 跟随系统 `AppleActionOnDoubleClick`（默认 zoom）。要"双击=全屏"必须在 **Go 侧**把 dblclick 路由到 ToggleFullScreen——main.go 需持有窗口引用并处理。（bridge.ts:205-210 + bridge.go:355-358，v0.10.0 源码核实）

## 迁移纪律

- 前端业务代码保持 **JS + Vue3**，不转 TS；唯一 TS 文件是生成的 `mygo.ts` 与配置。
- 禁止再引入 `wailsjs/`、`window.go.main.App`、`window.runtime`。
- Go 侧 error 语义与 Wails 不同（reject promise），业务错误一律走 MethodResult.message。

## v1.1 追加（task-go-backend，2026-11-18）——现有契约不变，仅新增

上面 v1 的 9 个方法与事件名保持原样。Go 侧另提供以下方法（同样返回 MethodResult；`mygo generate` 已产出 frontend/src/mygo.ts，可直接 `import { App } from '../mygo.js'`）：

| 方法 | 载荷/说明 |
|---|---|
| `addRecentFile(filePath, name)` | 手动记入最近列表 |
| `checkForUpdate(manual)` | data: UpdateInfo{available,currentVersion,latestVersion,channel,publishedAt,notes,assetName,assetSize,assetUrl,sha256,reason,error} |
| `downloadUpdate()` | data:{filePath}，path 同值；进度走 update:progress |
| `applyUpdateAndRestart()` | 唯一 (value,error) 风格：失败 reject Promise（useUpdater catch 依赖） |
| `revealUpdateFile()` | 在文件管理器中定位安装包 |
| `openUpdateDownloadPage()` | Shell.OpenExternal 打开 Release 页 |
| `getAppDataDir()` | path = 数据目录 |
| `getBuildInfo()` | data: BuildInfo{version,commit,buildTime,platform} |
| `greet(name)` | 模板遗留 |
| `windowToggleFullScreen()/windowIsFullscreen()/windowZoom()` | 窗口兜底 API（主路径仍是 window.mygo.window.*；isFullscreen 的 data 为 boolean） |
| `toggleFullScreen()` | **方案 D：双击拖拽条=全屏** 的 Go 入口。data:{fullScreen}（切换后的状态）。框架路由不可拦截（bridge preventDefault→TitleBarDoubleClicked→系统偏好 zoom），前端在 .window-drag-strip dblclick → call('App.ToggleFullScreen') |
| `isFullScreen()` | data:{fullScreen}，按钮态查询 |
| `quit()` | bridge 的 Quit() 走 call('App.Quit') |
| `getUpdateSettings()/setUpdateSettings(s)/skipVersion(v)` | data: UpdateSettings{channel,autoCheck,skippedVersion,lastCheckAt} |

事件补充：update:progress 载荷即旧 UpdateProgress 结构 `{downloaded,total,percent,speed}`；menu:* 与 app:fileOpen 均为 string（menu 无载荷发空串）。

取消语义再确认：OpenFileDialog 用户取消 → `{success:false, message:"canceled"}`；SaveFileDialog/ExportHTML 同。其他业务错误 success=false + message 为中文原因文本。

## 窗口双击全屏（task-go-backend 落地记录，2026-11-18）

采用方案 **D**（lead 指定，已核实 mygo v0.10.0 源码）：
- 框架链路：`--app-region: drag` 区域 mousedown 被 bridge capture 阶段 `preventDefault` 并上报 `t:"dblclick"` → Go `bridge.go:357` → darwin `window.go:1605 TitleBarDoubleClicked()` 跟随 `AppleActionOnDoubleClick`（默认 zoom）。v0.10.0 无回调/选项可拦截（A 不成立：`internal/web/window.go:138` 是 no-op、无注入点；C 的 no-drag 细条会毁拖动手感）。
- Go 侧新增绑定：`App.ToggleFullScreen()`（`win.SetFullScreen(!win.IsFullScreen())`，返回 MethodResult{success,data:{fullScreen}}）与 `App.IsFullScreen()`。
- 关键事实（供前端注释引用）：preventDefault 只压掉 AppKit 的系统双击路径，**页面 JS 仍收到同一事件**——同位置第二击 `e.detail===2`、`dblclick` 照常派发；因此 App.vue 在 .window-drag-strip 上 dblclick → `call('App.ToggleFullScreen')` 即可。旧的 windowToggleFullScreen/windowIsFullscreen/windowZoom 三个兼容方法保留。**建议实测确认这一点**（bridge 的 mousedown capture 也 preventDefault，理论上不阻止 click/dblclick 派发，但值得跑一次）。备选：macOS 系统偏好 AppleActionOnDoubleClick 无 Full Screen 选项（只有 None/Minimize/Maximize），故不可取。
