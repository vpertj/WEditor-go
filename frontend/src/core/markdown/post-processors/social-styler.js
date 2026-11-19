/**
 * @file src/core/markdown/post-processors/social-styler.js
 * @description 通用的社交平台复制后处理器：
 * 1) 注入基础字体/行高/字距等 inline 样式
 * 2) 调用主题复制适配器（adapters/*）做主题化修饰
 */

import { getThemeCopyAdapter } from './adapters/index.js'
import { calculateLineHeight as calcLH } from '../../../shared/utils/typography.js'
import { getPlatformProfile } from '../platform/profiles.js'

function addInlineStyles(html, fontFamily, fontSize, lineHeight, letterSpacing = 0) {
  const lh = parseFloat(lineHeight)
  const fallback = calcLH(fontSize, lh)
  const lineHeightCss = Number.isFinite(lh) ? String(lineHeight) : (/[empx%]/i.test(String(lineHeight)) ? String(lineHeight) : fallback)
  const baseStyle = `font-family: ${fontFamily}; color: #333; letter-spacing: ${letterSpacing}px;`
  const normalWeight = '400'
  const boldWeight = '700'


  let out = html
    .replace(/<section(?![^>]*style=)/gi, `<section style="${baseStyle} line-height: ${lineHeightCss} !important;"`)
    .replace(/<strong(?![^>]*style=)/gi, `<strong style="${baseStyle} font-weight: ${boldWeight};"`)
    .replace(/<b(?![^>]*style=)/gi, `<b style="${baseStyle} font-weight: ${boldWeight};"`)
    .replace(/<em(?![^>]*style=)/gi, `<em style="${baseStyle} font-weight: ${normalWeight}; font-style: italic;"`)
    .replace(/<i(?![^>]*style=)/gi, `<i style="${baseStyle} font-weight: ${normalWeight}; font-style: italic;"`)
    // 为带有 data-md-caption 的图片包裹 figure + figcaption
    .replace(/<img([^>]*?)data-md-caption=\"true\"([^>]*?)>/gi, (m, pre, post) => {
      const altMatch = m.match(/alt=\"([^\"]*)\"/i)
      const alt = altMatch ? altMatch[1] : ''
      const img = `<img${pre}data-md-caption=\"true\"${post}>`
      const figureStyle = `${baseStyle} text-align: center; margin: 1em 0;`
      const captionStyle = `${baseStyle} display: block; font-size: ${Math.max(12, Math.round(fontSize * 0.875))}px; color: #666; margin-top: 6px;`
      return `<figure style=\"${figureStyle}\">${img}<figcaption style=\"${captionStyle}\">${alt}</figcaption></figure>`
    })

  const enforce = (inputHtml, tag) => {
    const re = new RegExp(`<${tag}([^>]*?)style="([^"]*)"([^>]*)>`, 'gi')
    return inputHtml.replace(re, (_m, pre, style, post) => {
      let updated = style
      if (/line-height\s*:/i.test(updated)) {
        updated = updated.replace(/line-height\s*:\s*[^;]*;?/gi, `line-height: ${lineHeightCss} !important;`)
      } else {
        const needsSemicolon = updated.trim().length > 0 && !(/[;\s]$/.test(updated.trim()))
        updated = `${updated}${needsSemicolon ? '; ' : ' '}line-height: ${lineHeightCss} !important;`
      }
      return `<${tag}${pre}style="${updated}"${post}>`
    })
  }
  for (const t of ['section','p','h1','h2','h3','ul','ol','li','blockquote']) out = enforce(out, t)

  const wrapInner = (inputHtml, tag) => {
    const re = new RegExp(`<${tag}([^>]*)>([\s\S]*?)<\/${tag}>`, 'gi')
    return inputHtml.replace(re, (m, attrs, inner) => {
      if (/data-wx-lh-wrap/.test(inner)) return m
      if (/^\s*<(p|div|ul|ol|li|h1|h2|h3|blockquote|pre|table)\b/i.test(inner)) return m
      const span = `<span data-wx-lh-wrap style="line-height: ${lineHeightCss} !important; letter-spacing: ${letterSpacing}px; display: inline-block; width: 100%;">${inner}</span>`
      return `<${tag}${attrs}>${span}</${tag}>`
    })
  }
  for (const t of ['p','li','blockquote','h1','h2','h3']) out = wrapInner(out, t)
  return out
}

const FONT_FAMILY_MAP = {
  'microsoft-yahei': 'Microsoft YaHei, Arial, sans-serif',
  'pingfang-sc': 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
  'hiragino-sans': 'Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif',
  'arial': 'Arial, sans-serif',
  'system-safe': 'Microsoft YaHei, Arial, sans-serif'
}

