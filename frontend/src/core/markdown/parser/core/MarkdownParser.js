/**
 * @file src/core/markdown/parser/core/MarkdownParser.js
 * @description 核心 Markdown 解析器（负责调度与管道编排）
 */

import { getThemesSafe } from '../../../../shared/utils/theme.js'
import { cleanReferenceLinks } from '../../formatters/text.js'
import { FormatterCoordinator } from '../coordinator.js'
import { ThemeProcessor } from '../processors/ThemeProcessor.js'
import { FontProcessor } from '../processors/FontProcessor.js'
import { SocialStyler } from '../../post-processors/social-styler.js'
import { getPlatformProfile } from '../../platform/profiles.js'

/**
 * MarkdownParser
 * - 负责将输入的 Markdown 文本解析为 HTML
 * - 对外暴露稳定的 parse 接口
 * - 内部调度 FormatterCoordinator 与后处理器
 */
export class MarkdownParser {
  /**
   * 解析 Markdown 文本为 HTML
   * @param {string} markdownText - 要解析的 Markdown 文本
   * @param {object} options - 解析器的配置选项；options.platform:
   *                 'wechat'|'xiaohongshu'|'zhihu'（缺省 wechat，仅非 preview 生效）
   * @returns {string} 生成的 HTML 字符串
   */
  parse(markdownText, options = {}) {
    if (!markdownText || typeof markdownText !== 'string') {
      return ''
    }

    // 获取安全的主题配置
    const { colorTheme, codeStyle, themeSystem } = getThemesSafe({
      colorTheme: options.theme,
      codeStyle: options.codeTheme,
      themeSystem: options.themeSystem
    })

    // 获取字体设置
    const fontSettings = options.fontSettings || null

    // 复制（非 preview）分支的平台档案：fontSettings 未显式提供的
    // fontSize/lineHeight 用平台推荐值兜底，使 blockquote/code/table 等
    // 解析期生成的尺寸也与目标平台一致；preview 模式不注入（版式交由 CSS）。
    // fontSettings 为 null 时同样合成——null 早退是真实浏览器验证发现的断链点。
    const platformProfile = options.isPreview ? null : getPlatformProfile(options.platform)
    const effFontSettings = (() => {
      if (!platformProfile) return fontSettings
      const base = fontSettings || {}
      const merged = { ...base }
      const fsExplicit = typeof base.fontSize === 'number' && Number.isFinite(base.fontSize)
      const lhExplicit = typeof base.lineHeight === 'number' && Number.isFinite(base.lineHeight) && base.lineHeight > 0
      if (!fsExplicit && platformProfile.fontSize) merged.fontSize = platformProfile.fontSize
      if (!lhExplicit && platformProfile.lineHeight) merged.lineHeight = platformProfile.lineHeight
      return merged
    })()

    // 创建协调器实例
    const coordinator = new FormatterCoordinator()
    coordinator.setThemes(colorTheme, codeStyle, themeSystem)

    // 设置字体配置（已按平台档案合成默认值）
    if (effFontSettings) {
      coordinator.setFontSettings(effFontSettings)
    }

    if (options.isPreview) {
      coordinator.setOptions({
        isPreview: true,
        cleanHtml: options.cleanHtml || false
      })
    }

    // 预处理：清理不兼容的语法
    const cleanedText = cleanReferenceLinks(markdownText)
    const lines = cleanedText.split('\n')
    let result = ''

    coordinator.reset() // 每次解析前重置状态

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      const processResult = coordinator.processLine(line, trimmedLine, lines, i)

      if (processResult.updateContext) {
        coordinator.updateContext(processResult.updateContext)
      }

      if (processResult.result) {
        result += processResult.result
      }

      if (processResult.reprocessLine) {
        i-- // 重新处理当前行
      }
    }

    result += coordinator.finalize() // 处理任何未结束的块

    // 解析完成后应用主题/字体处理（当前为无副作用挂点）
    result = ThemeProcessor.process(result, { colorTheme, themeSystem, isPreview: options.isPreview })
    result = FontProcessor.process(result, { fontSettings: effFontSettings, isPreview: options.isPreview })

    // 使用后处理器应用字体样式和平台兼容性处理
    // options.platform: 'wechat' | 'xiaohongshu' | 'zhihu'（缺省 wechat，向后兼容）
    result = SocialStyler.process(result, {
      fontSettings: effFontSettings,
      themeSystem,
      colorTheme,
      isPreview: options.isPreview,
      platform: options.platform
    })

    return result
  }
}

export default MarkdownParser
