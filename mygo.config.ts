import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "WEditor",
  identifier: "com.tianjun.weditor",
  version: "1.0.0",
  devUrl: "http://localhost:5173",
  devCommand: "npm --prefix frontend run dev",
  buildCommand: "npm --prefix frontend run build",
  frontendDist: "frontend/dist",
  bindings: "frontend/src/mygo.ts",
  out: "build",
  // Finder 双击 .md/.txt 打开（映射为 Info.plist CFBundleDocumentTypes，走 App.OnOpenFile）
  fileAssociations: [
    { ext: ["md", "markdown", "mdown", "mkd"], name: "Markdown Document", mimeType: "text/markdown", role: "Editor" },
    { ext: ["txt"], name: "Text File", mimeType: "text/plain", role: "Editor" },
  ],

  macos: {
    infoPlist: {
      // 与 Wails 版对齐：强制深色外观（NSAppearanceNameDarkAqua）。
      // MyGo 无 Appearance API，Info.plist 是官方认可的补齐路径。
      NSRequiresAquaSystemAppearance: false,
    },
  },
});
