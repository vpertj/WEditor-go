package main

// 迁移自 Wails v2 版 app.go（../Weditor/app.go）。要点：
//   - BINDINGS.md 是前端契约：列出的方法名与 MethodResult 返回结构不可变。
//     旧的 (string,string,error) 多返回值风格全部收敛为 MethodResult{success,message,path,content,data}。
//   - 取消语义：Dialog.Open 返回空切片、Dialog.Save 返回 "" 都算用户取消，
//     统一回 {Success:false, Message:"canceled"}（前端 useWails.openFile 依赖它判定 null）。
//   - MyGo 的 error 会 reject 前端 Promise，业务错误一律走 MethodResult.message；
//     仅 applyUpdateAndRestart 按 BINDINGS.md 保留 value+error 风格。
//   - 事件推送：包级 mygo.NewEvent[T] + Ev.Emit(win, v)；ctx==nil 防护改为窗口指针检查
//     （mainWindow() 未就绪或已销毁时跳过/Emit 返回 errDestroyed）。
//   - startupFile/MarkFrontendReady/GetStartupFile 整套手工竞态兜底已删除：
//     OnOpenFile → AppFileOpen.Emit 的 DOM-ready 排队语义覆盖冷启动；
//     命令行参数打开文件同样经 OnOpenFile 送达（mygo deliverArgs，见 deeplink.go）。
//   - WindowSetTitle 无需 Go 侧调用（前端用 window.mygo.window.setTitle），旧调用已删。

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

const APP_NAME = "WEditor"

// 版本信息：由 CI 构建时通过 -ldflags -X main.XXX 注入。
// 保留默认值，本地 go build / mygo dev 也能正常工作。
var (
	APP_VERSION    = "1.0.0"
	APP_COMMIT     = "dev"
	APP_BUILD_TIME = ""
)

// RecentFile 最近打开的文件信息
type RecentFile struct {
	Path     string `json:"path"`
	Name     string `json:"name"`
	OpenedAt string `json:"openedAt"`
}

// MethodResult 是所有 binding 方法的统一返回结构（BINDINGS.md）。
type MethodResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"` // 失败原因（人类可读）；取消固定为 "canceled"
	Path    string `json:"path,omitempty"`
	Content string `json:"content,omitempty"`
	Data    any    `json:"data,omitempty"` // 结构化载荷：RecentFile[] / UpdateInfo / BuildInfo 等
}

