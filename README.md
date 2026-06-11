# 🔐 Krypton Vault — 个人密码管理器

一个**精美、安全、纯前端**的密码管理器。采用 **Glassmorphism（玻璃拟态）** 设计风格，所有数据经过 **AES-256-GCM** 加密后存储在浏览器本地。

## ✨ 功能特性

- 🔒 **AES-256-GCM 加密** — 使用 Web Crypto API，密码学级别安全
- 🪟 **玻璃拟态 UI** — 毛玻璃效果、动态渐变背景、流畅动画
- 🔑 **主密码保护** — PBKDF2 密钥派生（60万次迭代）
- 🏷️ **分类管理** — 社交/邮箱/金融/工作/其他
- 🔍 **实时搜索** — 按名称、用户名、网址快速定位
- 🎲 **密码生成器** — 可自定义长度和字符类型
- ⏱️ **自动锁定** — 可设置超时自动锁定保护
- 📤 **数据导出/导入** — JSON 格式备份与恢复
- 📋 **一键复制** — 用户名和密码快速复制
- 📱 **响应式设计** — 完美适配桌面和移动端
- ⌨️ **键盘快捷键** — `Ctrl+N` 新增，`Ctrl+L` 锁定
- ✏️ **自定义名称** — 点击标题可直接编辑保险库名称

## 🚀 部署到 Cloudflare Pages

### 方式一：通过 GitHub 自动部署（推荐）

1. 将此项目推送到你的 GitHub 仓库：

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages** → **Pages**
4. 点击 **连接到 Git**，选择你的 GitHub 仓库
5. 构建设置：
   - **构建命令**：留空（纯静态站点无需构建）
   - **输出目录**：`/`（根目录）
6. 点击 **保存并部署**

部署完成后，Cloudflare 会给你一个 `xxxxx.pages.dev` 的域名，全球 CDN 加速访问。

### 方式二：直接上传

1. 进入 Cloudflare Pages，选择"直接上传"
2. 将整个项目文件夹拖入上传区域
3. 部署即可

## 📁 项目结构

```
krypton-vault/
├── index.html          # 主页面
├── css/
│   └── style.css       # 玻璃拟态样式
├── js/
│   └── app.js          # 核心逻辑（加密/解密/管理）
└── README.md
```

## 🔐 安全说明

- **所有数据存储在浏览器 `localStorage` 中**，不上传任何服务器
- 使用 **PBKDF2** 从主密码派生密钥（60万次迭代，SHA-256）
- 使用 **AES-256-GCM** 加密所有密码数据
- 主密码**绝不存储**，仅用于密钥派生
- 解锁后主密码仅在**内存**中保留（用于重加密）

> ⚠️ **重要提示**：
> - 主密码是唯一凭证，**无法找回**
> - 建议定期导出备份文件并妥善保管
> - 清除浏览器数据将导致保险库丢失

## 🛠️ 技术栈

- 纯 HTML / CSS / JavaScript
- Web Crypto API（AES-GCM + PBKDF2）
- 零依赖，无需任何框架或库
- 兼容所有现代浏览器（Chrome/Firefox/Safari/Edge）

## 📄 License

MIT — 自由使用
