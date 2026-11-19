<template>
  <div id="app" :data-skin="skin">
    <!-- ═══════════ native · Apple HIG unified toolbar ═══════════ -->
    <div v-if="!isWorkbench" class="skin-shell">
      <!-- 顶栏即拖拽区（--app-region:drag），双击全屏判定同 onDragStripMouseDown -->
      <header class="skin-toolbar" @mousedown="onDragStripMouseDown">
        <div class="skin-traffic-gap"></div>

        <!-- 文档切换器：文件名 ▾（红绿灯避让 78px 起） -->
        <div class="docsw-wrap" @click.stop>
          <button :class="['docsw', { open: showDocMenu }]" @click="showDocMenu = !showDocMenu" title="文档">
            <span class="doc-icon">M↓</span>
            <span class="doc-title">{{ currentFileName || '未命名草稿' }}</span>
            <span class="doc-sub" v-if="currentFileName">— Markdown</span>
            <svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.6 5 6.6 8 3.6"/></svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showDocMenu" class="pop-menu" style="left: 0;">
              <div class="mi-head">文件</div><!-- TODO(i18n) -->
              <div class="mi" @click="doNewFile(); showDocMenu=false">新建文档<span class="sc">⌘N</span></div>
              <div class="mi" @click="openFile().then(r => r && r.success && (updateMarkdownContent(r.content), clearDraft(), applyDefaultOpenMode(), fileOpenTick++)); showDocMenu=false">打开…<span class="sc">⌘O</span></div>
              <div class="mi" @click="saveFile(markdownContent); showDocMenu=false">保存<span class="sc">⌘S</span></div>
              <div class="csep"></div>
              <div class="mi-head">最近文件</div>
              <div v-for="f in recentRows.slice(0, 5)" :key="f.path" class="mi" @click="openRecentOrCurrent(f.path); showDocMenu=false">
                {{ f.name }}<span class="sc">{{ f.time }}</span>
              </div>
              <div v-if="!recentRows.length" class="mi" style="opacity:.5">暂无<span class="sc"></span></div><!-- TODO(i18n) -->
            </div>
          </Transition>
        </div>

        <!-- 视图分段控件：分栏 | 源码 | 排版（居中） -->
        <div class="seg seg-center" role="radiogroup" aria-label="视图模式"><!-- TODO(i18n) -->
          <button v-for="m in segModes" :key="m.key" :class="{ on: activeSegKey === m.key }" role="radio" :aria-checked="activeSegKey === m.key" @click="setSegMode(m.mode)">
            <svg v-if="m.key==='both'" width="13" height="12" viewBox="0 0 13 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x=".8" y="1" width="11.4" height="10" rx="1.8"/><path d="M6.5 1v10"/></svg>
            <svg v-else-if="m.key==='source'" width="13" height="12" viewBox="0 0 13 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.4 2.6 1.6 6l2.8 3.4M8.6 2.6 11.4 6l-2.8 3.4"/></svg>
            <svg v-else width="13" height="12" viewBox="0 0 13 12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"><path d="M1.6 2.6h9.8M1.6 6h6.6M1.6 9.4h8.2"/></svg>
            {{ m.label }}
          </button>
        </div>

        <!-- 右侧工具群：搜索 + 导出 split + 设置 -->
        <div class="tb-group tb-right-group">
          <button class="tb filled" title="搜索与替换 ⌘F" @click="showGuide">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><circle cx="6.2" cy="6.2" r="4.1"/><path d="m9.4 9.4 3 3"/></svg>
          </button>
          <div class="export-split-wrap" @click.stop>
            <button class="tb filled" style="padding: 0 9px; gap: 6px;" :disabled="!hasContent" @click="handleCopyFormatSelect({ ...(selectedCopyFormat || { value: 'social' }), platform: currentPlatform })">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.6"/><path d="M9.4 2.2a1.6 1.6 0 0 0-1.2-.6H3.2A1.6 1.6 0 0 0 1.6 3.2v5c0 .47.2.9.6 1.2"/></svg>
              <span style="font-weight:550">导出</span><!-- TODO(i18n) -->
            </button>
            <span class="split-arrow"></span>
            <button class="tb tb-caret" style="min-width:22px;padding:0 4px" @click.stop="showExportMenu = !showExportMenu" title="更多导出">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.6 5 6.6 8 3.6"/></svg>
            </button>
            <Transition name="dropdown">
              <div v-if="showExportMenu" class="pop-menu pop-menu-right">
                <div class="mi-head">复制为富文本</div><!-- TODO(i18n) -->
                <div class="mi" @click="pickPlatformAndCopy('wechat'); showExportMenu=false"><span class="tick">{{ currentPlatform === 'wechat' ? '✓' : '' }}</span>公众号<span class="sc">⌘1</span></div>
                <div class="mi" @click="pickPlatformAndCopy('xiaohongshu'); showExportMenu=false"><span class="tick">{{ currentPlatform === 'xiaohongshu' ? '✓' : '' }}</span>小红书<span class="sc">⌘2</span></div>
                <div class="mi" @click="pickPlatformAndCopy('zhihu'); showExportMenu=false"><span class="tick">{{ currentPlatform === 'zhihu' ? '✓' : '' }}</span>知乎<span class="sc">⌘3</span></div>
                <div class="csep"></div>
                <div class="mi" @click="onExportHTMLClick(); showExportMenu=false">导出 HTML…<span class="sc">⌘⇧E</span></div>
                <div class="mi" @click="triggerImportMd(); showExportMenu=false">导入 .md…<span class="sc">⌘O</span></div>
              </div>
            </Transition>
          </div>
          <button class="tb filled" :class="{ 'tb-active': showSettingsPanel }" title="设置 ⌘," @click="toggleSettingsPanel()">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M6.3 1.4a1.2 1.2 0 0 1 2.4 0l.1.9c.5.15 1 .4 1.4.7l.8-.45a1.2 1.2 0 0 1 1.7 1.7l-.45.8c.3.4.55.9.7 1.4l.9.1a1.2 1.2 0 0 1 0 2.4l-.9.1c-.15.5-.4 1-.7 1.4l.45.8a1.2 1.2 0 0 1-1.7 1.7l-.8-.45c-.4.3-.9.55-1.4.7l-.1.9a1.2 1.2 0 0 1-2.4 0l-.1-.9c-.5-.15-1-.4-1.4-.7l-.8.45a1.2 1.2 0 0 1-1.7-1.7l.45-.8c-.3-.4-.55-.9-.7-1.4l-.9-.1a1.2 1.2 0 0 1 0-2.4l.9-.1c.15-.5.4-1 .7-1.4l-.45-.8a1.2 1.2 0 0 1 1.7-1.7l.8.45c.4-.3.9-.55 1.4-.7z"/><circle cx="7.5" cy="7.5" r="2.1"/></svg>
          </button>
        </div>
      </header>

      <div class="skin-body-row">
        <!-- source-list sidebar（native 皮肤新增导航层；旧 AppHeader 竖栏已隐藏） -->
        <aside class="nb-sidebar">
          <div class="nb-sb-scroll">
            <div class="nb-grp-h">
              <svg class="nb-disclosure" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 1.4 5.8 4 2.6 6.6"/></svg>
              <span>文档</span><!-- TODO(i18n) -->
              <svg class="nb-plus" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" @click="doNewFile" style="cursor:default"><path d="M5.5 1.5v8M1.5 5.5h8"/></svg>
            </div>
            <div class="nb-row sel" v-if="docRows.length">
              <span class="nb-row-ic"><svg width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M2 1h5.4L10.6 4v8H2z"/><path d="M7.4 1v3h3"/></svg></span>
              <span class="nb-row-name">{{ docRows[0].name }}</span>
              <span class="nb-row-sub mono" style="font-size:10px">{{ isModified ? '已编辑' : 'MD' }}</span>
            </div>
            <div class="nb-empty" v-else>当前无打开文档</div><!-- TODO(i18n) -->

            <div class="nb-grp-h">
              <svg class="nb-disclosure" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 1.4 5.8 4 2.6 6.6"/></svg>
              <span>最近打开</span><!-- TODO(i18n) -->
            </div>
            <div v-for="f in recentRows" :key="'r'+f.path" class="nb-row" @click="openRecentOrCurrent(f.path)">
              <span class="nb-row-ic"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="6" cy="6" r="4.6"/><path d="M6 3.4V6l1.9 1.2"/></svg></span>
              <span class="nb-row-name">{{ f.name }}</span>
              <span class="nb-row-sub">{{ f.time }}</span>
            </div>
            <div class="nb-empty" v-if="!recentRows.length">暂无记录</div><!-- TODO(i18n) -->
          </div>
          <div class="nb-sb-foot">
            <button class="nb-foot-btn" title="新建文档 ⌘N" @click="doNewFile">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5.5 1.5v8M1.5 5.5h8"/></svg>新建<!-- TODO(i18n) -->
            </button>
            <button class="nb-foot-btn" title="打开… ⌘O" @click="openFile().then(r => r && r.success && (updateMarkdownContent(r.content), clearDraft(), applyDefaultOpenMode(), fileOpenTick++))">
              <svg width="12" height="11" viewBox="0 0 12 11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M1.2 2.6c0-.66.5-1.2 1.2-1.2h2l1.2 1.4h4c.66 0 1.2.54 1.2 1.2v4.6c0 .66-.54 1.2-1.2 1.2H2.4c-.7 0-1.2-.54-1.2-1.2z"/></svg>打开…<!-- TODO(i18n) -->
            </button>
          </div>
        </aside>

        <div class="app-content">
          <input ref="fileInputRef" type="file" accept=".md,text/markdown,.txt" style="display:none" @change="handleFileChosen" />
          <AppMain
            :markdown-content="markdownContent"
            :sync-scroll-enabled="syncScrollEnabled"
            :view-mode="viewMode"
            :file-open-tick="fileOpenTick"
            @update:markdown-content="updateMarkdownContent"
            @clear-content="clearContent"
            @load-sample="loadSample"
            @html-generated="updateHtmlContent"
            @import-markdown="triggerImportMd"
            @toggle-sync-scroll="toggleSyncScroll"
          />
          <AppFooter
            :character-count="characterCount"
            :line-count="lineCount"
            :word-count="wordCount"
            :estimated-read-time="estimatedReadTime"
            :sync-scroll-enabled="syncScrollEnabled"
            :show-platform-links="true"
            :active-platform="currentPlatform"
            @toggle-sync-scroll="toggleSyncScroll"
            @select-platform="wbPlatformRequest = $event"
          />
        </div>
      </div>
    </div>

    <!-- ═══════════ workbench · Raycast 创作者工作台 ═══════════ -->
    <div v-else class="skin-shell" :style="wbPlatVars">
      <!-- 标题栏（52px，整条可拖拽；交互件 no-drag） -->
      <header class="skin-toolbar" @mousedown="onDragStripMouseDown">
        <div class="skin-traffic-gap"></div>

        <div class="wb-brand">
          <div class="wb-logo">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M4 18 L9 6 L12 14 L15 6 L20 18"/></svg>
          </div>
          <span class="wb-brand-name">WEditor</span>
          <span class="wb-brand-dash">—</span>
          <span class="wb-brand-file">{{ currentFileName || '未命名草稿.md' }}</span>
          <span v-if="isModified" class="wb-doc-dirty" title="未保存修改"></span><!-- TODO(i18n) -->
        </div>

        <!-- 居中视图分段控件 -->
        <div class="seg seg-center wb-seg">
          <button v-for="m in segModes" :key="m.key" :class="{ on: activeSegKey === m.key }" @click="setSegMode(m.mode)">
            <svg v-if="m.key==='both'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>
            <svg v-else-if="m.key==='source'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg>
            {{ m.label }}
          </button>
        </div>

        <div class="footer-spacer"></div>

        <!-- 同步滚动开关 -->
        <div class="wb-sync-toggle" @click="toggleSyncScroll" :title="$t('main.preview.syncScroll')">
          <span>{{ $t('main.preview.syncScroll') }}</span>
          <span class="wb-switch" :class="{ on: syncScrollEnabled }"></span>
        </div>

        <!-- ⌘K 命令面板入口（本次仅占位按钮，不实现面板 —— task-8 约定） -->
        <button class="cmdk-btn" title="命令面板（即将推出）" @click="showNotification('命令面板即将推出', 'info')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <span>搜索命令</span><kbd>⌘K</kbd><!-- TODO(i18n) -->
        </button>

        <!-- 主 CTA：复制排版（颜色跟随平台）+ split 选平台 -->
        <div class="wb-cta export-split-wrap" @click.stop>
          <button class="wb-cta-main" :disabled="!hasContent" @click="copyCurrentPlatformFormat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            复制排版<span class="wb-cta-kbd">⌘⇧C</span><!-- TODO(i18n) -->
          </button>
          <button class="wb-cta-split" @click.stop="showExportMenu = !showExportMenu" title="选择目标平台">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showExportMenu" class="pop-menu pop-menu-right" style="top: calc(var(--skin-toolbar-h) + 4px);">
              <div class="mi-head">目标平台</div><!-- TODO(i18n) -->
              <div v-for="(p, i) in PLATFORM_OPTIONS" :key="p.value" class="mi" @click="pickPlatformAndCopy(p.value); showExportMenu=false">
                <span class="tick">{{ currentPlatform === p.value ? '✓' : '' }}</span>{{ p.label }}<span class="sc">{{ p.shortcut }}</span>
              </div>
              <div class="csep"></div>
              <div class="mi" @click="onExportHTMLClick(); showExportMenu=false">导出 HTML…<span class="sc">⌘E</span></div>
            </div>
          </Transition>
        </div>
      </header>

      <div class="skin-body-row">
        <!-- 64px 图标 rail -->
        <nav class="wb-rail">
          <button v-for="sec in railSections" :key="sec.id" class="wb-rail-btn"
                  :class="{ active: !sec.action && wbPanel === sec.panel && showWbPanel2 }"
                  @click="onRailClick(sec)">
            <!-- 新建 -->
            <svg v-if="sec.id==='new'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M12 11v6M9 14h6"/></svg>
            <!-- 文档库 -->
            <svg v-else-if="sec.id==='docs'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <!-- 模板 -->
            <svg v-else-if="sec.id==='templates'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <!-- 历史 -->
            <svg v-else-if="sec.id==='history'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            <!-- 设置 -->
            <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>{{ sec.title }}</span>
          </button>
          <div class="wb-rail-spacer"></div>
          <button class="wb-avatar" title="WEditor">W</button>
        </nav>

        <!-- 第二列 280px：文档库/最近面板 -->
        <aside class="wb-panel2" v-show="showWbPanel2">
          <div class="wb-panel2-head">
            <div style="display:flex;align-items:center">
              <span class="wb-panel2-title">{{ railPanelTitle }}</span>
              <span class="wb-count-badge">{{ recentRows.length }}</span>
            </div>
            <div class="wb-panel2-actions">
              <button class="wb-mini-btn" title="打开文件夹 (⌘O)" @click="openFile().then(r => r && r.success && (updateMarkdownContent(r.content), clearDraft(), applyDefaultOpenMode(), fileOpenTick++))">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
              </button>
              <button class="wb-mini-btn" title="折叠侧栏 (⌘B)" @click="collapsePanel2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>
              </button>
            </div>
          </div>
          <div class="wb-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input v-model="panelSearch" placeholder="搜索文档…" /><!-- TODO(i18n) -->
          </div>
          <div class="wb-list">
            <p class="wb-group-label">当前文档</p><!-- TODO(i18n) -->
            <button v-if="currentFileName" class="wb-doc-item sel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B9A7FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>
              <span class="wb-doc-main">
                <span class="wb-doc-name">{{ currentFileName }}</span>
                <span class="wb-doc-meta">{{ isModified ? '编辑中 ●' : '已保存' }} · {{ characterCount }} 字</span>
              </span>
            </button>
            <p class="wb-group-label">最近打开</p><!-- TODO(i18n) -->
            <button v-for="f in filteredRecent" :key="'w'+f.path" class="wb-doc-item" @click="openRecentOrCurrent(f.path)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B949E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>
              <span class="wb-doc-main">
                <span class="wb-doc-name">{{ f.name }}</span>
                <span class="wb-doc-meta">{{ f.time }}</span>
              </span>
            </button>
            <p class="wb-empty-tip" v-if="!filteredRecent.length">暂无最近文件。打开或拖入 .md 后会出现在这里。</p><!-- TODO(i18n) -->
          </div>
          <div class="wb-panel2-foot">
            <button class="wb-import-btn" @click="triggerImportMd">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
              导入 Markdown…<!-- TODO(i18n) -->
            </button>
          </div>
        </aside>

        <!-- 中央工作区 -->
        <div class="app-content">
          <input ref="fileInputRef" type="file" accept=".md,text/markdown,.txt" style="display:none" @change="handleFileChosen" />
          <!-- 文档 tab 条 -->
          <div class="wb-tabbar">
            <div v-for="tab in wbTabs" :key="'t'+tab.path" class="wb-tab active" @click="onWbTabClick(tab)">
              <span v-if="isModified" class="dirty-dot" title="未保存"></span>
              <span class="wb-tab-name">{{ tab.name }}</span>
              <button class="wb-tab-close" @click.stop="closeWbTab(tab.path)">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <button class="wb-tab-add" title="新建标签页 (⌘T)" @click="doNewFile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>

          <AppMain
            :markdown-content="markdownContent"
            :sync-scroll-enabled="syncScrollEnabled"
            :view-mode="viewMode"
            :file-open-tick="fileOpenTick"
            :skin="skin"
            :platform-request="wbPlatformRequest"
            @update:markdown-content="updateMarkdownContent"
            @clear-content="clearContent"
            @load-sample="loadSample"
            @html-generated="updateHtmlContent"
            @import-markdown="triggerImportMd"
            @toggle-sync-scroll="toggleSyncScroll"
            @platform-change="onPlatformFromPreview"
          />
          <AppFooter
            :character-count="characterCount"
            :line-count="lineCount"
            :word-count="wordCount"
            :estimated-read-time="estimatedReadTime"
            :sync-scroll-enabled="syncScrollEnabled"
            :last-saved-at="(lastSavedAt && !isSaving) ? lastSavedAt : ''"
            :show-platform-links="false"
            :active-platform="currentPlatform"
            @toggle-sync-scroll="toggleSyncScroll"
          />
        </div>
      </div>
    </div>


    <!-- 全局回到顶部悬浮按钮 -->
    <BackToTopFloat />

    <!-- 草稿恢复横幅 -->
    <div v-if="showDraftBanner" class="draft-banner">
      <div class="draft-banner-content">
        <span class="draft-banner-icon">💾</span>
        <span class="draft-banner-text">
          检测到未保存的草稿
          <small v-if="draftTime">({{ draftTime }})</small>
        </span>
        <div class="draft-banner-actions">
          <button class="draft-btn recover" @click="handleRecoverDraft">恢复草稿</button>
          <button class="draft-btn discard" @click="handleDiscardDraft">丢弃</button>
        </div>
      </div>
    </div>



    <!-- 通知组件 -->
    <div v-if="notifications.length > 0" class="notification-container">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', notification.type, { 'slide-out': notification.isRemoving }]"
      >
        {{ notification.message }}
      </div>
    </div>

    <!-- 设置面板 -->
    <SettingsPanel
      :visible="showSettingsPanel"
      @close="closeSettingsPanel"
      @show-notification="showNotification"
    />

    <!-- Markdown 语法指南 -->
    <MarkdownGuide
      :show="showMarkdownGuide"
      @close="closeGuide"
    />

    <!-- 关于弹窗 -->
    <AboutDialog
      :show="showAboutDialog"
      @close="closeAbout"
    />

    <!-- 自动更新弹窗 -->
    <UpdateDialog />

  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { EventsOn } from './mygo-bridge.js'
