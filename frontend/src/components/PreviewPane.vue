<template>
  <div class="preview-pane" :class="{ 'is-workbench': skin === 'workbench' }">
    <!-- workbench 皮肤：三平台 tab 条（公众号/小红书/知乎）；native 保持现状不显示 -->
    <div v-if="skin === 'workbench'" class="pp-plat-bar">
      <span class="pp-plat-label">预览</span><!-- TODO(i18n) -->
      <button
        v-for="p in PLATFORM_TABS"
        :key="p.key"
        class="pp-plat-tab"
        :class="{ active: platKey === p.key, ['plat-' + p.key]: true }"
        :title="p.key === 'wechat' ? '公众号版心 677px' : p.key === 'xiaohongshu' ? '小红书竖卡 360px' : '知乎自适应'"
        @click="selectPlatform(p.key)"
      >
        <!-- 公众号 -->
        <svg v-if="p.key==='wechat'" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 4C5.4 4 2 6.8 2 10.2c0 1.9 1 3.6 2.7 4.7l-.7 2.1 2.5-1.3c.8.2 1.6.4 2.5.4h.6a5.7 5.7 0 0 1-.2-1.5c0-3.3 3.2-6 7.1-6h.6C16.6 6 13.4 4 9.5 4zm-2.6 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5.2 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/><path d="M22 14.4c0-2.8-2.7-5-6-5s-6 2.2-6 5 2.7 5 6 5c.7 0 1.4-.1 2-.3l2 1-.5-1.7c1.5-.9 2.5-2.3 2.5-4zm-8-1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"/></svg>
        <!-- 小红书 -->
        <svg v-else-if="p.key==='xiaohongshu'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10 7h4M10 11h4M10 15h2"/></svg>
        <!-- 知乎 -->
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M7.5 8.5h9M12 8.5V17M9 12c0 2.5 1.2 4.2 3.2 5M15.5 5.5 14 8"/></svg>
        {{ p.label }}
        <span v-if="p.key==='wechat'" class="pp-plat-w">677px</span>
      </button>
      <span class="footer-spacer"></span>
      <span class="pp-plat-tip">切换后版心宽度将平滑过渡</span><!-- TODO(i18n) -->
      <button class="pp-plat-copy" :class="'plat-' + platKey" :title="'复制' + activePlat.label + '排版 (⌘⇧C)'" @click="onCopyCurrentPlatform">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        复制 <span style="font-family:var(--skin-font-mono); font-size:9.5px; opacity:.7">⌘⇧C</span><!-- TODO(i18n) -->
      </button>
    </div>

    <!-- 预览模式切换工具栏（native 现状保留；workbench 下隐藏，由平台 tab 条取代） -->
    <div v-if="skin !== 'workbench'" class="preview-toolbar">
      <div class="preview-mode-selector">
        <label class="mode-label">预览模式:</label>
        <div class="mode-buttons">
          <button
            v-for="mode in viewportModes"
            :key="mode.key"
            @click="currentViewportMode = mode.key"
            :class="['mode-btn', { active: currentViewportMode === mode.key }]"
            :title="mode.description"
          >
            <!-- 桌面端图标 -->
            <svg v-if="mode.key === 'desktop'" class="mode-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z"/>
            </svg>
            <!-- 平板图标 -->
            <svg v-else-if="mode.key === 'tablet'" class="mode-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19,18H5V6H19M21,4H3C1.89,4 1,4.89 1,6V18A2,2 0 0,0 3,20H21A2,2 0 0,0 23,18V6C23,4.89 22.1,4 21,4Z"/>
            </svg>
            <!-- 手机图标 -->
            <svg v-else-if="mode.key === 'mobile'" class="mode-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="viewport-info">
        <span class="viewport-size">{{ getCurrentModeInfo().size }}</span>
      </div>
    </div>

    <!-- 预览容器：--pp-plat-* 由激活平台驱动（版心宽度 + 文章强调色一起变） -->
    <div class="preview-container" :class="['preview-container', `viewport-${currentViewportMode}`, `theme-system-${currentLayoutId}`]"
         :style="skin === 'workbench' ? { '--pp-plat-max': activePlat.maxWidth, '--pp-plat-accent': activePlat.accent, '--pp-plat-accent-rgb': activePlat.accentRgb } : null">
      <!-- 渲染预览模式 -->
      <div ref="previewContent"
           class="preview-rendered markdown-body modern-markdown"
           :class="getPreviewClasses()"
           @scroll="handleScroll"
           v-html="displayHtml">
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { parseMarkdown } from '../core/markdown/parser/coordinator.js'
import { useGlobalThemeManager } from '../composables/index.js'
import { copySocialFormat } from '../core/editor/copy-formats.js'
import { escapeHtml as sharedEscapeHtml } from '../shared/utils/text.js'
// mermaid 按需动态加载（仅文档含 .mermaid 块时引入），不阻塞首屏

