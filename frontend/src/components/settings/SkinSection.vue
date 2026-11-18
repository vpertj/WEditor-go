<template>
  <section class="settings-section">
    <div class="section-header">
      <div class="section-icon">
        <!-- layers（图层堆叠）：lucide 风，表达界面皮肤/层次 -->
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M12 2.3 2.6 7.5a.9.9 0 0 0 0 1.57L12 14.2l9.4-5.13a.9.9 0 0 0 0-1.57L12 2.3Zm7.36 8.45 2.04 1.11a.9.9 0 0 1 0 1.57L12 18.81l-9.4-5.38a.9.9 0 0 1 0-1.57l2.04-1.11L12 15.1l7.36-4.35Zm0 4.1 2.04 1.11a.9.9 0 0 1 0 1.57L12 22.91l-9.4-5.38a.9.9 0 0 1 0-1.57l2.04-1.11L12 19.2l7.36-4.35Z"/>
        </svg>
      </div>
      <h3>{{ $t('settings.skin.title') }}</h3>
    </div>

    <p class="description-text skin-desc">{{ $t('settings.skin.desc') }}</p>

    <!-- 两张横排预览卡片 -->
    <div class="skin-grid" role="radiogroup" :aria-label="$t('settings.skin.title')">
      <div
        v-for="item in SKINS"
        :key="item.id"
        class="skin-card card-base"
        :class="{
          active: !followSystemDark && skin === item.id,
          'auto-mapped': followSystemDark && skin === item.id,
          disabled: followSystemDark
        }"
        role="radio"
        tabindex="0"
        :aria-checked="followSystemDark ? 'false' : String(skin === item.id)"
        :aria-disabled="String(followSystemDark)"
        :data-testid="'skin-card-' + item.id"
        @click="onSelect(item.id)"
        @keydown.enter.prevent="onSelect(item.id)"
        @keydown.space.prevent="onSelect(item.id)"
      >
        <!-- 迷你 CSS 示意图（纯 div 绘制，不引用外部图片）。
             pointer-events:none：装饰性命中区整体穿透给卡片，
             保证点击/拖放目标计算与无障碍一致，也避免内部元素
             被自动化测试的 hit-target 检查误判为遮挡层。 -->
        <div class="skin-preview" aria-hidden="true">
          <!-- native：浅色磨砂顶栏 + 侧栏 + 三线小窗 -->
          <template v-if="item.id === 'native'">
            <div class="pv pv-native">
              <div class="pv-bar pv-native-topbar">
                <span class="pv-dot pv-native-dot"></span><span class="pv-dot pv-native-dot"></span><span class="pv-dot pv-native-dot"></span>
              </div>
              <div class="pv-row">
                <div class="pv-side pv-native-side">
                  <span class="pv-line pv-native-l w60"></span>
                  <span class="pv-line pv-native-l w45"></span>
                  <span class="pv-line pv-native-l pv-native-sel w70"></span>
                  <span class="pv-line pv-native-l w55"></span>
                </div>
                <div class="pv-win pv-native-win">
                  <span class="pv-line pv-native-doc w80"></span>
                  <span class="pv-line pv-native-doc w60"></span>
                  <span class="pv-line pv-native-doc w70"></span>
                  <span class="pv-line pv-native-doc w40"></span>
                </div>
              </div>
            </div>
          </template>
          <!-- workbench：深色左侧 rail + 编辑/预览双栏小窗 -->
          <template v-else>
            <div class="pv pv-workbench">
              <div class="pv-rail pv-wb-rail">
                <span class="pv-ico pv-wb-ico"></span>
                <span class="pv-ico pv-wb-ico pv-wb-ico-sel"></span>
                <span class="pv-ico pv-wb-ico"></span>
                <span class="pv-ico pv-wb-ico"></span>
              </div>
              <div class="pv-main pv-wb-main">
                <div class="pv-col pv-wb-col"><span class="pv-line pv-wb-line"></span><span class="pv-line pv-wb-line pv-wb-short"></span></div>
                <div class="pv-col pv-wb-col"><span class="pv-line pv-wb-line"></span><span class="pv-line pv-wb-line pv-wb-short"></span></div>
              </div>
            </div>
          </template>
        </div>

        <div class="skin-card-name title-secondary">
          {{ tn(`settings.skin.${item.id}Name`, item.name) }}
        </div>
        <div class="description-small skin-card-desc">
          {{ tn(`settings.skin.${item.id}Desc`, item.desc) }}
        </div>

        <!-- 选中态勾选角标 -->
        <div v-if="!followSystemDark && skin === item.id" class="check-indicator small skin-check">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 10l4 4 8-9" stroke="var(--theme-primary, #3b82f6)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 跟随系统明暗开关 -->
    <div class="card-base setting-row skin-follow-row">
      <div class="setting-info">
        <div class="title-secondary">{{ $t('settings.skin.follow') }}</div>
        <div class="description-small">
          {{ $t('settings.skin.followDesc') }}
          <span v-if="followSystemDark" class="skin-auto-hint" data-testid="skin-auto-map">
            {{ autoMapHint }}
          </span>
        </div>
      </div>
      <button
        class="toggle-switch"
        :class="{ active: followSystemDark }"
        :aria-pressed="followSystemDark"
        :title="$t(followSystemDark ? 'settings.skin.disableTip' : 'settings.skin.enableTip')"
        data-testid="skin-follow-toggle"
        @click="onToggleFollow"
      >
        <span class="toggle-knob"></span>
      </button>
    </div>
  </section>
</template>

<script setup>
/**
 * @file src/components/settings/SkinSection.vue
 * @description 设置面板 · 界面风格（UI Skin）区块（task-9）。
 *
 * - 数据源与切换 API 全部来自 task-8 的 useAppSkin()（只 import，不修改其实现）；
 *   setSkin / setFollowSystemDark 即时生效并持久化，无需点底部"应用设置"。
 * - 卡片文案优先走 $t（settings.skin.nativeName / nativeDesc / workbenchName /
 *   workbenchDesc），locale 缺失时回落 SKINS 里的 name/desc —— 因此本组件
 *   对 locales 文件没有硬依赖，即使 key 未加载也不会渲染空白。
 * - 开启"跟随系统明暗"后卡片置灰不可点，并在开关行显示当前自动映射结果。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppSkin } from '../../composables/index.js'

const { t, te } = useI18n()
const tn = (key, fallback) => (te(key) ? t(key) : fallback)

const { skin, followSystemDark, SKINS, setSkin, setFollowSystemDark } = useAppSkin()

// 跟随模式下展示当前自动映射结果：dark→工作台 / light→原生
const autoMapHint = computed(() => {
  const dark = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
  return `${tn('settings.skin.autoPrefix', 'Auto:')} ${t(dark ? 'settings.skin.workbenchName' : 'settings.skin.nativeName')}`
})

const onSelect = (id) => {
  if (followSystemDark.value) return
  setSkin(id)
  try {
    window.dispatchEvent(new CustomEvent('weditor-skin-toast', {
      detail: {
        message: t('settings.skin.appliedToast', { name: t(`settings.skin.${id}Name`) }),
        type: 'success'
      }
    }))
  } catch (_) { /* i18n 消息异常不影响切换 */ }
}