import { App } from './mygo.ts'
import { useAppState, useWails, usePlatform, useAutoSave, useUpdater } from './composables/index.js'
import { useGlobalThemeManager } from './composables/index.js'
import { useAppSkin } from './composables/useAppSkin.js'
import { nextTick } from 'vue'
import AppMain from './components/layout/AppMain.vue'
import AppFooter from './components/layout/AppFooter.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import MarkdownGuide from './components/MarkdownGuide.vue'
import AboutDialog from './components/AboutDialog.vue'
import UpdateDialog from './components/UpdateDialog.vue'
import BackToTopFloat from './components/BackToTopFloat.vue'

// ==========================================
// 平台检测
// ==========================================
const { isMac, isWindows, isLinux, platform } = usePlatform()

// ==========================================
// 界面皮肤（native / workbench）——模块级单例，见 composables/useAppSkin.js
// ==========================================
const { skin, isWorkbench, setSkin: _setSkin } = useAppSkin()

// ==========================================
// 应用状态管理
// ==========================================
const {
  // 状态
  markdownContent,
  htmlContent,
  showSettingsPanel,
  showMarkdownGuide,
  showAboutDialog,
  syncScrollEnabled,
  viewMode,
  notifications,
  selectedCopyFormat,
  copyFormatOptions,

  // 计算属性
  hasContent,
  characterCount,
  lineCount,
  wordCount,
  estimatedReadTime,

  // 方法
  updateMarkdownContent,
  clearContent,
  loadSample,
  updateHtmlContent,
  toggleSettingsPanel,
  closeSettingsPanel,
  showGuide,
  closeGuide,
  showAbout,
  closeAbout,
  toggleSyncScroll,
  setViewMode,
  showNotification,
  handleCopyFormatSelect,
  openGithub,

  // 默认打开方式
  defaultOpenMode
} = useAppState()

