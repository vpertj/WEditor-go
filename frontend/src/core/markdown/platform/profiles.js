/**
 * @file src/core/markdown/platform/profiles.js
 * @description 目标平台排版档案（wechat / xiaohongshu / zhihu）
 *
 * 复制管线此前没有 platform 维度：三个平台复制出的 HTML 完全相同，
 * toast 也恒指向公众号。本文件提供每个平台的"推荐排版参数 + 结构差异"，
 * 由 social-styler 的 applyPlatformProfile() 在非 preview（复制）分支
 * 以纯 inline style 方式应用。
 *
 * 字段说明：
 * - label            平台中文名（toast / UI 用；i18n key 见 locales copyFormat.platforms.*）
 * - labelEn          平台英文名（en locale 兜底文案用）
 * - copyTargetName   toast 里"可以粘贴到××"的目标名
 * - fontSize         平台推荐正文字号(px)。作为默认值：用户在字体设置里
 *                    显式调过 fontSettings.fontSize 时以用户值为准
 * - lineHeight       平台推荐行高(无单位倍率)。同上，用户显式设置优先
 * - contentMaxWidthPx 版心宽度(px)，仅供预览容器使用——复制到平台后台是
 *                    富文本粘贴，不存在固定版心概念，绝不写入复制产物
 * - accent           强调色(hex)。null = 保持当前颜色主题主色（公众号习惯
 *                    跟作者主题走）；非 null = 平台品牌色，覆盖 colorTheme.primary
 * - blockquoteStyle  引用块形态：
 *                      'left-bar'     左竖条 + 浅色渐变底（现有模板体系默认）
 *                      'gray-rounded' 灰底圆角卡片（知乎风格），弱化左侧竖条
 * - headingSuffix    h2 标题后是否追加装饰短线（小红书活泼风）
 * - hrStyle          分割线形态：
 *                      'gradient' 主色渐变细线（现有默认）
 *                      'faded'    淡灰居中短线（知乎朴素风）
 */
export const PLATFORM_PROFILES = {
  wechat: {
    label: '公众号',
    labelEn: 'WeChat Official Account',
    copyTargetName: '公众号编辑器',
    fontSize: 15,
    lineHeight: 1.75,
    contentMaxWidthPx: 677,
    accent: null, // 保持用户当前主题主色
    blockquoteStyle: 'left-bar',
    headingSuffix: false,
    hrStyle: 'gradient'
  },
  xiaohongshu: {
    label: '小红书',
    labelEn: 'Xiaohongshu',
    copyTargetName: '小红书创作界面',
    fontSize: 14,
    lineHeight: 1.6,
    contentMaxWidthPx: 360, // 仅预览用；小红书后台富文本无固定版心
    accent: '#FF2442',
    blockquoteStyle: 'left-bar',
    headingSuffix: true,
    hrStyle: 'gradient'
  },
  zhihu: {
    label: '知乎',
    labelEn: 'Zhihu',
    copyTargetName: '知乎专栏编辑器',
    fontSize: 16,
    lineHeight: 1.8,
    contentMaxWidthPx: 690,
    accent: '#0084FF',
    blockquoteStyle: 'gray-rounded',
    headingSuffix: false,
    hrStyle: 'faded'
  }
}

export const DEFAULT_PLATFORM = 'wechat'

/**
 * 取平台档案；未知/缺省一律回落到默认（公众号），保证向后兼容。
 * @param {string} [platform]
 * @returns {{key:string} & typeof PLATFORM_PROFILES.wechat}
 */
export function getPlatformProfile(platform) {
  const key = PLATFORM_PROFILES[platform] ? platform : DEFAULT_PLATFORM
  return { key, ...PLATFORM_PROFILES[key] }
}