const onToggleFollow = () => {
  setFollowSystemDark(!followSystemDark.value)
}
</script>

<style scoped>
@import '../../styles/components/settings/section.css';

.skin-desc {
  margin: 0 0 20px;
}

.skin-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 720px) {
  .skin-grid {
    grid-template-columns: 1fr;
  }
}

.skin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  outline: none;
}

.skin-card:focus-visible {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 3px var(--theme-primary-15, rgba(59, 130, 246, 0.18));
}

/* 跟随系统时：卡片禁用（不可点）。置灰不使用卡片级 opacity ——
   那会把迷你示意图里的深色/浅色真实观感洗成灰蒙（合成数学所致），
   改为只弱化标题/说明文字；hover 抬升的压制用 !important
   （section.css 与本规则特异性相同，scoped 下先后顺序不稳定）。 */
.skin-card.disabled {
  cursor: not-allowed;
}

.skin-card.disabled .skin-card-name {
  color: var(--theme-text-secondary);
}

.skin-card.disabled:hover {
  transform: none !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
  border-color: var(--theme-border-light) !important;
}

/* 自动命中的一张保持可辨识描边，明示当前映射结果（不加任何淡化） */
.skin-card.auto-mapped {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 1px var(--theme-primary-15, rgba(59, 130, 246, 0.25)), 0 4px 12px rgba(0, 0, 0, 0.08);
}

.skin-card.auto-mapped:hover {
  transform: none !important;
}