// 预览专用：剥离微信导出的内联 style 属性，让 CSS 主题系统完全接管预览排版。
// - 仅作用于预览 DOM，不影响公众号导出 HTML（导出仍用 formatter 的内联样式）
// - pre 代码块内部的语法高亮 span / 红绿灯保留，只处理块级与常用内联标签
const PREVIEW_STRIP_SELECTOR = [
  'p', 'strong', 'em', 'a', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'img', 'del', 'code'
].join(',')
function stripExportStyles(rootEl) {
  const root = rootEl || document.querySelector('.preview-rendered')
  if (!root) return
  root.querySelectorAll(PREVIEW_STRIP_SELECTOR).forEach((el) => {
    // 代码块内部不处理（语法高亮、红绿灯按钮、滚动容器等依赖内联样式）
    if (el.closest('pre')) return
    el.removeAttribute('style')
  })
}

// 通用防抖工具函数
function debounce(fn, delay = 300) {
  let timer = null
  let lastArgs = null
  const debounced = (...args) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...lastArgs)
    }, delay)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}

// 通用节流工具函数 (leading + trailing)
function throttle(fn, interval = 200) {
  let lastTime = 0
  let timer = null
  const throttled = (...args) => {
    const now = Date.now()
    if (now - lastTime >= interval) {
      lastTime = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now()
        timer = null
        fn(...args)
      }, interval - (now - lastTime))
    }
  }
  throttled.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return throttled
}