// ==========================================
// 文件打开计数：每次打开文件 +1，通知 AppMain 在 WYSIWYG 模式下先切回快速预览
// （避免 Milkdown 解析新文件期间显示旧文件内容）
// ==========================================
const fileOpenTick = ref(0)

// ==========================================
// 文件拖放保护：文件拖入窗口由 Wails 原生层处理（OnFileDrop 打开文件）。
// 捕获阶段拦截 DOM 层的文件 drop/dragover，避免 ProseMirror/CodeMirror
// 把文件当作内容插入编辑器导致乱码；选中文字的拖拽（无文件）不受影响。
// ==========================================
// 判断拖拽是否携带文件（files 与 items 双保险，兼容不同拖放来源）
const isFileDrag = (dt) => {
  if (!dt) return false
  if (dt.files && dt.files.length > 0) return true
  if (dt.items) {
    for (const item of dt.items) {
      if (item.kind === 'file') return true
    }
  }
  return false
}
document.addEventListener('dragover', (e) => {
  if (isFileDrag(e.dataTransfer)) {
    // 允许拖放（显示 + 光标），实际由原生层打开文件
    e.preventDefault()
    if (e.dataTransfer.dropEffect !== undefined) e.dataTransfer.dropEffect = 'copy'
  }
}, true)
document.addEventListener('drop', (e) => {
  if (isFileDrag(e.dataTransfer)) {
    e.preventDefault()
    e.stopPropagation()
  }
}, true)

