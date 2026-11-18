// WEditor —— MyGo 版桌面 Markdown 排版编辑器。
//
// 迁移自 Wails v2 版本（../Weditor）。窗口与生命周期要点：
//   - TitleBarHiddenInset + TrafficLightPosition：保留原生红绿灯，页面顶部用
//     --app-region: drag 的拖拽条；双击进全屏由页面 dblclick → mygo.window.toggleFullScreen()
//     处理（框架原生 drag/drop/双击兜底，无需 JS 手搓 WindowSetPosition）。
//   - App.OnOpenFile：Finder 双击 .md 冷启动打开文件。MyGo 的 Event.Emit 有
//     DOM-ready 前排队语义（ipc.go），因此不需要 Wails 版的
//     startupFile/MarkFrontendReady/GetStartupFile 手工竞态兜底。
//     命令行参数场景同样覆盖：mygo 在 ready 后经 deliverArgs 把带关联扩展名的
//     参数送进 OnOpenFile（deeplink.go fileArgs），这里直接 Emit 即可。
//   - StateKey："main" 自动记忆窗口位置/尺寸/最大化/全屏状态。
//   - fileAssociations 见 mygo.config.ts（生成 CFBundleDocumentTypes）。
//   - 原生应用菜单对齐旧版结构（文件/编辑/视图/工具/帮助 + macOS AppMenu/EditMenu/WindowMenu role），
//     回调里 Emit BINDINGS.md 约定的 menu:* 事件（事件名是前端 bridge 翻译表的硬契约）。
package main

import (
	"log"

	"github.com/egoist/mygo"
)

// MenuEvents 对应 Wails 版 buildAppMenu 里 EventsEmit("menu-*") 的那批事件：
// Go 侧声明，菜单回调与前端 events.on('menu:newFile') 共用。
// 事件名必须精确等于 BINDINGS.md / mygo-bridge.js 翻译表；不一致会静默失联。
// menu:* 无载荷 → string 空串（lead 确认的约定）。
var (
	MenuNewFile        = mygo.NewEvent[string]("menu:newFile")
	MenuOpenFile       = mygo.NewEvent[string]("menu:openFile")
	MenuSaveFile       = mygo.NewEvent[string]("menu:saveFile")
	MenuSaveAsFile     = mygo.NewEvent[string]("menu:saveAsFile")
	MenuImportFile     = mygo.NewEvent[string]("menu:importFile")
	MenuViewBoth       = mygo.NewEvent[string]("menu:viewBoth")
	MenuViewEditor     = mygo.NewEvent[string]("menu:viewEditor")
	MenuViewPreview    = mygo.NewEvent[string]("menu:viewPreview")
	MenuToggleSyncScroll = mygo.NewEvent[string]("menu:toggleSyncScroll")
	MenuToggleSettings = mygo.NewEvent[string]("menu:toggleSettings")
	MenuShowGuide      = mygo.NewEvent[string]("menu:showGuide")
	MenuExportHtml     = mygo.NewEvent[string]("menu:exportHtml")
	MenuShowAbout      = mygo.NewEvent[string]("menu:showAbout")
	MenuCheckUpdate    = mygo.NewEvent[string]("menu:checkUpdate")

	UpdateProgress = mygo.NewEvent[progressPayload]("update:progress")
	AppFileOpen    = mygo.NewEvent[string]("app:fileOpen")
)