export default {
  name: 'PreviewPane',
  props: {
    markdown: {
      type: String,
      default: ''
    },
    syncScrollEnabled: {
      type: Boolean,
      default: true
    },
    // ===== UI 皮肤（task-8）：workbench 下显示三平台 tab，native 保持现状 =====
    skin: {
      type: String,
      default: 'native'
    },
    activePlatform: {
      type: String,
      default: 'wechat'
    },
    // 外部平台切换请求（⌘1/2/3、顶栏 CTA split），watch 后应用到内部状态
    platformRequest: {
      type: String,
      default: ''
    }
  },
  emits: ['html-generated', 'platform-change'],
  setup(props, { emit }) {
    // 使用统一主题管理器
    const themeManager = useGlobalThemeManager()

    // 解构所需功能
    const {
      currentThemeSystemId: currentLayoutId,
      currentColorTheme,
      currentCodeStyle,
      currentFontSettings,
      initialize
    } = themeManager

    const renderedHtml = ref('')
    const socialHtml = ref('')
    const previewContent = ref(null)
    const currentViewportMode = ref('desktop')
    const scrollPosition = ref(0)
    // 移除多余的变量声明，现在在滚动时实时获取

    // ==========================================
    // workbench 皮肤 · 三平台预览 tab（task-8）
    // - 版心宽度：公众号 677px / 小红书 360px / 知乎自适应（none）。
    // - 激活平台的 formatted HTML 喂进渲染：复用现有 socialFormatted 逻辑
    //   （parseMarkdown 不带 isPreview = 公众号内联样式排版路径），
    //   emit('html-generated') 机制不动。native 皮肤完全不走此分支。
    // - 文章强调色经 --pp-plat-accent 变量与版心宽度一起切换（见模板）。
    // ==========================================
    const PLATFORM_TABS = [
      { key: 'wechat', label: '公众号', maxWidth: '677px', accent: '#07C160', accentRgb: '7, 193, 96' },   // TODO(i18n)
      { key: 'xiaohongshu', label: '小红书', maxWidth: '360px', accent: '#FF2442', accentRgb: '255, 36, 66' },
      { key: 'zhihu', label: '知乎', maxWidth: 'none', accent: '#0084FF', accentRgb: '0, 132, 255' }
    ]
    const platKey = ref(PLATFORM_TABS.some((p) => p.key === props.activePlatform) ? props.activePlatform : 'wechat')
    const activePlat = computed(() => PLATFORM_TABS.find((p) => p.key === platKey.value) || PLATFORM_TABS[0])
    const platformHtml = ref('')
    let platformHtmlTimer = null

    function refreshPlatformHtml() {
      clearTimeout(platformHtmlTimer)
      if (!props.markdown) { platformHtml.value = ''; return }
      platformHtmlTimer = setTimeout(async () => {
        try {
          const effectiveTheme = getCurrentTheme()
          // 与 processMarkdown 尾部 socialFormatted 同参（isPreview=false）→ 平台排版 HTML
          platformHtml.value = parseMarkdown(props.markdown, {
            theme: effectiveTheme,
            codeTheme: currentCodeStyle.value,
            themeSystem: currentLayoutId.value,
            fontSettings: currentFontSettings.value
          })
        } catch (e) {
          console.warn('平台排版 HTML 生成失败:', e)
        }
      }, 150)
    }
    function applyPlatform(key) {
      platKey.value = key
      emit('platform-change', key)
      refreshPlatformHtml()
    }
    function selectPlatform(key) {
      if (platKey.value === key) return
      saveScrollPosition()
      applyPlatform(key)
      // 版心宽度平滑过渡后恢复滚动比例
      if (previewContent.value) {
        previewContent.value.classList.add('viewport-transitioning')
        setTimeout(() => {
          if (previewContent.value) {
            previewContent.value.classList.remove('viewport-transitioning')
            restoreScrollPosition()
          }
        }, 300)
      }
    }
    // 外部请求（⌘1/2/3、顶栏 CTA split）→ 内部应用
    watch(() => props.platformRequest, (v) => {
      if (v && v !== platKey.value && PLATFORM_TABS.some((p) => p.key === v)) selectPlatform(v)
    })
    // App 层状态回同步（初始化/恢复场景）
    watch(() => props.activePlatform, (v) => {
      if (v && v !== platKey.value && PLATFORM_TABS.some((p) => p.key === v)) applyPlatform(v)
    })

    // 实际渲染内容：workbench → 平台 formatted HTML（未就绪时回落通用预览，避免空白）
    const displayHtml = computed(() =>
      props.skin === 'workbench' && platformHtml.value ? platformHtml.value : renderedHtml.value
    )

    // 平台复制按钮（顶栏 ⌘⇧C 也经 .pp-plat-copy 命中此处）：
    // 走既有 copySocialFormat 通道 + toast 通知（不新增 App↔组件信号面）
    const onCopyCurrentPlatform = async () => {
      if (!props.markdown || !props.markdown.trim()) {
        window.dispatchEvent(new CustomEvent('weditor-skin-toast', { detail: { message: '请先编辑内容', type: 'warning' } })) // TODO(i18n)
        return
      }
      try {
        const result = await copySocialFormat(props.markdown, {
          theme: getCurrentTheme(),
          codeTheme: currentCodeStyle.value,
          themeSystem: currentLayoutId.value,
          fontSettings: currentFontSettings.value
        })
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('weditor-skin-toast', {
            detail: { message: result.message, type: result.success ? 'success' : 'error' }
          }))
        }, 50)
      } catch (e) {
        window.dispatchEvent(new CustomEvent('weditor-skin-toast', { detail: { message: `复制失败：${e.message}`, type: 'error' } })) // TODO(i18n)
      }
    }

    // 预览模式配置
    const viewportModes = [
      {
        key: 'desktop',
        size: '100%',
        maxWidth: 'none',
        description: '桌面端预览 - 宽屏显示'
      },
      {
        key: 'tablet',
        size: '768px',
        maxWidth: '768px',
        description: '平板端预览 - 中等屏幕'
      },
      {
        key: 'mobile',
        size: '375px',
        maxWidth: '375px',
        description: '移动端预览 - 手机屏幕'
      }
    ]

    // 获取当前模式信息
    const getCurrentModeInfo = () => {
      return viewportModes.find(mode => mode.key === currentViewportMode.value) || viewportModes[0]
    }

    // 获取预览样式类
    const getPreviewClasses = () => {
      return {
        [`viewport-${currentViewportMode.value}`]: true,
        'viewport-mobile': currentViewportMode.value === 'mobile',
        'viewport-tablet': currentViewportMode.value === 'tablet',
        'viewport-desktop': currentViewportMode.value === 'desktop',
        // 挂载排版主题系统类，便于在CSS中按主题覆盖样式
        [`theme-system-${currentLayoutId.value}`]: true
      }
    }

    // 保存和恢复滚动位置
    const saveScrollPosition = () => {
      if (previewContent.value) {
        const scrollTop = previewContent.value.scrollTop
        const scrollHeight = previewContent.value.scrollHeight
        const clientHeight = previewContent.value.clientHeight

        // 保存滚动百分比而不是绝对位置，这样在内容高度变化时更准确
        scrollPosition.value = {
          scrollTop,
          scrollPercentage: scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0,
          timestamp: Date.now()
        }
      }
    }

    const restoreScrollPosition = () => {
      if (previewContent.value && scrollPosition.value) {
        const { scrollPercentage } = scrollPosition.value
        const scrollHeight = previewContent.value.scrollHeight
        const clientHeight = previewContent.value.clientHeight
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
        const targetScrollTop = Math.round(maxScrollTop * scrollPercentage)
        
        if (typeof window !== 'undefined') window.__scrollSyncLock = true
        previewContent.value.scrollTop = targetScrollTop
        if (typeof window !== 'undefined') requestAnimationFrame(() => { window.__scrollSyncLock = false })
      }
    }

    // 节流后的保存滚动位置（每 200ms 最多保存一次）
    const saveScrollPositionThrottled = throttle(() => {
      saveScrollPosition()
    }, 200)

    // 滚动同步处理
    const handleScroll = (e) => {
      const element = e.target
      const scrollTop = element.scrollTop
      const scrollHeight = element.scrollHeight
      const clientHeight = element.clientHeight

      // 节流保存滚动位置（避免每帧都写 localStorage）
      saveScrollPositionThrottled()

      // 只有在启用同步滚动时才执行同步；程序触发的滚动需要跳过
      if (!props.syncScrollEnabled || (typeof window !== 'undefined' && window.__scrollSyncLock)) return

      // 计算滚动百分比
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
      const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0

      // 同步到编辑器（用 requestAnimationFrame 替代 setTimeout(0)，对齐渲染帧）
      const editorElement = document.querySelector('.cm-scroller')
      if (editorElement) {
        const editorMaxScrollTop = Math.max(0, editorElement.scrollHeight - editorElement.clientHeight)
        const targetScrollTop = Math.round(editorMaxScrollTop * scrollPercentage)
        if (typeof window !== 'undefined') window.__scrollSyncLock = true
        editorElement.scrollTop = targetScrollTop
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => { window.__scrollSyncLock = false })
        }
      }
    }

    // 监听视口模式变化，添加平滑过渡
    watch(currentViewportMode, (_, oldMode) => {
      if (oldMode) {
        saveScrollPosition()

        // 添加切换动画类
        if (previewContent.value) {
          previewContent.value.classList.add('viewport-transitioning')

          // 动画完成后移除类并恢复滚动位置
          setTimeout(() => {
            if (previewContent.value) {
              previewContent.value.classList.remove('viewport-transitioning')
              restoreScrollPosition()
            }
          }, 300)
        }
      }
    })

    // 缓存当前主题对象（避免每次 processMarkdown 都读 localStorage + JSON.parse）
    let cachedTheme = null
    let cachedThemeExpiry = 0

    // 获取当前有效的颜色主题（包括临时自定义主题）
    const getCurrentTheme = () => {
      const now = Date.now()
      if (now < cachedThemeExpiry && cachedTheme !== null) {
        return cachedTheme
      }
      try {
        const tempTheme = localStorage.getItem('temp-custom-theme')
        if (tempTheme) {
          cachedTheme = JSON.parse(tempTheme)
        } else {
          cachedTheme = currentColorTheme.value
        }
      } catch (error) {
        console.warn('Failed to load temp custom theme:', error)
        cachedTheme = currentColorTheme.value
      }
      cachedThemeExpiry = now + 5000 // 5秒内复用缓存
      return cachedTheme
    }

    // 使主题缓存失效（主题变更时调用）
    const invalidateThemeCache = () => {
      cachedThemeExpiry = 0
      cachedTheme = null
    }

    // 处理Markdown解析和转换
    const processMarkdown = async () => {
      if (!props.markdown) {
        renderedHtml.value = ''
        socialHtml.value = ''
        emit('html-generated', '')
        return
      }

      try {
        // 获取当前有效主题（可能是临时自定义主题）
        const effectiveTheme = getCurrentTheme()

        // 预览版本：标记 isPreview，样式由 CSS 主题接管（stripExportStyles + 主题类）。
        // 先渲染预览、再惰性生成公众号格式：完整 Markdown 解析开销大，
        // 原先同步跑两遍会双倍阻塞每次输入后的重渲染。
        const previewFormatted = parseMarkdown(props.markdown, {
          theme: effectiveTheme,
          codeTheme: currentCodeStyle.value,
          themeSystem: currentLayoutId.value,
          fontSettings: currentFontSettings.value,
          isPreview: true
        })
        renderedHtml.value = previewFormatted

        // 等待DOM更新后再渲染 Mermaid
        await nextTick()

        // 剥离微信导出内联样式（预览专用），使 CSS 主题完全接管排版
        stripExportStyles(previewContent.value)

        // Mermaid 按需加载：仅当文档包含 .mermaid 块时才动态引入（降低首屏启动开销）
        const containerEl = document.querySelector('.preview-rendered')
        if (containerEl && containerEl.querySelectorAll('.mermaid').length > 0) {
          try {
            const { default: mermaid } = await import('mermaid')
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              deterministicIds: true,
              deterministicIDSeed: 'preview-mermaid',
              flowchart: {
                htmlLabels: false, // 重要：避免使用 foreignObject，以适配公众号
                useMaxWidth: true
              },
              themeVariables: {
                fontFamily: '"Microsoft YaHei", "微软雅黑", Arial, sans-serif'
              }
            })

            // 快速合法性检查：首个有效行必须是已知图类型指令
            const isLikelyMermaid = (def) => {
              const lines = (def || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
              // 过滤掉可能的 init 指令与注释
              const first = lines.find(l => !/^%%/.test(l) && !/^%%\{.*\}%%$/.test(l)) || ''
              const starters = [
                'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
                'erDiagram', 'gantt', 'journey', 'pie', 'gitGraph', 'mindmap', 'timeline',
                'requirementDiagram', 'sankey', 'xychart-beta', 'block-beta', 'zenuml'
              ]
              return starters.some(s => first.startsWith(s))
            }

            // 清理上一次渲染插入的 SVG 与错误提示块，避免越堆越多
            containerEl.querySelectorAll('.mermaid svg, .mermaid-error, .mermaid-error-hidden').forEach(n => n.remove())

            // 为 mermaid.render 提供离屏 sandbox，阻断其往 body 追加错误节点
            const sandbox = document.createElement('div')
            sandbox.style.position = 'fixed'
            sandbox.style.left = '-99999px'
            sandbox.style.top = '-99999px'
            sandbox.style.width = '0'
            sandbox.style.height = '0'
            sandbox.style.overflow = 'hidden'
            document.body.appendChild(sandbox)

            try {
              // 按块渲染；对每个 mermaid 源只保留一个渲染结果或一个错误提示
              const blocks = Array.from(containerEl.querySelectorAll('.mermaid'))
              for (let i = 0; i < blocks.length; i++) {
                const el = blocks[i]
                const def = (el.textContent || '').trim()
                // 非法/非 mermaid 指令的片段直接跳过，避免 mermaid 注入错误卡片
                if (!isLikelyMermaid(def)) continue
                if (!def) continue
                try {
                  const id = `mmd-prev-${i}-${Math.random().toString(36).slice(2)}`
                  const { svg } = await mermaid.render(id, def, undefined, sandbox)
                  const wrap = document.createElement('div')
                  wrap.innerHTML = svg
                  const hasError = wrap.querySelector('.error-icon') || /Syntax error/i.test(wrap.textContent || '')
                  const svgEl = wrap.querySelector('svg')
                  if (!hasError && svgEl) {
                    // 正常渲染：替换为 SVG
                    el.replaceWith(svgEl)
                  } else {
                    // 屏蔽错误卡片：不在页面显示，放置一个隐藏占位符
                    const ph = document.createElement('div')
                    ph.className = 'mermaid-error-hidden'
                    ph.style.display = 'none'
                    el.replaceWith(ph)
                  }
                } catch (perr) {
                  console.warn('Mermaid 单块渲染失败（预览继续）:', perr)
                  // 渲染异常时也隐藏该块，避免显示错误卡片或原始源码
                  const ph = document.createElement('div')
                  ph.className = 'mermaid-error-hidden'
                  ph.style.display = 'none'
                  el.replaceWith(ph)
                }
              }
            } finally {
              sandbox.remove()
            }
          } catch (merr) {
            console.warn('Mermaid 渲染失败:', merr)
          }
        }

        // 3. 公众号格式（供一键复制）：预览与 Mermaid 渲染完成后再生成，
        //    把第二次完整解析挪出输入响应路径；期间保留旧结果可用。
        const socialFormatted = parseMarkdown(props.markdown, {
          theme: effectiveTheme,
          codeTheme: currentCodeStyle.value,
          themeSystem: currentLayoutId.value,
          fontSettings: currentFontSettings.value
        })
        socialHtml.value = socialFormatted
        emit('html-generated', socialFormatted)

        // workbench：平台 formatted HTML 与主题保持同步（platformHtml 未初始化时首刷）
        if (props.skin === 'workbench') refreshPlatformHtml()
      } catch (error) {
        console.error('处理Markdown时出错:', error)
        const safeMsg = (error && error.message) ? sharedEscapeHtml(String(error.message)) : '未知错误'
        const errorMessage = `<div class="error">
          <h3>❌ 处理错误</h3>
          <p>错误信息: ${safeMsg}</p>
          <p>请检查Markdown语法或联系开发者。</p>
        </div>`

        renderedHtml.value = errorMessage
        socialHtml.value = ''
        emit('html-generated', '')
      }
    }

    // 创建防抖版本（300ms延迟，避免每次按键都重渲染）
    const processMarkdownDebounced = debounce(() => {
      processMarkdown()
    }, 300)

    // 监听markdown内容变化
    // - 从空到非空（加载文件/示例）：立即渲染，不等待防抖，提升打开速度感知
    // - 其它情况（输入）：300ms 防抖，避免逐键触发完整渲染
    watch(() => props.markdown, (newVal, oldVal) => {
      invalidateThemeCache()
      if (newVal && !oldVal) {
        processMarkdown()
      } else {
        processMarkdownDebounced()
      }
    })

    // 合并所有主题相关 watcher 为一个，300ms 防抖，避免启动时多次级联渲染
    // 监听：颜色主题、代码样式、布局主题系统、字体设置
    watch(
      [currentColorTheme, currentCodeStyle, currentLayoutId, currentFontSettings],
      () => {
        invalidateThemeCache()
        processMarkdownDebounced()
      },
      { deep: true }
    )

    // 监听临时自定义主题变化
    const handleCustomThemeChange = () => {
      invalidateThemeCache()
      processMarkdownDebounced()
    }

    // 组件生命周期
    onMounted(() => {
      // 初始化主题系统
      initialize()

      // 初始化完成后立即处理markdown
      processMarkdown()

      // workbench：首刷平台 formatted HTML（processMarkdown 尾部也会刷，这里覆盖空内容场景）
      if (props.skin === 'workbench') refreshPlatformHtml()

      // 监听自定义主题变化事件
      window.addEventListener('custom-theme-changed', handleCustomThemeChange)
    })

    onUnmounted(() => {
      clearTimeout(platformHtmlTimer)
      // 清理mermaid渲染的DOM元素，防止内存泄漏
      const containerEl = document.querySelector('.preview-rendered')
      if (containerEl) {
        containerEl.querySelectorAll('.mermaid svg, .mermaid-error, .mermaid-error-hidden').forEach(n => n.remove())
      }
      
      // 移除自定义主题变化事件监听器
      window.removeEventListener('custom-theme-changed', handleCustomThemeChange)
    })

    return {
      renderedHtml,
      socialHtml,
      previewContent,
      currentViewportMode,
      viewportModes,
      getCurrentModeInfo,
      getPreviewClasses,
      handleScroll,
      currentLayoutId,
      // ===== workbench 平台 tab =====
      PLATFORM_TABS,
      platKey,
      activePlat,
      displayHtml,
      selectPlatform,
      onCopyCurrentPlatform
    }
  }
}
</script>