.skin-card-name {
  margin-bottom: 0;
}

.skin-card-desc {
  color: var(--theme-text-secondary);
}

.skin-check {
  top: 10px;
  right: 10px;
}

/* ---------- 迷你 CSS 示意图 ---------- */
/* 示意内颜色是各皮肤自身的品牌参照色（native 浅磨砂 / workbench 深 violet），
   刻意不随 --theme-* 主题走，保证"预览即该皮肤的真实观感"。 */
.skin-preview {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  pointer-events: none;
}

.pv {
  height: 120px;
  display: flex;
  flex-direction: column;
}

.pv-row {
  flex: 1;
  display: flex;
  min-height: 0;
}

.pv-line {
  display: block;
  height: 6px;
  border-radius: 3px;
}

.pv-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* native：浅色 vibrancy（双选择器确保 scope 属性分布无关） */
.pv-native,
.pv-native-topbar {
  background: linear-gradient(148deg, #E7EDF5 0%, #CFDAEA 100%);
}

.pv-native .pv-native-topbar,
.pv-native-topbar {
  height: 20px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  background: rgba(236, 236, 241, 0.55);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
}

.pv-native .pv-native-dot,
.pv-native-dot { background: rgba(60, 60, 67, 0.28); }

.pv-native .pv-native-side,
.pv-native-side {
  width: 34%;
  flex: none;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: rgba(233, 233, 235, 0.62);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.pv-native .pv-native-l,
.pv-native-l { background: rgba(60, 60, 67, 0.24); }

.pv-native .pv-native-sel,
.pv-native-sel { background: #0A84FF !important; opacity: 0.9; }

.pv-native .pv-native-win,
.pv-native-win {
  flex: 1;
  margin: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #FBFBFD;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 0 0 0.5px rgba(0, 0, 0, 0.05);
}

.pv-native .pv-native-doc,
.pv-native-doc { background: rgba(28, 28, 30, 0.13); }

.pv-native .w40, .w40.pv-native-doc { width: 40%; }
.pv-native .w45, .w45.pv-native-l { width: 45%; }
.pv-native .w55, .w55.pv-native-l { width: 55%; }
.pv-native .w60, .w60.pv-native-l, .w60.pv-native-doc { width: 60%; }
.pv-native .w70, .w70.pv-native-l, .w70.pv-native-doc { width: 70%; }
.pv-native .w80, .w80.pv-native-doc { width: 80%; }

/* workbench：深蓝黑 + violet rail */
.pv-workbench,
.pv-wb-rail,
.pv-wb-main { min-width: 0; }

.pv-workbench {
  flex-direction: row;
  background: #10151C;
}

.pv-workbench .pv-wb-rail,
.pv-wb-rail {
  width: 26px;
  flex: none;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  background: #060910;
  border-right: 1px solid rgba(240, 246, 252, 0.08);
}

.pv-workbench .pv-wb-ico,
.pv-wb-ico {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: rgba(240, 246, 252, 0.16);
}

.pv-workbench .pv-wb-ico-sel,
.pv-wb-ico-sel {
  background: #7C5CFC !important;
  box-shadow: 0 0 8px rgba(124, 92, 252, 0.65);
}

.pv-workbench .pv-wb-main,
.pv-wb-main {
  flex: 1;
  display: flex;
  gap: 8px;
  padding: 12px;
  background: linear-gradient(160deg, #0D1117 0%, #161B22 100%);
}

.pv-workbench .pv-wb-col,
.pv-wb-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border-radius: 6px;
  background: #1B2027;
  border: 1px solid rgba(240, 246, 252, 0.07);
}

.pv-workbench .pv-wb-line,
.pv-wb-line { background: rgba(230, 237, 243, 0.18); }

.pv-workbench .pv-wb-short,
.pv-wb-short { width: 55%; }

/* ---------- 开关行 ---------- */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px;
  cursor: default;
}

.setting-row:hover {
  transform: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.skin-auto-hint {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-primary);
  background: var(--theme-primary-15, rgba(59, 130, 246, 0.15));
}

.toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: var(--theme-border-light);
  cursor: pointer;
  transition: background 0.3s ease, box-shadow 0.3s ease;
  padding: 0;
  outline: none;
}

.toggle-switch:hover {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.06);
}

.toggle-switch.active {
  background: var(--theme-primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(24px);
}
</style>
