/**
 * @file src/main.js
 * @description 应用主入口文件
 *
 * 这是整个 Vue 应用的起点。它的职责非常清晰和集中：
 * 1.  **创建 Vue 应用实例**: 调用 Vue 3 的 `createApp` 函数，并传入根组件 `App.vue`，
 *     从而创建一个新的 Vue 应用实例。
 * 2.  **导入全局样式**: 导入项目所需的全局 CSS 文件。
 *     - `global.css`: 包含整个应用范围内的基础样式、重置（reset）、CSS 变量定义等。
 *     - `components/index.css`: 这是一个集中的入口，用于导入所有组件级别的 CSS 文件。
 *       这种模式有助于保持 `main.js` 的整洁，将组件样式的管理委托给 CSS 文件本身。
 * 3.  **挂载应用**: 调用 `app.mount('#app')`，将 Vue 应用实例挂载到 `index.html` 文件中
 *     ID 为 `app` 的 DOM 元素上。这是将 Vue 应用渲染到页面上的最后一步。
 *
 * 这个文件遵循了现代前端框架（如 Vue、React）的典型入口文件模式，即保持最小化，
 * 只做最核心的初始化工作，而将具体的业务逻辑、路由、状态管理等委托给其他模块。
 */

import { createApp } from 'vue';
import App from './App.vue';

// 导入主题预加载器（必须在其他样式之前导入，防止主题闪烁）
import './core/theme/theme-loader.js';

// UI 皮肤层（task-8）：token/chrome 必须最先于组件样式导入，供 html[data-skin] 选择器接管。
// 业务 CSS 引用 --skin token；两套皮肤差异在各自覆盖段内。
import './styles/skins/tokens.css';
import './styles/skins/base.css';
import './styles/skins/native.css';
import './styles/skins/workbench.css';

// 导入全局 CSS
// `theme-root.css` 定义主题变量与按系统引入
import './styles/themes/theme-root.css';
// `global.css` 定义了应用的整体基础样式和设计令牌
import './styles/global.css';
// `components/index.css` 作为组件样式的统一入口
import './styles/components/index.css';
import './styles/prism-variables.css';

// i18n
import { i18n } from './plugins/i18n.js'

// 皮肤系统（task-8）：useAppSkin 模块级单例；init() 在挂载后调用
// （#app 的 :data-skin 绑定要求 DOM 就绪；FOUC 由 theme-loader.js 预写 html[data-skin] 兜底）
import { useAppSkin } from './composables/useAppSkin.js';

// 创建 Vue 应用实例
const app = createApp(App);

// 安装插件
app.use(i18n)

// 将应用挂载到 DOM 中 ID 为 'app' 的元素上
app.mount('#app');

// 恢复持久化皮肤 + 注册系统明暗监听 + 同步 <html>/<#app> data-skin
useAppSkin().init();
