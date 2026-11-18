<template>
  <footer class="app-footer">
    <div class="footer-left">
      <div class="stat-item">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        <span>{{ $t('footer.characters', { count: characterCount }) }}</span>
      </div>
      <div class="stat-item">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M3,3H21V5H3V3M3,7H21V9H3V7M3,11H21V13H3V11M3,15H21V17H3V15M3,19H21V21H3V19Z"/>
        </svg>
        <span>{{ $t('footer.lines', { count: lineCount }) }}</span>
      </div>
      <div class="stat-item">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M17,7H22V17H17V19A1,1 0 0,0 18,20H20V22H17.5C16.95,22 16,21.55 16,21C16,21.55 15.05,22 14.5,22H12V20H14A1,1 0 0,0 15,19V5A1,1 0 0,0 14,4H12V2H14.5C15.05,2 16,2.45 16,3C16,2.45 16.95,2 17.5,2H20V4H18A1,1 0 0,0 17,5V7M2,7H13V9H4V15H13V17H2V7Z"/>
        </svg>
        <span>{{ $t('footer.words', { count: wordCount }) }}</span>
      </div>
      <div class="stat-item">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
        </svg>
        <span>{{ $t('footer.minutes', { count: estimatedReadTime }) }}</span>
      </div>
    </div>

    <!-- ===== UI 皮肤扩展段（task-8）：同步滚动 + 平台快捷切换，两皮肤共用 ===== -->
    <span class="st-sw" @click="$emit('toggle-sync-scroll')" :title="$t('main.preview.syncScroll')">
      <span class="nb-switch" :class="{ off: !syncScrollEnabled }"></span>
      <span>{{ $t('main.preview.syncScroll') }}</span>
    </span>

    <span class="footer-spacer"></span>

    <template v-if="showPlatformLinks">
      <span class="st-it" style="padding-right:2px">复制到：</span><!-- TODO(i18n) -->
      <span
        v-for="(p, i) in platforms"
        :key="p.key"
        class="plat-link"
        :class="{ active: activePlatform === p.key }"
        :style="activePlatform === p.key ? {} : { color: 'var(--text-tertiary)' }"
        @click="$emit('select-platform', p.key)"
      >{{ p.label }}<span v-if="i < platforms.length - 1" class="st-dot" style="margin:0 6px; display:inline-block; vertical-align:middle"></span></span>
      <span class="st-dot" style="margin:0 9px"></span>
      <span class="st-it" style="color: var(--text-tertiary)">⌘⇧C 快速复制</span><!-- TODO(i18n) -->
    </template>
  </footer>
</template>

<script setup>
defineProps({
  characterCount: { type: Number, required: true },
  lineCount: { type: Number, required: true },
  wordCount: { type: Number, required: true },
  estimatedReadTime: { type: Number, required: true },
  syncScrollEnabled: { type: Boolean, default: true },
  // native：状态条展示三平台快捷切换；workbench：顶栏 CTA 已承担，关不掉旧结构也不显示
  showPlatformLinks: { type: Boolean, default: false },
  activePlatform: { type: String, default: 'wechat' }
})

defineEmits(['toggle-sync-scroll', 'select-platform'])

// TODO(i18n): 平台名暂用中文字面量（locales 归 task-9）
const platforms = [
  { key: 'wechat', label: '公众号' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'zhihu', label: '知乎' }
]
</script>

<style scoped>
@import '../../styles/components/layout/app-footer.css';
</style>