// BuildInfo 构建信息，关于页与更新器共用
type BuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"buildTime"`
	Platform  string `json:"platform"`
}

// App 是暴露给前端的绑定服务（指针接收者 + Bind(&App{})，与旧 Wails 结构一致；
// 可变状态放实例字段 appDataDir，跨调用共享同一实例）。
type App struct {
	appDataDir string
}

// 应用级共享状态。
var (
	appMu sync.Mutex

	mainWin        *mygo.Window // 主窗口；替代旧的 a.ctx（Emit 目标 / 对话框 Parent）
	recentFiles    []RecentFile // 最近文件列表（绑定/非绑定路径共享，旧 App 字段移到包级）
	cleanupStarted bool         // 后台清理 goroutine 只起一次（测试可反复 initApp）
)

// mainWindow 返回当前有效的主窗口指针；未创建或已销毁时为 nil。
// 这是旧代码 ctx==nil 防护在 MyGo 下的等价物。
func mainWindow() *mygo.Window {
	appMu.Lock()
	w := mainWin
	appMu.Unlock()
	if w == nil || w.IsDestroyed() {
		return nil
	}
	return w
}

// setMainWindow 记录主窗口（由 main.go 在 WhenReady 创建窗口后调用）。
func setMainWindow(w *mygo.Window) {
	appMu.Lock()
	mainWin = w
	appMu.Unlock()
}

// initApp 对齐 Wails OnStartup：加载最近文件、准备数据目录，
// 并在后台清理上次更新的残留（纯维护性 IO，不阻塞启动路径——窗口与前端渲染优先）。
func initApp(app *App) {
	appMu.Lock()
	if app.appDataDir == "" {
		app.appDataDir = computeDataDir()
	}
	dir := app.appDataDir
	loadRecentFilesLocked(dir)
	first := !cleanupStarted
	cleanupStarted = true
	appMu.Unlock()

	if first {
		go func() {
			app.cleanupUpdatesDir() // 方法按实例字段工作，见 updater.go
			cleanupPlatformArtifacts()
		}()
	}
}

// shutdown 对齐 Wails OnShutdown：落盘最近文件。
func shutdown(app *App) {
	appMu.Lock()
	saveRecentFilesLocked(app.appDataDir)
	appMu.Unlock()
}

// handleFileOpen 处理 Finder 双击 / 已运行实例 / 命令行参数送来的文件。
// 与旧版一致：仅接受受支持的 Markdown/文本文件且文件存在；记入最近文件后
// 直接广播 app:fileOpen —— Event.Emit 的 DOM-ready 前排队语义覆盖冷启动竞态，
// 不再需要 startupFile/MarkFrontendReady/GetStartupFile 手工兜底。
func handleFileOpen(filePath string) {
	if filePath == "" {
		return
	}
	if !isMarkdownFile(filePath) || !fileExists(filePath) {
		return
	}
	filePath = filepath.Clean(filePath)

	win := mainWindow()
	if win == nil {
		log.Printf("app:fileOpen dropped: no live window for %s", filePath)
		return
	}
	addRecentFile("", filePath, filepath.Base(filePath)) // 数据目录未初始化时兜底真实用户目录
	if err := AppFileOpen.Emit(win, filePath); err != nil {
		log.Printf("emit app:fileOpen: %v", err)
	}
}

// isMarkdownFile 判断文件是否为支持的 Markdown/文本类型
func isMarkdownFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".md", ".markdown", ".mdown", ".mkd", ".txt":
		return true
	}
	return false
}

// fileExists 判断文件是否存在且不是目录
func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// ==========================================
// 文件对话框操作
// ==========================================

// mdFilters 打开对话框的过滤器（对应旧 Wails OpenDialogOptions.Filters）。
func mdFilters() []mygo.FileFilter {
	return []mygo.FileFilter{
		{Name: "Markdown 文件 (*.md)", Extensions: []string{"md", "markdown", "mdown", "mkd"}},
		{Name: "文本文件 (*.txt)", Extensions: []string{"txt"}},
		{Name: "所有文件 (*.*)", Extensions: []string{"*"}},
	}
}

// OpenFileDialog 弹出打开对话框并读取文件内容。取消时 Success=false, Message="canceled"。
func (a *App) OpenFileDialog() MethodResult {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Title:    "打开 Markdown 文件",
		Parent:   mainWindow(),
		Filters:  mdFilters(),
		Multiple: false,
	})
	if err != nil {
		return MethodResult{Message: fmt.Sprintf("打开文件对话框失败: %v", err)}
	}
	if len(paths) == 0 || paths[0] == "" {
		return MethodResult{Message: "canceled"} // MyGo 取消语义：空切片
	}
	filePath := paths[0]

	content, err := os.ReadFile(filePath)
	if err != nil {
		return MethodResult{Message: fmt.Sprintf("读取文件失败: %v", err)}
	}

	addRecentFile(a.appDataDir, filePath, filepath.Base(filePath))
	return MethodResult{Success: true, Path: filePath, Content: string(content)}
}

// SaveFileDialog 弹出保存对话框，返回选择的路径。取消时 Message="canceled"。
func (a *App) SaveFileDialog(defaultName string) MethodResult {
	if defaultName == "" {
		defaultName = "untitled.md"
	}
	filePath, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Title:       "保存 Markdown 文件",
		DefaultPath: defaultName,
		Parent:      mainWindow(),
		Filters: []mygo.FileFilter{
			{Name: "Markdown 文件 (*.md)", Extensions: []string{"md"}},
		},
	})
	if err != nil {
		return MethodResult{Message: fmt.Sprintf("保存文件对话框失败: %v", err)}
	}
	if filePath == "" {
		return MethodResult{Message: "canceled"} // MyGo 取消语义：空字符串
	}
	return MethodResult{Success: true, Path: filePath}
}

// ==========================================
// 文件读写操作
// ==========================================

// SaveFile 将内容写入指定路径。
func (a *App) SaveFile(filePath string, content string) MethodResult {
	if filePath == "" {
		return MethodResult{Message: "文件路径不能为空"}
	}

	// 确保目录存在
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return MethodResult{Message: fmt.Sprintf("创建目录失败: %v", err)}
	}

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return MethodResult{Message: fmt.Sprintf("写入文件失败: %v", err)}
	}

	addRecentFile(a.appDataDir, filePath, filepath.Base(filePath))
	return MethodResult{Success: true, Path: filePath}
}

// ReadFile 读取文件内容。
func (a *App) ReadFile(filePath string) MethodResult {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return MethodResult{Message: fmt.Sprintf("读取文件失败: %v", err)}
	}

	addRecentFile(a.appDataDir, filePath, filepath.Base(filePath))
	return MethodResult{Success: true, Path: filePath, Content: string(content)}
}

// ==========================================
// 最近文件管理
// ==========================================

// GetRecentFiles 返回 Data = []RecentFile{path,name,openedAt}（JSON 字段沿用旧版）。
func (a *App) GetRecentFiles() MethodResult {
	appMu.Lock()
	list := append([]RecentFile(nil), recentFiles...)
	appMu.Unlock()
	if list == nil {
		list = []RecentFile{}
	}
	return MethodResult{Success: true, Data: list}
}

// AddRecentFile 添加文件到最近列表。
func (a *App) AddRecentFile(filePath string, name string) MethodResult {
	addRecentFile(a.appDataDir, filePath, name)
	return MethodResult{Success: true}
}

// ClearRecentFiles 清空最近文件列表。
func (a *App) ClearRecentFiles() MethodResult {
	appMu.Lock()
	recentFiles = []RecentFile{}
	a.ensureDataDirLocked()
	saveRecentFilesLocked(a.appDataDir)
	appMu.Unlock()
	return MethodResult{Success: true}
}

// ==========================================
// 导出功能
// ==========================================

// ExportHTML 导出 HTML 文件（接收前端渲染好的 HTML，这里仅做另存为 + 包装落盘）。
// 取消时 Message="canceled"；成功时 Path 与 Data.filePath 同值（BINDINGS.md 约定）。
func (a *App) ExportHTML(htmlContent string, defaultName string) MethodResult {
	if defaultName == "" {
		defaultName = "export.html"
	}
	if !strings.HasSuffix(defaultName, ".html") {
		defaultName = strings.TrimSuffix(defaultName, filepath.Ext(defaultName)) + ".html"
	}

	filePath, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Title:       "导出 HTML",
		DefaultPath: defaultName,
		Parent:      mainWindow(),
		Filters: []mygo.FileFilter{
			{Name: "HTML 文件 (*.html)", Extensions: []string{"html", "htm"}},
		},
	})
	if err != nil {
		return MethodResult{Message: fmt.Sprintf("对话框失败: %v", err)}
	}
	if filePath == "" {
		return MethodResult{Message: "canceled"}
	}

	// 添加完整的 HTML 包装（与旧版一致）
	fullHTML := fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s</title>
    <style>
        body { max-width: 860px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.8; color: #333; }
        img { max-width: 100%%; }
        pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
        code { font-family: "JetBrains Mono", "Fira Code", "Menlo", monospace; font-size: 0.9em; }
        blockquote { border-left: 4px solid #4A90D9; margin: 0; padding: 4px 16px; color: #666; background: #f8f9fa; }
        table { border-collapse: collapse; width: 100%%; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
%s
</body>
</html>`, defaultName, htmlContent)

	if err := os.WriteFile(filePath, []byte(fullHTML), 0644); err != nil {
		return MethodResult{Message: fmt.Sprintf("写入文件失败: %v", err)}
	}

	return MethodResult{
		Success: true,
		Path:    filePath,
		Data:    map[string]string{"filePath": filePath},
	}
}

