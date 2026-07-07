<p align="center">
  <img src="assets/logo.svg" alt="envxray" width="96" height="96" />
</p>

<h1 align="center">envxray</h1>

<p align="center"><b>在 .env 拖垮生产之前给它拍片。已提交的密钥、未声明的读取、无用的配置——都在浏览器里查出来。</b></p>

<p align="center">
  <a href="README.md">🇺🇸 English</a> · <a href="README.id.md">🇮🇩 Bahasa Indonesia</a> · 🇨🇳 简体中文
</p>

<p align="center"><a href="https://ryanda9910.github.io/envxray/"><b>→ 打开工具</b></a></p>

两类 env 问题反复上线：密钥留在已提交的 `.env` 里，以及代码读取了某个
`process.env.X` 却没人把它写进 `.env`——于是生产环境启动时是 `undefined`，
在最糟的时刻崩溃。`.env.example` 本该防住后者，但它总是过期。

envxray 拿你的 `.env` 和读取它的代码做交叉核对，告诉你到底哪里有问题：哪些像
**真实的已提交密钥**、哪些被**读取却未声明**、哪些**声明了却从未读取**（无用配置或拼写错误）、
哪些密钥名的值是**空的**。然后为你生成一份干净、已脱敏的 `.env.example`。
全部在浏览器中运行——你的 `.env` 和代码永远不会离开标签页，不会上传到服务器。

## 检出内容

- 🔴 **已提交密钥** — `.env` 里像真实密钥的值（`sk_live_…`、`ghp_…`、JWT、PEM、长随机串）
- 🔴 **读取但未声明** — 代码里有 `process.env.X`，`.env` 里却没有 → 生产环境为 `undefined`
- 🟡 **无用配置** — 声明了却从未读取（遗留或拼写错误）
- 🟡 **空密钥** — `*_SECRET`/`*_TOKEN`/`*_KEY` 值为空 → 用空凭证启动
- ✅ **自动生成 `.env.example`** — 所有变量，值已脱敏，可直接提交

支持 JS/TS、Deno、Python、Ruby、PHP 以及 shell/docker-compose 的环境变量读取。

## 刻意保持低误报

占位值（`your-api-key`、`changeme`、`xxxx`、`<password>`）不会被当作密钥。
`PORT=3000` 不是密钥。不粘贴代码时只运行已提交密钥检查——不会臆造无法验证的漂移问题。

打开**[工具](https://ryanda9910.github.io/envxray/)**并粘贴。无需构建、无需账号、无需上传。加载后可离线运行。

## 许可证

MIT。