// ==========================================
// 桌面集成 (Wails)
// ==========================================
const {
  openFile,
  saveFile,
  saveFileAs,
  newFile,
  exportHTML,
  openFilePath,
  setupMenuListeners,
  setupFileDropListener,
  currentFilePath,
  currentFileName,
  isModified,
  recentFiles
} = useWails()

// ==========================================
// 自动更新
// ==========================================
const { initUpdater, checkForUpdate } = useUpdater()

// ==========================================
// 自动保存
// ==========================================
const {
  lastSavedAt,
  isSaving,
  isDraftAvailable,
  draftTime,
  recoverDraft,
  clearDraft
} = useAutoSave(markdownContent, {
  delay: 2000,
  enabled: true,
  saveToDisk: async (content) => {
    // 如果当前有已打开的文件路径，自动保存到磁盘
    if (currentFilePath.value) {
      await App.saveFile(currentFilePath.value, content).catch((e) => console.warn('自动保存失败:', e))
    }
  },
  filePath: currentFilePath
})

// ==========================================
// 草稿恢复
// ==========================================
const showDraftBanner = ref(false)

// 检测是否有草稿（在启动文件加载之后调用，避免双击打开文件时误弹“未保存草稿”提示）
function checkDraftBanner() {
  if (isDraftAvailable.value && !hasContent.value) {
    showDraftBanner.value = true
  }
}