// ==========================================
// 窗口操作（前端 binding，供标题栏双击等交互调用）
// ==========================================

// ToggleFullScreen / IsFullScreen：双击标题栏方案 D 的 Go 侧入口。
// 背景（已核实 mygo v0.10.0）：bridge.js 对 --app-region:drag 区域的 mousedown
// capture 阶段 preventDefault 并向 Go 上报 "dblclick"（bridge.js:205-210），
// Go bridge.go:357 → darwin window.go:1605 TitleBarDoubleClicked 跟随系统偏好
// AppleActionOnDoubleClick（默认 zoom）；v0.10.0 无任何回调/选项可拦截这条路由
// （MyGoWindow 是 NSWindow 裸子类，未覆写 toggleFullScreen:/performZoom:）。
// 注意：preventDefault 只压掉 AppKit 的系统路径——页面 JS 仍收得到同一事件
// （e.detail 递增照常），故前端在拖拽条上 dblclick → call('App.ToggleFullScreen')
// 即可实现"双击=全屏"。旧版 WindowToggleFullScreen/WindowIsFullscreen 保留兼容。
func (a *App) ToggleFullScreen() MethodResult {
	win := mainWindow()
	if win == nil {
		return MethodResult{Message: "窗口不可用"}
	}
	win.SetFullScreen(!win.IsFullScreen())
	return MethodResult{Success: true, Data: map[string]bool{"fullScreen": win.IsFullScreen()}}
}

