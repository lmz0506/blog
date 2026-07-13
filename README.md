# 个人博客 & 知识库系统

[![Language](https://img.shields.io/badge/Jekyll-4.3-blue)](https://jekyllrb.com/)
[![License](https://img.shields.io/github/license/en-o/blog)](https://github.com/en-o/blog)
[![GitHub stars](https://img.shields.io/github/stars/en-o/blog?style=social)](https://github.com/en-o/blog)

基于 Jekyll 构建的现代化个人博客和知识库系统，配备完整的可视化管理平台。

## ✨ 特性

- 🎨 **现代化设计** - 渐变色、毛玻璃效果、流畅动画
- 📱 **响应式布局** - 完美适配桌面端和移动端
- 📚 **知识库系统** - 支持分类、标签、目录的文档管理
- 💭 **碎碎念** - 时间轴样式的微博客功能
- 🔗 **友链管理** - 优雅的友情链接展示
- 🎯 **可视化管理** - 完整的 Web 管理后台
- 🚀 **GitHub Pages** - 一键部署，免费托管

## 📸 预览

访问地址: https://doc.limverse.com/](https://doc.limverse.com/)

## 🚀 快速开始

### 环境要求

- Ruby 3.0+
- Node.js 14+ (用于管理平台)
- Git

### 安装步骤

#### 1. Windows 环境安装 Jekyll

```bash
# 1. 下载安装 Ruby+Devkit
# 访问 https://rubyinstaller.org/downloads/
# 下载 Ruby+Devkit 3.2.X (x64)

# 2. 安装时勾选 "Add Ruby executables to your PATH"
# 安装完成后选择 3 安装 MSYS2

# 3. 验证安装
ruby -v
gem -v

# 4. 安装 Bundler
# 换 gem 源
# gem sources --remove https://rubygems.org/
# gem sources --add https://mirrors.tuna.tsinghua.edu.cn/rubygems/
# gem sources -l          # 确认只剩一个国内源
gem install bundler
```

#### 2. 克隆项目并安装依赖

```bash
# 克隆仓库
git clone https://github.com/en-o/blog.git
cd blog

# 安装 Jekyll 依赖
# 让 Bundler 也走 gem 同一镜像
# bundle config mirror.https://rubygems.org https://mirrors.tuna.tsinghua.edu.cn/rubygems
# 加 --full-index 一次性拉取索引，减少小请求
bundle install
```

#### 3. 本地运行

```bash
# 启动 Jekyll 服务
# bundle exec jekyll serve --host=0.0.0.0
# 想永久生效，在 _config.yml 里加
# host: 0.0.0.0
# port: 4000
bundle exec jekyll serve

# 访问 http://localhost:4000
```

## 🎯 可视化管理平台

本项目提供了功能强大的可视化管理平台，无需手动编辑文件即可管理所有内容。

### 启动管理平台

```bash
# 1. 进入管理平台目录
cd admin

# 2. 安装依赖（首次使用）
npm install

# 3. 启动管理平台
npm start
```

访问：[http://localhost:3001](http://localhost:3001)

### 管理平台功能

| 功能模块          | 说明                   |
| ------------- | -------------------- |
| 🏠 **首页管理**   | 管理个人信息、技能栈、项目展示、当前在做 |
| 📝 **页面管理**   | 可视化新增、编辑、删除页面        |
| 📚 **文档管理**   | 管理知识库文档，支持分类和标签      |
| 💾 **数据管理**   | 管理友链和碎碎念数据           |
| ⚙️ **配置管理**   | 网站基础信息、图标、页脚等配置      |
| 🔄 **Git 操作** | 查看状态、提交更改、推送到 GitHub |

详细使用说明：[admin/README.md](admin/README.md)

## 📁 项目结构

```
blog/
├── pages/                # 📄 页面文件
│   ├── links.md         # 友链页面
│   ├── docs.md          # 知识库页面
│   └── thoughts.md      # 碎碎念页面
├── _layouts/            # 🎨 布局模板
│   ├── default.html     # 默认布局
│   ├── page.html        # 页面布局
│   └── doc.html         # 文档布局（含目录）
├── _includes/           # 🧩 可复用组件
│   ├── header.html      # 头部导航
│   └── footer.html      # 页脚
├── _data/               # 💾 数据文件
│   ├── profile.yml      # 个人信息
│   ├── projects.yml     # 项目数据
│   ├── links.yml        # 友链数据
│   └── thoughts.yml     # 碎碎念数据
├── _docs/               # 📚 知识库文档集合
│   ├── frontend/        # 前端开发文档
│   ├── backend/         # 后端开发文档
│   ├── devops/          # DevOps 文档
│   └── JAVA/            # Java 文档
├── assets/              # 🎨 静态资源
│   ├── css/
│   │   └── style.css    # 主样式文件
│   └── images/          # 图片资源
├── admin/               # 🎯 管理平台
│   ├── routes/          # API 路由
│   ├── public/          # 前端界面
│   └── server.js        # 服务器入口
├── index.md             # 🏠 首页
├── 404.md               # 404 页面
├── _config.yml          # ⚙️ Jekyll 配置
└── README.md            # 📖 项目说明
```

## 📝 内容管理

### 方式一：使用管理平台（推荐）

启动管理平台后，可以通过 Web 界面轻松管理所有内容：

1. **首页内容** - 编辑个人信息、技能栈、项目列表
2. **创建文档** - 选择分类、填写标题、编写内容
3. **发布碎碎念** - 记录想法，支持标签和时间戳
4. **管理友链** - 添加、编辑、删除友情链接
5. **Git 操作** - 提交更改并推送到 GitHub

### 方式二：手动编辑文件

#### 1. 添加知识库文档

```bash
# 创建新分类
mkdir -p _docs/database

# 创建文档
touch _docs/database/mysql-optimization.md
```

编辑文档：

```markdown
---
layout: doc
title: MySQL 性能优化
category: 数据库
date: 2025-12-15
tags: [MySQL, 数据库, 性能优化]
---

## 索引优化

内容以二级标题开始，会自动生成目录...

## 查询优化

更多内容...
```

#### 2. 添加碎碎念

编辑 `_data/thoughts.yml`：

```yaml
- datetime: '2025-12-15 14:30'
  content: 今天完成了博客系统的重构，感觉很有成就感！
  tags:
    - 编程
    - 思考
```

#### 3. 添加友链

编辑 `_data/links.yml`：

```yaml
- name: 朋友的博客
  url: https://friend.com
  description: 一个有趣的技术博客
  avatar: https://example.com/avatar.jpg
```

#### 4. 创建新页面

在 `pages/` 目录下创建 Markdown 文件：

```markdown
---
layout: page
title: 关于
permalink: /about.html
---

# 关于我

这里是关于页面的内容...
```

## 🎨 自定义配置

### 网站基础配置

编辑 `_config.yml`：

```yaml
title: 我的个人主页
description: 个人主页 & 知识库
url: https://doc.lmzfly.xyz
baseurl: ""  # 子目录部署时填写，如 /blog

github_url: https://github.com/yourusername

# 页脚配置
footer_text: "© 2024 我的博客. All rights reserved."
footer_powered_by: true
footer_powered_by_text: "Powered by"
footer_powered_by_name: "Jekyll"
footer_powered_by_link: "https://jekyllrb.com/"
```

### 导航菜单

编辑 `_includes/header.html` 添加或修改导航链接：

```html
<ul class="nav-menu">
  <li><a href="/">首页</a></li>
  <li><a href="/docs.html">知识库</a></li>
  <li><a href="/thoughts.html">碎碎念</a></li>
  <li><a href="/links.html">友链</a></li>
  <li><a href="/about.html">关于</a></li>
</ul>
```

### 样式自定义

主样式文件：`assets/css/style.css`

- 渐变色主题色：`#667eea` → `#764ba2`
- 支持自定义颜色、字体、间距等
- 完整的响应式断点设置

## 🚀 部署到 GitHub Pages

### 1. 创建仓库

在 GitHub 创建新仓库：
- 使用自定义域名：仓库名任意
- 使用 GitHub 域名：仓库名为 `用户名.github.io`

### 2. 推送代码

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 3. 配置 GitHub Pages
> https://github.com/en-o/blog/settings/pages
1. 进入仓库 Settings → Pages
2. Source 选择 `main` 分支
3. 保存后等待部署完成

### 4. 自定义域名（可选）

#### 使用 GitHub 域名

删除 `CNAME` 文件，网站将部署到 `用户名.github.io`

#### 使用自定义域名

1. 编辑 `CNAME` 文件，填入你的域名：
   ```
   doc.lmzfly.xyz
   ```

2. 在域名提供商处添加 DNS 记录：
   ```
   类型: CNAME
   主机记录: www (或 @)
   记录值: 用户名.github.io
   ```

3. 等待 DNS 生效（可能需要几分钟到几小时）

## 🛠️ 进阶使用

### 布局类型

| 布局        | 用途   | 特点                |
| --------- | ---- | ----------------- |
| `default` | 基础布局 | 包含头部、页脚           |
| `page`    | 普通页面 | 继承 default，内容直接显示 |
| `doc`     | 文档页面 | 包含目录、标签、日期等元数据    |

### 创建自定义布局

在 `_layouts/` 创建新布局文件：

```html
<!-- _layouts/custom.html -->
---
layout: default
---

<div class="custom-wrapper">
  {{ content }}
</div>
```

### 使用 Liquid 模板

Jekyll 使用 Liquid 模板引擎，支持变量、循环、条件等：

```liquid
{% for doc in site.docs %}
  <h2>{{ doc.title }}</h2>
  <p>{{ doc.excerpt }}</p>
{% endfor %}
```

## 用当前作为模板创建自己的
1. 跟这上面的说明启动项目，然后在可视化编辑中编辑信息
2. 删除我的提交记录
```shell
   git checkout --orphan temp
   git add . && git commit -m init
   git branch -D main
   git branch -m temp main
   git push --force
```

## 📦 技术栈

- **前端框架**: Jekyll 4.3
- **样式**: 原生 CSS（渐变、毛玻璃效果）
- **管理后台**: Node.js + Express
- **模板引擎**: Liquid
- **数据格式**: YAML
- **部署**: GitHub Pages

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- Jekyll 社区
- GitHub Pages
- 所有贡献者

---

如有问题，欢迎提 [Issue](https://github.com/en-o/blog/issues) 或访问[在线预览](http://doc.lmzfly.xyz/)查看效果。