function handleRecoverDraft() {
  const draft = recoverDraft()
  if (draft) {
    updateMarkdownContent(draft)
    showDraftBanner.value = false
    showNotification('已恢复上次编辑的草稿', 'success')
  }
}

function handleDiscardDraft() {
  clearDraft()
  showDraftBanner.value = false
}

// ==========================================
// 默认打开方式
// ==========================================
// 通过系统打开（Finder 双击 / 命令行 / 拖放 / 打开对话框）文件时，
// 切换到用户设置的默认视图模式（默认排版，可在设置中修改）
function applyDefaultOpenMode() {
  setViewMode(defaultOpenMode.value)
}

// ==========================================
// Finder 双击打开文件（MyGo: App.OnOpenFile → app:fileOpen 事件）
// ==========================================
// MyGo 的事件在页面 DOM ready 前会排队、ready 后送达（ipc.go Event.Emit 语义），
// 因此不需要旧 Wails 版 startupFile/MarkFrontendReady/GetStartupFile 手工竞态兜底。
EventsOn('app-file-open', async (filePath) => {
  if (!filePath) return
  try {
    const result = await openFilePath(filePath)
    if (result.success) {
      updateMarkdownContent(result.content)
      clearDraft()
      applyDefaultOpenMode()
      fileOpenTick.value++
      showNotification(`已打开: ${currentFileName.value}`, 'success')
    } else {
      showNotification(`无法读取文件: ${result.message}`, 'error')
    }
  } catch (e) {
    showNotification(`无法读取文件: ${e.message}`, 'error')
  }
})