// IsFullScreen 返回当前窗口是否处于原生全屏。Data = {fullScreen}。
func (a *App) IsFullScreen() MethodResult {
	win := mainWindow()
	if win == nil {
		return MethodResult{Success: true, Data: map[string]bool{"fullScreen": false}}
	}
	return MethodResult{Success: true, Data: map[string]bool{"fullScreen": win.IsFullScreen()}}
}

// WindowToggleFullScreen 切换原生全屏（再调一次即退出）。
// 主路径在前端（window.mygo.window.toggleFullScreen()），此方法供菜单 role 之外的调用方兜底。
func (a *App) WindowToggleFullScreen() MethodResult {
	win := mainWindow()
	if win == nil {
		return MethodResult{Message: "窗口不可用"}
	}
	win.ToggleFullScreen()
	return MethodResult{Success: true}
}

// WindowIsFullscreen 返回当前窗口是否处于原生全屏（前端可据此显示按钮状态）。
func (a *App) WindowIsFullscreen() MethodResult {
	win := mainWindow()
	if win == nil {
		return MethodResult{Success: true, Data: false}
	}
	return MethodResult{Success: true, Data: win.IsFullScreen()}
}

// WindowZoom 缩放窗口（macOS 上等价于系统「窗口 > 缩放」；再调一次还原）。
func (a *App) WindowZoom() MethodResult {
	win := mainWindow()
	if win == nil {
		return MethodResult{Message: "窗口不可用"}
	}
	if win.IsMaximized() {
		win.Unmaximize()
	} else {
		win.Maximize()
	}
	return MethodResult{Success: true}
}

// Quit 退出应用（mygo-bridge 的 Quit() 走 call('App.Quit')）。
func (a *App) Quit() MethodResult {
	mygo.App.Quit()
	return MethodResult{Success: true}
}

// ==========================================
// 应用信息
// ==========================================

