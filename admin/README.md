# Jekyll Blog 管理平台

可视化管理 Jekyll 博客的内容管理平台，支持页面管理、文档管理、数据管理和 Git 操作。

## 特性

- 📝 **页面管理** - 可视化新增、编辑、删除页面
- 📚 **文档管理** - 管理知识库文档，支持分类
- 💾 **数据管理** - 管理友链和碎碎念数据
- 🔄 **Git 集成** - 查看状态、提交更改、推送到 GitHub
- 🚫 **隔离部署** - 管理平台不会被发布到 GitHub Pages

## 安装

### 1. 进入 admin 目录

```bash
cd admin
```

### 2. 安装依赖

```bash
npm install
```

## 运行

### 启动管理平台

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

启动后访问：http://localhost:3001

## 功能说明

### 1. 页面管理

**新增页面：**
1. 填写页面路径（相对于 `pages/` 目录）
   - 单个页面：`about.md`
   - 子目录页面：`projects/project-a.md`
2. 填写标题、Permalink、布局
3. 编写 Markdown 内容
4. 点击"保存页面"

**编辑页面：**
- 在页面列表中点击"编辑"按钮
- 修改内容后点击"保存页面"

**删除页面：**
- 在页面列表中点击"删除"按钮
- 确认删除操作

### 2. 文档管理

**新增文档：**
1. 填写分类（如：frontend, backend）
2. 填写文件名（如：react-tutorial.md）
3. 填写标题、日期、标签
4. 编写 Markdown 内容
5. 点击"保存文档"

**编辑文档：**
- 在文档列表中点击"编辑"按钮
- 修改内容后点击"保存文档"

**删除文档：**
- 在文档列表中点击"删除"按钮
- 确认删除操作

### 3. 数据管理

**友链管理：**
1. 填写友链表单
   - 名称：朋友的名字或网站名
   - 链接：网站 URL
   - 描述：一句话介绍
   - 头像链接：头像图片 URL（可选）
2. 点击"添加友链"
3. 可以编辑或删除现有友链

**碎碎念管理：**
1. 填写碎碎念表单
   - 日期：选择日期
   - 内容：记录想法
   - 标签：多个标签用逗号分隔
2. 点击"添加碎碎念"
3. 可以编辑或删除现有碎碎念
4. 新添加的碎碎念会显示在最前面

### 4. Git 操作

**查看状态：**
- 自动显示已修改、已删除、新增、已暂存的文件

**提交并推送：**
1. 填写提交信息
2. 确认分支名称（默认：main）
3. 点击"提交并推送到 GitHub"
4. 确认操作

**提交记录：**
- 查看最近 10 条提交记录

## API 接口

管理平台提供以下 REST API：

### 页面管理

```
GET    /api/pages              # 获取所有页面
GET    /api/pages/:path        # 获取单个页面
POST   /api/pages              # 创建页面
PUT    /api/pages/:path        # 更新页面
DELETE /api/pages/:path        # 删除页面
```

### 文档管理

```
GET    /api/docs                      # 获取所有文档
GET    /api/docs/categories           # 获取分类列表
GET    /api/docs/:category/:filename  # 获取单个文档
POST   /api/docs                      # 创建文档
PUT    /api/docs/:category/:filename  # 更新文档
DELETE /api/docs/:category/:filename  # 删除文档
```

### 数据管理

```
GET    /api/data/links      # 获取友链
PUT    /api/data/links      # 更新友链
GET    /api/data/thoughts   # 获取碎碎念
PUT    /api/data/thoughts   # 更新碎碎念
```

### Git 操作

```
GET    /api/git/status            # 获取 Git 状态
GET    /api/git/log               # 获取提交记录
POST   /api/git/commit            # 提交更改
POST   /api/git/push              # 推送到远程
POST   /api/git/commit-and-push   # 一键提交并推送
```

## 安全提示

### 本地使用

管理平台仅供本地使用，不应暴露到公网。

### GitHub Pages 排除

管理平台已在 `_config.yml` 中被排除：

```yaml
exclude:
  - admin/    # 不会被 Jekyll 构建和发布
```

### Git 凭证

确保已配置 Git 凭证，以便推送到 GitHub：

```bash
# 配置用户名和邮箱
git config user.name "Your Name"
git config user.email "your@email.com"

# 配置凭证缓存（可选）
git config credential.helper store
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JavaScript
- **依赖**:
  - `gray-matter` - 解析 Markdown Front Matter
  - `simple-git` - Git 操作
  - `js-yaml` - YAML 数据处理

## 常见问题

### Q: 启动失败，端口被占用？

A: 修改 `server.js` 中的 `PORT` 常量：

```javascript
const PORT = 3002; // 改为其他端口
```

### Q: Git 推送失败？

A: 检查：
1. 是否配置了 Git 凭证
2. 是否有推送权限
3. 网络连接是否正常

### Q: 中文乱码？

A: 所有文件已使用 UTF-8 编码，如遇乱码请检查编辑器编码设置。

### Q: 如何备份数据？

A: 所有数据都存储在 Jekyll 项目文件中，定期使用 Git 提交即可备份。

## 开发

### 项目结构

```
admin/
├── server.js           # Express 服务器
├── package.json        # 依赖配置
├── routes/             # API 路由
│   ├── pages.js        # 页面管理
│   ├── docs.js         # 文档管理
│   ├── data.js         # 数据管理
│   └── git.js          # Git 操作
└── public/             # 前端文件
    ├── index.html      # 管理界面
    └── app.js          # 前端逻辑
```

### 添加新功能

1. 在 `routes/` 目录添加新路由
2. 在 `server.js` 中注册路由
3. 在 `public/index.html` 添加 UI
4. 在 `public/app.js` 添加逻辑

## License

MIT
