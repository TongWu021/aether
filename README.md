# Aether

AI 产品经理工作驾驶舱 — 本地运行的 Electron 桌面应用，统一管理工作文件、对话记忆和 AI 协作流程。

## 给试用同事：安装 / 更新

> 适用于 Apple Silicon Mac（M1/M2/M3/M4）。Intel Mac 暂未支持。

把下面这条命令贴给 Codex（或任何能跑 shell 的 AI 助手）即可：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/TongWu021/aether/main/install.sh)
```

它会自动下载最新 release、装到 `/Applications/Aether.app`、去掉 macOS 的 Gatekeeper 隔离标记。**同样一条命令既负责首次安装，也负责后续更新**。

App 内会在新版本发布后自动检测并提示，复制命令再让 Codex 跑一次即可。

---

## 开发

```bash
npm install
npm run dev
```

### 类型检查 & 打包

```bash
npm run typecheck
npm run build:mac     # 本地构建（输出到 dist/）
```

### 发布新版本

1. 改 `package.json` 里的 `version`
2. `git tag v<新版本号> && git push origin v<新版本号>`
3. GitHub Actions 自动构建 arm64 dmg 并发布到 Releases

详细架构与开发约束见 `CLAUDE.md` 与 `Aether架构.md`（仓库根目录之外）。
