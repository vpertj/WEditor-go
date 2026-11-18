/**
 * @file src/composables/useWails.js
 * @description Wails 桌面集成 Composable
 *
 * 提供与 Go 后端的完整交互能力：
 * - 文件操作（打开/保存/另存为）
 * - 原生菜单事件监听
 * - 拖放文件支持
 * - 最近文件管理
 * - HTML 导出
 * - 窗口控制
 */
import { ref, onMounted, onUnmounted } from 'vue'
// MyGo 迁移：runtime 兼容层（见 mygo-bridge.js），保持原有导入名与签名。
import {
  isMyGo,
  EventsOn,
  EventsOff,
  EventsEmit,
  Environment,
  WindowMinimise,
  WindowMaximise,
  WindowUnmaximise,
  WindowSetTitle,
  BrowserOpenURL,
  Quit,
  OnFileDrop,
  OnFileDropOff
} from '../mygo-bridge.js'

export function useWails() {
  const isWails = ref(false)
  const currentFilePath = ref('')
  const currentFileName = ref('')
  const isModified = ref(false)
  const appVersion = ref('1.0.0')
  const platform = ref('')
  const recentFiles = ref([])

  // ==========================================
  // 环境检测
  // ==========================================

  const checkWails = () => {
    // MyGo 迁移：桌面环境判定改走 bridge（window.mygo 存在即桌面应用）
    isWails.value = isMyGo()
    return isWails.value
  }

  const getEnvInfo = async () => {
    try {
      const env = await Environment()
      platform.value = `${env.platform}/${env.arch}`
      try {
        const r = await window.go.main.App.getAppVersion()
        if (r && r.success && r.data && r.data.version) appVersion.value = r.data.version
      } catch (e) {
        console.warn('获取版本信息失败:', e)
      }
    } catch (e) {
      console.error('获取环境信息失败:', e)
    }
  }

  // ==========================================
  // 文件操作
  // ==========================================

  /**
   * 打开文件对话框并读取文件内容
   * @returns {{ filePath: string, content: string, success: boolean } | null}
   */
  const openFile = async () => {
    if (!isWails.value) return null

    try {
      // MyGo binding 统一返回 MethodResult{success,message,path,content}
      const r = await window.go.main.App.openFileDialog()

      if (!r || !r.success) {
        const msg = r && r.message
        if (msg === 'canceled') return null // 用户取消
        console.error('打开文件失败:', msg)
        return { success: false, message: msg || '打开失败' }
      }
      const filePath = r.path
      const content = r.content
      if (!filePath) return null

      currentFilePath.value = filePath
      currentFileName.value = filePath.split('/').pop() || filePath
      isModified.value = false

      // 更新窗口标题
      WindowSetTitle(`WEditor - ${currentFileName.value}`)

      // 刷新最近文件
      await getRecentFiles()

      return { success: true, filePath, content }
    } catch (e) {
      console.error('打开文件出错:', e)
      return { success: false, message: e.message || '打开失败' }
    }
  }

  /**
   * 按路径打开文件（Apple Events / 拖放 / 最近文件通用）
   * 设置当前文件、窗口标题并刷新最近文件列表
   * @param {string} filePath - 文件路径
   */
  const openFilePath = async (filePath) => {
    if (!isWails.value) return { success: false, message: '不在 Wails 环境中' }

    try {
      const r = await window.go.main.App.readFile(filePath)
      if (!r || !r.success) return { success: false, message: (r && r.message) || '打开失败' }
      const content = r.content
      currentFilePath.value = filePath
      currentFileName.value = filePath.split('/').pop() || filePath
      isModified.value = false
      WindowSetTitle(`WEditor - ${currentFileName.value}`)
      await getRecentFiles()

      return { success: true, filePath, content }
    } catch (e) {
      console.error('打开文件失败:', e)
      return { success: false, message: e.message || '打开失败' }
    }
  }

  /**
   * 【已废弃】MyGo 下 Finder 双击经 app:fileOpen 事件排队送达，无需拉取兜底。
   * 保留函数签名以兼容旧调用点，恒返回 null。
   */
  const loadStartupFile = async () => null

  /**
   * 保存文件到当前路径（无当前路径则调用另存为）
   * @param {string} content - Markdown 内容
   */
  const saveFile = async (content) => {
    if (!isWails.value) return { success: false, message: '不在 Wails 环境中' }

    try {
      if (currentFilePath.value) {
        const r = await window.go.main.App.saveFile(currentFilePath.value, content)
        if (r && !r.success) throw new Error(r.message || '保存失败')
        isModified.value = false
        WindowSetTitle(`WEditor - ${currentFileName.value}`)
        return { success: true, filePath: currentFilePath.value }
      } else {
        return await saveFileAs(content)
      }
    } catch (e) {
      console.error('保存文件出错:', e)
      return { success: false, message: e.message || '保存失败' }
    }
  }

  /**
   * 另存为对话框
   * @param {string} content - Markdown 内容
   */
  const saveFileAs = async (content) => {
    if (!isWails.value) return { success: false, message: '不在 Wails 环境中' }

    try {
      const fileName = currentFileName.value || 'untitled.md'
      const dlg = await window.go.main.App.saveFileDialog(fileName)
      const filePath = dlg && dlg.success ? dlg.path : ''

      if (!filePath) return { success: false, message: '用户取消了操作' }

      await window.go.main.App.saveFile(filePath, content)
      currentFilePath.value = filePath
      currentFileName.value = filePath.split('/').pop() || filePath
      isModified.value = false

      WindowSetTitle(`WEditor - ${currentFileName.value}`)
      await getRecentFiles()

      return { success: true, filePath }
    } catch (e) {
      console.error('另存为出错:', e)
      return { success: false, message: e.message || '保存失败' }
    }
  }

  /**
   * 新建文件
   */
  const newFile = () => {
    if (confirm('确定要新建文件吗？未保存的更改将丢失。')) {
      currentFilePath.value = ''
      currentFileName.value = ''
      isModified.value = false
      WindowSetTitle('WEditor')
      return true
    }
    return false
  }

  // ==========================================
  // 最近文件
  // ==========================================

  const getRecentFiles = async () => {
    if (!isWails.value) return []
    try {
      const r = await window.go.main.App.getRecentFiles()
      const list = r && r.success ? r.data : []
      recentFiles.value = Array.isArray(list) ? list : []
      return recentFiles.value
    } catch (e) {
      console.error('获取最近文件失败:', e)
      return []
    }
  }

  const clearRecentFiles = async () => {
    if (!isWails.value) return
    try {
      await window.go.main.App.clearRecentFiles()
      recentFiles.value = []
    } catch (e) {
      console.error('清空最近文件失败:', e)
    }
  }

  const openRecentFile = async (filePath) => {
    if (!isWails.value) return null
    try {
      const r = await window.go.main.App.readFile(filePath)
      if (!r || !r.success) return { success: false, message: (r && r.message) || '打开失败' }
      const content = r.content
      currentFilePath.value = filePath
      currentFileName.value = filePath.split('/').pop() || filePath
      isModified.value = false
      WindowSetTitle(`WEditor - ${currentFileName.value}`)
      await getRecentFiles()
      return { success: true, filePath, content }
    } catch (e) {
      console.error('打开最近文件失败:', e)
      return { success: false, message: e.message }
    }
  }

  // ==========================================
  // 导出
  // ==========================================

  /**
   * 导出 HTML 文件
   * @param {string} htmlContent - HTML 内容
   * @param {string} defaultName - 默认文件名
   */
  const exportHTML = async (htmlContent, defaultName = '') => {
    if (!isWails.value) return { success: false, message: '不在 Wails 环境中' }
    try {
      const name = defaultName || (currentFileName.value ?
        currentFileName.value.replace(/\.md$/i, '') + '.html' : 'export.html')
      const r = await window.go.main.App.exportHTML(htmlContent, name)
      return r && r.success ? { success: true, filePath: r.path || (r.data && r.data.filePath) } : { success: false, message: (r && r.message) || '导出失败' }
    } catch (e) {
      console.error('导出 HTML 失败:', e)
      return { success: false, message: e.message }
    }
  }

  // ==========================================
  // 菜单事件监听
  // ==========================================

  /** 维护所有已注册的事件名，用于清理 */
  const _registeredEvents = []

  /**
   * 设置原生菜单事件监听
   * @param {Object} callbacks - 回调函数映射
   * @param {Function} callbacks.onNewFile - 新建文件
   * @param {Function} callbacks.onOpenFile - 打开文件
   * @param {Function} callbacks.onSaveFile - 保存文件
   * @param {Function} callbacks.onSaveAsFile - 另存为
   * @param {Function} callbacks.onImportFile - 导入
   * @param {Function} callbacks.onViewBoth - 编辑+预览
   * @param {Function} callbacks.onViewEditor - 仅编辑
   * @param {Function} callbacks.onViewPreview - 仅预览
   * @param {Function} callbacks.onToggleSyncScroll - 切换同步滚动
   * @param {Function} callbacks.onToggleSettings - 切换设置
   * @param {Function} callbacks.onShowGuide - 显示指南
   * @param {Function} callbacks.onExportHTML - 导出 HTML
   * @param {Function} callbacks.onShowAbout - 关于
   * @param {Function} callbacks.onCheckUpdate - 检查更新
   */
  const setupMenuListeners = (callbacks = {}) => {
    if (!isWails.value) {
      console.log('⚠️ 不在 Wails 环境中，跳过菜单监听器设置')
      return
    }

    const eventMap = {
      'menu-new-file': callbacks.onNewFile,
      'menu-open-file': callbacks.onOpenFile,
      'menu-save-file': callbacks.onSaveFile,
      'menu-save-as-file': callbacks.onSaveAsFile,
      'menu-import-file': callbacks.onImportFile,
      'menu-view-both': callbacks.onViewBoth,
      'menu-view-editor': callbacks.onViewEditor,
      'menu-view-preview': callbacks.onViewPreview,
      'menu-toggle-sync-scroll': callbacks.onToggleSyncScroll,
      'menu-toggle-settings': callbacks.onToggleSettings,
      'menu-show-guide': callbacks.onShowGuide,
      'menu-export-html': callbacks.onExportHTML,
      'menu-show-about': callbacks.onShowAbout,
      'menu-check-update': callbacks.onCheckUpdate,
    }

    Object.entries(eventMap).forEach(([eventName, callback]) => {
      if (callback) {
        _registeredEvents.push(eventName)
        EventsOn(eventName, () => {
          console.log(`📢 菜单事件: ${eventName}`)
          callback()
        })
      }
    })

    console.log('🎧 菜单监听器已设置，事件数:', _registeredEvents.length)
  }

  /**
   * 设置文件拖放监听
   * 注意：OnFileDrop 第二个参数 useDropTarget=false，
   * 表示整个窗口任意位置拖放文件都会触发回调（无需 --wails-drop-target 标记）
   */
  const setupFileDropListener = (callback) => {
    if (!isWails.value) return

    OnFileDrop((x, y, paths) => {
      console.log('📥 文件拖放:', paths)
      if (paths && paths.length > 0 && callback) {
        // 仅处理第一个文件
        const filePath = paths[0]
        if (/\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) {
          callback(filePath)
        }
      }
    }, false)
  }

  // ==========================================
  // 清理
  // ==========================================

  const cleanupListeners = () => {
    if (_registeredEvents.length > 0) {
      _registeredEvents.forEach(e => EventsOff(e))
      _registeredEvents.length = 0
    }
    try { OnFileDropOff() } catch (e) { /* 忽略 */ }
  }

  // ==========================================
  // 生命周期
  // ==========================================

  onMounted(async () => {
    checkWails()
    if (isWails.value) {
      await getEnvInfo()
      await getRecentFiles()
    }
  })

  onUnmounted(() => {
    cleanupListeners()
  })

  // ==========================================
  // 导出
  // ==========================================

  return {
    // 状态
    isWails,
    isElectron: isWails,  // 兼容性别名（保持 App.vue 迁移平滑）
    currentFilePath,
    currentFileName,
    isModified,
    appVersion,
    platform,
    recentFiles,

    // 文件操作
    openFile,
    saveFile,
    saveFileAs,
    newFile,
    openFilePath,
    loadStartupFile,

    // 最近文件
    getRecentFiles,
    clearRecentFiles,
    openRecentFile,

    // 导出
    exportHTML,

    // 菜单和事件
    setupMenuListeners,
    setupFileDropListener,
    cleanupListeners,

    // 环境
    checkWails,
    getEnvInfo,
  }
}