// GetAppVersion 返回 Data = {version, commit, buildTime}。
func (a *App) GetAppVersion() MethodResult {
	return MethodResult{Success: true, Data: map[string]string{
		"version":   APP_VERSION,
		"commit":    APP_COMMIT,
		"buildTime": APP_BUILD_TIME,
	}}
}

// GetBuildInfo 返回完整构建信息（Data = BuildInfo，关于页与更新器共用）。
func (a *App) GetBuildInfo() MethodResult {
	return MethodResult{Success: true, Data: BuildInfo{
		Version:   APP_VERSION,
		Commit:    APP_COMMIT,
		BuildTime: APP_BUILD_TIME,
		Platform:  platformString(),
	}}
}

// GetAppDataDir 返回应用数据目录。
func (a *App) GetAppDataDir() MethodResult {
	return MethodResult{Success: true, Path: a.dataDir()}
}

// GetPlatform 返回 Data = {os, arch}（前端 bridge 的 Environment().arch 由此补齐）。
func (a *App) GetPlatform() MethodResult {
	return MethodResult{Success: true, Data: map[string]string{
		"os":   runtime.GOOS,
		"arch": runtime.GOARCH,
	}}
}

// Greet 保留的模板方法
func (a *App) Greet(name string) MethodResult {
	return MethodResult{Success: true, Content: fmt.Sprintf("Hello %s, It's show time!", name)}
}

// ==========================================
// 更新器绑定入口（实现见 updater.go，这里收敛为 MethodResult）
// ==========================================

// CheckForUpdate 检查更新。manual=true 表示用户主动触发，
// 此时前端需要展示失败原因；自动检查失败则静默。Data = UpdateInfo。
func (a *App) CheckForUpdate(manual bool) MethodResult {
	return MethodResult{Success: true, Data: a.checkForUpdate(manual)}
}

// DownloadUpdate 下载当前平台的新版本安装包，进度通过 update:progress 事件推送。
func (a *App) DownloadUpdate() MethodResult {
	r := a.downloadUpdate()
	res := MethodResult{Success: r.Success, Message: r.Message, Path: r.FilePath}
	if r.Success {
		res.Data = map[string]string{"filePath": r.FilePath}
	}
	return res
}

// ApplyUpdateAndRestart 安装已下载的更新并重启。
// 唯一按 BINDINGS.md 保留 (value, error) 风格的绑定：失败要 reject 前端 Promise，
// useUpdater.applyAndRestart 依赖 catch 分支进入 error 态。
func (a *App) ApplyUpdateAndRestart() (MethodResult, error) {
	if err := a.applyUpdateAndRestart(); err != nil {
		return MethodResult{Message: err.Error()}, err
	}
	return MethodResult{Success: true, Message: "正在重启"}, nil
}

// RevealUpdateFile 在系统文件管理器中定位已下载的安装包。
func (a *App) RevealUpdateFile() MethodResult {
	updateMu.Lock()
	var path string
	if stagedUpdate != nil {
		path = stagedUpdate.Path
	}
	updateMu.Unlock()
	if path == "" {
		return MethodResult{Message: "没有已下载的安装包"}
	}
	revealed := revealInFileManager(path)
	if revealed == "" {
		return MethodResult{Message: "无法打开文件管理器"}
	}
	return MethodResult{Success: true, Path: revealed}
}

// OpenUpdateDownloadPage 打开 Release 页面，用于无法自动更新时的降级路径。
func (a *App) OpenUpdateDownloadPage() MethodResult {
	url := fmt.Sprintf("https://github.com/%s/%s/releases/latest", updateRepoOwner, updateRepoName)
	if err := mygo.Shell.OpenExternal(url); err != nil {
		return MethodResult{Message: fmt.Sprintf("打开下载页失败: %v", err)}
	}
	return MethodResult{Success: true, Data: url}
}