// ==========================================
// 菜单监听器
// ==========================================
nextTick(async () => {
  console.log(`🖥️ 运行平台: ${platform.value}, Wails 菜单监听器初始化`)

  setupMenuListeners({
    // 新建文件
    onNewFile: () => {
      console.log('📄 菜单: 新建文件')
      if (newFile()) {
        clearContent()
        showNotification('已创建新文件', 'success')
      }
    },

    // 打开文件
    onOpenFile: async () => {
      console.log('📁 菜单: 打开文件')
      const result = await openFile()
      if (!result) {
        console.log('用户取消了操作')
        return
      }
      if (result.success) {
        updateMarkdownContent(result.content)
        clearDraft()
        applyDefaultOpenMode()
        fileOpenTick.value++
        showNotification(`已打开: ${currentFileName.value}`, 'success')
      } else {
        showNotification(`打开失败: ${result.message}`, 'error')
      }
    },

    // 保存文件
    onSaveFile: async () => {
      console.log('💾 菜单: 保存文件')
      const result = await saveFile(markdownContent.value)
      if (result.success) {
        clearDraft()
        showNotification(`已保存: ${currentFileName.value}`, 'success')
      } else {
        showNotification(`保存失败: ${result.message}`, 'error')
      }
    },

    // 另存为
    onSaveAsFile: async () => {
      console.log('💾 菜单: 另存为')
      const result = await saveFileAs(markdownContent.value)
      if (result.success) {
        clearDraft()
        showNotification(`已保存: ${currentFileName.value}`, 'success')
      } else if (result.message !== '用户取消了操作') {
        showNotification(`保存失败: ${result.message}`, 'error')
      }
    },

    // 导入文件（通过文件选择器）
    onImportFile: () => {
      triggerImportMd()
    },

    // 视图切换
    onViewBoth: () => setViewMode('both'),
    onViewEditor: () => setViewMode('editor'),
    onViewPreview: () => setViewMode('preview'),
    onToggleSyncScroll: () => toggleSyncScroll(),

    // 面板
    onToggleSettings: () => toggleSettingsPanel(),
    onShowGuide: () => showGuide(),
    onShowAbout: () => showAbout(),
    onCheckUpdate: () => checkForUpdate(true),

    // 导出 HTML
    onExportHTML: async () => {
      console.log('🌐 菜单: 导出 HTML')
      if (!htmlContent.value) {
        showNotification('预览尚未生成，请等待渲染完成', 'warning')
        return
      }
      const result = await exportHTML(htmlContent.value, '')
      if (result && result.success) {
        showNotification(`已导出: ${result.filePath.split('/').pop()}`, 'success')
      } else if (result && result.message !== '用户取消了操作') {
        showNotification(`导出失败: ${result.message}`, 'error')
      }
    }
  })

  // 文件拖放支持
  setupFileDropListener(async (filePath) => {
    try {
      const result = await openFilePath(filePath)
      if (result.success) {
        updateMarkdownContent(result.content)
        clearDraft()
        applyDefaultOpenMode()
        fileOpenTick.value++
        showNotification(`已拖放打开: ${currentFileName.value}`, 'success')
      } else {
        showNotification(`无法读取文件: ${result.message}`, 'error')
      }
    } catch (e) {
      showNotification(`无法读取文件: ${e.message}`, 'error')
    }
  })

  // 启动静默检查更新：延迟执行，不阻塞启动
  await initUpdater()

  // MyGo 迁移说明：Finder 双击打开的文件由 app:fileOpen 事件送达（DOM ready 前
  // 自动排队），不再需要 MarkFrontendReady/GetStartupFile 拉取式兜底。
  // 草稿检测照常：若随后有文件打开事件到来，监听器会 clearDraft。
  checkDraftBanner()
})

// ==========================================
// 主题管理器
// ==========================================
useGlobalThemeManager()

// MyGo 迁移：窗口拖拽由框架原生处理（CSS `--app-region: drag`，bridge capture 阶段
// 判定 + 交互元素豁免）。双击拖拽条进入/退出 macOS 原生全屏：
let _lastFullToggleAt = 0
// MyGo bridge 在 capture 阶段对 drag 区按下 preventDefault（internal/bridge/bridge.js，
// v0.10.0 逐字节核对），WKWebView 下这会同时抑制页面 dblclick 的合成——所以不能用
// @dblclick。但 mousedown 本身仍会到达 JS 且 e.detail 携带 WebKit 点击计数
// （第二击 detail===2），据此判定双击最可靠。preventDefault 也抑制了框架默认的
// performZoom 系统路径，不会出现 zoom+全屏双触发；万一实测两路都通，
// _lastFullToggleAt 800ms 节流兜底。
const onDragStripMouseDown = (e) => {
  if (e.button !== 0 || e.detail !== 2) return
  const now = Date.now()
  if (now - _lastFullToggleAt < 800) return
  _lastFullToggleAt = now
  App.toggleFullScreen().catch((err) => console.warn('切换全屏失败:', err))
}

// ==========================================
// 导入 .md 文件（通过浏览器文件选择器）
// ==========================================
const fileInputRef = ref(null)
const triggerImportMd = () => fileInputRef.value && fileInputRef.value.click()

const handleFileChosen = async (e) => {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (!/\.(md|markdown)$/i.test(file.name) && !/text\/markdown|text\/plain/.test(file.type)) {
    showNotification('仅支持导入 .md 文件', 'warning')
    return
  }
  try {
    const text = await file.text()
    updateMarkdownContent(text)
    clearDraft()
    showNotification(`已导入：${file.name}`, 'success')
  } catch (err) {
    showNotification(`导入失败：${err.message}`, 'error')
  }
}

// ==========================================
// 皮肤（skin）派生状态与导航动作
// - workbench 的"当前文档"就是 AppMain 渲染的活动文件；tab/rail 点击只做
//   视图切换与打开动作，不引入多文档实例（那属于后续任务）。
// ==========================================
// unified toolbar / rail 共用的视图模式（分段控件三档 → viewMode 四态映射）
const segModes = [
  { key: 'both', mode: 'both', label: '分栏' },      // TODO(i18n): 文案归 task-9 locales
  { key: 'source', mode: 'editor', label: '源码' },
  { key: 'layout', mode: 'wysiwyg', label: '排版' }
]
const activeSegKey = computed(() => {
  const found = segModes.find((m) => m.mode === viewMode.value)
  return found ? found.key : 'both'
})
const setSegMode = (mode) => setViewMode(mode)

// workbench tab 点击：切到该文档对应视图（活动文件即当前编辑器内容，
// 重复点击仅确保回到分栏/排版可见态；不引入多文档实例）
const onWbTabClick = () => { if (viewMode.value !== 'both') setViewMode('both') }

// workbench 主 CTA / 同步开关颜色跟随激活平台（--plat-accent 在 tokens.css 默认绿，此处覆盖）
const PLAT_COLORS = { wechat: ['#07C160', '7, 193, 96'], xiaohongshu: ['#FF2442', '255, 36, 66'], zhihu: ['#0084FF', '0, 132, 255'] }
const wbPlatVars = computed(() => {
  const [c, rgb] = PLAT_COLORS[currentPlatform.value] || PLAT_COLORS.wechat
  return { '--plat-accent': c, '--plat-accent-rgb': rgb }
})

