<template>
  <footer class="app-footer">
    <div class="footer-left">
      <div class="stat-item">
        <FileText :size="13" />
        <span>{{ $t('footer.characters', { count: characterCount }) }}</span>
      </div>
      <div class="stat-item">
        <AlignLeft :size="13" />
        <span>{{ $t('footer.lines', { count: lineCount }) }}</span>
      </div>
      <div class="stat-item">
        <Type :size="13" />
        <span>{{ $t('footer.words', { count: wordCount }) }}</span>
      </div>
      <div class="stat-item">
        <Clock :size="13" />
        <span>{{ $t('footer.minutes', { count: estimatedReadTime }) }}</span>
      </div>
    </div>

    <!-- ===== UI 皮肤扩展段（task-8）：同步滚动 + 平台快捷切换，两皮肤共用 ===== -->
    <span class="st-sw" @click="$emit('toggle-sync-scroll')" :title="$t('main.preview.syncScroll')">
      <span class="nb-switch" :class="{ off: !syncScrollEnabled }"></span>
      <span>{{ $t('main.preview.syncScroll') }}</span>
    </span>

    <!-- 自动保存指示：并入 footer（原 fixed 悬浮层会遮挡右下内容） -->
    <span v-if="lastSavedAt" class="autosave-hint" :title="'内容有改动即自动保存'">
      <Save :size="12" />
      自动保存 {{ lastSavedAt }}<!-- TODO(i18n) -->
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
import { FileText, AlignLeft, Type, Clock, Save } from 'lucide-vue-next'
defineProps({
  characterCount: { type: Number, required: true },
  lineCount: { type: Number, required: true },
  wordCount: { type: Number, required: true },
  estimatedReadTime: { type: Number, required: true },
  syncScrollEnabled: { type: Boolean, default: true },
  lastSavedAt: { type: String, default: '' },
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
.autosave-hint { display: inline-flex; align-items: center; gap: 4px; color: var(--text-tertiary); font-size: 12px; margin-left: 6px; white-space: nowrap; }
@import '../../styles/components/layout/app-footer.css';
</style>
