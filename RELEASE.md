# 发布新版本

> 这个文档专门给"忘了怎么发版"的你。两步走完事。

## 日常发版（最常见）

```bash
# 1. 提交你改的代码
git commit -am "feat: xxx"        # 或 fix:、refactor: 等
git push

# 2. 发版
npm run release
```

完事。剩下 GitHub Actions 自动跑（10-15 分钟），同事打开 Aether 就会看到顶部 banner 提示新版本。

监控构建进度：https://github.com/TongWu021/aether/actions

---

## `npm run release` 到底做了什么

一行命令拆开是这些：

1. `npm version patch` —— 把 package.json 的 version 从 `0.1.0` bump 成 `0.1.1`
2. 自动 commit：`chore: release v0.1.1`
3. 自动打 git tag：`v0.1.1`
4. `git push --follow-tags` —— 把 commit + tag 一起推到 GitHub
5. GitHub 检测到 `v*` tag，自动触发 `.github/workflows/release.yml`
6. workflow 在 macOS runner 上 build 出 arm64 dmg，自动创建 Release 并上传
7. 同事打开 App，启动 3 秒后调 GitHub API 比对版本，发现新的就弹 banner

---

## 三种 release 的区别（语义化版本）

| 命令 | 版本变化 | 什么时候用 |
|------|---------|------------|
| `npm run release` | 0.1.0 → 0.1.**1** (patch) | 修 bug、小调整 — **99% 用这个** |
| `npm run release:minor` | 0.1.0 → 0.**2**.0 (minor) | 新功能上线 |
| `npm run release:major` | 0.1.0 → **1**.0.0 (major) | 不兼容老版本的重大改动 |

alpha 阶段先全部用 `patch` 就好。

---

## 常见报错

### `Git working directory not clean`
你还有没提交的修改。先 `git commit -am "..."` 然后再 `npm run release`。

### `tag 'vX.Y.Z' already exists`
你试图发一个已经存在的版本号。先看 `git tag -l` 列表，删掉本地遗留 tag：`git tag -d vX.Y.Z`，或者直接 `npm run release` bump 到下一个号。

### Actions 构建失败
打开 https://github.com/TongWu021/aether/actions 看哪一步红。常见原因：
- TypeScript 类型错误：本地 `npm run typecheck` 跑一下看
- electron-builder 报错：贴日志给 Claude

---

## 给同事发的话术

> 帮我装一下 Aether（仅 M 系列 Mac），让 Codex 跑这条命令：
> ```
> bash <(curl -fsSL https://raw.githubusercontent.com/TongWu021/aether/main/install.sh)
> ```
> 装完去 Launchpad 找 Aether 打开。以后我发新版你 App 里会自动弹提示。

---

## 懒人模式

跟 Claude Code 说一句 "**发新版本**"，它会：
1. 检查未提交的修改、帮你 commit
2. 跑 `npm run release`
3. 在后台盯 Actions
4. 完成时通知你

完全不用记任何命令。
