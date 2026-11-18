# WEditor (MyGo Edition)

macOS 桌面 Markdown 排版编辑器 —— **一键把 Markdown 转成可直接粘贴到公众号 / 小红书 / 知乎的排版内容**。

本项目是从 [Wails v2 版 WEditor](https://github.com/vpertj/Weditor) 迁移到 [MyGo](https://github.com/egoist/mygo) 框架的重写版：纯 Go 无 cgo、无内嵌 HTTP server（`mygo://` 协议直出资源）、原生窗口体验。

## ✨ 特性

- **三种工作模式**：分栏（源码+实时预览）／纯源码（CodeMirror 6）／排版（Milkdown 所见即所得）
- **多平台一键分发**：复制即得公众号 / 小红书 / 知乎各自规范的内联样式 HTML，Mermaid 图表离线渲染
- **双皮肤主题**（设置 → 界面风格，即时切换）：
  - 🍎 **原生血统** — Apple HIG / Xcode vibrancy 材质、unified toolbar、系统蓝强调（默认）
  - 🛠 **创作者工作台** — Raycast 深色风、图标导航 rail、三平台预览 tab 换肤分发
  - 支持"跟随系统明暗自动切换"（浅色→原生 / 深色→工作台）
- **桌面深度集成**：Finder 双击 `.md` 冷启动直达、文件拖放打开、拖拽标题栏移动、双击标题栏进全屏、最近文件、窗口状态记忆
- 自动保存草稿、字数/阅读时长统计、同步滚动、HTML 导出、Markdown 语法指南、自动更新
- 中英双语界面

## 🏗 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | [MyGo v0.10](https://github.com/egoist/mygo)（Go + WKWebView，typed IPC） |
| 前端 | Vue 3 + Vite（JavaScript） |
| 编辑器 | CodeMirror 6（源码）＋ Milkdown/ProseMirror（排版） |
| 渲染 | markdown-it + Prism + Mermaid（懒加载分包） |
| 后端 | Go 1.27，约 1.7k 行（文件 IO / 对话框 / 菜单 / 自研 updater） |

## 🚀 开发

```bash
# 环境要求：Go ≥1.27（toolchain 自动切换）、Node ≥22、npm
npm install && npm --prefix frontend install

npx mygo dev          # 开发模式：Vite 热更新 + app live reload
npx mygo generate     # 重新生成前端 typed client（frontend/src/mygo.ts）
npx mygo build        # 打包 .app + .dmg 到 build/darwin-arm64/
```

## 📦 发布

推送 tag 即可由 Gitea/GitHub Actions 触发（待接入 CI），或本地：

```bash
npx mygo build -platform darwin/universal
```

产物为 ad-hoc 签名；分发 Developer ID 需在 `mygo.config.ts` 配置证书与 notarize。

## 🗂 结构速览

```
main.go            窗口/菜单/事件声明           app.go             前端绑定服务（BINDINGS.md 契约）
updater*.go        自研检查/下载/校验/替换       version.go         版本信息
frontend/          Vue3 应用（src/composables/useAppSkin.js 皮肤系统；
                   src/styles/skins/*.css token 层；src/mygo.ts 生成的 typed client）
design/mockups/    UI 设计稿（B/D 两版高保真 HTML+PNG，皮肤验收基准）
docs/research/     MyGo 迁移可行性评估报告
```

## ⚠️ 已知边界

- 多文档 tab、⌘K 命令面板、模板库/历史 rail 目前为占位（见 mockups 设计意图）
- 皮肤 workbench 下 CodeMirror 表面为全局暗色适配，与深色"颜色主题"叠加时观感一致但来源不同