// 平台分发选项（公众号/小红书/知乎）：native 导出 split menu + workbench CTA/预览 tab 共用
const PLATFORM_OPTIONS = [
  { value: 'wechat', label: '公众号', shortcut: '⌘1' },
  { value: 'xiaohongshu', label: '小红书', shortcut: '⌘2' },
  { value: 'zhihu', label: '知乎', shortcut: '⌘3' }
]
// PreviewPane(v-if 重建) 激活时把其平台选择回传到顶栏 CTA；
// wbPlatformRequest：⌘1/2/3 快捷键向 PreviewPane 下发的请求（prop watch 应用）
const platformFromPreview = ref(null)
const wbPlatformRequest = ref('wechat')
const currentPlatform = computed({
  get: () => platformFromPreview.value || 'wechat',
  set: (v) => { platformFromPreview.value = v }
})
const onPlatformFromPreview = (p) => { platformFromPreview.value = p; wbPlatformRequest.value = p }
watch(wbPlatformRequest, (p) => { platformFromPreview.value = p })

// workbench 顶部 tab：活动文档 = 当前打开文件；未命名虚拟一个"草稿"tab
const wbTabs = computed(() => {
  const name = currentFileName.value || '未命名草稿' // TODO(i18n)
  return [{ path: currentFilePath.value || '', name }]
})