// GetUpdateSettings 读取更新设置。Data = UpdateSettings。
func (a *App) GetUpdateSettings() MethodResult {
	return MethodResult{Success: true, Data: a.getUpdateSettings()}
}

// SetUpdateSettings 保存更新设置。Data = 规范化后的 UpdateSettings。
func (a *App) SetUpdateSettings(s UpdateSettings) MethodResult {
	return MethodResult{Success: true, Data: a.setUpdateSettings(s)}
}

// SkipVersion 记录跳过的版本。Data = 更新后的 UpdateSettings。
func (a *App) SkipVersion(version string) MethodResult {
	return MethodResult{Success: true, Data: a.skipVersion(version)}
}

// ==========================================
// 内部辅助
// ==========================================

func platformString() string {
	return fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)
}

// computeDataDir 获取应用数据目录（旧 getAppDataDir；Wails Environment().Platform
// 改用 runtime.GOOS，同一进程内取值一致）。
func computeDataDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "."
	}

	var configDir string
	switch runtime.GOOS {
	case "darwin":
		configDir = filepath.Join(homeDir, "Library", "Application Support", APP_NAME)
	case "windows":
		configDir = filepath.Join(homeDir, "AppData", "Roaming", APP_NAME)
	default:
		configDir = filepath.Join(homeDir, ".config", APP_NAME)
	}

	os.MkdirAll(configDir, 0755)
	return configDir
}

// ensureDataDirLocked 返回实例的数据目录，必要时计算（调用方持有 appMu）。
// 测试里直接构造的 &App{appDataDir: dir} 走字段值，不会被覆盖。
func (a *App) ensureDataDirLocked() string {
	if a.appDataDir == "" {
		a.appDataDir = computeDataDir()
	}
	return a.appDataDir
}

// dataDir 返回实例数据目录；未经 initApp（如单元测试直接构造 &App{}）时按需计算并缓存。
func (a *App) dataDir() string {
	appMu.Lock()
	defer appMu.Unlock()
	return a.ensureDataDirLocked()
}

// recentFilePath 返回最近文件记录的存储路径。
func recentFilePath(dir string) string {
	return filepath.Join(dir, "recent.json")
}

// loadRecentFilesLocked 从磁盘加载最近文件列表（调用方持有 appMu）。
func loadRecentFilesLocked(dir string) {
	var list []RecentFile
	if data, err := os.ReadFile(recentFilePath(dir)); err == nil {
		json.Unmarshal(data, &list)
	}
	if list == nil {
		list = []RecentFile{}
	}
	recentFiles = list
}

// saveRecentFilesLocked 保存最近文件列表到磁盘（调用方持有 appMu）。
func saveRecentFilesLocked(dir string) {
	if dir == "" {
		return
	}
	data, err := json.MarshalIndent(recentFiles, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(recentFilePath(dir), data, 0644)
}

// addRecentFile 添加一个文件到最近列表（去重，最多保留 20 条）。
// dir 为落盘目录：绑定方法传实例的 appDataDir；handleFileOpen 等非绑定路径传 ""，
// 用真实用户目录兜底。
func addRecentFile(dir, filePath string, name string) {
	if filePath == "" {
		return
	}
	appMu.Lock()
	defer appMu.Unlock()

	// 去重：移除已存在的相同路径
	filtered := make([]RecentFile, 0, len(recentFiles))
	for _, f := range recentFiles {
		if f.Path != filePath {
			filtered = append(filtered, f)
		}
	}

	// 添加新记录到最前面
	newEntry := RecentFile{
		Path:     filePath,
		Name:     name,
		OpenedAt: time.Now().Format("2006-01-02 15:04"),
	}
	recentFiles = append([]RecentFile{newEntry}, filtered...)

	// 最多保留 20 条
	if len(recentFiles) > 20 {
		recentFiles = recentFiles[:20]
	}

	if dir == "" {
		dir = computeDataDir()
	}
	saveRecentFilesLocked(dir)
}