func main() {
	app := &App{}
	mygo.Bind(app)

	mygo.App.SetMenu(buildAppMenu())

	mygo.App.WhenReady(func() {
		win := mygo.NewWindow(mygo.WindowOptions{
			Title:           "WEditor",
			Width:           1000,
			Height:          1200,
			MinWidth:        800,
			MinHeight:       900,
			BackgroundColor: "#1b2636", // 对齐旧版 BackgroundColour，消除首帧闪色
			StateKey:        "main",
			TitleBarStyle:   mygo.TitleBarHiddenInset,
			URL:             "/",
		})

		setMainWindow(win)
		initApp(app)

		// Finder 双击 / 已运行实例 openurl / 命令行参数送达的文件：
		// handleFileOpen 校验类型后广播 app:fileOpen；Emit 的 DOM-ready 排队语义
		// 保证冷启动不丢事件（替代旧的 startupFile/GetStartupFile 手工兜底）。
		mygo.App.OnOpenFile(handleFileOpen)

		// 关闭前落盘最近文件（对齐旧 OnShutdown）
		mygo.App.OnQuit(func() { shutdown(app) })

		// 对齐旧版 mac.About：关于面板改在 WhenReady 里预置——mygo 无持久化 setter，
		// ShowAboutPanel 是命令式弹窗；若在此调用会启动即弹出。保留配置意图由前端
		// MenuShowAbout → AboutDialog 呈现（与旧版"关于 WEditor"菜单行为一致）。
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// emitMenu 向主窗口广播一个 menu:* 事件（无载荷，按约定发空串）。
func emitMenu(ev *mygo.Event[string]) {
	win := mainWindow()
	if win == nil {
		return
	}
	if err := ev.Emit(win, ""); err != nil {
		log.Printf("emit %s: %v", ev.Name(), err)
	}
}

// buildAppMenu 构建原生应用菜单，对齐旧 Wails 版 buildAppMenu 的结构与快捷键。
// 编辑菜单的撤销/重做改走 Role（macOS 直连 WKWebView 的 first responder，行为即所需；
// 旧版经前端事件的间接路径不再需要）。
func buildAppMenu() *mygo.Menu {
	return mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu}, // macOS 专用（其他平台被忽略），对齐旧 menu.AppMenu()

		// ===== 文件菜单 =====
		{Label: "文件", Submenu: []*mygo.MenuItem{
			{Label: "新建", Accelerator: "CmdOrCtrl+N", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuNewFile) }},
			{Label: "打开...", Accelerator: "CmdOrCtrl+O", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuOpenFile) }},
			mygo.Separator(),
			{Label: "保存", Accelerator: "CmdOrCtrl+S", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuSaveFile) }},
			{Label: "另存为...", Accelerator: "CmdOrCtrl+Shift+S", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuSaveAsFile) }},
			mygo.Separator(),
			{Label: "导入 Markdown...", Accelerator: "CmdOrCtrl+I", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuImportFile) }},
			mygo.Separator(),
			{Role: mygo.RoleClose},
		}},

		// ===== 编辑菜单（role：撤销/重做/剪切/复制/粘贴/全选 全走原生 first responder）=====
		{Label: "编辑", Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleUndo},
			{Role: mygo.RoleRedo},
			mygo.Separator(),
			{Role: mygo.RoleCut},
			{Role: mygo.RoleCopy},
			{Role: mygo.RolePaste},
			{Role: mygo.RoleSelectAll},
		}},

		// ===== 视图菜单 =====
		{Label: "视图", Submenu: []*mygo.MenuItem{
			{Label: "编辑+预览", Accelerator: "CmdOrCtrl+1", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuViewBoth) }},
			{Label: "仅编辑", Accelerator: "CmdOrCtrl+2", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuViewEditor) }},
			{Label: "仅预览", Accelerator: "CmdOrCtrl+3", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuViewPreview) }},
			mygo.Separator(),
			{Label: "切换同步滚动", Accelerator: "CmdOrCtrl+Shift+T", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuToggleSyncScroll) }},
		}},

		// ===== 工具菜单 =====
		{Label: "工具", Submenu: []*mygo.MenuItem{
			{Label: "设置", Accelerator: "CmdOrCtrl+,", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuToggleSettings) }},
			{Label: "Markdown 语法指南", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuShowGuide) }},
			mygo.Separator(),
			{Label: "导出 HTML...", Accelerator: "CmdOrCtrl+Shift+E", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuExportHtml) }},
		}},

		// ===== 窗口菜单（macOS role：Minimize ⌘M / Zoom / Full Screen ^⌘F 走 AppKit 原生 action）=====
		{Role: mygo.RoleWindowMenu},

		// ===== 帮助菜单 =====
		{Label: "帮助", Submenu: []*mygo.MenuItem{
			{Label: "检查更新...", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuCheckUpdate) }},
			mygo.Separator(),
			{Label: "关于 WEditor", Click: func(*mygo.MenuItem, *mygo.Window) { emitMenu(MenuShowAbout) }},
		}},
	})
}