<style scoped>
/* ============================================================
   workbench 平台 tab 条 + 版心/强调色联动（task-8）
   ============================================================ */
.pp-plat-bar {
  height: 38px;
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 4px;
  border-bottom: 1px solid var(--border-hairline);
}
.pp-plat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: 8px;
}
.pp-plat-tab {
  height: 26px;
  padding: 0 12px;
  border-radius: 8px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  cursor: default;
  transition: color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}
.pp-plat-tab.plat-wechat:hover { color: var(--plat-wx); background: rgba(7, 193, 96, 0.08); }
.pp-plat-tab.plat-xiaohongshu:hover { color: var(--plat-xhs); background: rgba(255, 36, 66, 0.08); }
.pp-plat-tab.plat-zhihu:hover { color: var(--plat-zh); background: rgba(0, 132, 255, 0.08); }
.pp-plat-tab.active.plat-wechat {
  color: var(--plat-wx);
  font-weight: 600;
  background: rgba(7, 193, 96, 0.14);
  box-shadow: inset 0 0 0 1px rgba(7, 193, 96, 0.5), 0 0 14px rgba(7, 193, 96, 0.18);
}
.pp-plat-tab.active.plat-xiaohongshu {
  color: var(--plat-xhs);
  font-weight: 600;
  background: rgba(255, 36, 66, 0.12);
  box-shadow: inset 0 0 0 1px rgba(255, 36, 66, 0.5), 0 0 14px rgba(255, 36, 66, 0.16);
}
.pp-plat-tab.active.plat-zhihu {
  color: var(--plat-zh);
  font-weight: 600;
  background: rgba(0, 132, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(0, 132, 255, 0.5), 0 0 14px rgba(0, 132, 255, 0.16);
}
.pp-plat-w { font-size: 9px; font-family: var(--skin-font-mono); opacity: 0.7; }
.pp-plat-tip { font-size: 10px; color: var(--text-tertiary); margin-right: 8px; white-space: nowrap; }
.pp-plat-copy {
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: default;
  color: var(--pp-plat-accent, var(--plat-wx));
  background: rgba(var(--pp-plat-accent-rgb, 7, 193, 96), 0.12);
  box-shadow: inset 0 0 0 1px rgba(var(--pp-plat-accent-rgb, 7, 193, 96), 0.45);
  transition: filter 180ms ease;
  flex: none;
}
.pp-plat-copy:hover { filter: brightness(1.15); }

/* 版心宽度按激活平台切换：公众号 677px / 小红书 360px / 知乎自适应。
   !important 压过 preview-pane.css 的 viewport-desktop .preview-rendered{max-width:760px} */
.preview-container :deep(.preview-rendered) {
  max-width: var(--pp-plat-max, none) !important;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  transition: max-width 300ms ease;
}
/* 平台强调色经由 --pp-plat-accent 暴露给皮肤层与未来扩展；
   formatted HTML 自带行内强调样式，此处不再覆盖文章着色。 */
</style>