// moved to utils/typography.js

function hexToRgb(hex) {
  if (!hex) return null
  const m = String(hex).trim().replace('#', '')
  const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m
  const int = parseInt(v, 16)
  if (!Number.isFinite(int) || v.length !== 6) return null
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function wrapWithFontStyles(html, fontSettings) {
  if (!fontSettings || !html) return html
  const fontFamily = FONT_FAMILY_MAP[fontSettings.fontFamily] || FONT_FAMILY_MAP['microsoft-yahei']
  const fontSize = fontSettings.fontSize || 16
  const lineHeight = calcLH(fontSize, fontSettings.lineHeight)
  const letterSpacing = typeof fontSettings.letterSpacing === 'number' ? fontSettings.letterSpacing : 0
  const styledHtml = addInlineStyles(html, fontFamily, fontSize, lineHeight, letterSpacing)
  const lh2 = parseFloat(lineHeight)
  const fallback = calcLH(fontSize, lh2)
  const lhCss = Number.isFinite(lh2) ? String(lineHeight) : (/[empx%]/i.test(String(lineHeight)) ? String(lineHeight) : fallback)
  return `<section data-role="outer" class="rich_media_content" style="font-family: ${fontFamily}; font-size: ${fontSize}px; line-height: ${lhCss} !important; letter-spacing: ${letterSpacing}px; font-weight: 400; color: #333; margin: 0; padding: 0;">
<section data-role="inner" style="font-family: ${fontFamily}; font-size: ${fontSize}px; line-height: ${lhCss} !important; letter-spacing: ${letterSpacing}px; font-weight: 400; color: #333;">
${styledHtml}
</section>
</section>`
}

/**
 * 把颜色 hex 与白色按 ratio 混合（ratio 为彩色占比），用于灰底/浅色调色。
 */
function blendWithWhite(hex, ratio = 0.06) {
  const rgb = hexToRgb(hex) || { r: 88, g: 101, b: 242 }
  const mix = (c) => Math.round(c * ratio + 255 * (1 - ratio))
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(rgb.r))}${toHex(mix(rgb.g))}${toHex(mix(rgb.b))}`
}

/**
 * 平台档案 → 复制产物的最小可辨结构差异（纯字符串级 inline style 调整）。
 * 只做四类事，不推翻模板体系：
 *  1) 基础字号/行高：profile 值覆盖 wrapWithFontStyles 的默认排版参数
 *     （调用方已保证用户显式设置的 fontSettings 优先于 profile）；
 *     h2/h3/h4 按主题适配器同样的缩放比（1.5/1.22/1.08）同步换算。
 *  2) 强调色 primary：替换上游以主题主色渲染的内联声明
 *     （h1 胶囊背景、blockquote 左竖条边框、blockquote 渐变底色、链接色）。
 *  3) 引用块形态：'left-bar' 调粗细；'gray-rounded' 改灰底圆角卡片并弱化竖条。
 *  4) 分割线 hrStyle / h2 标题后装饰短线（headingSuffix）。
 * @param {string} html 已经过主题适配器 transform 的复制产物
 * @param {object} profile getPlatformProfile() 返回值
 * @param {{baseFontSize:number}} [opts] baseFontSize=最终生效的正文字号（fontSettings 与 profile 合成结果）
 * @returns {string}
 */
export function applyPlatformProfile(html, profile, opts = {}) {
  if (!html || !profile) return html
  const scale = (v) => Math.max(12, Math.round(v))
  const fs = Number(profile.fontSize) || null
  const lh = Number(profile.lineHeight) || null
  const accent = profile.accent || null
  // 仅当 profile 与"最终生效字号"不同时才改写（用户显式调过字号则不动尺寸类样式）
  const effectiveFs = Number(opts.baseFontSize) || fs || 16
  const resize = !!fs && fs !== effectiveFs
  const lineHeightCss = String(lh || 'normal')

  let out = html

  // 1) 基础行高：先改写主题适配器注入的 px 行高（h2/h3 等，无 !important），
  //    再改写 wrapWithFontStyles/模板体系带 !important 的基础行高。
  if (lh) {
    out = out.replace(/line-height:\s*[\d.]+px/gi, () => `line-height: ${lh}em`)
    out = out.replace(/line-height:\s*[^;"']+\s*!important/gi, () => `line-height: ${lineHeightCss} !important`)
  }
  if (resize) {
    // 只改写外层包裹 section（data-role=outer/inner）的 font-size——它们决定
    // 正文与继承性排版基准。blockquote/h2 等由解析期按 effectiveFs 生成的
    // 显式 px 尺寸保持不动，避免"用户字号被平台倍率二次缩放"。
    const ratio = fs / effectiveFs
    out = out.replace(/(<section data-role="(?:outer|inner)"[^>]*?style=")([^"]*)(")/gi,
      (m, open, style, close) => `${open}${style.replace(/font-size:\s*\d+(?:\.\d+)?px/gi, () => `font-size: ${scale(fs)}px`)}${close}`)
    // h2/h3/h4 若缺 font-size 声明则补齐（与适配器缩放比一致）
    for (const [tag, s] of [['h2', 1.5], ['h3', 1.22], ['h4', 1.08]]) {
      out = out.replace(new RegExp(`<${tag}([^>]*)style="([^"]*)"`, 'gi'), (m, pre, style) => {
        if (/font-size\s*:/i.test(style)) return m
        return `<${tag}${pre}style="${style}; font-size: ${scale(fs * s)}px"`
      })
    }
  }

  // 2) 强调色覆盖（wechat accent=null 时保持主题色，直接跳过）
  if (accent) {
    const rgb = hexToRgb(accent)
    const rgbStr = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : null
    // h1 胶囊背景
    out = out.replace(/background:\s*#[0-9a-fA-F]{3,8}(?=\s*;?\s*color:\s*#fff)/gi, `background: ${accent}`)
    // blockquote 左竖条
    out = out.replace(/border-left:\s*(\d+)px solid #[0-9a-fA-F]{3,8}/gi, (_m, w) => `border-left: ${w}px solid ${accent}`)
    // blockquote 主题色渐变底（hex + 透明度后缀形式）
    out = out.replace(/linear-gradient\(([^)]*?)#[0-9a-fA-F]{6}[0-9A-Fa-f]{2}[^)]*\)/gi,
      (m) => /^linear-gradient\(.*rgba/.test(m) ? m : m.replace(/#[0-9a-fA-F]{6}[0-9A-Fa-f]{2}/gi, (h) => accent + h.slice(7)))
    // blockquote 主色投影（box-shadow: … #RRGGBBAA）
    out = out.replace(/box-shadow:([^;"']*)#([0-9a-fA-F]{6})([0-9A-Fa-f]{2})/gi,
      (_m, pre_, _c, alpha) => `box-shadow:${pre_}${accent}${alpha}`)
    // 链接色
    out = out.replace(/color:\s*#[0-9a-fA-F]{3,8}(?=\s*;?\s*text-decoration:\s*none)/gi, `color: ${accent}`)
    // rgba(r,g,b,a) 形式的半透明主色（表格边框/阴影等）
    if (rgbStr) {
      out = out.replace(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/gi, (_m, a) => `rgba(${rgbStr}, ${a})`)
    }
  }

  // 3) 引用块形态
  if (profile.blockquoteStyle === 'gray-rounded') {
    const grayBg = accent ? blendWithWhite(accent, 0.04) : '#F7F7FA'
    out = out.replace(/<blockquote([^>]*?)style="([^"]*)"([^>]*)>/gi, (m, pre, style, post) => {
      let s = style
      s = s.replace(/border-left\s*:\s*[^;]+;?/gi, `border-left: 3px solid ${accent || '#E0E0E0'};`)
      s = s.replace(/background\s*:\s*(linear-gradient\([^)]*\)|#[0-9a-fA-F]+|rgba?\([^)]*\));?/gi, `background: ${grayBg};`)
      if (!/border-radius/i.test(s)) s += ' border-radius: 8px;'
      return `<blockquote${pre}style="${s.trim()}"${post}>`
    })
  } else if (accent) {
    // left-bar：竖条加粗一档，强化品牌感
    out = out.replace(/border-left:\s*(\d+)px solid /gi, (_m, w) => `border-left: ${Math.min(6, parseInt(w, 10) + 1)}px solid `)
  }

  // 4) 分割线与 h2 尾饰
  if (profile.hrStyle === 'faded') {
    out = out.replace(/<hr([^>]*?)style="([^"]*)"[^>]*>/gi, (m, pre) =>
      `<hr${pre}style="border: none; height: 1px; background: #E5E5E5; margin: 2em auto; width: 40%;">`)
  }
  if (profile.headingSuffix) {
    out = out.replace(/<\/h2>/gi, '<span data-plat-h2-suffix style="display:block; width: 2.2em; height: 3px; border-radius: 2px; background: linear-gradient(90deg, transparent, ' + (accent || '#FF2442') + '); margin-top: 6px;"></span></h2>')
  }

  return out
}

export class SocialStyler {
  /**
   * @param {string} html
   * @param {object} options
   * @param {object} [options.fontSettings] 用户字体设置（显式值优先于平台推荐值）
   * @param {object|string} [options.themeSystem] 主题系统（决定复制适配器）
   * @param {object} [options.colorTheme] 颜色主题（primary 强调色基线）
   * @param {boolean} [options.isPreview] 预览模式：不做平台化，保持原行为
   * @param {string} [options.platform] 'wechat'|'xiaohongshu'|'zhihu'，缺省 wechat
   */
  static process(html, options = {}) {
    if (!html) return ''
    const { fontSettings, themeSystem, colorTheme, isPreview = false, platform } = options

    // 预览模式：仅为带说明的图片添加图注包裹，不进行整体字体/段落样式注入
    if (isPreview) {
      const fontFamily = FONT_FAMILY_MAP[fontSettings?.fontFamily] || FONT_FAMILY_MAP['microsoft-yahei']
      const fontSize = fontSettings?.fontSize || 16
      const baseStyle = `font-family: ${fontFamily}; color: #333; letter-spacing: ${typeof fontSettings?.letterSpacing === 'number' ? fontSettings.letterSpacing : 0}px;`
      const out = html.replace(/<img([^>]*?)data-md-caption="true"([^>]*?)>/gi, (m, pre, post) => {
        const altMatch = m.match(/alt="([^"]*)"/i)
        const alt = altMatch ? altMatch[1] : ''
        const img = `<img${pre}data-md-caption="true"${post}>`
        const figureStyle = `${baseStyle} text-align: center; margin: 1em 0;`
        const captionStyle = `${baseStyle} display: block; font-size: ${Math.max(12, Math.round(fontSize * 0.875))}px; color: #666; margin-top: 6px;`
        return `<figure style="${figureStyle}">${img}<figcaption style="${captionStyle}">${alt}</figcaption></figure>`
      })
      return out
    }

    // 复制到公众号等平台：注入字体/行高等样式，并进行主题适配 + 平台档案差异化。
    // 注意：fontSettings 可能为 null（用户从未持久化字体设置 / themeManager
    // 返回 null）——此时也必须走本分支：用平台档案合成一份最小 fontSettings，
    // 否则复制产物不带任何内联样式且三平台完全相同（真实浏览器验证发现的断链）。
    if (!isPreview) {
      const profile = getPlatformProfile(platform)
      const base = fontSettings || {}

      // 平台推荐排版参数 vs 用户显式设置：
      // 规则——profile 提供"平台推荐默认值"；用户在字体设置里显式给过的
      // fontSize/lineHeight 优先于 profile（字段缺失/非数值时视为未显式设置）。
      const effFontSettings = { ...base }
      const userFsExplicit = typeof base.fontSize === 'number' && Number.isFinite(base.fontSize)
      const userLhExplicit = typeof base.lineHeight === 'number' && Number.isFinite(base.lineHeight) && base.lineHeight > 0
      if (!userFsExplicit && profile.fontSize) effFontSettings.fontSize = profile.fontSize
      if (!userLhExplicit && profile.lineHeight) effFontSettings.lineHeight = profile.lineHeight

      let out = wrapWithFontStyles(html, effFontSettings)

      // 强调色：xiaohongshu/zhihu 用平台品牌色覆盖主题主色；wechat 保持主题色
      const primary = profile.accent
        || (colorTheme && colorTheme.primary ? colorTheme.primary : '#5865F2')
      const baseFontSize = Number(effFontSettings?.fontSize) || 16
      const primaryRgb = hexToRgb(primary) || { r: 88, g: 101, b: 242 }
      const primaryRgbStr = `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`
      const adapter = getThemeCopyAdapter(themeSystem)
      if (adapter && typeof adapter.transform === 'function') {
        out = adapter.transform(out, { primary, baseFontSize, primaryRgbStr, themeSystem })
      }

      // 平台结构差异（引用块形态 / h2 尾饰 / hr 风格等）
      out = applyPlatformProfile(out, profile, { baseFontSize })
      return out
    }
    return html
  }

  static applyInlineStyles(html, fontSettings) {
    if (!fontSettings || !html) return html
    const fontFamily = FONT_FAMILY_MAP[fontSettings.fontFamily] || FONT_FAMILY_MAP['microsoft-yahei']
    const fontSize = fontSettings.fontSize || 16
    const lineHeight = calculateLineHeight(fontSize, fontSettings.lineHeight)
    const letterSpacing = typeof fontSettings.letterSpacing === 'number' ? fontSettings.letterSpacing : 0
    return addInlineStyles(html, fontFamily, fontSize, lineHeight, letterSpacing)
  }
}