// native sidebar「最近打开」
const recentRows = computed(() => {
  const list = Array.isArray(recentFiles.value) ? recentFiles.value : []
  return list.slice(0, 12).map((f) => ({
    path: f.path,
    name: f.name || String(f.path || '').split('/').pop(),
    time: formatRecentTime(f.openedAt)
  }))
})
function formatRecentTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const dayDiff = Math.floor((now.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / 86400000)
  if (dayDiff <= 0) return d.getHours() < 12 ? '刚刚' : `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  if (dayDiff === 1) return '昨天'
  const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return wd // TODO(i18n)
}

// 「文档」分组 = 当前打开的文件（单文档模型；多文档列表归后续任务）
const docRows = computed(() => {
  if (!currentFileName.value) return []
  return [{ path: currentFilePath.value, name: currentFileName.value, badge: 'MD' }]
})

const openRecentOrCurrent = async (path) => {
  if (!path) return
  try {
    const r = await openFilePath(path)
    if (r && r.success) {
      updateMarkdownContent(r.content)
      clearDraft()
      applyDefaultOpenMode()
      fileOpenTick.value++
      showNotification(`已打开: ${currentFileName.value}`, 'success')
    } else {
      showNotification(`无法读取文件: ${(r && r.message) || '未知错误'}`, 'error')
    }
  } catch (e) {
    showNotification(`无法读取文件: ${e.message}`, 'error')
  }
}

// 新建（复用菜单逻辑，无桌面环境时降级为清空）
const doNewFile = () => {
  if (newFile()) {
    clearContent()
    showNotification('已创建新文件', 'success')
  }
}

// rail 面板语义：本次迭代仅 文档库(默认)/设置 两档可用，其余占位
const wbPanel = ref('docs')            // 'docs' | 'templates' | 'history'
const showWbPanel2 = ref(true)
const railSections = [
  { id: 'new', title: '新建', action: doNewFile },                 // TODO(i18n)
  { id: 'docs', title: '文档库', panel: 'docs' },
  { id: 'templates', title: '模板', panel: 'templates' },
  { id: 'history', title: '历史', panel: 'history' },
  { id: 'settings', title: '设置', action: () => toggleSettingsPanel() }
]
const onRailClick = (sec) => {
  if (sec.action) { sec.action(); return }
  if (sec.panel === wbPanel.value && showWbPanel2.value) {
    // 再点一次收起第二列（折叠侧栏 ⌘B 语义）
    showWbPanel2.value = false
    return
  }
  wbPanel.value = sec.panel
  showWbPanel2.value = true
  if (sec.panel !== 'docs') {
    // 模板库/历史版本尚未实现：占位提示，保持文档库数据可见性一致
    showNotification(`${sec.title}即将推出`, 'info') // TODO(i18n)
  }
}
const collapsePanel2 = () => { showWbPanel2.value = false }

// 第二列面板标题与搜索过滤
const panelSearch = ref('')
const railPanelTitle = computed(() => {
  const map = { docs: '文档库', templates: '模板库', history: '历史版本' } // TODO(i18n)
  return map[wbPanel.value] || '文档库'
})
const filteredRecent = computed(() => {
  const q = panelSearch.value.trim().toLowerCase()
  if (!q) return recentRows.value
  return recentRows.value.filter((f) => f.name.toLowerCase().includes(q))
})

// 顶栏弹出菜单开关；document 捕获阶段兜底关闭（点击菜单与 caret 触发器之外区域时收起，
// 修复 split button 主按钮点击后 caret 区 hover/事件引发的重开竞态）
const showExportMenu = ref(false)
const showDocMenu = ref(false)
const onDocPointerDown = (e) => {
  if (!showExportMenu.value && !showDocMenu.value) return
  const t = e.target
  if (t.closest && (t.closest('.export-split-wrap') || t.closest('.docsw-wrap'))) return
  showExportMenu.value = false
  showDocMenu.value = false
}
window.addEventListener('pointerdown', onDocPointerDown, true)
onBeforeUnmount(() => window.removeEventListener('pointerdown', onDocPointerDown, true))

// native 导出 split：选平台 → 经 AppMain 下发给 PreviewPane（版心/强调色跟随），
// 再把 platform 一路传进 handleCopyFormatSelect → copySocialFormat
// （此前复制管线无平台维度，三平台产物与 toast 完全相同）。
const pickPlatformAndCopy = (p) => {
  wbPlatformRequest.value = p
  currentPlatform.value = p
  nextTick(() => {
    handleCopyFormatSelect({ value: 'social', platform: p })
  })
}

// 顶栏主"导出"CTA / workbench"复制排版"：按当前激活平台复制。
// workbench 皮肤下优先点 PreviewPane 的平台复制按钮（其内部持有 platKey）；
// 找不到时回落 App 层路径，并带上 currentPlatform。
const copyCurrentPlatformFormat = () => {
  const btn = document.querySelector('.pp-plat-copy')
  if (btn) {
    btn.click()
    return
  }
  if (!hasContent.value) {
    showNotification('请先编辑内容', 'warning') // TODO(i18n)
    return
  }
  const format = selectedCopyFormat.value || { value: 'social' }
  handleCopyFormatSelect({ ...format, platform: currentPlatform.value })
}

// workbench tab 关闭：仅活动"未命名草稿"可关（等价新建）；已存盘文件关闭回到空态
const closeWbTab = (path) => {
  if (!path) { doNewFileSoft() } else { doNewFile() }
}
function doNewFileSoft() { clearContent() }

// 导出 HTML（unified toolbar / CTA split 菜单项，复用菜单通道逻辑）
const onExportHTMLClick = async () => {
  if (!htmlContent.value) {
    showNotification('预览尚未生成，请等待渲染完成', 'warning')
    return
  }
  const result = await exportHTML(htmlContent.value, '')
  if (result && result.success) {
    showNotification(`已导出: ${(result.filePath || '').split('/').pop()}`, 'success')
  } else if (result && result.message !== '用户取消了操作') {
    showNotification(`导出失败: ${result.message}`, 'error')
  }
}

// 键盘快捷键（workbench 设计稿承诺的 ⌘1/⌘2/⌘3 平台切换、⌥S 同步滚动；
// 全局监听仅 workbench 皮肤启用，避免影响 native 既有行为）
const onGlobalKeydown = (e) => {
  if (!isWorkbench.value) return
  const meta = e.metaKey || e.ctrlKey
  if (!meta) return
  if (e.shiftKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault()
    copyCurrentPlatformFormat()
    return
  }
  if (e.altKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    toggleSyncScroll()
    return
  }
  if (!e.shiftKey && !e.altKey) {
    const idx = ['1', '2', '3'].indexOf(e.key)
    if (idx >= 0) {
      e.preventDefault()
      // ⌘1/2/3：切平台并复制（设计稿承诺"选平台即出该平台的稿"；
      // wbPlatformRequest 经 AppMain 中转到 PreviewPane，tab DOM 可能因 v-if 重建不存在）
      pickPlatformAndCopy(PLATFORM_OPTIONS[idx].value)
    }
  }
}
// PreviewPane 平台复制结果 → 复用 App 通知通道（避免新增跨组件信号面）
const onSkinToast = (e) => {
  const d = e.detail || {}
  if (d.message) showNotification(d.message, d.type || 'info')
}
window.addEventListener('keydown', onGlobalKeydown)
window.addEventListener('weditor-skin-toast', onSkinToast)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('weditor-skin-toast', onSkinToast)
})

// 拖拽区按下：交互元素豁免（rail/tabbar/sidebar 内容均为 no-drag，命中即放行）
// 双击全屏判定沿用 detail===2 方案（见上方 onDragStripMouseDown 注释）。
</script>

<style scoped>
/* 导入原来的样式 */
@import './styles/components/layout/app-layout.css';
@import './styles/components/notifications.css';
/* UI 皮肤层说明：token/chrome 由 main.js 全局导入（styles/skins/*.css）；
   scoped 内 @import 会给选择器加 scope 属性而破坏 html[data-skin] token 挂接。 */


/* ============================================================
   布局分支说明（task-8 双皮肤系统）
   - native    ：46px unified toolbar 整条即窗口拖拽区（--app-region:drag），
                 交互控件各自 no-drag；双击全屏走 onDragStripMouseDown。
   - workbench ：52px 标题栏同样整条可拖拽 + 同一双击全屏处理器。
   旧的 fixed .window-drag-strip 覆盖层已移除（两皮肤顶栏自带拖拽语义）。
   ============================================================ */

/* 右侧主内容区域 */
.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.skin-toolbar :deep(.pop-menu) { z-index: 70; }

/* 顶栏右侧工具群定位到最右 */
.tb-right-group { margin-left: auto; }
.seg-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.export-split-wrap { position: relative; display: flex; align-items: center; }
.pop-menu-right { right: 0; }
.docsw-wrap { position: relative; display: flex; }
.wb-seg { /* workbench 分段控件保持文档流居中约束由 .seg-center 提供 */ }

/* 通知容器样式调整 */
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 草稿恢复横幅 */
.draft-banner {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  background: var(--theme-primary, #4A90D9);
  color: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  animation: draft-slide-in 0.3s ease-out;
  max-width: 500px;
  /* 横幅悬浮于顶部，自身及其按钮不参与窗口拖拽 */
  -webkit-app-region: no-drag;
}

.draft-banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
}

.draft-banner-icon {
  font-size: 18px;
}

.draft-banner-text {
  flex: 1;
  font-size: 14px;
}

.draft-banner-text small {
  opacity: 0.8;
  font-size: 12px;
}

.draft-banner-actions {
  display: flex;
  gap: 8px;
}

.draft-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.draft-btn.recover {
  background: white;
  color: var(--theme-primary, #4A90D9);
}

.draft-btn.recover:hover {
  background: #f0f0f0;
}

.draft-btn.discard {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.draft-btn.discard:hover {
  background: rgba(255, 255, 255, 0.35);
}

@keyframes draft-slide-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

</style>
